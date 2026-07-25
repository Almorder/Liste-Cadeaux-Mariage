import { PUBLIC_SEED } from './seed-public.js';

const CATEGORY_ORDER = ['Cuisson du riz', 'Accessoires riz', 'Vaisselle', 'Couverts', 'Conservation', 'Cuisine', 'Couteaux', 'Petit électroménager', 'Maison', 'Salle de bain', 'Parfums', 'Autres'];
const ICONS = {
  'Cuisson du riz': '🍚',
  'Accessoires riz': '🥢',
  Vaisselle: '🍽️',
  Couverts: '🍴',
  Conservation: '◫',
  Cuisine: '◌',
  Couteaux: '◇',
  'Petit électroménager': '⌁',
  Maison: '⌂',
  'Salle de bain': '◍',
  Parfums: '✦',
  Autres: '♡',
};

const state = {
  data: null,
  demo: false,
  selectedGiftId: null,
  filters: {
    search: '',
    availableOnly: false,
    categories: new Set(),
    beneficiaries: new Set(),
    priorities: new Set(),
    maxBudget: 500,
  },
};

const dom = {
  introGate: document.getElementById('introGate'),
  introCopy: document.getElementById('introCopy'),
  introConsent: document.getElementById('introConsent'),
  enterList: document.getElementById('enterList'),
  headerDate: document.getElementById('headerDate'),
  heroStats: document.getElementById('heroStats'),
  searchInput: document.getElementById('searchInput'),
  availableToggle: document.getElementById('availableToggle'),
  filtersToggle: document.getElementById('filtersToggle'),
  filterDrawer: document.getElementById('filterDrawer'),
  filterCount: document.getElementById('filterCount'),
  categoryFilters: document.getElementById('categoryFilters'),
  beneficiaryFilters: document.getElementById('beneficiaryFilters'),
  priorityFilters: document.getElementById('priorityFilters'),
  budgetRange: document.getElementById('budgetRange'),
  budgetValue: document.getElementById('budgetValue'),
  resetFilters: document.getElementById('resetFilters'),
  emptyReset: document.getElementById('emptyReset'),
  resultCount: document.getElementById('resultCount'),
  syncState: document.getElementById('syncState'),
  catalogContent: document.getElementById('catalogContent'),
  emptyState: document.getElementById('emptyState'),
  modalRoot: document.getElementById('modalRoot'),
  toastRegion: document.getElementById('toastRegion'),
  refreshButton: document.getElementById('refreshButton'),
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function formatMoney(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number(value) % 1 ? 2 : 0,
  }).format(Number(value || 0));
}

function formatParagraphs(text = '') {
  return String(text)
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph, index) => `<p>${index === 0 ? `<strong>${escapeHtml(paragraph)}</strong>` : escapeHtml(paragraph)}</p>`)
    .join('');
}

function statusLabel(gift) {
  if (gift.status === 'purchased') return 'Acheté';
  if (gift.status === 'reserved') return 'Réservé';
  if (gift.status === 'funded' || Number(gift.collected || 0) >= Number(gift.price || 0)) return 'Financé';
  if (Number(gift.collected || 0) > 0) return 'En cours';
  return 'Disponible';
}

function statusClass(gift) {
  if (isUnavailable(gift)) return 'closed';
  if (Number(gift.collected || 0) > 0) return 'partial';
  return 'available';
}

function isUnavailable(gift) {
  return ['funded', 'reserved', 'purchased', 'hidden'].includes(gift.status)
    || (Number(gift.price || 0) > 0 && Number(gift.collected || 0) >= Number(gift.price || 0));
}

function progress(gift) {
  if (!Number(gift.price || 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(gift.collected || 0) / Number(gift.price)) * 100)));
}

function remaining(gift) {
  return Math.max(0, Number(gift.price || 0) - Number(gift.collected || 0));
}

