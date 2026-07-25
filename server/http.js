export function json(response, status, payload, extraHeaders = {}) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) response.setHeader(key, value);
  return response.end(JSON.stringify(payload));
}

export function methodNotAllowed(response, methods) {
  response.setHeader('Allow', methods.join(', '));
  return json(response, 405, { error: 'Méthode non autorisée.' });
}

export function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string' && request.body.trim()) {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new Error('Le contenu envoyé n’est pas un JSON valide.');
    }
  }
  return {};
}

export function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || '';
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return request.socket?.remoteAddress || '';
}

export function safeError(error) {
  if (process.env.NODE_ENV !== 'production') return String(error?.stack || error);
  return 'Une erreur interne est survenue.';
}
