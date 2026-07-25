import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';
import { updateRegistry } from '../../server/registry.js';
import { cleanMultiline, cleanText } from '../../server/validation.js';

export default async function handler(request, response) {
  if (request.method !== 'PUT') return methodNotAllowed(response, ['PUT']);
  if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
  try {
    const body = parseJsonBody(request);
    const { state } = await updateRegistry((draft) => {
      draft.settings = {
        ...draft.settings,
        coupleName: cleanText(body.coupleName || draft.settings.coupleName, 120),
        weddingDate: cleanText(body.weddingDate || draft.settings.weddingDate, 120),
        introText: cleanMultiline(body.introText ?? draft.settings.introText, 5000),
      };
    });
    return json(response, 200, { ok: true, state });
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: safeError(error) });
  }
}
