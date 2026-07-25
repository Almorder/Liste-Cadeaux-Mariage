import { AsyncLocalStorage } from 'node:async_hooks';

const requestAuth = new AsyncLocalStorage();

function readHeader(request, name) {
  const headers = request?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '').trim();
  return String(headers[name.toLowerCase()] || headers[name] || '').trim();
}

export function withBlobRequest(request, callback) {
  const oidcToken = readHeader(request, 'x-vercel-oidc-token') || String(process.env.VERCEL_OIDC_TOKEN || '').trim();
  return requestAuth.run({ oidcToken }, callback);
}

export function blobAuthOptions() {
  const readWriteToken = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (readWriteToken) return { token: readWriteToken };

  const storeId = String(process.env.BLOB_STORE_ID || '').trim();
  const oidcToken = String(requestAuth.getStore()?.oidcToken || '').trim();
  return {
    ...(storeId ? { storeId } : {}),
    ...(oidcToken ? { oidcToken } : {}),
  };
}

export function blobAuthDiagnostics(request) {
  return {
    storeIdPresent: Boolean(String(process.env.BLOB_STORE_ID || '').trim()),
    readWriteTokenPresent: Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()),
    oidcHeaderPresent: Boolean(readHeader(request, 'x-vercel-oidc-token')),
    oidcEnvironmentPresent: Boolean(String(process.env.VERCEL_OIDC_TOKEN || '').trim()),
    vercelEnvironment: String(process.env.VERCEL_ENV || 'unknown'),
  };
}