function placeholder(gift) {
  const icon = ICONS[gift.category] || '♡';
  const title = escapeHtml((gift.name || 'Cadeau').slice(0, 42));
  const brand = escapeHtml((gift.brand || 'Myriam & Nolan').slice(0, 30).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8e9eb"/><stop offset="1" stop-color="#ead8cf"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="745" cy="110" r="190" fill="#fff" opacity=".28"/><text x="70" y="170" font-size="68">${icon}</text><text x="70" y="465" font-family="Georgia" font-size="40" fill="#201a1c">${title}</text><text x="70" y="520" font-family="Arial" font-size="18" letter-spacing="3" fill="#7b6e71">${brand}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function imageUrl(gift) {
  if (gift.image?.startsWith('blob:')) return `/api/image?path=${encodeURIComponent(gift.image.slice(5))}`;
  if (gift.image) return gift.image;
  if (gift.url && !state.demo) return `https://api.microlink.io/?url=${encodeURIComponent(gift.url)}&embed=image.url`;
  return placeholder(gift);
}

function bindImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach((image) => {
    image.addEventListener('error', () => {
      if (image.src !== image.dataset.fallback) image.src = image.dataset.fallback;
    }, { once: true });
  });
}

function groupedItems() {
  const gifts = state.data?.gifts || [];
  const groups = state.data?.settings?.variantGroups || {};
  const used = new Set();
  const items = [];

  for (const gift of gifts) {
    if (gift.visible === false || gift.status === 'hidden') continue;
    if (gift.variantGroup && groups[gift.variantGroup]) {
      if (used.has(gift.variantGroup)) continue;
      used.add(gift.variantGroup);
      const variants = gifts.filter((candidate) => candidate.visible !== false && candidate.variantGroup === gift.variantGroup);
      const locked = variants.find((candidate) => Number(candidate.collected || 0) > 0 || candidate.status !== 'available');
      const active = locked || variants[0];
      const prices = variants.map((candidate) => Number(candidate.price || 0)).filter(Number.isFinite);
      const beneficiaries = [...new Set(variants.map((candidate) => candidate.beneficiary))];
      const priorities = [...new Set(variants.map((candidate) => candidate.priority))];
      items.push({
        kind: 'group',
        id: `group:${gift.variantGroup}`,
        groupId: gift.variantGroup,
        name: groups[gift.variantGroup].title,
        description: groups[gift.variantGroup].description,
        category: groups[gift.variantGroup].category || active.category,
        beneficiary: beneficiaries.length === 1 ? beneficiaries[0] : 'Les deux',
        priority: priorities.includes('Haute') ? 'Haute' : priorities.includes('Moyenne') ? 'Moyenne' : 'Basique',
        variants,
        active,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      });
    } else {
      items.push({
        kind: 'single',
        id: gift.id,
        name: gift.name,
        description: gift.description,
        category: gift.category,
        beneficiary: gift.beneficiary,
        priority: gift.priority,
        variants: [gift],
        active: gift,
        minPrice: Number(gift.price || 0),
        maxPrice: Number(gift.price || 0),
      });
    }
  }
  return items;
}

function itemMatches(item) {
  const { filters } = state;
  const searchable = [item.name, item.description, item.category, ...item.variants.flatMap((gift) => [gift.name, gift.brand])].join(' ').toLowerCase();
  if (filters.search && !searchable.includes(filters.search.toLowerCase())) return false;
  if (filters.availableOnly && isUnavailable(item.active)) return false;
  if (filters.categories.size && !filters.categories.has(item.category)) return false;
  if (filters.beneficiaries.size && !filters.beneficiaries.has(item.beneficiary)) return false;
  if (filters.priorities.size && !filters.priorities.has(item.priority)) return false;
  if (filters.maxBudget < 500 && !item.variants.some((gift) => Number(gift.price || 0) <= filters.maxBudget)) return false;
  return true;
}

function categorySort(a, b) {
  const ai = CATEGORY_ORDER.indexOf(a);
  const bi = CATEGORY_ORDER.indexOf(b);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b, 'fr');
}

