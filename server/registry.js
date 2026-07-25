import crypto from 'node:crypto';
import { get, list, put } from '@vercel/blob';
import seed from '../data/seed.js';
import { blobAuthOptions } from './blob-auth.js';

const LEGACY_REGISTRY_PATH = 'registry/state.json';
const EVENTS_PREFIX = 'events/';
const ACCESS = 'private';
const LIST_LIMIT = 1000;
const READ_CONCURRENCY = 12;

function clone(value) {
  return structuredClone(value);
}

function blobOptions(extra = {}) {
  return { access: ACCESS, ...blobAuthOptions(), ...extra };
}

function isMissingBlobError(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || code.includes('notfound') || code.includes('not_found') || message.includes('not found') || message.includes('does not exist');
}

export function classifyStorageError(error) {
  const name = String(error?.name || error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  if (status === 401 || status === 403 || /unauthor|forbidden|credential|token|oidc|access/.test(message)) {
    return {
      code: 'BLOB_AUTH',
      message: 'Le Blob Store n’autorise pas ce déploiement. Vérifie la connexion du projet au store, puis redéploie.',
    };
  }
  if (/private|public|access mode|access.*mismatch/.test(message)) {
    return {
      code: 'BLOB_ACCESS_MODE',
      message: 'Le mode du Blob Store ne correspond pas au site. Le store doit être Private.',
    };
  }
  if (status === 404 || /store.*not found|unknown store/.test(message)) {
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

export function blobConfigurationStatus() {
  return {
    hasToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasStoreId: Boolean(process.env.BLOB_STORE_ID),
    access: ACCESS,
    storageModel: 'append-only-events',
  };
}

async function readJsonBlob(pathname) {
  try {
    const result = await get(pathname, blobOptions({ useCache: false }));
    if (!result || result.statusCode === 404) return null;
    if (result.statusCode !== 200 || !result.stream) {
      throw new Error(`Lecture Blob inattendue pour ${pathname} (statut ${result.statusCode || 'inconnu'}).`);
    }
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (error) {
    if (isMissingBlobError(error)) return null;
    throw error;
  }
}

async function readLegacyBase() {
  try {
    const legacy = await readJsonBlob(LEGACY_REGISTRY_PATH);
    if (legacy && Array.isArray(legacy.gifts)) return legacy;
  } catch (error) {
    // Le fichier historique n'est plus utilisé pour les écritures. S'il est
    // illisible, la liste repart proprement du seed embarqué dans le dépôt.
    console.warn('LEGACY_REGISTRY_IGNORED', String(error?.message || error));
  }
  return clone(seed);
}

async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({
      ...blobAuthOptions(),
      prefix,
      limit: LIST_LIMIT,
      ...(cursor ? { cursor } : {}),
    });
    blobs.push(...(page?.blobs || []));
    cursor = page?.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()));
  return results;
}

async function readEvents() {
  const blobs = await listAll(EVENTS_PREFIX);
  const events = await mapLimit(blobs, READ_CONCURRENCY, async (blob) => {
    try {
      const event = await readJsonBlob(blob.pathname);
      return event ? { ...event, _pathname: blob.pathname } : null;
    } catch (error) {
      // Un événement isolé corrompu ne doit jamais rendre toute la liste indisponible.
      console.error('EVENT_READ_IGNORED', blob.pathname, error);
      return null;
    }
  });
  return events
    .filter(Boolean)
    .sort((left, right) => {
      const byDate = String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
      return byDate || String(left._pathname).localeCompare(String(right._pathname));
    });
}

function upsertById(items, value) {
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) items[index] = value;
  else items.push(value);
}

function applyEvent(state, event) {
  switch (event.kind) {
    case 'gift.upsert':
      if (event.gift?.id) upsertById(state.gifts, clone(event.gift));
      break;
    case 'gift.delete':
      state.gifts = state.gifts.filter((gift) => gift.id !== event.entityId);
      break;
    case 'settings.update':
      state.settings = { ...state.settings, ...clone(event.settings || {}) };
      break;
    case 'commitment.upsert':
      if (event.commitment?.id) upsertById(state.commitments, clone(event.commitment));
      break;
    case 'commitment.delete':
      state.commitments = state.commitments.filter((item) => item.id !== event.entityId);
      break;
    case 'contact.upsert':
      if (event.contact?.id) upsertById(state.contacts, clone(event.contact));
      break;
    case 'contact.delete':
      state.contacts = state.contacts.filter((item) => item.id !== event.entityId);
      break;
    default:
      break;
  }
  if (event.createdAt && String(event.createdAt) > String(state.updatedAt || '')) {
    state.updatedAt = event.createdAt;
  }
}

