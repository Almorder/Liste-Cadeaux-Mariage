import { json, methodNotAllowed } from '../server/http.js';
import { adminConfigurationStatus } from '../server/auth.js';
import { blobConfigurationStatus, readRegistry } from '../server/registry.js';

function classifyBlobError(error) {
  const message = String(error?.message || error || 'Erreur inconnue');
  const lower = message.toLowerCase();
  if (lower.includes('blob_read_write_token') || lower.includes('token')) return 'TOKEN_ABSENT_OU_INVALIDE';
  if (lower.includes('private') || lower.includes('access')) return 'STORE_NON_PRIVE_OU_MAUVAIS_MODE_ACCES';
  if (lower.includes('forbidden') || lower.includes('unauthorized') || lower.includes('403') || lower.includes('401')) return 'STORE_NON_CONNECTE_AU_PROJET';
  return 'ERREUR_BLOB';
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  const admin = adminConfigurationStatus();
  const blob = blobConfigurationStatus();
  let storage = { ok: false, code: 'NON_TESTE' };
  try {
    const { state } = await readRegistry();
    storage = { ok: true, code: 'OK', giftCount: Array.isArray(state?.gifts) ? state.gifts.length : 0 };
  } catch (error) {
    storage = {
      ok: false,
      code: classifyBlobError(error),
      message: String(error?.message || 'Erreur de stockage').replace(/https?:\/\/\S+/g, '[URL masquée]'),
    };
  }
  return json(response, 200, {
    ok: storage.ok && admin.hasEmail && admin.hasPassword && admin.sessionSecretValid,
    storage,
    environment: {
      blobTokenPresent: blob.hasToken,
      adminEmailPresent: admin.hasEmail,
      adminPasswordPresent: admin.hasPassword,
      sessionSecretValid: admin.sessionSecretValid,
    },
  });
}
