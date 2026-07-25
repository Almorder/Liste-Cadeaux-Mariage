function readHeader(request, name) {
  const headers = request?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '').trim();
  return String(headers[name.toLowerCase()] || headers[name] || '').trim();
}

// Le SDK @vercel/blob 2.6.1 gère OIDC automatiquement dans les Vercel Functions.
// Il ne faut pas lui transmettre BLOB_STORE_ID ni le header OIDC comme options.
// Pour un ancien store utilisant encore un token statique, on conserve uniquement
// la compatibilité officielle via l'option `token`.
export function blobAuthOptions() {
  const readWriteToken = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  return readWriteToken ? { token: readWriteToken } : {};
}

// Conservé pour ne pas devoir modifier tous les handlers existants.
// Le callback reste exécuté dans le contexte normal de la Vercel Function,
// ce qui permet au SDK de récupérer automatiquement le jeton OIDC.
export function withBlobRequest(_request, callback) {
  return callback();
}

export function blobAuthDiagnostics(request) {
  return {
    storeIdPresent: Boolean(String(process.env.BLOB_STORE_ID || '').trim()),
    readWriteTokenPresent: Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()),
    oidcHeaderPresent: Boolean(readHeader(request, 'x-vercel-oidc-token')),
    vercelEnvironment: String(process.env.VERCEL_ENV || 'unknown'),
    authMode: process.env.BLOB_READ_WRITE_TOKEN ? 'legacy-token' : 'automatic-oidc',
  };
}
