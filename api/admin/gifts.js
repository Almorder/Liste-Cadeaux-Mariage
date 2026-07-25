import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';
import { recalculateGiftFromCommitments, updateRegistry } from '../../server/registry.js';
import { cleanText, normalizeGift } from '../../server/validation.js';

export default async function handler(request, response) {
  if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
  try {
    if (request.method === 'PUT') {
      const body = parseJsonBody(request);
      const { state } = await updateRegistry((draft) => {
        const id = cleanText(body.id, 100);
        const index = draft.gifts.findIndex((gift) => gift.id === id);
        const existing = index >= 0 ? draft.gifts[index] : {};
        const gift = normalizeGift(body, existing);
        if (index >= 0) draft.gifts[index] = gift;
        else draft.gifts.push(gift);
        if (draft.commitments.some((item) => item.giftId === gift.id)) recalculateGiftFromCommitments(draft, gift.id);
      });
      return json(response, 200, { ok: true, state });
    }
    if (request.method === 'DELETE') {
      const id = cleanText(request.query?.id, 100);
      if (!id) return json(response, 400, { error: 'Identifiant manquant.' });
      const { state } = await updateRegistry((draft) => {
        const before = draft.gifts.length;
        draft.gifts = draft.gifts.filter((gift) => gift.id !== id);
        if (draft.gifts.length === before) throw new Error('Cadeau introuvable.');
      });
      return json(response, 200, { ok: true, state });
    }
    return methodNotAllowed(response, ['PUT', 'DELETE']);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Modification impossible.';
    const status = /obligatoires|doit commencer|introuvable|image doit|Identifiant/i.test(message) ? 400 : 500;
    return json(response, status, { error: status === 500 ? safeError(error) : message });
  }
}