function renderStats() {
  const gifts = state.data?.gifts?.filter((gift) => gift.visible !== false && gift.status !== 'hidden') || [];
  const grouped = groupedItems();
  const available = grouped.filter((item) => !isUnavailable(item.active)).length;
  const chosen = grouped.length - available;
  dom.heroStats.innerHTML = `
    <div><strong>${grouped.length}</strong><span>envies</span></div>
    <div><strong>${available}</strong><span>disponibles</span></div>
    <div><strong>${chosen}</strong><span>déjà choisies</span></div>`;
  if (!gifts.length) dom.heroStats.innerHTML = '<div><strong>0</strong><span>cadeau</span></div>';
}

function cardPrice(item) {
  if (item.kind === 'group') {
    if (Number(item.active.collected || 0) > 0 || item.active.status !== 'available') return formatMoney(item.active.price);
    return `dès ${formatMoney(item.minPrice)}`;
  }
  return formatMoney(item.active.price);
}

function giftCard(item) {
  const gift = item.active;
  const percent = progress(gift);
  const collective = gift.collectiveEnabled;
  const status = statusLabel(gift);
  return `
    <article class="gift-card" data-open-gift="${escapeHtml(item.id)}">
      <div class="gift-image">
        <img src="${escapeHtml(imageUrl(gift))}" data-fallback="${escapeHtml(placeholder(gift))}" alt="${escapeHtml(item.name)}" loading="lazy">
        <div class="badge-row">
          <span class="badge">${escapeHtml(item.beneficiary)}</span>
          ${item.kind === 'group' ? `<span class="badge">${item.variants.length} options</span>` : ''}
          <span class="badge status ${statusClass(gift)}">${escapeHtml(status)}</span>
        </div>
      </div>
      <div class="gift-body">
        <p class="gift-kicker">${escapeHtml(item.category)} · ${escapeHtml(item.priority)}</p>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="gift-description">${escapeHtml(item.description || gift.description || '')}</p>
        ${collective && (Number(gift.collected || 0) > 0 || isUnavailable(gift)) ? `
          <div class="progress-wrap">
            <div class="progress-label"><span>${formatMoney(gift.collected)} réunis</span><strong>${percent} %</strong></div>
            <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
          </div>` : ''}
        ${item.kind === 'group' ? `<div class="variant-note">Une seule option sera retenue. Les autres se bloquent dès qu’une variante est choisie.</div>` : ''}
        <div class="gift-meta">
          <div class="price-block"><strong>${cardPrice(item)}</strong><small>${collective ? 'Participation possible' : 'Cadeau complet'}</small></div>
          <button class="card-link" type="button" aria-label="Voir ${escapeHtml(item.name)}">↗</button>
        </div>
      </div>
    </article>`;
}

function renderCatalog() {
  const items = groupedItems().filter(itemMatches);
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  const categories = [...byCategory.keys()].sort(categorySort);
  dom.resultCount.textContent = `${items.length} ${items.length > 1 ? 'envies affichées' : 'envie affichée'}`;
  dom.emptyState.classList.toggle('hidden', items.length > 0);
  dom.catalogContent.innerHTML = categories.map((category) => `
    <section class="category-section">
      <div class="category-heading">
        <h2>${escapeHtml(category)}</h2>
        <p>${byCategory.get(category).length} ${byCategory.get(category).length > 1 ? 'envies' : 'envie'}</p>
      </div>
      <div class="gift-grid">${byCategory.get(category).map(giftCard).join('')}</div>
    </section>`).join('');
  bindImageFallbacks(dom.catalogContent);
  dom.catalogContent.querySelectorAll('[data-open-gift]').forEach((card) => {
    card.addEventListener('click', () => openGift(card.dataset.openGift));
  });
  updateFilterCount();
}

