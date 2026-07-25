import { json, methodNotAllowed } from '../server/http.js';
import { publicState, readRegistry } from '../server/registry.js';
import seed from '../data/seed.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  try {
    const { state } = await readRegistry();
    return json(response, 200, { ...publicState(state), degradedMode: false });
  } catch (error) {
    console.error('PUBLIC_REGISTRY_ERROR', error);
    // La liste reste visible, mais les participations sont désactivées jusqu'à la réparation du stockage.
    return json(response, 200, {
      ...publicState(structuredClone(seed)),
      degradedMode: true,
      warning: 'La liste est visible en lecture seule, mais le stockage privé Vercel est momentanément inaccessible.',
    });
  }
}
