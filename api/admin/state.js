import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed, safeError } from '../../server/http.js';
import { readRegistry } from '../../server/registry.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
  try {
    const { state } = await readRegistry();
    return json(response, 200, state);
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: safeError(error) });
  }
}