function renderFilterOptions() {
  const categories = [...new Set((state.data?.gifts || []).filter((gift) => gift.visible !== false).map((gift) => gift.category))].sort(categorySort);
  const renderChips = (container, values, key) => {
    container.innerHTML = values.map((value) => `<button class="chip" type="button" data-filter-key="${key}" data-filter-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('');
  };
  renderChips(dom.categoryFilters, categories, 'categories');
  renderChips(dom.beneficiaryFilters, ['Myriam', 'Nolan', 'Les deux'], 'beneficiaries');
  renderChips(dom.priorityFilters, ['Haute', 'Moyenne', 'Basique'], 'priorities');
  document.querySelectorAll('[data-filter-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const set = state.filters[button.dataset.filterKey];
      if (set.has(button.dataset.filterValue)) set.delete(button.dataset.filterValue);
      else set.add(button.dataset.filterValue);
      button.classList.toggle('active');
      renderCatalog();
    });
  });
}

function updateFilterCount() {
  const { filters } = state;
  const count = filters.categories.size + filters.beneficiaries.size + filters.priorities.size
    + (filters.availableOnly ? 1 : 0) + (filters.maxBudget < 500 ? 1 : 0);
  dom.filterCount.textContent = count ? `(${count})` : '';
}

function resetAllFilters() {
  state.filters.search = '';
  state.filters.availableOnly = false;
  state.filters.categories.clear();
  state.filters.beneficiaries.clear();
  state.filters.priorities.clear();
  state.filters.maxBudget = 500;
  dom.searchInput.value = '';
  dom.availableToggle.classList.remove('button-soft');
  dom.budgetRange.value = 500;
  dom.budgetValue.textContent = '500 € et +';
  document.querySelectorAll('.chip.active').forEach((button) => button.classList.remove('active'));
  renderCatalog();
}

function findItem(id) {
  return groupedItems().find((item) => item.id === id || item.variants.some((gift) => gift.id === id));
}

function openGift(itemId, selectedGiftId = null) {
  const item = findItem(itemId);
  if (!item) return;
  const locked = item.variants.find((gift) => Number(gift.collected || 0) > 0 || gift.status !== 'available');
  const gift = item.variants.find((variant) => variant.id === selectedGiftId) || locked || item.active || item.variants[0];
  state.selectedGiftId = gift.id;
  const percent = progress(gift);
  const unavailable = isUnavailable(gift);
  const variantSelector = item.kind === 'group' ? `
    <div class="variant-selector">
      <strong>Choisir une option</strong>
      <div class="variant-options">
        ${item.variants.map((variant) => `
          <button class="variant-option ${variant.id === gift.id ? 'active' : ''}" type="button" data-select-variant="${escapeHtml(variant.id)}" ${locked && locked.id !== variant.id ? 'disabled' : ''}>
            <span><strong>${escapeHtml(variant.brand || variant.name)}</strong><br><small>${escapeHtml(variant.name)}</small></span>
            <strong>${formatMoney(variant.price)}</strong>
          </button>`).join('')}
      </div>
    </div>` : '';
  const progressBlock = gift.collectiveEnabled && (Number(gift.collected || 0) > 0 || unavailable) ? `
    <div class="progress-wrap">
      <div class="progress-label"><span>${formatMoney(gift.collected)} réunis sur ${formatMoney(gift.price)}</span><strong>${percent} %</strong></div>
      <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
    </div>` : '';
  const actions = unavailable ? `
    <button class="button button-dark" data-contact-gift="${escapeHtml(gift.id)}">Demander une mise en relation</button>` : `
    ${gift.collectiveEnabled ? `<button class="button button-soft" data-participate="collective">Participer au cadeau</button>` : ''}
    <button class="button button-dark" data-participate="full">${Number(gift.collected || 0) > 0 ? `Offrir le solde · ${formatMoney(remaining(gift))}` : 'Offrir ce cadeau'}</button>`;

  dom.modalRoot.innerHTML = `
    <div class="modal-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(item.name)}">
      <div class="modal modal-wide">
        <button class="icon-button modal-close" type="button" data-close-modal aria-label="Fermer">×</button>
        <div class="product-modal-grid">
          <div class="product-modal-image"><img src="${escapeHtml(imageUrl(gift))}" data-fallback="${escapeHtml(placeholder(gift))}" alt="${escapeHtml(gift.name)}"></div>
          <div class="product-modal-content">
            <p class="eyebrow">${escapeHtml(item.category)} · ${escapeHtml(gift.brand || '')}</p>
            <h2>${escapeHtml(item.kind === 'group' ? item.name : gift.name)}</h2>
            <p>${escapeHtml(gift.description || item.description || '')}</p>
            ${variantSelector}
            <div class="detail-list">
              <div class="detail-row"><span>Prix</span><strong>${formatMoney(gift.price)}</strong></div>
              <div class="detail-row"><span>Pour</span><strong>${escapeHtml(gift.beneficiary)}</strong></div>
              <div class="detail-row"><span>Importance</span><strong>${escapeHtml(gift.priority)}</strong></div>
              ${gift.size ? `<div class="detail-row"><span>Format</span><strong>${escapeHtml(gift.size)}</strong></div>` : ''}
              ${gift.material ? `<div class="detail-row"><span>Matière</span><strong>${escapeHtml(gift.material)}</strong></div>` : ''}
              <div class="detail-row"><span>État</span><strong>${escapeHtml(statusLabel(gift))}</strong></div>
            </div>
            ${progressBlock}
            <div class="product-actions">${actions}</div>
            ${gift.url ? `<a class="button button-light merchant-link" href="${escapeHtml(gift.url)}" target="_blank" rel="noopener noreferrer">Voir le produit chez le marchand ↗</a>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
  bindImageFallbacks(dom.modalRoot);
  bindModalClose();
  dom.modalRoot.querySelectorAll('[data-select-variant]').forEach((button) => {
    button.addEventListener('click', () => openGift(item.id, button.dataset.selectVariant));
  });
  dom.modalRoot.querySelectorAll('[data-participate]').forEach((button) => {
    button.addEventListener('click', () => openParticipation(gift, button.dataset.participate));
  });
  dom.modalRoot.querySelector('[data-contact-gift]')?.addEventListener('click', () => openContact(gift));
}

function bindModalClose() {
  dom.modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  dom.modalRoot.querySelector('.modal-shell')?.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-shell')) closeModal();
  });
}

function closeModal() {
  dom.modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function openParticipation(gift, mode) {
  if (state.demo) {
    toast('Le stockage Vercel n’est pas encore connecté : cette participation ne peut pas être enregistrée.', true);
    return;
  }
  const max = remaining(gift);
  const suggested = Math.max(1, Math.min(max, max >= 100 ? 50 : Math.round(max / 2)));
  const fullMode = mode === 'full';
  dom.modalRoot.innerHTML = `
    <div class="modal-shell" role="dialog" aria-modal="true">
      <form class="modal" id="participationForm">
        <button class="icon-button modal-close" type="button" data-close-modal aria-label="Fermer">×</button>
        <p class="eyebrow">${fullMode ? 'Offrir le cadeau' : 'Participation collective'}</p>
        <h2>${escapeHtml(gift.name)}</h2>
        <p class="form-intro">${fullMode ? `Vous vous engagez sur le montant restant de ${formatMoney(max)}.` : `Choisissez librement votre participation. Il reste ${formatMoney(max)} à financer.`}</p>
        <div class="form-grid">
          ${fullMode ? `
            <div class="field full">
              <label>Votre intention</label>
              <div class="intent-options">
                <label class="intent-option"><input type="radio" name="intent" value="reserved" checked><span>Je souhaite acheter ce cadeau prochainement</span></label>
                <label class="intent-option"><input type="radio" name="intent" value="purchased"><span>J’ai déjà acheté ce cadeau</span></label>
              </div>
            </div>` : `
            <div class="field full">
              <label for="amount">Montant de votre participation</label>
              <input id="amount" name="amount" type="number" min="1" max="${max}" step="1" value="${suggested}" required>
            </div>`}
          <div class="field"><label for="firstName">Prénom</label><input id="firstName" name="firstName" autocomplete="given-name" maxlength="80" required></div>
          <div class="field"><label for="lastName">Nom</label><input id="lastName" name="lastName" autocomplete="family-name" maxlength="80" required></div>
          <div class="field full"><label for="phone">Numéro de téléphone</label><input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="30" required></div>
          <div class="field full"><label for="message">Petit message, facultatif</label><textarea id="message" name="message" maxlength="700" placeholder="Une précision ou un mot pour nous…"></textarea></div>
          <div class="visually-hidden" aria-hidden="true"><label>Site web<input name="website" tabindex="-1" autocomplete="off"></label></div>
        </div>
        <div class="form-note">Votre nom et votre numéro sont enregistrés dans notre espace privé. Aucun autre invité ne peut les voir.</div>
        <input type="hidden" name="startedAt" value="${Date.now()}">
        <button class="button button-dark form-submit" type="submit">Confirmer ${fullMode ? formatMoney(max) : 'ma participation'}</button>
      </form>
    </div>`;
  document.body.classList.add('modal-open');
  bindModalClose();
  document.getElementById('participationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Enregistrement…';
    const formData = new FormData(form);
    const payload = {
      giftId: gift.id,
      mode,
      intent: formData.get('intent') || 'reserved',
      amount: fullMode ? max : Number(formData.get('amount')),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      message: formData.get('message'),
      website: formData.get('website'),
      startedAt: Number(formData.get('startedAt')),
    };
    try {
      const response = await fetch('/api/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Enregistrement impossible.');
      state.data = result.public;
      renderAll();
      showSuccess('Merci pour votre participation', `Votre intention de ${formatMoney(result.amount)} a bien été enregistrée. Nous disposons de vos coordonnées dans notre espace privé.`);
    } catch (error) {
      submit.disabled = false;
      submit.textContent = `Confirmer ${fullMode ? formatMoney(max) : 'ma participation'}`;
      toast(error.message, true);
    }
  });
}

function openContact(gift) {
  if (state.demo) {
    toast('Le stockage Vercel n’est pas encore connecté : cette demande ne peut pas être enregistrée.', true);
    return;
  }
  dom.modalRoot.innerHTML = `
    <div class="modal-shell" role="dialog" aria-modal="true">
      <form class="modal" id="contactForm">
        <button class="icon-button modal-close" type="button" data-close-modal aria-label="Fermer">×</button>
        <p class="eyebrow">Cadeau déjà choisi</p>
        <h2>Être mis en relation</h2>
        <p class="form-intro">L’identité de la personne reste privée. Nous pourrons lui transmettre votre demande et organiser la mise en contact avec son accord.</p>
        <div class="form-grid">
          <div class="field"><label for="contactFirstName">Prénom</label><input id="contactFirstName" name="firstName" required></div>
          <div class="field"><label for="contactLastName">Nom</label><input id="contactLastName" name="lastName" required></div>
          <div class="field full"><label for="contactPhone">Numéro de téléphone</label><input id="contactPhone" name="phone" type="tel" required></div>
          <div class="field full"><label for="contactMessage">Votre message</label><textarea id="contactMessage" name="message" placeholder="Je souhaite participer avec cette personne…"></textarea></div>
          <div class="visually-hidden" aria-hidden="true"><label>Site web<input name="website" tabindex="-1" autocomplete="off"></label></div>
        </div>
        <input type="hidden" name="startedAt" value="${Date.now()}">
        <button class="button button-dark form-submit" type="submit">Envoyer ma demande</button>
      </form>
    </div>`;
  document.body.classList.add('modal-open');
  bindModalClose();
  document.getElementById('contactForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Envoi…';
    const fd = new FormData(form);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giftId: gift.id,
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          phone: fd.get('phone'),
          message: fd.get('message'),
          website: fd.get('website'),
          startedAt: Number(fd.get('startedAt')),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Envoi impossible.');
      showSuccess('Demande transmise', 'Nous pourrons organiser la mise en relation en respectant la confidentialité de chacun.');
    } catch (error) {
      submit.disabled = false;
      submit.textContent = 'Envoyer ma demande';
      toast(error.message, true);
    }
  });
}

function showSuccess(title, text) {
  dom.modalRoot.innerHTML = `
    <div class="modal-shell" role="dialog" aria-modal="true">
      <div class="modal success-modal">
        <div class="success-symbol">♡</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
        <button class="button button-dark" type="button" data-close-modal>Retour à la liste</button>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
  bindModalClose();
}

function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.textContent = message;
  dom.toastRegion.appendChild(element);
  setTimeout(() => element.remove(), 3500);
}

function renderAll() {
  const settings = state.data?.settings || {};
  dom.headerDate.textContent = settings.weddingDate || '29 août 2026';
  dom.introCopy.innerHTML = formatParagraphs(settings.introText || 'Cette liste est un guide, sans aucune obligation. Votre présence reste notre plus beau cadeau.');
  renderStats();
  renderCatalog();
}

function showSetupError(message) {
  state.data = { gifts: [], settings: PUBLIC_SEED.settings };
  renderAll();
  dom.catalogContent.innerHTML = `<div class="error-banner"><strong>Configuration Vercel incomplète.</strong><br>${escapeHtml(message)}</div>`;
  dom.resultCount.textContent = 'Liste momentanément indisponible';
  dom.syncState.textContent = 'Stockage à configurer';
  dom.syncState.classList.add('demo');
}

async function loadData({ quiet = false } = {}) {
  if (!quiet) dom.resultCount.textContent = 'Chargement de la liste…';
  try {
    const response = await fetch('/api/public', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Connexion impossible.');
    state.data = result;
    state.demo = Boolean(result.degradedMode);
    dom.syncState.textContent = result.degradedMode ? 'Lecture seule temporaire' : 'Liste synchronisée';
    dom.syncState.classList.toggle('demo', Boolean(result.degradedMode));
    renderFilterOptions();
    renderAll();
    if (result.degradedMode) {
      const banner = document.createElement('div');
      banner.className = 'error-banner';
      banner.innerHTML = `<strong>Liste visible en lecture seule.</strong><br>${escapeHtml(result.warning || 'Les réservations sont momentanément indisponibles.')}`;
      dom.catalogContent.prepend(banner);
    }
  } catch (error) {
    const local = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';
    if (local) {
      state.data = structuredClone(PUBLIC_SEED);
      state.demo = true;
      dom.syncState.textContent = 'Mode local uniquement';
      dom.syncState.classList.add('demo');
      renderFilterOptions();
      renderAll();
      toast('Mode prévisualisation : aucune donnée ne sera enregistrée.');
    } else {
      showSetupError(error.message);
    }
  } finally {
    document.body.classList.remove('is-loading');
  }
}

function bindUi() {
  dom.introConsent.addEventListener('change', () => {
    dom.enterList.disabled = !dom.introConsent.checked;
  });
  dom.enterList.addEventListener('click', () => {
    sessionStorage.setItem('mn_intro_read', '1');
    dom.introGate.classList.add('hidden');
    document.body.classList.remove('modal-open');
  });
  if (sessionStorage.getItem('mn_intro_read') === '1') dom.introGate.classList.add('hidden');
  else document.body.classList.add('modal-open');

  dom.searchInput.addEventListener('input', () => {
    state.filters.search = dom.searchInput.value.trim();
    renderCatalog();
  });
  dom.availableToggle.addEventListener('click', () => {
    state.filters.availableOnly = !state.filters.availableOnly;
    dom.availableToggle.classList.toggle('button-soft', state.filters.availableOnly);
    renderCatalog();
  });
  dom.filtersToggle.addEventListener('click', () => dom.filterDrawer.classList.toggle('hidden'));
  dom.budgetRange.addEventListener('input', () => {
    state.filters.maxBudget = Number(dom.budgetRange.value);
    dom.budgetValue.textContent = state.filters.maxBudget >= 500 ? '500 € et +' : `${state.filters.maxBudget} €`;
    renderCatalog();
  });
  dom.resetFilters.addEventListener('click', resetAllFilters);
  dom.emptyReset.addEventListener('click', resetAllFilters);
  dom.refreshButton.addEventListener('click', async () => {
    dom.refreshButton.disabled = true;
    await loadData({ quiet: true });
    dom.refreshButton.disabled = false;
    toast('Liste actualisée.');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.modalRoot.innerHTML) closeModal();
  });
}

bindUi();
loadData();
