import crypto from 'node:crypto';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../server/http.js';
import { updateRegistry } from '../server/registry.js';
import { cleanMultiline, cleanText, validateGuestIdentity, validateHoneypot } from '../server/validation.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  try {
    const body = parseJsonBody(request);
    validateHoneypot(body);
    const identity = validateGuestIdentity(body);
    const giftId = cleanText(body.giftId, 100);
    const message = cleanMultiline(body.message, 700);

    await updateRegistry((draft) => {
      const gift = draft.gifts.find((item) => item.id === giftId);
      if (!gift) throw new Error('Ce cadeau est introuvable.');
      draft.contacts.push({
        id: crypto.randomUUID(),
        giftId,
        ...identity,
        message,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    });

    return json(response, 201, { ok: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Envoi impossible.';
    const status = /introuvable|renseigner|refusé|instant/i.test(message) ? 400 : 500;
    return json(response, status, { error: status === 500 ? safeError(error) : message });
  }
}
