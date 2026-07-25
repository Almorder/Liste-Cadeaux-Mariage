const CATEGORY_ORDER = ['Cuisson du riz', 'Accessoires riz', 'Vaisselle', 'Couverts', 'Conservation', 'Cuisine', 'Couteaux', 'Petit électroménager', 'Maison', 'Salle de bain', 'Parfums', 'Autres'];
const root = document.getElementById('adminRoot');
const modalRoot = document.getElementById('adminModalRoot');
const toastRegion = document.getElementById('toastRegion');

const app = {
  state: null,
  tab: 'products',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function money(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number(value) % 1 ? 2 : 0,
  }).format(Number(value || 0));
}

function date(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusLabel(status) {
  return ({
    available: 'Disponible', reserved: 'Réservé', funded: 'Financé', purchased: 'Acheté', hidden: 'Masqué',
    promised: 'Promis', received: 'Reçu', cancelled: 'Annulé', pending: 'À traiter', done: 'Traité',
  })[status] || status;
}

function placeholder(gift) {
  const name = escapeHtml((gift.name || 'Cadeau').slice(0, 38));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8e9eb"/><stop offset="1" stop-color="#ead8cf"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="42" y="330" font-family="Georgia" font-size="31" fill="#201a1c">${name}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function imageUrl(gift) {
  if (gift.image?.startsWith('blob:')) return `/api/image?path=${encodeURIComponent(gift.image.slice(5))}`;
  if (gift.image) return gift.image;
  if (gift.url) return `https://api.microlink.io/?url=${encodeURIComponent(gift.url)}&embed=image.url`;
  return placeholder(gift);
}

function bindFallbacks(scope = document) {
  scope.querySelectorAll('img[data-fallback]').forEach((image) => {
    image.addEventListener('error', () => { image.src = image.dataset.fallback; }, { once: true });
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let result = {};
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) {
    const error = new Error(result.error || 'Une erreur est survenue.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.textContent = message;
  toastRegion.appendChild(element);
  setTimeout(() => element.remove(), 3500);
}

function closeModal() {
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function bindModalClose() {
  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  modalRoot.querySelector('.modal-shell')?.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-shell')) closeModal();
  });
}

function renderLogin(errorMessage = '') {
  root.innerHTML = `
    <section class="admin-login-shell">
      <form class="admin-login-card" id="adminLoginForm">
        <div class="monogram">M × N</div>
        <p class="eyebrow">Espace strictement privé</p>
        <h1>Administration</h1>
        <p>Les coordonnées des invités et les modifications de la liste sont protégées par votre compte administrateur.</p>
        ${errorMessage ? `<div class="admin-error">${escapeHtml(errorMessage)}</div>` : ''}
        <div class="field"><label for="adminEmail">Adresse e-mail</label><input id="adminEmail" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="adminPassword">Mot de passe</label><input id="adminPassword" name="password" type="password" autocomplete="current-password" required></div>
        <button class="button button-dark" type="submit">Ouvrir l’espace privé</button>
        <a class="admin-login-back" href="/">← Retour à la liste publique</a>
      </form>
    </section>`;
  document.getElementById('adminLoginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const fd = new FormData(form);
    button.disabled = true;
    button.textContent = 'Connexion…';
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      await loadAdmin();
    } catch (error) {
      renderLogin(error.message);
    }
  });
}

function metrics() {
  const activeCommitments = app.state.commitments.filter((item) => item.status !== 'cancelled');
  return {
    visible: app.state.gifts.filter((gift) => gift.visible !== false && gift.status !== 'hidden').length,
    commitments: activeCommitments.length,
    promised: activeCommitments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    contacts: app.state.contacts.filter((item) => item.status === 'pending').length,
  };
}

function renderApp(tab = app.tab) {
  app.tab = tab;
  const values = metrics();
  root.innerHTML = `
    <div class="admin-app">
      <header class="admin-topbar">
        <a class="brand" href="/">
          <span class="brand-mark">M × N</span>
          <span class="brand-text"><strong>Administration</strong><small>Liste de mariage</small></span>
        </a>
        <div class="admin-topbar-actions">
          <button class="button button-light button-small" id="exportData">Exporter les données</button>
          <button class="icon-button" id="logoutButton" aria-label="Se déconnecter">↪</button>
        </div>
      </header>
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <nav class="admin-nav">
            <button data-admin-tab="products">Cadeaux</button>
            <button data-admin-tab="commitments">Participations</button>
            <button data-admin-tab="contacts">Mises en relation</button>
            <button data-admin-tab="settings">Message et réglages</button>
          </nav>
          <div class="admin-nav-note">Les noms et numéros ne sont jamais envoyés à la page publique. Ils restent accessibles uniquement après authentification.</div>
        </aside>
        <main class="admin-main">
          <div class="admin-kpis">
            <div class="admin-kpi"><strong>${values.visible}</strong><span>produits visibles</span></div>
            <div class="admin-kpi"><strong>${values.commitments}</strong><span>participations actives</span></div>
            <div class="admin-kpi"><strong>${money(values.promised)}</strong><span>montant promis</span></div>
            <div class="admin-kpi"><strong>${values.contacts}</strong><span>demandes à traiter</span></div>
          </div>
          <div id="adminContent"></div>
        </main>
      </div>
    </div>`;
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.adminTab === tab);
    button.addEventListener('click', () => renderApp(button.dataset.adminTab));
  });
  document.getElementById('logoutButton').addEventListener('click', logout);
  document.getElementById('exportData').addEventListener('click', exportState);
  renderContent(tab);
}

