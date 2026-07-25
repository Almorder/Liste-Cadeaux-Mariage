import { clearSessionCookie } from '../../server/auth.js';
import { json, methodNotAllowed } from '../../server/http.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  clearSessionCookie(response);
  return json(response, 200, { ok: true });
}