function normalizeState(input) {
  const state = clone(input || seed);
  state.gifts = Array.isArray(state.gifts) ? state.gifts : [];
  state.commitments = Array.isArray(state.commitments) ? state.commitments : [];
  state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
  state.settings = state.settings && typeof state.settings === 'object' ? state.settings : clone(seed.settings);
  state.updatedAt = state.updatedAt || new Date().toISOString();
  return state;
}

function recalculateAllGifts(state) {
  const giftIds = new Set(state.commitments.map((item) => item.giftId).filter(Boolean));
  for (const giftId of giftIds) recalculateGiftFromCommitments(state, giftId);
}

export async function readRegistry() {
  const [base, events] = await Promise.all([readLegacyBase(), readEvents()]);
  const state = normalizeState(base);
  for (const event of events) applyEvent(state, event);
  recalculateAllGifts(state);
  return { state, etag: null };
}

function stableJson(value) {
  return JSON.stringify(value);
}

function changed(left, right) {
  return stableJson(left) !== stableJson(right);
}

function byId(items) {
  return new Map((items || []).map((item) => [item.id, item]));
}

function eventPath(scope, entityId, createdAt) {
  const safeId = String(entityId || 'global').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
  return `${EVENTS_PREFIX}${scope}/${safeId}/${stamp}-${crypto.randomUUID()}.json`;
}

async function writeEvent(scope, entityId, payload) {
  const createdAt = new Date().toISOString();
  const event = { version: 1, createdAt, ...payload };
  const pathname = eventPath(scope, entityId, createdAt);
  await put(pathname, JSON.stringify(event), blobOptions({
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
  }));
  return event;
}

function collectEntityEvents(beforeItems, afterItems, kindPrefix, fieldName, scope) {
  const writes = [];
  const before = byId(beforeItems);
  const after = byId(afterItems);
  for (const [id, value] of after) {
    if (!before.has(id) || changed(before.get(id), value)) {
      writes.push(writeEvent(scope, id, {
        kind: `${kindPrefix}.upsert`,
        entityId: id,
        [fieldName]: clone(value),
      }));
    }
  }
  for (const id of before.keys()) {
    if (!after.has(id)) {
      writes.push(writeEvent(scope, id, {
        kind: `${kindPrefix}.delete`,
        entityId: id,
      }));
    }
  }
  return writes;
}

async function persistDiff(before, after) {
  const writes = [
    ...collectEntityEvents(before.gifts, after.gifts, 'gift', 'gift', 'gifts'),
    ...collectEntityEvents(before.commitments, after.commitments, 'commitment', 'commitment', 'commitments'),
    ...collectEntityEvents(before.contacts, after.contacts, 'contact', 'contact', 'contacts'),
  ];
  if (changed(before.settings, after.settings)) {
    writes.push(writeEvent('settings', 'current', {
      kind: 'settings.update',
      entityId: 'current',
      settings: clone(after.settings),
    }));
  }
  await Promise.all(writes);
}

export async function updateRegistry(mutator) {
  const { state } = await readRegistry();
  const before = clone(state);
  const draft = clone(state);
  const result = await mutator(draft);
  draft.updatedAt = new Date().toISOString();
  await persistDiff(before, draft);
  return { state: draft, result };
}

export function publicState(state) {
  const { whatsappGroups: _privateWhatsappGroups, ...publicSettings } = state.settings || {};
  const gifts = state.gifts
    .filter((gift) => gift.visible !== false && gift.status !== 'hidden')
    .map((gift) => ({ ...gift }));
  const activeGifts = gifts.filter((gift) => gift.status === 'available' || (gift.collected > 0 && gift.collected < gift.price));
  const funded = gifts.filter((gift) => ['funded', 'reserved', 'purchased'].includes(gift.status) || gift.collected >= gift.price).length;
  const totalCollected = gifts.reduce((sum, gift) => sum + Number(gift.collected || 0), 0);
  return {
    gifts,
    settings: publicSettings,
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
  if (!gift || gift.status === 'hidden') return;
  const active = state.commitments
    .filter((item) => item.giftId === giftId && item.status !== 'cancelled')
    .sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')) || String(left.id).localeCompare(String(right.id)));
  const promised = active.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  gift.collected = Math.min(Math.max(0, promised), Number(gift.price || 0));
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
