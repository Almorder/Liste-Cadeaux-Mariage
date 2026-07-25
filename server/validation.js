export function cleanText(value, maxLength = 300) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function cleanMultiline(value, maxLength = 3000) {
  return String(value ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function validPhone(value) {
  const phone = cleanText(value, 30);
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 16 ? phone : null;
}

export function finiteMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100) / 100;
}

export function validateGuestIdentity(body) {
  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const phone = validPhone(body.phone);
  if (!firstName || !lastName || !phone) throw new Error('Merci de renseigner un nom, un prénom et un numéro de téléphone valide.');
  return { firstName, lastName, phone };
}

export function validateHoneypot(body) {
  if (cleanText(body.website, 200)) throw new Error('Envoi refusé.');
  const startedAt = Number(body.startedAt || 0);
  if (startedAt && Date.now() - startedAt < 1200) throw new Error('Merci de prendre un instant avant de valider.');
}

export function normalizeGift(input, existing = {}) {
  const allowedStatuses = new Set(['available', 'reserved', 'funded', 'purchased', 'hidden']);
  const gift = {
    ...existing,
    id: cleanText(input.id || existing.id || `gift-${Date.now()}`, 100),
    sourceRow: Number(input.sourceRow || existing.sourceRow || 0),
    name: cleanText(input.name, 180),
    brand: cleanText(input.brand, 120),
    category: cleanText(input.category, 100) || 'Autres',
    beneficiary: ['Myriam', 'Nolan', 'Les deux'].includes(input.beneficiary) ? input.beneficiary : 'Les deux',
    priority: ['Haute', 'Moyenne', 'Basique'].includes(input.priority) ? input.priority : 'Moyenne',
    price: finiteMoney(input.price),
    priceLabel: cleanText(input.priceLabel, 100),
    officialPrice: cleanText(input.officialPrice, 150),
    size: cleanText(input.size, 150),
    material: cleanText(input.material, 180),
    quantity: Math.max(1, Math.round(Number(input.quantity || 1))),
    description: cleanMultiline(input.description, 1800),
    url: cleanText(input.url, 1200),
    variantGroup: cleanText(input.variantGroup, 100),
    collectiveEnabled: Boolean(input.collectiveEnabled),
    featured: Boolean(input.featured),
    image: cleanText(input.image, 1800),
    status: allowedStatuses.has(input.status) ? input.status : (existing.status || 'available'),
    collected: Math.max(0, finiteMoney(input.collected ?? existing.collected ?? 0) || 0),
    visible: input.visible !== false,
    participantCount: Math.max(0, Math.round(Number(input.participantCount ?? existing.participantCount ?? 0))),
  };
  if (!gift.id || !gift.name || gift.price === null || gift.price < 0) throw new Error('Le nom et le prix du cadeau sont obligatoires.');
  if (gift.url && !/^https:\/\//i.test(gift.url)) throw new Error('Le lien du produit doit commencer par https://');
  if (gift.image && !gift.image.startsWith('blob:') && !gift.image.startsWith('data:') && !/^https:\/\//i.test(gift.image)) {
    throw new Error('L’image doit être une URL HTTPS ou une image importée.');
  }
  gift.collected = gift.price > 0 ? Math.min(gift.collected, gift.price) : 0;
  return gift;
}
