import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { requireAdmin } from '../../server/auth.js';
import { blobAuthOptions, withBlobRequest } from '../../server/blob-auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';

const MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export default async function handler(request, response) {
  return withBlobRequest(request, async () => {
    if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
    if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
    try {
      const body = parseJsonBody(request);
      const match = String(body.dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match || !MIME_TYPES[match[1]]) return json(response, 400, { error: 'Format d’image non pris en charge.' });
      const buffer = Buffer.from(match[2], 'base64');
      if (!buffer.length || buffer.length > 3 * 1024 * 1024) {
        return json(response, 400, { error: 'L’image doit peser moins de 3 Mo après compression.' });
      }
      const pathname = `gift-images/${crypto.randomUUID()}.${MIME_TYPES[match[1]]}`;
      await put(pathname, buffer, {
        access: 'private',
        ...blobAuthOptions(),
        contentType: match[1],
        cacheControlMaxAge: 3600,
      });
      return json(response, 201, { ok: true, image: `blob:${pathname}` });
    } catch (error) {
      console.error('ADMIN_IMAGE_BLOB_ERROR', error);
      return json(response, 500, { error: safeError(error) });
    }
  });
}
