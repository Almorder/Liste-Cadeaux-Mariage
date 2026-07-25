import { blobAuthDiagnostics, withBlobRequest } from '../server/blob-auth.js';
import { json, methodNotAllowed } from '../server/http.js';
import { classifyStorageError, publicState, readRegistry } from '../server/registry.js';
import seed from '../data/seed.js';

export default async function handler(request, response) {
  return withBlobRequest(request, async () => {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  try {
    const { state } = await readRegistry();
    return json(response, 200, { ...publicState(state), degradedMode: false, release: 'storage-v9-append-only' });
  } catch (error) {
    console.error('PUBLIC_REGISTRY_ERROR', error);
    const diagnostic = classifyStorageError(error);
    return json(response, 200, {
      ...publicState(structuredClone(seed)),
      degradedMode: true,
      release: 'storage-v9-append-only',
      storageCode: diagnostic.code,
      warning: diagnostic.message,
      blobDiagnostics: blobAuthDiagnostics(request),
    });
  }

  });
}
