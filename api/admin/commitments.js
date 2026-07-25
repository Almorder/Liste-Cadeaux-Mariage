import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';
import { recalculateGiftFromCommitments, updateRegistry } from '../../server/registry.js';
import { cleanText, finiteMoney } from '../../server/validation.js';

export default async function handler(request, response) {
  if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH']);
  if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });
  try {
    const body = parseJsonBody(request);
    const id = cleanText(body.id, 100);
    const allowed = new Set(['promised', 'received', 'cancelled']);
    const { state } = await updateRegistry((draft) => {
      const item = draft.commitments.find((commitment) => commitment.id === id);
      if (!item) throw new Error('Participation introuvable.');
      if (allowed.has(body.status)) item.status = body.status;
      if (body.amount !== undefined) {
        const amount = finiteMoney(body.amount);
        if (amount === null || amount < 0) throw new Error('Montant invalide.');
        item.amount = amount;
      }
      recalculateGiftFromCommitments(draft, item.giftId);
    });
    return json(response, 200, { ok: true, state });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Modification impossible.';
    return json(response, /introuvable|invalide/i.test(message) ? 400 : 500, { error: message || safeError(error) });
  }
}
