import { BlobPreconditionFailedError, get, head, put } from '@vercel/blob';
import seed from '../data/seed.js';
import { blobAuthOptions } from './blob-auth.js';

const REGISTRY_PATH = 'registry/state.json';
const ACCESS = 'private';

function cloneSeed() {
  const value = structuredClone(seed);
  value.updatedAt = new Date().toISOString();
  return value;
}

function blobOptions(extra = {}) {
  // Ne pas forcer de credential ici : le SDK choisit automatiquement
  // l'OIDC Vercel moderne ou BLOB_READ_WRITE_TOKEN pour les anciens stores.
  return { access: ACCESS, ...blobAuthOptions(), ...extra };
}

export function classifyStorageError(error) {
  const name = String(error?.name || error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  if (status === 401 || status === 403 || /unauthor|forbidden|credential|token|oidc|access/.test(message)) {
    return {
      code: 'BLOB_AUTH',
      message: 'Le Blob Store n’autorise pas encore ce déploiement. Connecte le projet au store ou active OIDC, puis redéploie.',
    };
  }
  if (/private|public|access mode|access.*mismatch/.test(message)) {
    return {
      code: 'BLOB_ACCESS_MODE',
      message: 'Le mode du Blob Store ne correspond pas au site. Le store doit être créé en mode Private.',
    };
  }
  if (status === 404 || /store.*not found|does not exist|unknown store/.test(message)) {
    return {
      code: 'BLOB_NOT_CONNECTED',
      message: 'Aucun Blob Store utilisable n’est connecté à ce projet Vercel en Production.',
    };
  }
  return {
    code: name || 'BLOB_UNKNOWN',
    message: 'Le stockage Vercel Blob est inaccessible. Consulte les logs de la Function concernée dans Vercel.',
  };
}

function isPreconditionFailedError(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    error instanceof BlobPreconditionFailedError ||
    status === 412 ||
    code.includes('precondition') ||
    code.includes('etag') ||
    message.includes('precondition failed') ||
    message.includes('etag mismatch') ||
    message.includes('etag does not match')
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isMissingBlobError(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || code.includes('notfound') || code.includes('not_found') || message.includes('not found') || message.includes('does not exist');
}

export function blobConfigurationStatus() {
  return {
    hasToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasStoreId: Boolean(process.env.BLOB_STORE_ID),
    access: ACCESS,
    registryPath: REGISTRY_PATH,
  };
}

async function readRegistryBlob(attempts = 5) {
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      // `useCache: false` garantit que le JSON lu vient de l'origine Blob.
      // Pour l'écriture conditionnelle, Vercel recommande de récupérer l'ETag
      // canonique avec `head()` plutôt que de dépendre uniquement de la réponse GET.
      const result = await get(REGISTRY_PATH, blobOptions({ useCache: false }));
      if (!result || result.statusCode === 404) return null;
      if (result.statusCode !== 200 || !result.stream) {
        throw new Error(`Lecture Blob inattendue (statut ${result.statusCode || 'inconnu'}).`);
      }

      const text = await new Response(result.stream).text();
      const metadata = await head(REGISTRY_PATH, blobAuthOptions());
      const getEtag = result.blob?.etag || null;
      const headEtag = metadata?.etag || null;

      // Dans le cas très rare où la ressource change entre GET et HEAD,
      // on relit jusqu'à obtenir un contenu et un ETag de la même version.
      if (getEtag && headEtag && getEtag !== headEtag) {
        const backoff = 40 * (attempt + 1) + Math.floor(Math.random() * 40);
        console.warn('REGISTRY_READ_VERSION_CHANGED', {
          attempt: attempt + 1,
          attempts,
          backoff,
        });
        await sleep(backoff);
        continue;
      }

      return {
        state: JSON.parse(text),
        etag: headEtag || getEtag,
      };
    }

    const conflict = new Error('Impossible de lire une version stable de la liste. Merci de réessayer.');
    conflict.code = 'REGISTRY_READ_CONFLICT';
    throw conflict;
  } catch (error) {
    if (isMissingBlobError(error)) return null;
    throw error;
  }
}

