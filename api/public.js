import { json, methodNotAllowed, safeError } from '../server/http.js';
import { publicState, readRegistry } from '../server/registry.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  try {
    const { state } = await readRegistry();
    return json(response, 200, publicState(state));
  } catch (error) {
    console.error(error);
    return json(response, 503, {
      error: 'La liste n’est pas encore connectée à son stockage privé.',
      setupRequired: true,
      details: safeError(error),
    });
  }
}