function renderContent(tab) {
  if (tab === 'products') renderProducts();
  else if (tab === 'commitments') renderCommitments();
  else if (tab === 'contacts') renderContacts();
  else renderSettings();
}

function renderProducts() {
  const content = document.getElementById('adminContent');
  content.innerHTML = `
    <div class="admin-section-head">
      <div><p class="eyebrow">Contenu public</p><h1>Les cadeaux</h1></div>
      <button class="button button-dark" id="addGift">Ajouter un cadeau</button>
    </div>
    <div class="admin-panel">
      <div class="admin-toolbar"><span>${app.state.gifts.length} produits, variantes comprises</span><span>Dernière mise à jour : ${date(app.state.updatedAt)}</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Visuel</th><th>Produit</th><th>Catégorie</th><th>Prix</th><th>État</th><th>Visible</th><th></th></tr></thead>
          <tbody>${app.state.gifts.map((gift) => `
            <tr>
              <td><img class="admin-thumb" src="${escapeHtml(imageUrl(gift))}" data-fallback="${escapeHtml(placeholder(gift))}" alt=""></td>
              <td><strong>${escapeHtml(gift.name)}</strong><br><small>${escapeHtml(gift.brand || '')}${gift.variantGroup ? ` · Variante ${escapeHtml(gift.variantGroup)}` : ''}</small></td>
              <td>${escapeHtml(gift.category)}</td>
              <td>${money(gift.price)}</td>
              <td><span class="status-pill ${escapeHtml(gift.status)}">${escapeHtml(statusLabel(gift.status))}</span></td>
              <td>${gift.visible !== false ? 'Oui' : 'Non'}</td>
              <td><div class="admin-actions"><button class="button button-light button-small" data-edit-gift="${escapeHtml(gift.id)}">Modifier</button></div></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('addGift').addEventListener('click', () => openGiftEditor());
  document.querySelectorAll('[data-edit-gift]').forEach((button) => button.addEventListener('click', () => openGiftEditor(button.dataset.editGift)));
  bindFallbacks(content);
}

