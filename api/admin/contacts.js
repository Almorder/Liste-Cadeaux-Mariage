import { withBlobRequest } from '../../server/blob-auth.js';
import { requireAdmin } from '../../server/auth.js';
import { json, methodNotAllowed, parseJsonBody, safeError } from '../../server/http.js';
import { updateRegistry } from '../../server/registry.js';
import { cleanText } from '../../server/validation.js';

const GROUP_STATUSES = new Set(['not_created', 'link_ready', 'invitations_sent', 'active']);

function validWhatsappInviteLink(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'chat.whatsapp.com' && url.pathname.length > 1;
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  return withBlobRequest(request, async () => {
    if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH']);
    if (!requireAdmin(request)) return json(response, 401, { error: 'Connexion requise.' });

    try {
      const body = parseJsonBody(request);
      const action = cleanText(body.action, 40) || 'contact-status';

      const { state } = await updateRegistry((draft) => {
        if (action === 'group') {
          const giftId = cleanText(body.giftId, 100);
          const inviteLink = cleanText(body.inviteLink, 600);
          const groupStatus = GROUP_STATUSES.has(body.groupStatus) ? body.groupStatus : 'not_created';
          const gift = draft.gifts.find((item) => item.id === giftId);
          if (!gift) throw new Error('Cadeau introuvable.');
          if (!validWhatsappInviteLink(inviteLink)) {
            throw new Error('Le lien doit être un lien d’invitation WhatsApp commençant par https://chat.whatsapp.com/.');
          }

          draft.settings = draft.settings && typeof draft.settings === 'object' ? draft.settings : {};
          draft.settings.whatsappGroups = draft.settings.whatsappGroups && typeof draft.settings.whatsappGroups === 'object'
            ? draft.settings.whatsappGroups
            : {};
          draft.settings.whatsappGroups[giftId] = {
            inviteLink,
            status: groupStatus,
            updatedAt: new Date().toISOString(),
          };

          if (body.markContactsDone === true) {
            for (const contact of draft.contacts) {
              if (contact.giftId === giftId) contact.status = 'done';
            }
          }
          return;
        }

        const id = cleanText(body.id, 100);
        const status = body.status === 'done' ? 'done' : 'pending';
        const item = draft.contacts.find((contact) => contact.id === id);
        if (!item) throw new Error('Demande introuvable.');
        item.status = status;
      });

      return json(response, 200, { ok: true, state });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : safeError(error);
      return json(response, /introuvable|lien doit/i.test(message) ? 400 : 500, { error: message });
    }
  });
}