async function initializeRegistry() {
  const state = cloneSeed();
  try {
    const blob = await put(REGISTRY_PATH, JSON.stringify(state), blobOptions({
      contentType: 'application/json; charset=utf-8',
      cacheControlMaxAge: 60,
      addRandomSuffix: false,
      allowOverwrite: false,
    }));
    return { state, etag: blob?.etag || null };
  } catch (error) {
    // Une autre fonction a pu initialiser le fichier entre-temps.
    const existing = await readRegistryBlob();
    if (existing) return existing;
    throw error;
  }
}

export async function readRegistry() {
  // Compatible avec les deux modes Vercel : ancien token statique et OIDC.
  // Le SDK gère l'authentification OIDC automatiquement dans les Functions.
  return (await readRegistryBlob()) || initializeRegistry();
}

async function writeRegistry(state, etag) {
  state.updatedAt = new Date().toISOString();
  return put(REGISTRY_PATH, JSON.stringify(state), blobOptions({
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(etag ? { ifMatch: etag } : {}),
  }));
}

export async function updateRegistry(mutator, attempts = 12) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { state, etag } = await readRegistry();
    const draft = structuredClone(state);
    const result = await mutator(draft);
    try {
      await writeRegistry(draft, etag);
      return { state: draft, result };
    } catch (error) {
      if (!isPreconditionFailedError(error)) throw error;

      lastError = error;
      // Une autre Function a écrit entre notre lecture et notre écriture.
      // On relit l'état le plus récent puis on rejoue la mutation.
      const backoff = Math.min(1200, 60 * (2 ** attempt)) + Math.floor(Math.random() * 90);
      console.warn('REGISTRY_ETAG_CONFLICT_RETRY', {
        attempt: attempt + 1,
        attempts,
        backoff,
      });
      await sleep(backoff);
    }
  }

  const conflict = new Error('La liste vient d’être modifiée par une autre personne. Merci de réessayer dans un instant.');
  conflict.code = 'REGISTRY_WRITE_CONFLICT';
  conflict.cause = lastError;
  throw conflict;
}

export function publicState(state) {
  const gifts = state.gifts.filter((gift) => gift.visible !== false && gift.status !== 'hidden').map((gift) => ({ ...gift }));
  const activeGifts = gifts.filter((gift) => ['available'].includes(gift.status) || (gift.collected > 0 && gift.collected < gift.price));
  const funded = gifts.filter((gift) => ['funded', 'reserved', 'purchased'].includes(gift.status) || gift.collected >= gift.price).length;
  const totalCollected = gifts.reduce((sum, gift) => sum + Number(gift.collected || 0), 0);
  return {
    gifts,
    settings: state.settings,
    stats: {
      total: gifts.length,
      available: activeGifts.length,
      funded,
      totalCollected,
    },
    updatedAt: state.updatedAt,
  };
}

export function recalculateGiftFromCommitments(state, giftId) {
  const gift = state.gifts.find((item) => item.id === giftId);
  if (!gift) return;
  const active = state.commitments.filter((item) => item.giftId === giftId && item.status !== 'cancelled');
  const collected = active.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  gift.collected = Math.min(Math.max(0, collected), Number(gift.price || 0));
  gift.participantCount = active.length;
  const purchased = active.some((item) => item.mode === 'full' && item.intent === 'purchased');
  const reserved = active.some((item) => item.mode === 'full' && item.intent !== 'purchased');
  if (purchased) gift.status = 'purchased';
  else if (reserved) gift.status = 'reserved';
  else if (gift.price > 0 && gift.collected >= gift.price) gift.status = 'funded';
  else gift.status = 'available';
}

export function activeVariant(state, variantGroup) {
  if (!variantGroup) return null;
  return state.gifts.find((gift) => gift.variantGroup === variantGroup && (gift.collected > 0 || gift.status !== 'available')) || null;
}
