import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed } from '../../server/http.js';
import { classifyStorageError, readRegistry } from '../../server/registry.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
  try {
    const { state } = await readRegistry();
    return json(response, 200, { ...state, release: 'storage-v4' });
  } catch (error) {
    console.error('ADMIN_STATE_STORAGE_ERROR', error);
    const diagnostic = classifyStorageError(error);
    return json(response, 500, { error: diagnostic.message, code: diagnostic.code });
  }
}
