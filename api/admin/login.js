import { createSessionToken, credentialsAreValid, setSessionCookie } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  try {
    const body = parseJsonBody(request);
    if (!credentialsAreValid(body.email, body.password)) {
      return json(response, 401, { error: 'Identifiants incorrects.' });
    }
    const token = createSessionToken(String(body.email).trim().toLowerCase());
    setSessionCookie(response, token);
    return json(response, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: safeError(error) });
  }
}
