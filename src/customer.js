import { createScene } from './shared/scene.js';
import { loadModel } from './shared/modelLoader.js';
import { Interaction } from './shared/interaction.js';

const $ = (s) => document.querySelector(s);

let models = [];
let S, root, interaction;

async function loadModels() {
  try {
    const r = await fetch('./models.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('no models');
    const data = await r.json();
    models = (Array.isArray(data) ? data : []).filter(m => m.published !== false);
  } catch { models = []; }
  renderGrid();
}

function renderGrid() {
  const q = $('#search').value.toLowerCase();
  const filtered = models.filter(m =>
    !q || (m.name || '').toLowerCase().includes(q) ||
    (m.category || '').toLowerCase().includes(q) ||
    (m.tags || []).some(t => t.toLowerCase().includes(q))
  );
  const el = $('#cust-grid');
  el.innerHTML = '';
  if (!filtered.length) {
    el.innerHTML = '<div class="empty">لا توجد منتجات منشورة</div>';
    return;
  }
  for (const m of filtered) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-thumb">🏠</div>
      <div class="product-name">${m.name || ''}</div>
      <div class="product-cat">${m.category || ''}</div>
      ${m.price ? `<div class="product-price">${m.price} ${m.currency || ''}</div>` : ''}
    `;
    card.onclick = () => openViewer(m);
    el.appendChild(card);
  }
}
$('#search').oninput = renderGrid;

async function openViewer(model) {
  $('#viewer').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('#viewer-title').textContent = model.name || '';

  const canvas = $('#viewer-canvas');
  if (!S) S = createScene(canvas, { showHuman: true, bg: 0xf3f6fa });

  if (root) { S.scene.remove(root); interaction?.detach(); }
  root = loadModel(model);
  S.scene.add(root);
  S.fitToObject(root);

  interaction = new Interaction(S.camera, canvas, root);
  S.addUpdater(() => interaction.apply());

  const pl = $('#viewer-parts');
  pl.innerHTML = '';
  for (const [id, d] of root.userData.parts) {
    if (!d.def.axis) continue;
    const btn = document.createElement('button');
    btn.textContent = d.def.label || (d.def.motion === 'slide' ? `درج ${id}` : `باب ${id}`);
    btn.onclick = () => interaction.toggle(id);
    pl.appendChild(btn);
  }
}

$('#btn-close').onclick = () => {
  $('#viewer').classList.add('hidden');
  document.body.style.overflow = '';
  if (root && S) { S.scene.remove(root); root = null; }
  interaction?.detach(); interaction = null;
};

$('#btn-toggle-all').onclick = () => {
  if (!interaction) return;
  interaction.toggleAll(!interaction.isAnyOpen());
};
$('#v-open').onclick = () => interaction?.toggleAll(true);
$('#v-close').onclick = () => interaction?.toggleAll(false);
$('#v-fit').onclick = () => root && S.fitToObject(root);
$('#v-share').onclick = async () => {
  const url = location.href;
  if (navigator.share) { try { await navigator.share({ url, title: $('#viewer-title').textContent }); } catch {} }
  else { await navigator.clipboard?.writeText(url); alert('تم نسخ الرابط'); }
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
loadModels();
