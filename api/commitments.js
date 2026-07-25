import { withBlobRequest } from '../server/blob-auth.js';
import crypto from 'node:crypto';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../server/http.js';
import { activeVariant, classifyStorageError, publicState, recalculateGiftFromCommitments, updateRegistry } from '../server/registry.js';
import { cleanMultiline, cleanText, finiteMoney, validateGuestIdentity, validateHoneypot } from '../server/validation.js';

export default async function handler(request, response) {
  return withBlobRequest(request, async () => {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  try {
    const body = parseJsonBody(request);
    validateHoneypot(body);
    const identity = validateGuestIdentity(body);
    const giftId = cleanText(body.giftId, 100);
    const mode = body.mode === 'full' ? 'full' : 'collective';
    const intent = body.intent === 'purchased' ? 'purchased' : 'reserved';
    const message = cleanMultiline(body.message, 700);

    const { state, result } = await updateRegistry((draft) => {
      const gift = draft.gifts.find((item) => item.id === giftId && item.visible !== false);
      if (!gift) throw new Error('Ce cadeau est introuvable.');
      const groupSelection = activeVariant(draft, gift.variantGroup);
      if (groupSelection && groupSelection.id !== gift.id) {
        throw new Error('Une autre variante de ce cadeau a déjà été choisie.');
      }
      const remaining = Math.max(0, Number(gift.price || 0) - Number(gift.collected || 0));
      if (remaining <= 0 || ['funded', 'reserved', 'purchased', 'hidden'].includes(gift.status)) {
        throw new Error('Ce cadeau a déjà été choisi ou financé.');
      }
      if (mode === 'collective' && !gift.collectiveEnabled) {
        throw new Error('Ce cadeau n’accepte pas les participations partielles.');
      }
      let amount = mode === 'full' ? remaining : finiteMoney(body.amount);
      if (amount === null || amount <= 0) throw new Error('Le montant doit être supérieur à 0 €.');
      if (amount > remaining) amount = remaining;
      const commitment = {
        id: crypto.randomUUID(),
        giftId: gift.id,
        ...identity,
        amount,
        message,
        status: 'promised',
        createdAt: new Date().toISOString(),
        mode,
        intent: mode === 'full' ? intent : 'participation',
      };
      draft.commitments.push(commitment);
      recalculateGiftFromCommitments(draft, gift.id);
      return { commitmentId: commitment.id, amount, giftName: gift.name };
    });

    return json(response, 201, {
      ok: true,
      ...result,
      public: publicState(state),
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Envoi impossible.';
    const status = /introuvable|déjà|variante|montant|renseigner|participations|refusé|instant/i.test(message) ? 400 : 500;
    if (status === 500) {
      const diagnostic = classifyStorageError(error);
      return json(response, 500, { error: diagnostic.message, code: diagnostic.code });
    }
    return json(response, status, { error: message });
  }

  });
}
