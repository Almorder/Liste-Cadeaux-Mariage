import { withBlobRequest } from '../../server/blob-auth.js';
import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';
import { updateRegistry } from '../../server/registry.js';
import { cleanText } from '../../server/validation.js';

export default async function handler(request, response) {
  return withBlobRequest(request, async () => {
  if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH']);
  if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
  try {
    const body = parseJsonBody(request);
    const id = cleanText(body.id, 100);
    const status = body.status === 'done' ? 'done' : 'pending';
    const { state } = await updateRegistry((draft) => {
      const item = draft.contacts.find((contact) => contact.id === id);
      if (!item) throw new Error('Demande introuvable.');
      item.status = status;
    });
    return json(response, 200, { ok: true, state });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : safeError(error);
    return json(response, /introuvable/i.test(message) ? 400 : 500, { error: message });
  }

  });
}