function renderCommitments() {
  const content = document.getElementById('adminContent');
  const rows = [...app.state.commitments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  content.innerHTML = `
    <div class="admin-section-head"><div><p class="eyebrow">Données privées</p><h1>Participations</h1></div></div>
    <div class="admin-panel">
      <div class="admin-toolbar"><span>${rows.length} participations enregistrées</span><span>Les données téléphoniques restent privées.</span></div>
      ${rows.length ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Participant</th><th>Téléphone</th><th>Cadeau</th><th>Montant</th><th>État</th><th>Date</th></tr></thead>
        <tbody>${rows.map((item) => {
          const gift = app.state.gifts.find((candidate) => candidate.id === item.giftId);
          return `<tr>
            <td><strong>${escapeHtml(`${item.firstName} ${item.lastName}`)}</strong>${item.message ? `<br><small>${escapeHtml(item.message)}</small>` : ''}</td>
            <td><a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a></td>
            <td>${escapeHtml(gift?.name || 'Cadeau supprimé')}<br><small>${item.mode === 'full' ? (item.intent === 'purchased' ? 'Déjà acheté' : 'Cadeau complet') : 'Participation collective'}</small></td>
            <td><input class="inline-select" type="number" min="0" step="1" value="${Number(item.amount || 0)}" data-commitment-amount="${escapeHtml(item.id)}" aria-label="Montant"></td>
            <td><select class="inline-select" data-commitment-status="${escapeHtml(item.id)}"><option value="promised" ${item.status === 'promised' ? 'selected' : ''}>Promis</option><option value="received" ${item.status === 'received' ? 'selected' : ''}>Reçu</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Annulé</option></select></td>
            <td>${date(item.createdAt)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<div class="admin-empty">Aucune participation enregistrée pour le moment.</div>'}
    </div>`;
  document.querySelectorAll('[data-commitment-status]').forEach((select) => select.addEventListener('change', () => updateCommitment(select.dataset.commitmentStatus, { status: select.value })));
  document.querySelectorAll('[data-commitment-amount]').forEach((input) => input.addEventListener('change', () => updateCommitment(input.dataset.commitmentAmount, { amount: Number(input.value) })));
}

function renderContacts() {
  const content = document.getElementById('adminContent');
  const rows = [...app.state.contacts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  content.innerHTML = `
    <div class="admin-section-head"><div><p class="eyebrow">Confidentialité</p><h1>Mises en relation</h1></div></div>
    <div class="admin-panel">
      <div class="admin-toolbar"><span>${rows.length} demandes</span><span>La mise en contact reste toujours sous votre contrôle.</span></div>
      ${rows.length ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Demandeur</th><th>Téléphone</th><th>Cadeau</th><th>Message</th><th>État</th><th>Date</th></tr></thead>
        <tbody>${rows.map((item) => {
          const gift = app.state.gifts.find((candidate) => candidate.id === item.giftId);
          return `<tr>
            <td><strong>${escapeHtml(`${item.firstName} ${item.lastName}`)}</strong></td>
            <td><a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a></td>
            <td>${escapeHtml(gift?.name || 'Cadeau supprimé')}</td>
            <td>${escapeHtml(item.message || '—')}</td>
            <td><select class="inline-select" data-contact-status="${escapeHtml(item.id)}"><option value="pending" ${item.status === 'pending' ? 'selected' : ''}>À traiter</option><option value="done" ${item.status === 'done' ? 'selected' : ''}>Traité</option></select></td>
            <td>${date(item.createdAt)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<div class="admin-empty">Aucune demande de mise en relation.</div>'}
    </div>`;
  document.querySelectorAll('[data-contact-status]').forEach((select) => select.addEventListener('change', () => updateContact(select.dataset.contactStatus, select.value)));
}

function renderSettings() {
  const content = document.getElementById('adminContent');
  const settings = app.state.settings || {};
  content.innerHTML = `
    <div class="admin-section-head"><div><p class="eyebrow">Personnalisation</p><h1>Message et réglages</h1></div></div>
    <form class="admin-card admin-settings-form" id="settingsForm">
      <h2>Identité de la liste</h2>
      <p>Ces informations apparaissent sur la page publique.</p>
      <div class="field"><label for="coupleName">Noms</label><input id="coupleName" name="coupleName" value="${escapeHtml(settings.coupleName || '')}" required></div>
      <div class="field"><label for="weddingDate">Date du mariage</label><input id="weddingDate" name="weddingDate" value="${escapeHtml(settings.weddingDate || '')}" required></div>
      <div class="field"><label for="introText">Message obligatoire avant la liste</label><textarea id="introText" name="introText" required>${escapeHtml(settings.introText || '')}</textarea></div>
      <button class="button button-dark" type="submit">Enregistrer les réglages</button>
    </form>
    <div class="admin-card">
      <h2>Sauvegarde</h2>
      <p>Téléchargez régulièrement une copie JSON de toute la liste, y compris les participations et les demandes privées.</p>
      <button class="button button-light" id="settingsExport">Télécharger une sauvegarde</button>
    </div>`;
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('settingsExport').addEventListener('click', exportState);
}

function giftTemplate() {
  return {
    id: `gift-${Date.now()}`,
    name: '', brand: '', category: 'Cuisine', beneficiary: 'Les deux', priority: 'Moyenne',
    price: 0, priceLabel: '', officialPrice: '', size: '', material: '', quantity: 1,
    description: '', url: '', variantGroup: '', collectiveEnabled: true, featured: false,
    image: '', status: 'available', collected: 0, visible: true, participantCount: 0,
  };
}

function option(value, current, label = value) {
  return `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function openGiftEditor(id = null) {
  const original = id ? app.state.gifts.find((gift) => gift.id === id) : null;
  const gift = structuredClone(original || giftTemplate());
  const groupKeys = Object.keys(app.state.settings?.variantGroups || {});
  modalRoot.innerHTML = `
    <div class="modal-shell" role="dialog" aria-modal="true">
      <form class="modal admin-editor" id="giftEditorForm">
        <button class="icon-button modal-close" type="button" data-close-modal aria-label="Fermer">×</button>
        <p class="eyebrow">${id ? 'Modification' : 'Nouveau produit'}</p>
        <h2>${id ? 'Modifier le cadeau' : 'Ajouter un cadeau'}</h2>
        <div class="editor-grid">
          <div class="field span-2"><label>Nom du produit</label><input name="name" value="${escapeHtml(gift.name)}" required></div>
          <div class="field"><label>Marque</label><input name="brand" value="${escapeHtml(gift.brand)}"></div>
          <div class="field"><label>Prix en euros</label><input name="price" type="number" min="0" step=".01" value="${Number(gift.price || 0)}" required></div>
          <div class="field"><label>Catégorie</label><select name="category">${CATEGORY_ORDER.map((category) => option(category, gift.category)).join('')}</select></div>
          <div class="field"><label>Pour</label><select name="beneficiary">${['Myriam', 'Nolan', 'Les deux'].map((value) => option(value, gift.beneficiary)).join('')}</select></div>
          <div class="field"><label>Importance</label><select name="priority">${['Haute', 'Moyenne', 'Basique'].map((value) => option(value, gift.priority)).join('')}</select></div>
          <div class="field"><label>État</label><select name="status">${[['available', 'Disponible'], ['reserved', 'Réservé'], ['funded', 'Financé'], ['purchased', 'Acheté'], ['hidden', 'Masqué']].map(([value, label]) => option(value, gift.status, label)).join('')}</select></div>
          <div class="field"><label>Taille ou capacité</label><input name="size" value="${escapeHtml(gift.size || '')}"></div>
          <div class="field"><label>Matière</label><input name="material" value="${escapeHtml(gift.material || '')}"></div>
          <div class="field"><label>Groupe de variantes</label><input name="variantGroup" list="variantGroups" value="${escapeHtml(gift.variantGroup || '')}" placeholder="Laisser vide si unique"><datalist id="variantGroups">${groupKeys.map((key) => `<option value="${escapeHtml(key)}">`).join('')}</datalist></div>
          <div class="field"><label>Montant déjà réuni</label><input name="collected" type="number" min="0" step=".01" value="${Number(gift.collected || 0)}"></div>
          <div class="field span-2"><label>Description</label><textarea name="description">${escapeHtml(gift.description || '')}</textarea></div>
          <div class="field span-2"><label>Lien marchand</label><input name="url" type="url" value="${escapeHtml(gift.url || '')}" placeholder="https://…"></div>
          <div class="field span-2">
            <label>Image du produit</label>
            <div class="image-editor">
              <img class="image-preview" id="editorImagePreview" src="${escapeHtml(imageUrl(gift))}" data-fallback="${escapeHtml(placeholder(gift))}" alt="Aperçu">
              <div class="image-controls">
                <input name="image" id="editorImageValue" value="${escapeHtml(gift.image || '')}" placeholder="URL HTTPS ou image importée">
                <input type="file" id="editorImageFile" accept="image/jpeg,image/png,image/webp">
                <small>L’image est redimensionnée puis enregistrée dans votre stockage privé Vercel.</small>
              </div>
            </div>
          </div>
        </div>
        <div class="editor-checks">
          <label class="editor-check"><input name="collectiveEnabled" type="checkbox" ${gift.collectiveEnabled ? 'checked' : ''}><span>Autoriser les participations collectives</span></label>
          <label class="editor-check"><input name="visible" type="checkbox" ${gift.visible !== false ? 'checked' : ''}><span>Afficher sur la liste publique</span></label>
          <label class="editor-check"><input name="featured" type="checkbox" ${gift.featured ? 'checked' : ''}><span>Marquer comme très souhaité</span></label>
        </div>
        <div class="admin-modal-actions">
          ${id ? '<button class="button button-danger" type="button" id="deleteGift">Supprimer</button>' : '<span></span>'}
          <button class="button button-dark" type="submit">Enregistrer le cadeau</button>
        </div>
      </form>
    </div>`;
  document.body.classList.add('modal-open');
  bindModalClose();
  bindFallbacks(modalRoot);
  const imageInput = document.getElementById('editorImageValue');
  const preview = document.getElementById('editorImagePreview');
  imageInput.addEventListener('change', () => { preview.src = imageInput.value || placeholder(gift); });
  document.getElementById('editorImageFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      toast('Préparation de l’image…');
      const dataUrl = await resizeImage(file);
      preview.src = dataUrl;
      imageInput.dataset.upload = dataUrl;
      imageInput.value = 'Image prête à importer';
    } catch (error) {
      toast(error.message, true);
    }
  });
  if (id) document.getElementById('deleteGift').addEventListener('click', () => deleteGift(id));
  document.getElementById('giftEditorForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const saveButton = form.querySelector('[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = 'Enregistrement…';
    try {
      let image = imageInput.value === 'Image prête à importer' ? gift.image : imageInput.value.trim();
      if (imageInput.dataset.upload) {
        const uploaded = await api('/api/admin/image', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: imageInput.dataset.upload }),
        });
        image = uploaded.image;
      }
      const fd = new FormData(form);
      const payload = {
        ...gift,
        name: fd.get('name'), brand: fd.get('brand'), price: Number(fd.get('price')),
        category: fd.get('category'), beneficiary: fd.get('beneficiary'), priority: fd.get('priority'),
        status: fd.get('status'), size: fd.get('size'), material: fd.get('material'),
        variantGroup: fd.get('variantGroup'), collected: Number(fd.get('collected') || 0),
        description: fd.get('description'), url: fd.get('url'), image,
        collectiveEnabled: fd.get('collectiveEnabled') === 'on',
        visible: fd.get('visible') === 'on', featured: fd.get('featured') === 'on',
      };
      const result = await api('/api/admin/gifts', { method: 'PUT', body: JSON.stringify(payload) });
      app.state = result.state;
      closeModal();
      renderApp('products');
      toast('Cadeau enregistré.');
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = 'Enregistrer le cadeau';
      toast(error.message, true);
    }
  });
}

async function resizeImage(file) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error('Choisissez une image JPEG, PNG ou WebP.');
  const bitmap = await createImageBitmap(file);
  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(outputType, outputType === 'image/png' ? undefined : .84);
}

async function deleteGift(id) {
  if (!confirm('Supprimer ce cadeau de la liste ? Les participations existantes resteront dans l’historique privé.')) return;
  try {
    const result = await api(`/api/admin/gifts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    app.state = result.state;
    closeModal();
    renderApp('products');
    toast('Cadeau supprimé.');
  } catch (error) {
    toast(error.message, true);
  }
}

async function updateCommitment(id, changes) {
  try {
    const result = await api('/api/admin/commitments', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...changes }),
    });
    app.state = result.state;
    renderApp('commitments');
    toast('Participation mise à jour.');
  } catch (error) {
    toast(error.message, true);
    renderApp('commitments');
  }
}

async function updateContact(id, status) {
  try {
    const result = await api('/api/admin/contacts', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    });
    app.state = result.state;
    renderApp('contacts');
    toast('Demande mise à jour.');
  } catch (error) {
    toast(error.message, true);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const fd = new FormData(form);
  button.disabled = true;
  button.textContent = 'Enregistrement…';
  try {
    const result = await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        coupleName: fd.get('coupleName'), weddingDate: fd.get('weddingDate'), introText: fd.get('introText'),
      }),
    });
    app.state = result.state;
    renderApp('settings');
    toast('Réglages enregistrés.');
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Enregistrer les réglages';
    toast(error.message, true);
  }
}

function exportState() {
  const blob = new Blob([JSON.stringify(app.state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `liste-mariage-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function logout() {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* cookie is still cleared when possible */ }
  app.state = null;
  renderLogin();
}

async function loadAdmin() {
  try {
    app.state = await api('/api/admin/state');
    renderApp('products');
  } catch (error) {
    if (error.status === 401) renderLogin();
    else renderLogin(`${error.message} Diagnostic : ouvre /api/health dans un nouvel onglet.`);
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalRoot.innerHTML) closeModal();
});

loadAdmin();
