import { get } from '@vercel/blob';
import { Readable } from 'node:stream';
import { blobAuthOptions, withBlobRequest } from '../server/blob-auth.js';

export default async function handler(request, response) {
  return withBlobRequest(request, async () => {
    if (request.method !== 'GET') {
      response.status(405).end('Méthode non autorisée.');
      return;
    }
    const pathname = String(request.query?.path || '');
    if (!pathname.startsWith('gift-images/') || pathname.includes('..')) {
      response.status(400).end('Chemin invalide.');
      return;
    }
    try {
      const result = await get(pathname, { access: 'private', ...blobAuthOptions() });
      if (!result || result.statusCode !== 200 || !result.stream) {
        response.status(404).end('Image introuvable.');
        return;
      }
      response.status(200);
      response.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
      response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      Readable.fromWeb(result.stream).pipe(response);
    } catch (error) {
      console.error('PUBLIC_IMAGE_BLOB_ERROR', error);
      response.status(404).end('Image introuvable.');
    }
  });
}
