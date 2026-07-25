import { BlobPreconditionFailedError, get, put } from '@vercel/blob';
import seed from '../data/seed.js';

const REGISTRY_PATH = 'registry/state.json';
const ACCESS = 'private';

function cloneSeed() {
  const value = structuredClone(seed);
  value.updatedAt = new Date().toISOString();
  return value;
}

function blobOptions(extra = {}) {
  // Les nouveaux projets Vercel Blob utilisent OIDC par défaut.
  // On ne transmet un token statique que lorsqu'il existe réellement ;
  // sinon le SDK récupère automatiquement le jeton OIDC de la Function.
  const options = { access: ACCESS, ...extra };
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    options.token = process.env.BLOB_READ_WRITE_TOKEN;
  }
  return options;
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
    access: ACCESS,
    registryPath: REGISTRY_PATH,
  };
}

async function readRegistryBlob() {
  try {
    const result = await get(REGISTRY_PATH, blobOptions({ useCache: false }));
    if (!result || result.statusCode === 404) return null;
    if (result.statusCode !== 200 || !result.stream) {
      throw new Error(`Lecture Blob inattendue (statut ${result.statusCode || 'inconnu'}).`);
    }
    const text = await new Response(result.stream).text();
    return {
      state: JSON.parse(text),
      etag: result.blob?.etag || null,
    };
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

export async function updateRegistry(mutator, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { state, etag } = await readRegistry();
    const draft = structuredClone(state);
    const result = await mutator(draft);
    try {
      await writeRegistry(draft, etag);
      return { state: draft, result };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('La liste a été modifiée simultanément. Merci de réessayer.');
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
