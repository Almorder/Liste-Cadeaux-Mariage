import { createSessionToken, credentialsAreValid } from '../../server/auth.js';
import { setSessionCookie } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody } from '../../server/http.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  try {
    const body = parseJsonBody(request);
    if (!credentialsAreValid(body.email, body.password)) {
      return json(response, 401, { error: 'Identifiants incorrects. Vérifie exactement l’adresse et le mot de passe enregistrés dans Vercel.' });
    }
    const token = createSessionToken(String(body.email).trim().toLowerCase());
    setSessionCookie(response, token);
    return json(response, 200, { ok: true });
  } catch (error) {
    console.error('ADMIN_LOGIN_CONFIGURATION_ERROR', error);
    return json(response, 503, { error: String(error?.message || 'Configuration administrateur incomplète.') });
  }
}
