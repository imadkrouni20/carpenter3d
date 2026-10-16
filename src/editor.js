import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createScene } from './shared/scene.js';
import { loadModel, emptyModel, makePart, newPartId, DEFAULT_MATERIAL_ID } from './shared/modelLoader.js';
import { MATERIALS, listByCategory } from './shared/materials.js';
import { listShapes, buildGeometry, shapeParams, SHAPES as SHAPES_MAP } from './shared/shapes.js';
import * as DB from './shared/db.js';
import { Interaction } from './shared/interaction.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  json: null, root: null, selectedId: null,
  mode: 'translate', cat: 'wood', matId: DEFAULT_MATERIAL_ID, shapeCat: 'basic',
  history: [], future: [], linkScale: false, measuring: false,
  settingsOpen: false,
  _dragStartSnapshot: null
};

// ================= المشهد =================
const canvas = $('#canvas');
const S = createScene(canvas, { showHuman: false });
S.grid.visible = true;

const tc = new TransformControls(S.camera, S.renderer.domElement);
tc.setSize(0.9);
tc.addEventListener('dragging-changed', (e) => {
  S.controls.enabled = !e.value;
  if (e.value) state._dragStartSnapshot = JSON.stringify(state.json);
  else if (state._dragStartSnapshot) {
    state.history.push(state._dragStartSnapshot);
    if (state.history.length > 60) state.history.shift();
    state.future = [];
    state._dragStartSnapshot = null;
    updateUndoRedo();
  }
});
tc.addEventListener('objectChange', onTransformChange);
const tcHelper = tc.getHelper ? tc.getHelper() : tc;
S.scene.add(tcHelper);

// ================= أدوات =================
function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(28,32,40,0.95);color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:200;border:1px solid rgba(255,255,255,0.08);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
$$('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $$('.modal').forEach(m => m.classList.add('hidden'));
    ['#ctx-menu', '#top-menu', '#mat-sheet'].forEach(s => $(s)?.classList.add('hidden'));
    closeSettings();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); doRedo(); }
  if (e.key === 'Delete' && state.selectedId) deleteSelected();
});

// ================= Undo / Redo =================
function snapshot() {
  if (!state.json) return;
  state.history.push(JSON.stringify(state.json));
  if (state.history.length > 60) state.history.shift();
  state.future = [];
  updateUndoRedo();
}
function doUndo() {
  if (!state.history.length) return;
  state.future.push(JSON.stringify(state.json));
  state.json = JSON.parse(state.history.pop());
  rebuildFromJson();
  updateUndoRedo();
}
function doRedo() {
  if (!state.future.length) return;
  state.history.push(JSON.stringify(state.json));
  state.json = JSON.parse(state.future.pop());
  rebuildFromJson();
  updateUndoRedo();
}
function updateUndoRedo() {
  const u = $('#btn-undo'), r = $('#btn-redo');
  if (u) u.style.opacity = state.history.length ? '1' : '0.4';
  if (r) r.style.opacity = state.future.length ? '1' : '0.4';
}
$('#btn-undo').onclick = doUndo;
$('#btn-redo').onclick = doRedo;

// ================= المكتبة =================
let libCat = 'all';
$('#lib-search-btn').onclick = () => {
  $('#lib-search').classList.toggle('hidden');
  if (!$('#lib-search').classList.contains('hidden')) $('#lib-search').focus();
};
$('#lib-search').oninput = renderLibrary;
$$('.lib-cat').forEach(b => b.onclick = () => {
  $$('.lib-cat').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  libCat = b.dataset.cat;
  renderLibrary();
});
async function renderLibrary() {
  const list = await DB.listModels();
  const q = ($('#lib-search').value || '').toLowerCase();
  const filtered = list.filter(m => {
    const okQ = !q || (m.name || '').toLowerCase().includes(q);
    const okC = libCat === 'all' || (m.category || '') === libCat;
    return okQ && okC;
  });
  const el = $('#lib-grid');
  el.innerHTML = '';
  if (!filtered.length) { el.innerHTML = '<div class="lib-empty">لا توجد منتجات بعد — اضغط "منتج جديد" للبدء</div>'; return; }
  for (const m of filtered) {
    const card = document.createElement('div');
    card.className = 'lib-card';
    card.innerHTML = `
      <div class="lib-thumb">📦</div>
      <div class="lib-title">${m.name || 'بدون اسم'}</div>
      <div class="lib-meta">${(m.parts||[]).length} قطعة · ${m.published ? 'منشور' : 'مسودة'}</div>`;
    card.onclick = () => openEditor(m.id);
    el.appendChild(card);
  }
}
$('#fab-new').onclick = () => {
  state.json = emptyModel();
  state.history = []; state.future = [];
  state.matId = DEFAULT_MATERIAL_ID;
  showScreen('screen-editor');
  buildScene();
};
async function openEditor(id) {
  const m = await DB.getModel(id);
  if (!m) return;
  state.json = m;
  state.history = []; state.future = [];
  state.matId = DEFAULT_MATERIAL_ID;
  showScreen('screen-editor');
  buildScene();
}
$('#btn-home').onclick = async () => {
  if (state.json && state.json.parts?.length) await DB.saveModel(state.json);
  await renderLibrary();
  showScreen('screen-lib');
};

// ================= بناء المشهد =================
function buildScene() {
  if (state.root) { S.scene.remove(state.root); state.root = null; }
  state.root = loadModel(state.json);
  S.scene.add(state.root);
  state.selectedId = null;
  tc.detach();
  closeSettings();
  updateUIState();
  $('#project-name').textContent = state.json.name || 'منتج جديد';
  if (state.json.parts.length) S.fitToObject(state.root);
  else S.controls.target.set(0, 50, 0);
  updateUndoRedo();
}
function rebuildFromJson() {
  if (state.root) S.scene.remove(state.root);
  state.root = loadModel(state.json);
  S.scene.add(state.root);

  // ⚠️ أهم سطر: أعِد بناء interaction على الجذر الجديد
  if (state.interaction) {
    try { state.interaction.detach(); } catch {}
  }
  state.interaction = new Interaction(S.camera, canvas, state.root);
  state.interaction.enabled = false;

  if (state.selectedId && state.root.userData.parts.get(state.selectedId)) {
    attachToPart(state.selectedId);
  } else {
    state.selectedId = null;
    tc.detach();
  }
  updateUIState();
}
function updateUIState() {
  const hasParts = state.json && state.json.parts.length > 0;
  $('#empty-state').classList.toggle('hidden', hasParts);
  const sel = state.selectedId && state.root && state.root.userData.parts.get(state.selectedId);
  $('#part-tools').classList.toggle('hidden', !sel);
  $('#obj-pill').classList.toggle('hidden', !sel);

  const showInputs = sel && !state.settingsOpen;
  $('#inputs-row').classList.toggle('hidden', !showInputs);
  $('#shape-settings').classList.toggle('hidden', !state.settingsOpen);

  if (sel) {
    $('#obj-name').textContent = state.selectedId;
    $$('.ig').forEach(ig => ig.classList.toggle('hidden', ig.dataset.mode !== state.mode));
    syncInputsFromPart();
    if (state.settingsOpen) renderShapeSettings();
  }
  if (!sel) {
    state.settingsOpen = false;
    $('#measure-label').classList.add('hidden');
    $('#shape-settings').classList.add('hidden');
  }
}

// ================= اختيار =================
function attachToPart(id) {
  const d = state.root.userData.parts.get(id);
  if (!d) return;
  state.selectedId = id;
  tc.attach(d.group);
  tc.setMode(state.mode);
  updateUIState();
}
function deselectAll() {
  state.selectedId = null;
  tc.detach();
  closeSettings();
  updateUIState();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let _down = null;
canvas.addEventListener('pointerdown', (e) => { _down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!_down) return;
  const dx = e.clientX - _down.x, dy = e.clientY - _down.y;
  const dt = Date.now() - _down.t;
  _down = null;
  if (Math.hypot(dx, dy) > 6 || dt > 500) return;
  if (tc.dragging) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, S.camera);
  const hits = raycaster.intersectObjects(state.root.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.partId) o = o.parent;
    if (o && o.userData.partId) { attachToPart(o.userData.partId); return; }
  }
  deselectAll();
});

// ================= إضافة =================
$('#btn-add-fab').onclick = () => openShapePicker();
$('#btn-add-empty').onclick = () => openShapePicker();
function openShapePicker() {
  state.shapeCat = 'basic';
  $$('.sh-cat').forEach(x => x.classList.toggle('active', x.dataset.cat === 'basic'));
  renderShapeGrid();
  openModal('shape-modal');
}
$$('.sh-cat').forEach(b => b.onclick = () => {
  $$('.sh-cat').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.shapeCat = b.dataset.cat;
  renderShapeGrid();
});
function renderShapeGrid() {
  const grid = $('#shape-grid');
  grid.innerHTML = '';
  for (const s of listShapes(state.shapeCat)) {
    const el = document.createElement('div');
    el.className = 'shape-item';
    el.innerHTML = `<div class="shape-icon">${s.icon}</div><span>${s.name}</span>`;
    el.onclick = () => { addShape(s.id); closeShapeModal(); };
    grid.appendChild(el);
  }
}
function addShape(shapeId) {
  snapshot();
  const part = makePart(shapeId, DEFAULT_MATERIAL_ID);
  state.json.parts.push(part);
  rebuildFromJson();
  attachToPart(part.id);
  state.mode = 'translate';
  tc.setMode('translate');
  $$('.ptool').forEach(x => x.classList.toggle('active', x.dataset.tool === 'translate'));
  closeSettings();
  updateUIState();
  toast('تمت الإضافة');
}
$$('.rs-item[data-shape]').forEach(b => b.onclick = () => addShape(b.dataset.shape));
const _rsMore = $('#rs-more'); if (_rsMore) _rsMore.onclick = () => openShapePicker();

// ================= التحويل =================
$$('.ptool[data-tool]').forEach(b => b.onclick = () => {
  state.mode = b.dataset.tool;
  tc.setMode(state.mode);
  $$('.ptool[data-tool]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  closeSettings();
  updateUIState();
});

// ================= مزامنة الإدخالات =================
function syncInputsFromPart() {
  if (!state.selectedId) return;
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  const p = d.def;
  $('#in-x').value = (p.pos[0] || 0).toFixed(1);
  $('#in-y').value = (p.pos[1] || 0).toFixed(1);
  $('#in-z').value = (p.pos[2] || 0).toFixed(1);
  $('#in-w').value = (p.size[0] || 0).toFixed(1);
  $('#in-h').value = (p.size[1] || 0).toFixed(1);
  $('#in-d').value = (p.size[2] || 0).toFixed(1);
  const rot = p.rotation || [0, 0, 0];
  $('#in-rx').value = (rot[0] * 180 / Math.PI).toFixed(1);
  $('#in-ry').value = (rot[1] * 180 / Math.PI).toFixed(1);
  $('#in-rz').value = (rot[2] * 180 / Math.PI).toFixed(1);
}

['x','y','z'].forEach(axis => {
  $(`#in-${axis}`).oninput = (e) => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d) return;
    const idx = { x:0, y:1, z:2 }[axis];
    const v = parseFloat(e.target.value) || 0;
    d.def.pos[idx] = v;
    if (d.def.axis && d.def.pivot) {
      d.mesh.position.set(
        d.def.pos[0] - d.def.pivot[0],
        d.def.pos[1] - d.def.pivot[1],
        d.def.pos[2] - d.def.pivot[2]
      );
    } else {
      d.group.position.set(d.def.pos[0], d.def.pos[1], d.def.pos[2]);
    }
    d.group.userData.basePos = d.group.position.clone();
  };
});
['x','y','z','w','h','d','rx','ry','rz'].forEach(k => {
  $(`#in-${k}`).addEventListener('focus', () => { state._dragStartSnapshot = JSON.stringify(state.json); });
  $(`#in-${k}`).addEventListener('blur', () => {
    if (state._dragStartSnapshot && state._dragStartSnapshot !== JSON.stringify(state.json)) {
      state.history.push(state._dragStartSnapshot);
      if (state.history.length > 60) state.history.shift();
      state.future = [];
      updateUndoRedo();
    }
    state._dragStartSnapshot = null;
  });
});

['w','h','d'].forEach((axis, idx) => {
  $(`#in-${axis}`).oninput = (e) => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d) return;
    let v = Math.max(1, parseFloat(e.target.value) || 1);
    if (state.linkScale) {
      d.def.size = [v, v, v];
      ['w','h','d'].forEach(k => { const el = $(`#in-${k}`); if (el !== e.target) el.value = v; });
    } else {
      d.def.size[idx] = v;
    }
    const shapeId = d.def.shape || d.def.type || 'box';
    d.mesh.geometry.dispose();
    d.mesh.geometry = buildGeometry(shapeId, d.def.size, d.def.options || {});
  };
});
$('#btn-link').onclick = (e) => {
  state.linkScale = !state.linkScale;
  e.currentTarget.classList.toggle('active', state.linkScale);
  toast(state.linkScale ? 'الأبعاد مربوطة' : 'الأبعاد منفصلة');
};

[['rx',0],['ry',1],['rz',2]].forEach(([k, idx]) => {
  $(`#in-${k}`).oninput = (e) => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d) return;
    const deg = parseFloat(e.target.value) || 0;
    d.def.rotation = d.def.rotation || [0, 0, 0];
    d.def.rotation[idx] = deg * Math.PI / 180;
    d.group.rotation.set(d.def.rotation[0], d.def.rotation[1], d.def.rotation[2]);
  };
});
$('#btn-reset-rot').onclick = () => {
  if (!state.selectedId) return;
  snapshot();
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  d.def.rotation = [0, 0, 0];
  d.group.rotation.set(0, 0, 0);
  syncInputsFromPart();
  toast('تم التصفير');
};

// ================= Measure =================
$('#btn-measure').onclick = () => {
  state.measuring = !state.measuring;
  $('#btn-measure').classList.toggle('active', state.measuring);
  if (state.measuring) updateMeasure();
  else $('#measure-label').classList.add('hidden');
};
function updateMeasure() {
  if (!state.measuring || !state.selectedId) { $('#measure-label').classList.add('hidden'); return; }
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  const size = d.def.size;
  const worldPos = new THREE.Vector3();
  d.group.getWorldPosition(worldPos);
  worldPos.y += size[1] / 2 + 15;
  const v = worldPos.clone().project(S.camera);
  const rect = canvas.getBoundingClientRect();
  const x = (v.x * 0.5 + 0.5) * rect.width;
  const y = (-v.y * 0.5 + 0.5) * rect.height;
  const lbl = $('#measure-label');
  lbl.textContent = `${size[0].toFixed(1)} × ${size[1].toFixed(1)} × ${size[2].toFixed(1)} cm`;
  lbl.style.left = x + 'px';
  lbl.style.top = y + 'px';
  lbl.classList.remove('hidden');
}
S.addUpdater(() => { if (state.measuring) updateMeasure(); });

// ================= ⚙️ لوحة خصائص الشكل =================
$('#btn-settings').onclick = () => {
  if (!state.selectedId) return;
  state.settingsOpen = !state.settingsOpen;
  $('#btn-settings').classList.toggle('active', state.settingsOpen);
  if (state.settingsOpen) renderShapeSettings();
  updateUIState();
};
$('#ss-close').onclick = () => closeSettings();
function closeSettings() {
  state.settingsOpen = false;
  $('#btn-settings')?.classList.remove('active');
  $('#shape-settings')?.classList.add('hidden');
}

function renderShapeSettings() {
  if (!state.selectedId) return;
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  const p = d.def;
  const shapeId = p.shape || p.type || 'box';
  const shape = SHAPES_MAP[shapeId];
  $('#ss-title').textContent = `خصائص: ${shape?.name || shapeId}`;

  const body = $('#ss-body');
  body.innerHTML = '';

  const params = shapeParams(shapeId);
  if (!params.length) {
    body.innerHTML = '<div style="padding:20px;color:#6a7688;text-align:center;grid-column:1/-1;">لا توجد خصائص إضافية</div>';
    return;
  }

  for (const prm of params) {
    const isSize = prm.k.startsWith('size.');
    const isOpt  = prm.k.startsWith('options.');
    const sizeIdx = isSize ? parseInt(prm.k.slice(5)) : -1;
    const optKey  = isOpt ? prm.k.slice(8) : null;

    let value;
    if (isSize) value = p.size[sizeIdx] ?? 0;
    else if (isOpt) value = (p.options?.[optKey] ?? prm.default ?? 0);
    else value = 0;

    const isSlider = prm.min !== undefined || prm.max !== undefined;

    const field = document.createElement('div');
    field.className = 'ss-field';

    const label = document.createElement('label');
    label.textContent = prm.label + (isSlider ? '' : ' (cm)');
    field.appendChild(label);

    if (isSlider) {
      const min = prm.min ?? 0;
      const max = prm.max ?? 1;
      const step = prm.step ?? 0.01;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step;
      input.value = value;

      const val = document.createElement('div');
      val.className = 'ss-val';
      val.textContent = typeof value === 'number' ? value.toFixed(2) : value;

      input.oninput = (e) => {
        const v = parseFloat(e.target.value);
        val.textContent = v.toFixed(2);
        applyParamChange(d, { sizeIdx, optKey }, v, false);
      };
      input.addEventListener('focus', () => { state._dragStartSnapshot = JSON.stringify(state.json); });
      input.addEventListener('blur', () => {
        if (state._dragStartSnapshot && state._dragStartSnapshot !== JSON.stringify(state.json)) {
          state.history.push(state._dragStartSnapshot);
          if (state.history.length > 60) state.history.shift();
          state.future = []; updateUndoRedo();
        }
        state._dragStartSnapshot = null;
      });

      field.appendChild(input);
      field.appendChild(val);
    } else {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '1';
      input.min = '1';
      input.value = value.toFixed(1);

      input.oninput = (e) => {
        const v = Math.max(1, parseFloat(e.target.value) || 1);
        applyParamChange(d, { sizeIdx, optKey }, v, false);
      };
      input.addEventListener('focus', () => { state._dragStartSnapshot = JSON.stringify(state.json); });
      input.addEventListener('blur', () => {
        if (state._dragStartSnapshot && state._dragStartSnapshot !== JSON.stringify(state.json)) {
          state.history.push(state._dragStartSnapshot);
          if (state.history.length > 60) state.history.shift();
          state.future = []; updateUndoRedo();
        }
        state._dragStartSnapshot = null;
      });

      field.appendChild(input);
    }

    body.appendChild(field);
  }
}

function applyParamChange(d, { sizeIdx, optKey }, value, skipGeo = false) {
  const p = d.def;
  if (sizeIdx >= 0) p.size[sizeIdx] = value;
  else if (optKey) {
    p.options = p.options || {};
    p.options[optKey] = value;
  }
  if (!skipGeo) {
    const shapeId = p.shape || p.type || 'box';
    d.mesh.geometry.dispose();
    d.mesh.geometry = buildGeometry(shapeId, p.size, p.options || {});
  }
}

// ================= المواد =================
$('#btn-material').onclick = () => {
  if (!state.selectedId) { toast('اختر قطعة أولاً'); return; }
  closeSettings();
  $('#mat-sheet').classList.remove('hidden');
  renderMatGrid();
};
$$('.sheet-cat').forEach(b => b.onclick = () => {
  $$('.sheet-cat').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.cat = b.dataset.cat;
  renderMatGrid();
});
function renderMatGrid() {
  const grid = $('#mat-grid');
  grid.innerHTML = '';
  for (const m of listByCategory(state.cat)) {
    const el = document.createElement('div');
    el.className = 'mat-item' + (m.id === state.matId ? ' active' : '');
    el.innerHTML = `
      <div class="mat-sphere" style="background:radial-gradient(circle at 30% 30%, ${lighten(m.color)}, ${m.color} 60%, ${darken(m.color)} 100%)"></div>
      <span>${m.name}</span>`;
    el.onclick = () => applyMaterial(m.id);
    grid.appendChild(el);
  }
}
const lighten = (hex) => { const c = new THREE.Color(hex); c.offsetHSL(0,0,0.18); return '#'+c.getHexString(); };
const darken  = (hex) => { const c = new THREE.Color(hex); c.offsetHSL(0,0,-0.18); return '#'+c.getHexString(); };

function applyMaterial(id) {
  if (!state.selectedId) return;
  snapshot();
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  d.def.material = { materialId: id };
  state.matId = id;
  const tempJson = { id:'_', parts:[{ ...d.def }] };
  const tmp = loadModel(tempJson);
  const newMesh = tmp.children[0].children[0];
  d.mesh.material.dispose();
  d.mesh.material = newMesh.material;
  newMesh.geometry.dispose();
  renderMatGrid();
  toast('تم تطبيق المادة');
  setTimeout(() => $('#mat-sheet').classList.add('hidden'), 350);
}

// ================= قوائم =================
$('#obj-menu-btn').onclick = (e) => { e.stopPropagation(); $('#ctx-menu').classList.toggle('hidden'); };
$('#btn-menu').onclick = (e) => { e.stopPropagation(); $('#top-menu').classList.toggle('hidden'); };
document.addEventListener('click', (e) => {
  if (!$('#ctx-menu').contains(e.target) && !$('#obj-menu-btn').contains(e.target)) $('#ctx-menu').classList.add('hidden');
  if (!$('#top-menu').contains(e.target) && !$('#btn-menu').contains(e.target)) $('#top-menu').classList.add('hidden');
});
$('#ctx-menu').addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  $('#ctx-menu').classList.add('hidden');
  if (act === 'rename') {
    const n = prompt('اسم القطعة:', state.selectedId);
    if (n && n !== state.selectedId) {
      snapshot();
      const p = state.json.parts.find(x => x.id === state.selectedId);
      if (p) { p.id = n; state.selectedId = n; rebuildFromJson(); }
    }
  }
  if (act === 'del') deleteSelected();
});
$('#top-menu').addEventListener('click', async (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  $('#top-menu').classList.add('hidden');
  if (act === 'save') { await DB.saveModel(state.json); toast('تم الحفظ'); }
  if (act === 'publish') await doPublish();
  if (act === 'export') doExport();
  if (act === 'del-model') {
    if (confirm('حذف المنتج؟')) {
      await DB.deleteModel(state.json.id);
      state.json = emptyModel(); state.history = []; state.future = [];
      buildScene();
    }
  }
});

function deleteSelected() {
  if (!state.selectedId) return;
  snapshot();
  state.json.parts = state.json.parts.filter(x => x.id !== state.selectedId);
  state.selectedId = null;
  tc.detach();
  closeSettings();
  rebuildFromJson();
}

$('#btn-dup').onclick = () => {
  if (!state.selectedId) return;
  const p = state.json.parts.find(x => x.id === state.selectedId);
  if (!p) return;
  snapshot();
  const clone = JSON.parse(JSON.stringify(p));
  clone.id = newPartId(p.shape || p.type);
  clone.pos = [p.pos[0] + 30, p.pos[1], p.pos[2]];
  if (clone.pivot) clone.pivot = [p.pivot[0] + 30, p.pivot[1], p.pivot[2]];
  state.json.parts.push(clone);
  rebuildFromJson();
  attachToPart(clone.id);
};

// ================= نشر / تصدير =================
async function doPublish() {
  await DB.saveModel(state.json);
  const all = await DB.listModels();
  const pub = all.filter(m => m.published !== false);
  const blob = new Blob([JSON.stringify(pub, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'models.json'; a.click();
  toast(`جاهز ${pub.length} منتج`);
}
function doExport() {
  const blob = new Blob([JSON.stringify(state.json, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${state.json.id}.json`; a.click();
}

// ================= أدوات علوية =================
$('#btn-edit-name').onclick = () => {
  const n = prompt('اسم المنتج:', state.json.name);
  if (n !== null) { state.json.name = n; $('#project-name').textContent = n; }
};
$('#btn-center').onclick = () => state.root && state.root.children.length && S.fitToObject(state.root);
$('#btn-shot').onclick = () => {
  const url = S.renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = 'shot.png'; a.click();
};
$('#btn-grid-toggle').onclick = (e) => {
  e.currentTarget.classList.toggle('active');
  S.grid.visible = !S.grid.visible;
};

$('#btn-list').onclick = () => { renderPartsList(); openModal('list-modal'); };
function renderPartsList() {
  const el = $('#parts-list');
  el.innerHTML = '';
  if (!state.json.parts.length) { el.innerHTML = '<div style="text-align:center;color:#6a7688;padding:30px;">لا توجد عناصر بعد</div>'; return; }
  for (const p of state.json.parts) {
    const row = document.createElement('div');
    row.className = 'part-row' + (p.id === state.selectedId ? ' active' : '');
    row.innerHTML = `<span>${p.id}</span><em>${p.shape || p.type || ''}</em>`;
    row.onclick = () => { attachToPart(p.id); closeModal('list-modal'); };
    el.appendChild(row);
  }
}


// ═══════════════════════════════════════════════════════════
// إغلاق نافذة الأشكال بانزلاق نحو الأسفل
// ═══════════════════════════════════════════════════════════
function closeShapeModal() {
  const m = document.getElementById('shape-modal');
  if (!m || m.classList.contains('hidden')) return;
  m.classList.add('closing');
  setTimeout(() => {
    m.classList.add('hidden');
    m.classList.remove('closing');
  }, 240);
}
window.closeShapeModal = closeShapeModal;

// اربط زر X + أي عنصر data-close="shape-modal" بهذه الدالة
document.querySelectorAll('[data-close="shape-modal"]').forEach(b => {
  b.onclick = (e) => { e.stopPropagation(); closeShapeModal(); };
});

// إغلاق عند النقر على الخلفية المعتمة خارج الصندوق
const _sm = document.getElementById('shape-modal');
if (_sm) {
  _sm.addEventListener('click', (e) => {
    if (e.target === _sm) closeShapeModal();
  });
}

// استبدل استدعاءات closeModal('shape-modal') في الكود

// ================= إقلاع =================
(async () => {
  await renderLibrary();
  showScreen('screen-lib');
  updateUndoRedo();
})();

// ================= زر الحذف من شريط الأدوات =================
const _btnDelPart = document.getElementById('btn-del-part');
if (_btnDelPart) {
  _btnDelPart.onclick = (e) => {
    e.stopPropagation();
    if (typeof deleteSelected === 'function') {
      if (state.selectedId && confirm('حذف القطعة؟')) {
        deleteSelected();
      }
    }
  };
}

// ═══════════════════════════════════════════════════════════
// نافذة إعدادات المحرر
// ═══════════════════════════════════════════════════════════
const _settingsSheet = document.getElementById('settings-sheet');
const _settingsOverlay = document.getElementById('settings-overlay');

function openSettingsSheet() {
  if (!_settingsSheet) return;
  _settingsOverlay.classList.add('open');
  requestAnimationFrame(() => _settingsSheet.classList.add('open'));
}

function closeSettingsSheet() {
  if (!_settingsSheet) return;
  _settingsOverlay.classList.remove('open');
  _settingsSheet.classList.remove('open');
}
window.openSettingsSheet = openSettingsSheet;
window.closeSettingsSheet = closeSettingsSheet;

// زر الإغلاق
const _ssClose = document.getElementById('settings-close');
if (_ssClose) _ssClose.onclick = closeSettingsSheet;

// النقر على الخلفية
if (_settingsOverlay) _settingsOverlay.onclick = closeSettingsSheet;

// استبدل وظيفة زر القائمة ☰ ليفتح الإعدادات
const _menuBtnEl = document.getElementById('btn-menu');
if (_menuBtnEl) {
  _menuBtnEl.onclick = (e) => {
    e.stopPropagation();
    openSettingsSheet();
  };
}

// ═════ البطاقات ═════

// إضافة شكل
const _tAdd = document.getElementById('tile-add');
if (_tAdd) _tAdd.onclick = () => { closeSettingsSheet(); setTimeout(() => openShapePicker(), 200); };

// تحديد متعدد (placeholder)
const _tMulti = document.getElementById('tile-multi');
if (_tMulti) _tMulti.onclick = () => { toast('قريباً: تحديد متعدد'); };

// الهيكل
const _tHier = document.getElementById('tile-hierarchy');
if (_tHier) _tHier.onclick = () => {
  closeSettingsSheet();
  setTimeout(() => { renderPartsList(); openModal('list-modal'); }, 200);
};

// محاذاة (Snap)
const _tSnap = document.getElementById('tile-snap');
if (_tSnap) _tSnap.onclick = () => {
  _tSnap.classList.toggle('on');
  state.snapEnabled = _tSnap.classList.contains('on');
  toast(state.snapEnabled ? 'محاذاة: مفعّلة' : 'محاذاة: معطّلة');
};

// تمركز تلقائي
const _tCenter = document.getElementById('tile-center');
if (_tCenter) _tCenter.onclick = () => {
  _tCenter.classList.toggle('on');
  state.autoCenter = _tCenter.classList.contains('on');
  toast(state.autoCenter ? 'تمركز تلقائي: مفعّل' : 'تمركز تلقائي: معطّل');
};

// تدوير دائري (cycle 0 → 1 → 5 → 15 → 0)
const _tRound = document.getElementById('tile-round');
if (_tRound) _tRound.onclick = () => {
  const vals = [0, 1, 5, 15];
  const cur = state.roundRot ?? 1;
  const i = (vals.indexOf(cur) + 1) % vals.length;
  state.roundRot = vals[i];
  const txt = _tRound.querySelector('text');
  if (txt) txt.textContent = vals[i] === 0 ? '—' : vals[i];
  _tRound.classList.toggle('ss-number-off', vals[i] === 0);
  toast('تدوير دائري: ' + (vals[i] === 0 ? 'معطّل' : vals[i] + '°'));
};

// عرض الأبعاد
const _tDims = document.getElementById('tile-dims');
if (_tDims) _tDims.onclick = () => {
  _tDims.classList.toggle('on');
  state.showDimensions = _tDims.classList.contains('on');
  if (state.showDimensions && state.selectedId) {
    state.measuring = true;
    if (typeof updateMeasure === 'function') updateMeasure();
  } else {
    state.measuring = false;
    const ml = document.getElementById('measure-label');
    if (ml) ml.classList.add('hidden');
  }
  toast(state.showDimensions ? 'عرض الأبعاد: مفعّل' : 'عرض الأبعاد: معطّل');
};

// مشاركة
const _tShare = document.getElementById('tile-share');
if (_tShare) _tShare.onclick = async () => {
  const url = location.href;
  const title = state.json?.name || 'منتج';
  try {
    if (navigator.share) await navigator.share({ url, title });
    else { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); }
  } catch {}
};

// تصدير
const _tExport = document.getElementById('tile-export');
if (_tExport) _tExport.onclick = () => {
  closeSettingsSheet();
  setTimeout(() => { if (typeof doExport === 'function') doExport(); }, 200);
};

// أزرار الحفظ / النشر / الحذف
const _ssSave = document.getElementById('ss-save');
if (_ssSave) _ssSave.onclick = async () => {
  if (state.json) { await DB.saveModel(state.json); toast('تم الحفظ'); }
  closeSettingsSheet();
};
const _ssPub = document.getElementById('ss-publish');
if (_ssPub) _ssPub.onclick = () => {
  closeSettingsSheet();
  setTimeout(() => { if (typeof doPublish === 'function') doPublish(); }, 200);
};
const _ssDel = document.getElementById('ss-del');
if (_ssDel) _ssDel.onclick = async () => {
  if (!state.json) return;
  if (confirm('حذف المنتج؟')) {
    await DB.deleteModel(state.json.id);
    state.json = emptyModel();
    state.history = []; state.future = [];
    buildScene();
    closeSettingsSheet();
  }
};

// ESC يغلق النافذة
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettingsSheet();
});

// ═══════════════════════════════════════════════════════════
// تفعيل: محاذاة + تمركز مغناطيسي + تدوير دائري
// (نعيد تعريف onTransformChange — الأخير يفوز في module scope)
// ═══════════════════════════════════════════════════════════

if (typeof state.snapEnabled === 'undefined') state.snapEnabled = false;
if (typeof state.autoCenter === 'undefined') state.autoCenter = false;
if (typeof state.roundRot === 'undefined') state.roundRot = 0;

// ═══════════════════════════════════════════════════════════
// عرض الأبعاد — تسمية فوق كل قطعة
// ═══════════════════════════════════════════════════════════
if (typeof state.showDimensions === 'undefined') state.showDimensions = false;

const _dimOverlay = document.createElement('div');
_dimOverlay.id = 'dims-overlay';
document.body.appendChild(_dimOverlay);
const _dimLabels = new Map();
let _dimLastCount = -1;

function refreshDimLabels() {
  _dimOverlay.innerHTML = '';
  _dimLabels.clear();
  _dimLastCount = state.root ? state.root.userData.parts.size : 0;
  if (!state.showDimensions || !state.root) return;
  for (const [id, d] of state.root.userData.parts) {
    const el = document.createElement('div');
    el.className = 'dim-label';
    _dimOverlay.appendChild(el);
    _dimLabels.set(id, { el, d });
  }
}

function updateDimPositions() {
  if (!state.showDimensions || !state.root) return;
  const cnt = state.root.userData.parts.size;
  if (cnt !== _dimLastCount) refreshDimLabels();
  const rect = canvas.getBoundingClientRect();
  for (const [id, { el, d }] of _dimLabels) {
    if (!d || !d.group) continue;
    const wp = new THREE.Vector3();
    d.group.getWorldPosition(wp);
    wp.y += (d.def.size?.[1] || 20) / 2 + 12;
    const v = wp.project(S.camera);
    if (v.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    const s = d.def.size || [0, 0, 0];
    el.textContent = `${s[0].toFixed(0)} × ${s[1].toFixed(0)} × ${s[2].toFixed(0)} cm`;
  }
}

S.addUpdater(updateDimPositions);

// ═══════════════════════════════════════════════════════════
// تحديد متعدد
// ═══════════════════════════════════════════════════════════
if (typeof state.multiSelect === 'undefined') state.multiSelect = false;
if (!state.multiSelected) state.multiSelected = new Set();

function updateMultiHighlight() {
  if (!state.root) return;
  for (const [id, d] of state.root.userData.parts) {
    const m = d.mesh.material;
    if (!m) continue;
    if (state.multiSelected.has(id)) {
      m.emissive = new THREE.Color(0x3b82f6);
      m.emissiveIntensity = 0.45;
    } else {
      m.emissive = new THREE.Color(0x000000);
      m.emissiveIntensity = 0;
    }
    m.needsUpdate = true;
  }
}

function updateMultiChip() {
  let chip = document.getElementById('multi-chip');
  if (!state.multiSelect) { if (chip) chip.remove(); return; }
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'multi-chip';
    chip.innerHTML = `
      <span id="multi-count">0 محدد</span>
      <button id="multi-del" title="حذف">🗑</button>
      <button id="multi-dup" title="نسخ">⧉</button>
      <button id="multi-exit" title="خروج">✕</button>
    `;
    document.body.appendChild(chip);
    chip.querySelector('#multi-del').onclick = () => {
      if (!state.multiSelected.size) return;
      if (!confirm('حذف ' + state.multiSelected.size + ' عنصر؟')) return;
      snapshot();
      state.json.parts = state.json.parts.filter(p => !state.multiSelected.has(p.id));
      state.multiSelected.clear();
      rebuildFromJson();
      updateMultiHighlight();
      updateMultiChip();
    };
    chip.querySelector('#multi-dup').onclick = () => {
      if (!state.multiSelected.size) return;
      snapshot();
      const clones = [];
      for (const id of state.multiSelected) {
        const p = state.json.parts.find(x => x.id === id);
        if (!p) continue;
        const c = JSON.parse(JSON.stringify(p));
        c.id = newPartId(p.shape || p.type);
        c.pos = [p.pos[0] + 30, p.pos[1], p.pos[2]];
        if (c.pivot) c.pivot = [p.pivot[0] + 30, p.pivot[1], p.pivot[2]];
        clones.push(c);
      }
      state.json.parts.push(...clones);
      state.multiSelected.clear();
      rebuildFromJson();
      updateMultiHighlight();
      updateMultiChip();
    };
    chip.querySelector('#multi-exit').onclick = () => setMultiSelect(false);
  }
  chip.querySelector('#multi-count').textContent = state.multiSelected.size + ' محدد';
}

function toggleMultiSelection(id) {
  if (state.multiSelected.has(id)) state.multiSelected.delete(id);
  else state.multiSelected.add(id);
  updateMultiHighlight();
  updateMultiChip();
}

function setMultiSelect(on) {
  state.multiSelect = on;
  if (on) {
    state.selectedId = null;
    tc.detach();
    updateUIState();
  } else {
    state.multiSelected.clear();
    updateMultiHighlight();
  }
  const tile = document.getElementById('tile-multi');
  if (tile) tile.classList.toggle('on', on);
  updateMultiChip();
  toast(on ? 'وضع التحديد المتعدد — انقر على القطع' : 'خروج من التحديد المتعدد');
  if (on) closeSettingsSheet();
}

// اعتراض النقر على الكانفاس عند وضع التحديد المتعدد
let _multiDown = null;




// ═══════════════════════════════════════════════════════════
// تصدير GLB حقيقي
// ═══════════════════════════════════════════════════════════
async function exportGLB() {
  if (!state.root || !state.json) { toast('لا يوجد منتج'); return; }
  try {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    // انسخ الشجرة لتفادي تعديل الأصل
    const clone = state.root.clone(true);
    clone.traverse(o => {
      if (o.isMesh && o.material) {
        // تأكد أن كل المواد قابلة للتصدير
        o.material = o.material.clone();
      }
    });
    exporter.parse(clone, (result) => {
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.json.id || 'model'}.glb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('تم تصدير GLB');
    }, (err) => {
      console.error(err);
      toast('فشل تصدير GLB');
    }, { binary: true });
  } catch (err) {
    console.error(err);
    toast('خطأ: ' + err.message);
  }
}
window.exportGLB = exportGLB;

// ═══════════════════════════════════════════════════════════
// ربط الأزرار الموجودة في نافذة الإعدادات
// (نستبدل onclick القديم — الأخير يفوز)
// ═══════════════════════════════════════════════════════════

const _tMultiEl = document.getElementById('tile-multi');
if (_tMultiEl) _tMultiEl.onclick = () => setMultiSelect(!state.multiSelect);

const _tDimsEl = document.getElementById('tile-dims');
if (_tDimsEl) _tDimsEl.onclick = () => {
  _tDimsEl.classList.toggle('on');
  state.showDimensions = _tDimsEl.classList.contains('on');
  refreshDimLabels();
  toast(state.showDimensions ? 'عرض الأبعاد: مفعّل' : 'عرض الأبعاد: معطّل');
};

const _tExportEl = document.getElementById('tile-export');
if (_tExportEl) _tExportEl.onclick = () => {
  closeSettingsSheet();
  setTimeout(() => exportGLB(), 200);
};

const _tSnapEl = document.getElementById('tile-snap');
if (_tSnapEl) _tSnapEl.onclick = () => {
  _tSnapEl.classList.toggle('on');
  state.snapEnabled = _tSnapEl.classList.contains('on');
  toast(state.snapEnabled ? 'محاذاة: مفعّلة (كل 5 سم)' : 'محاذاة: معطّلة');
};

const _tCenterEl = document.getElementById('tile-center');
if (_tCenterEl) _tCenterEl.onclick = () => {
  _tCenterEl.classList.toggle('on');
  state.autoCenter = _tCenterEl.classList.contains('on');
  toast(state.autoCenter ? 'تمركز مغناطيسي: مفعّل' : 'تمركز مغناطيسي: معطّل');
};

const _tRoundEl = document.getElementById('tile-round');
if (_tRoundEl) {
  const _vals = [0, 1, 5, 15];
  _tRoundEl.onclick = () => {
    const cur = state.roundRot ?? 0;
    const i = (_vals.indexOf(cur) + 1) % _vals.length;
    state.roundRot = _vals[i];
    const txt = _tRoundEl.querySelector('text');
    if (txt) txt.textContent = _vals[i] === 0 ? '—' : _vals[i];
    _tRoundEl.classList.toggle('on', _vals[i] > 0);
    toast('تدوير دائري: ' + (_vals[i] === 0 ? 'معطّل' : _vals[i] + '°'));
  };
}

// أضف زر Delete لحذف القطع المحددة متعددة
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && state.multiSelect && state.multiSelected.size) {
    const chip = document.getElementById('multi-chip');
    const btn = chip?.querySelector('#multi-del');
    if (btn) btn.click();
  }
});

// ═══════════════════════════════════════════════════════════
// كاشف أخطاء مرئي (مؤقت للتشخيص)
// ═══════════════════════════════════════════════════════════
window.addEventListener('error', (e) => {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef5350;color:#fff;padding:10px 14px;z-index:99999;font-family:monospace;font-size:11px;direction:ltr;text-align:left;line-height:1.4;word-break:break-all;';
  box.textContent = '⚠ JS ERROR: ' + e.message + ' | ' + (e.filename || '').split('/').pop() + ':' + e.lineno;
  box.onclick = () => box.remove();
  document.body.appendChild(box);
});
window.addEventListener('unhandledrejection', (e) => {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:50px;left:0;right:0;background:#ff8f00;color:#fff;padding:10px 14px;z-index:99999;font-family:monospace;font-size:11px;direction:ltr;text-align:left;word-break:break-all;';
  box.textContent = '⚠ PROMISE: ' + (e.reason?.message || e.reason || 'unknown');
  box.onclick = () => box.remove();
  document.body.appendChild(box);
});

console.log('✔ editor.js loaded successfully');

// ═══════════════════════════════════════════════════════════
// مزامنة حالة أزرار Snap مع الحالة الفعلية + snap عند نهاية السحب
// ═══════════════════════════════════════════════════════════

// الأزرار تبدأ بـ "on" في HTML → اجعل الحالة true
state.snapEnabled = true;
state.autoCenter = true;

// إعادة ربط زر المحاذاة
const _snapBtn = document.getElementById('tile-snap');
if (_snapBtn) {
  _snapBtn.classList.toggle('on', state.snapEnabled);
  _snapBtn.onclick = () => {
    state.snapEnabled = !state.snapEnabled;
    _snapBtn.classList.toggle('on', state.snapEnabled);
    toast(state.snapEnabled ? '✓ محاذاة 5سم: مفعّلة' : '✗ محاذاة: معطّلة');
  };
}

// إعادة ربط زر التمركز



// Snap إضافي عند نهاية السحب (لضمان الالتصاق)
tc.addEventListener('dragging-changed', (e) => {
  if (e.value === false && state.selectedId) {
    setTimeout(() => onTransformChange(), 5);
  }
});

// ═══════════════════════════════════════════════════════════
// محرك الالتصاق الذكي — أوجه + مراكز + حواف + محاور
// ═══════════════════════════════════════════════════════════

// يعيد 6 أوجه + المركز لقطعة (إحداثيات عالمية)
// الأوجه المتقابلة (تُفضَّل في التصاق الوجه بالوجه)

// يبحث عن أفضل التصاق ويعيد { dx, dy, dz, label, dist }
// يطبّق التصاق ذكي على القطعة الحالية (عند نهاية السحب)


// ═══════════════════════════════════════════════════════════
// تفعيل محرك الالتصاق + إعادة ربط الأزرار
// ═══════════════════════════════════════════════════════════

state.snapEnabled = true;     // شبكة 5سم
state.snapToElements = true;  // محرك الالتصاق الذكي
state.autoCenter = false;     // إلغاء القديم

// استمع لنهاية السحب وطبّق التصاق
tc.addEventListener('dragging-changed', (e) => {
  if (e.value === false && state.selectedId && state.snapToElements) {
    // مهلة بسيطة حتى يستقر الوضع
    
  }
});

// زر المحاذاة (شبكة)
const _sBtn = document.getElementById('tile-snap');
if (_sBtn) {
  _sBtn.classList.toggle('on', state.snapEnabled);
  _sBtn.onclick = () => {
    state.snapEnabled = !state.snapEnabled;
    _sBtn.classList.toggle('on', state.snapEnabled);
    toast(state.snapEnabled ? '✓ محاذاة الشبكة 5سم' : '✗ محاذاة الشبكة معطّلة');
  };
}

// زر التمركز المغناطيسي (الآن = محرك الالتصاق الذكي)
const _cBtn = document.getElementById('tile-center');
if (_cBtn) {
  _cBtn.classList.toggle('on', state.snapToElements);
  _cBtn.onclick = () => {
    state.snapToElements = !state.snapToElements;
    _cBtn.classList.toggle('on', state.snapToElements);
    toast(state.snapToElements ? '✓ التصاق ذكي: مفعّل' : '✗ التصاق ذكي: معطّل');
  };
}

console.log('✔ محرك الالتصاق الذكي جاهز');

// ═══════════════════════════════════════════════════════════
// محرك التصاق لحظي + خط مسافة + إبراز الوجه
// ═══════════════════════════════════════════════════════════

// ---- مجموعة المرئيات ----
const _snapVizGroup = new THREE.Group();
_snapVizGroup.renderOrder = 999;
S.scene.add(_snapVizGroup);

// خط متقطع أخضر (للأرضية أو للعنصر)
const _snapLineGeom = new THREE.BufferGeometry();
_snapLineGeom.setAttribute('position',
  new THREE.BufferAttribute(new Float32Array(6), 3));
const _snapLineMat = new THREE.LineDashedMaterial({
  color: 0x4caf7d, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.95
});
const _snapLine = new THREE.Line(_snapLineGeom, _snapLineMat);
_snapLine.frustumCulled = false;
_snapLine.visible = false;
_snapVizGroup.add(_snapLine);

// مستوي الإبراز الأخضر (لوجه التلامس)
const _snapHLMat = new THREE.MeshBasicMaterial({
  color: 0x4caf7d, transparent: true, opacity: 0.42,
  side: THREE.DoubleSide, depthWrite: false, depthTest: true
});
const _snapHL = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), _snapHLMat);
_snapHL.visible = false;
_snapHL.renderOrder = 998;
_snapVizGroup.add(_snapHL);

// تسمية HTML
const _snapLabel = document.createElement('div');
_snapLabel.id = 'snap-distance-label';
document.body.appendChild(_snapLabel);

// موضع عالمي محفوظ لإعادة الإسقاط كل إطار
let _snapLabelWorld = new THREE.Vector3();
let _snapLabelVisible = false;

function _projectAndPlaceLabel(worldPos, text) {
  _snapLabelWorld.copy(worldPos);
  _snapLabel.textContent = text;
  const v = worldPos.clone().project(S.camera);
  const rect = canvas.getBoundingClientRect();
  _snapLabel.style.left = ((v.x * 0.5 + 0.5) * rect.width) + 'px';
  _snapLabel.style.top  = ((-v.y * 0.5 + 0.5) * rect.height) + 'px';
  _snapLabel.classList.add('show');
  _snapLabelVisible = true;
}

function _hideSnapLabel() {
  _snapLabel.classList.remove('show');
  _snapLabelVisible = false;
}

// ---- ربط الالتصاق بأرضية ----
function _clampToFloor(d) {
  d.group.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(d.group);
  if (bbox.min.y < 0) {
    d.group.position.y -= bbox.min.y;
    d.group.updateMatrixWorld(true);
    return true;
  }
  return false;
}

// ---- التصاق لحظي مغناطيسي ----
// ---- محدّث المرئيات (يُستدعى عند كل تغيير) ----
// ---- Hook بعد كل تغيير من gizmo ----


// ---- إعادة إسقاط التسمية كل إطار (لو تحرك الكاميرا) ----
S.addUpdater(() => {
  if (_snapLabelVisible) {
    const v = _snapLabelWorld.clone().project(S.camera);
    const rect = canvas.getBoundingClientRect();
    _snapLabel.style.left = ((v.x * 0.5 + 0.5) * rect.width) + 'px';
    _snapLabel.style.top  = ((-v.y * 0.5 + 0.5) * rect.height) + 'px';
  }
  // إخفاء عند عدم وجود اختيار
  if (!state.selectedId) {
    if (_snapLine.visible) _snapLine.visible = false;
    if (_snapHL.visible) _snapHL.visible = false;
    if (_snapLabelVisible) _hideSnapLabel();
  } else if (!tc.dragging) {
    // إخفاء تسمية العنصر (المغناطيسي) بعد الإفلات مع إبقاء خط الأرضية
    const d = state.root?.userData?.parts.get(state.selectedId);
    if (d) {
      const pos = d.group.position;
      d.group.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(d.group);
      const botY = bbox.min.y;
      // إظهار خط الأرضية حتى بدون سحب
      if (botY > 0.5 && state.mode === 'translate') {
        _snapLine.visible = true;
        const arr = _snapLineGeom.attributes.position.array;
        arr[0] = pos.x; arr[1] = botY; arr[2] = pos.z;
        arr[3] = pos.x; arr[4] = 0;    arr[5] = pos.z;
        _snapLineGeom.attributes.position.needsUpdate = true;
        _snapLine.computeLineDistances();
      } else {
        _snapLine.visible = false;
      }
    }
  }
});

// ---- إخفاء عند إلغاء التحديد ----
const _oldDeselect = deselectAll;
deselectAll = function() {
  _oldDeselect();
  _snapLine.visible = false;
  _snapHL.visible = false;
  _hideSnapLabel();
};

// ---- إخفاء عند تبديل الوضع إلى rotate/scale ----
$$('.ptool[data-tool]').forEach(b => {
  const _old = b.onclick;
  b.onclick = (e) => {
    if (_old) _old.call(b, e);
    if (state.mode !== 'translate') {
      _snapLine.visible = false;
      _snapHL.visible = false;
      _hideSnapLabel();
    }
  };
});

console.log('✔ محرك الالتصاق اللحظي جاهز');

// ═══════════════════════════════════════════════════════════
// محرك التصاق شامل: 27 نقطة مرجعية لكل عنصر (bbox)
//  - 8 زوايا
//  - 6 مراكز أوجه
//  - 12 منتصف حواف
//  - 1 مركز
// ═══════════════════════════════════════════════════════════

function _bboxOf(obj) {
  return new THREE.Box3().setFromObject(obj);
}

function _worldCenter(obj) {
  const bb = _bboxOf(obj);
  return bb.getCenter(new THREE.Vector3());
}

function _anchorsFromBBox(bb) {
  const min = bb.min, max = bb.max;
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const cz = (min.z + max.z) / 2;
  const pts = [];

  // 8 زوايا
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z])
        pts.push({ x, y, z, type: 'corner' });

  // 6 مراكز أوجه (type:face، axis، side)
  pts.push({ x: min.x, y: cy, z: cz, type: 'face', axis: 'x', side: -1 });
  pts.push({ x: max.x, y: cy, z: cz, type: 'face', axis: 'x', side: +1 });
  pts.push({ x: cx, y: min.y, z: cz, type: 'face', axis: 'y', side: -1 });
  pts.push({ x: cx, y: max.y, z: cz, type: 'face', axis: 'y', side: +1 });
  pts.push({ x: cx, y: cy, z: min.z, type: 'face', axis: 'z', side: -1 });
  pts.push({ x: cx, y: cy, z: max.z, type: 'face', axis: 'z', side: +1 });

  // 12 منتصف حافة
  // موازية لـ X
  for (const y of [min.y, max.y])
    for (const z of [min.z, max.z])
      pts.push({ x: cx, y, z, type: 'edge', edges: ['y', 'z'] });
  // موازية لـ Y
  for (const x of [min.x, max.x])
    for (const z of [min.z, max.z])
      pts.push({ x, y: cy, z, type: 'edge', edges: ['x', 'z'] });
  // موازية لـ Z
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      pts.push({ x, y, z: cz, type: 'edge', edges: ['x', 'y'] });

  // المركز
  pts.push({ x: cx, y: cy, z: cz, type: 'center' });

  return pts;
}

// ترجيح الأزواج (أقل = أفضل)
function _pairScore(a, b) {
  if (a.type === 'center' && b.type === 'center') return 5;
  if (a.type === 'face' && b.type === 'face') {
    if (a.axis === b.axis && a.side !== b.side) return 0;   // وجه مقابل وجه
    if (a.axis === b.axis) return 100;                       // متوازيان
    return 55;                                               // متعامدان
  }
  if (a.type === 'edge' && b.type === 'edge') {
    const same = a.edges[0] === b.edges[0] && a.edges[1] === b.edges[1];
    return same ? 12 : 55;
  }
  if (a.type === 'corner' && b.type === 'corner') return 8;
  // مختلط
  if ((a.type === 'edge' && b.type === 'corner') ||
      (a.type === 'corner' && b.type === 'edge')) return 18;
  if ((a.type === 'face' && b.type === 'edge') ||
      (a.type === 'edge' && b.type === 'face')) return 35;
  if ((a.type === 'face' && b.type === 'corner') ||
      (a.type === 'corner' && b.type === 'face')) return 25;
  return 40;
}

function _findElementSnapV2(movingGroup, otherParts, movingId, threshold = 12) {
  const bbA = _bboxOf(movingGroup);
  const A = _anchorsFromBBox(bbA);
  let best = null;
  let bestScore = Infinity;
  const th2 = threshold * threshold;

  for (const [oid, od] of otherParts) {
    if (oid === movingId) continue;
    const bbB = _bboxOf(od.group);
    const B = _anchorsFromBBox(bbB);
    for (const a of A) {
      for (const b of B) {
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 > th2) continue;
        const dist = Math.sqrt(d2);
        const score = _pairScore(a, b) + dist;
        if (score < bestScore) {
          bestScore = score;
          best = { dx, dy, dz, dist, aType: a.type, bType: b.type };
        }
      }
    }
  }
  return best;
}

function _anchorLabel(s) {
  if (!s) return '';
  const t = (x) => ({ face: 'وجه', edge: 'حافة', corner: 'زاوية', center: 'مركز' }[x] || x);
  return `${t(s.aType)}↔${t(s.bType)}`;
}

// التصاق لحظي
function _applyLiveSnapV2(d) {
  const snap = _findElementSnapV2(d.group, state.root.userData.parts, state.selectedId, 4);
  if (snap) {
    d.group.position.x += snap.dx;
    d.group.position.y += snap.dy;
    d.group.position.z += snap.dz;
    return snap;
  }
  return null;
}

// منع النزول تحت الأرض
function _clampToFloorV2(d) {
  d.group.updateMatrixWorld(true);
  const bb = _bboxOf(d.group);
  if (bb.min.y < 0) {
    d.group.position.y -= bb.min.y;
    d.group.updateMatrixWorld(true);
    return true;
  }
  return false;
}

console.log('✔ محرك التصاق شامل جاهز');

// ═══════════════════════════════════════════════════════════
// applyTransform + onTransformChange الجديدين
// ═══════════════════════════════════════════════════════════

function applyTransform(d) {
  const p = d.def;
  if (p.axis && p.pivot) {
    d.group.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
    d.mesh.position.set(p.pos[0]-p.pivot[0], p.pos[1]-p.pivot[1], p.pos[2]-p.pivot[2]);
  } else {
    d.group.position.set(p.pos[0], p.pos[1], p.pos[2]);
    d.mesh.position.set(0, 0, 0);
  }
  d.group.userData.basePos = d.group.position.clone();
}

function onTransformChange() {
  if (!state.selectedId) return;
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  const p = d.def;

  // ═══ تدوير دائري ═══
  if (state.roundRot > 0 && state.mode === 'rotate') {
    const step = state.roundRot * Math.PI / 180;
    d.group.rotation.x = Math.round(d.group.rotation.x / step) * step;
    d.group.rotation.y = Math.round(d.group.rotation.y / step) * step;
    d.group.rotation.z = Math.round(d.group.rotation.z / step) * step;
  }
  p.rotation = [d.group.rotation.x, d.group.rotation.y, d.group.rotation.z];

  // ═══ القياس ═══
  if (state.mode === 'scale') {
    const base = p.size.slice();
    const sc = d.group.scale;
    let newSize = [
      Math.max(1, +(base[0] * sc.x).toFixed(1)),
      Math.max(1, +(base[1] * sc.y).toFixed(1)),
      Math.max(1, +(base[2] * sc.z).toFixed(1))
    ];
    if (state.snapEnabled) newSize = newSize.map(v => Math.max(1, Math.round(v / 5) * 5));
    p.size = newSize;
    d.group.scale.set(1, 1, 1);
    const shapeId = p.shape || p.type || 'box';
    d.mesh.geometry.dispose();
    d.mesh.geometry = buildGeometry(shapeId, newSize, p.options || {});
    // gizmo في المركز — لا حاجة لإزاحة
  }

  // ═══ Snap الشبكة 5سم ═══
  if (state.snapEnabled && state.mode === 'translate') {
    d.group.position.x = Math.round(d.group.position.x / 5) * 5;
    d.group.position.z = Math.round(d.group.position.z / 5) * 5;
  }

  // ═══ Snap مغناطيسي لحظي (عتبة 4سم) ═══
  if (state.snapToElements && state.mode === 'translate') {
    _applyLiveSnapV2(d);
  }

  // ═══ منع النزول تحت الأرض ═══
  _clampToFloorV2(d);

  // ═══ كتابة القيم في p ═══
  const gp = d.group.position;
  if (p.axis && p.pivot) {
    p.pivot = [gp.x, gp.y, gp.z];
    d.mesh.position.set(p.pos[0] - gp.x, p.pos[1] - gp.y, p.pos[2] - gp.z);
  } else {
    p.pos = [gp.x, gp.y, gp.z];
  }
  d.group.userData.basePos = d.group.position.clone();
  syncInputsFromPart();
  if (state.measuring) updateMeasure();
  _updateSnapVisualsV2(d);
}

// ═══════════════════════════════════════════════════════════
// مرئيات التصاق (خط + تسمية + إبراز الوجه)
// ═══════════════════════════════════════════════════════════
let _snapVizGroup2 = null;
let _snapLine2 = null;
let _snapHL2 = null;
let _snapLabel2 = null;

function _initSnapViz2() {
  if (_snapVizGroup2) return;
  _snapVizGroup2 = new THREE.Group();
  S.scene.add(_snapVizGroup2);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  _snapLine2 = new THREE.Line(g, new THREE.LineDashedMaterial({
    color: 0x4caf7d, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.95
  }));
  _snapLine2.frustumCulled = false;
  _snapLine2.visible = false;
  _snapVizGroup2.add(_snapLine2);

  _snapHL2 = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x4caf7d, transparent: true, opacity: 0.42,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  _snapHL2.visible = false;
  _snapVizGroup2.add(_snapHL2);

  _snapLabel2 = document.createElement('div');
  _snapLabel2.id = 'snap-distance-label';
  document.body.appendChild(_snapLabel2);
}
_initSnapViz2();

let _snapLabelWorld2 = new THREE.Vector3();
let _snapLabelVisible2 = false;

function _showLabel2(worldPos, text) {
  _snapLabelWorld2.copy(worldPos);
  _snapLabel2.textContent = text;
  const v = worldPos.clone().project(S.camera);
  const rect = canvas.getBoundingClientRect();
  _snapLabel2.style.left = ((v.x * 0.5 + 0.5) * rect.width) + 'px';
  _snapLabel2.style.top  = ((-v.y * 0.5 + 0.5) * rect.height) + 'px';
  _snapLabel2.classList.add('show');
  _snapLabelVisible2 = true;
}
function _hideLabel2() {
  _snapLabel2.classList.remove('show');
  _snapLabelVisible2 = false;
}

function _updateSnapVisualsV2(d) {
  if (!d) {
    _snapLine2.visible = false;
    _snapHL2.visible = false;
    _hideLabel2();
    return;
  }
  d.group.updateMatrixWorld(true);
  const bb = _bboxOf(d.group);
  const ctr = bb.getCenter(new THREE.Vector3());

  // خط الأرضية
  let showed = false;
  if (bb.min.y > 0.5 && state.mode === 'translate') {
    _snapLine2.visible = true;
    const a = _snapLine2.geometry.attributes.position.array;
    a[0] = ctr.x; a[1] = bb.min.y; a[2] = ctr.z;
    a[3] = ctr.x; a[4] = 0;        a[5] = ctr.z;
    _snapLine2.geometry.attributes.position.needsUpdate = true;
    _snapLine2.computeLineDistances();
    const midY = bb.min.y / 2;
    _showLabel2(new THREE.Vector3(ctr.x, midY, ctr.z), bb.min.y.toFixed(1));
    showed = true;
  } else {
    _snapLine2.visible = false;
  }

  // التصاق بالعناصر
  const snap = _findElementSnapV2(d.group, state.root.userData.parts, state.selectedId, 14);
  if (snap) {
    const size = d.def.size || [1, 1, 1];
    const ax = Math.abs(snap.dx), ay = Math.abs(snap.dy), az = Math.abs(snap.dz);
    const maxA = Math.max(ax, ay, az);
    _snapHL2.visible = true;
    _snapHL2.rotation.set(0, 0, 0);

    const contactX = ctr.x + snap.dx;
    const contactY = ctr.y + snap.dy;
    const contactZ = ctr.z + snap.dz;

    if (ay === maxA && ay > 0.05) {
      _snapHL2.rotation.x = -Math.PI / 2;
      _snapHL2.scale.set(size[0] * 1.015, size[2] * 1.015, 1);
      _snapHL2.position.set(ctr.x, contactY, ctr.z);
    } else if (ax === maxA && ax > 0.05) {
      _snapHL2.rotation.y = Math.PI / 2;
      _snapHL2.scale.set(size[2] * 1.015, size[1] * 1.015, 1);
      _snapHL2.position.set(contactX, ctr.y, ctr.z);
    } else {
      _snapHL2.scale.set(size[0] * 1.015, size[1] * 1.015, 1);
      _snapHL2.position.set(ctr.x, ctr.y, contactZ);
    }

    const contact = new THREE.Vector3(
      (ctr.x + contactX) / 2, (ctr.y + contactY) / 2, (ctr.z + contactZ) / 2
    );
    _showLabel2(contact, snap.dist < 0.3 ? '0.0' : snap.dist.toFixed(1));
    showed = true;
  } else {
    _snapHL2.visible = false;
  }

  if (!showed) _hideLabel2();
}

// إعادة إسقاط التسمية كل إطار
S.addUpdater(() => {
  if (_snapLabelVisible2) {
    const v = _snapLabelWorld2.clone().project(S.camera);
    const rect = canvas.getBoundingClientRect();
    _snapLabel2.style.left = ((v.x * 0.5 + 0.5) * rect.width) + 'px';
    _snapLabel2.style.top  = ((-v.y * 0.5 + 0.5) * rect.height) + 'px';
  }
  if (!state.selectedId) {
    if (_snapLine2.visible) _snapLine2.visible = false;
    if (_snapHL2.visible) _snapHL2.visible = false;
    if (_snapLabelVisible2) _hideLabel2();
  }
});

// إخفاء عند إلغاء التحديد
if (typeof deselectAll === 'function') {
  const _oldDesel = deselectAll;
  deselectAll = function() {
    _oldDesel.apply(this, arguments);
    if (_snapLine2) _snapLine2.visible = false;
    if (_snapHL2) _snapHL2.visible = false;
    _hideLabel2();
  };
}

console.log('✔ مرئيات التصاق شامل جاهزة');

// ═══════════════════════════════════════════════════════════
// مزامنة الإدخالات + الإضافة عند تحريك الحقول
// ═══════════════════════════════════════════════════════════
const _oldSync = syncInputsFromPart;
syncInputsFromPart = function() {
  if (_oldSync) _oldSync.apply(this, arguments);
  // p.pos = المركز — يظهر كما هو في الحقول
};

// حقول X/Y/Z: تُعدّل p.pos ثم applyTransform
['x','y','z'].forEach((axis, idx) => {
  const el = $(`#in-${axis}`);
  if (!el) return;
  const _old = el.oninput;
  el.oninput = (e) => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d) return;
    const v = parseFloat(e.target.value) || 0;
    d.def.pos[idx] = v;
    if (d.def.axis && d.def.pivot) {
      d.mesh.position.set(
        d.def.pos[0] - d.def.pivot[0],
        d.def.pos[1] - d.def.pivot[1],
        d.def.pos[2] - d.def.pivot[2]
      );
    } else {
      d.group.position.set(d.def.pos[0], d.def.pos[1], d.def.pos[2]);
      d.mesh.position.set(0, 0, 0);
      _clampToFloorV2(d);
    }
    d.group.userData.basePos = d.group.position.clone();
  };
});

// حقول W/H/D: تعدّل الحجم + إزاحة الـmesh
['w','h','d'].forEach((axis, idx) => {
  const el = $(`#in-${axis}`);
  if (!el) return;
  const _old = el.oninput;
  el.oninput = (e) => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d) return;
    let v = Math.max(1, parseFloat(e.target.value) || 1);
    if (state.linkScale) {
      d.def.size = [v, v, v];
      ['w','h','d'].forEach(k => { const e2 = $(`#in-${k}`); if (e2 !== e.target) e2.value = v; });
    } else {
      d.def.size[idx] = v;
    }
    const shapeId = d.def.shape || d.def.type || 'box';
    d.mesh.geometry.dispose();
    d.mesh.geometry = buildGeometry(shapeId, d.def.size, d.def.options || {});
    if (!d.def.axis) {
      _clampToFloorV2(d);
    }
  };
});

console.log('✔ مزامنة الإدخالات جاهزة');

// ═══════════════════════════════════════════════════════════
// إعادة تعريف شريحة التحديد المتعدد — مع زرَّي CSG
// ═══════════════════════════════════════════════════════════

updateMultiChip = function() {
  let chip = document.getElementById('multi-chip');
  if (!state.multiSelect) { if (chip) chip.remove(); return; }

  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'multi-chip';
    chip.innerHTML = `
      <span id="multi-count">0 محدد</span>
      <button id="multi-sub" title="اقتطاع (طرح)">⊖</button>
      <button id="multi-union" title="دمج">⊕</button>
      <button id="multi-del" title="حذف">🗑</button>
      <button id="multi-dup" title="نسخ">⧉</button>
      <button id="multi-exit" title="خروج">✕</button>
    `;
    document.body.appendChild(chip);

    chip.querySelector('#multi-sub').onclick = () => performCSG('subtract');
    chip.querySelector('#multi-union').onclick = () => performCSG('union');
    chip.querySelector('#multi-del').onclick = () => {
      if (!state.multiSelected.size) return;
      if (!confirm('حذف ' + state.multiSelected.size + ' عنصر؟')) return;
      snapshot();
      state.json.parts = state.json.parts.filter(p => !state.multiSelected.has(p.id));
      state.multiSelected.clear();
      rebuildFromJson();
      updateMultiHighlight();
      updateMultiChip();
    };
    chip.querySelector('#multi-dup').onclick = () => {
      if (!state.multiSelected.size) return;
      snapshot();
      const clones = [];
      for (const id of state.multiSelected) {
        const p = state.json.parts.find(x => x.id === id);
        if (!p) continue;
        const c = JSON.parse(JSON.stringify(p));
        c.id = newPartId(p.shape || p.type);
        c.pos = [p.pos[0] + 30, p.pos[1], p.pos[2]];
        if (c.pivot) c.pivot = [p.pivot[0] + 30, p.pivot[1], p.pivot[2]];
        clones.push(c);
      }
      state.json.parts.push(...clones);
      state.multiSelected.clear();
      rebuildFromJson();
      updateMultiHighlight();
      updateMultiChip();
    };
    chip.querySelector('#multi-exit').onclick = () => setMultiSelect(false);
  }

  const cnt = state.multiSelected.size;
  chip.querySelector('#multi-count').textContent = cnt + ' محدد';
  const showCsg = cnt >= 2 ? '' : 'none';
  chip.querySelector('#multi-sub').style.display = showCsg;
  chip.querySelector('#multi-union').style.display = showCsg;
};

// ═══════════════════════════════════════════════════════════
// حماية: منع إعادة بناء الهندسة لقطع CSG
// ═══════════════════════════════════════════════════════════

const _origApplyGeometry = (typeof applyGeometry === 'function') ? applyGeometry : null;
if (typeof applyGeometry === 'function') {
  applyGeometry = function(d) {
    const p = d.def;
    const shapeId = p.shape || p.type || 'box';
    if (shapeId === 'csg' && p.csg) {
      // CSG: نطبق scale فقط
      const base = p.csg.baseSize || [1, 1, 1];
      d.mesh.scale.set(
        Math.max(0.01, p.size[0] / base[0]),
        Math.max(0.01, p.size[1] / base[1]),
        Math.max(0.01, p.size[2] / base[2])
      );
      return;
    }
    if (_origApplyGeometry) _origApplyGeometry(d);
  };
}

// إعادة ربط حقول W/H/D لتستخدم applyGeometry الآمن
['w', 'h', 'd'].forEach((axis, idx) => {
  const el = $(`#in-${axis}`);
  if (!el) return;
  const _prev = el.oninput;
  el.oninput = (e) => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d) return;
    const p = d.def;
    let v = Math.max(1, parseFloat(e.target.value) || 1);
    if (state.linkScale) {
      p.size = [v, v, v];
      ['w', 'h', 'd'].forEach(k => { const e2 = $(`#in-${k}`); if (e2 !== e.target) e2.value = v; });
    } else {
      p.size[idx] = v;
    }
    const shapeId = p.shape || p.type || 'box';
    if (shapeId === 'csg' && p.csg) {
      const base = p.csg.baseSize || [1, 1, 1];
      d.mesh.scale.set(
        Math.max(0.01, p.size[0] / base[0]),
        Math.max(0.01, p.size[1] / base[1]),
        Math.max(0.01, p.size[2] / base[2])
      );
    } else {
      d.mesh.geometry.dispose();
      d.mesh.geometry = buildGeometry(shapeId, p.size, p.options || {});
    }
    _clampToFloorV2(d);
  };
});

console.log('✔ CSG جاهز');

// ═══════════════════════════════════════════════════════════
// حماية إضافية: إذا توقف الـrenderer، أعد تفعيله
// ═══════════════════════════════════════════════════════════
let _lastFrameTime = performance.now();
let _stuckCheck = setInterval(() => {
  const now = performance.now();
  if (now - _lastFrameTime > 3000 && !document.hidden) {
    // مرّت 3 ثوانٍ بدون إطار → حاول إعادة التفعيل
    try {
      S.controls.enabled = true;
      S.controls.update();
      S.renderer.render(S.scene, S.camera);
    } catch (e) { console.warn('recovery failed', e); }
  }
  _lastFrameTime = now;
}, 2000);

S.addUpdater(() => { _lastFrameTime = performance.now(); });

console.log('✔ CSG آمن جاهز');
// ═══════════════════════════════════════════════════════════
// تنظيف: احذف أي قطعة CSG ضخمة من IndexedDB
// ═══════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════
// CSG v3 — نسخة موثوقة مع تشخيص كامل
// ═══════════════════════════════════════════════════════════

console.log('✔ CSG v3 جاهز');

// ═══════════════════════════════════════════════════════════
// التحديد المتعدد — إصلاح جذري
// (لا نعترض أحداث OrbitControls أبداً)
// ═══════════════════════════════════════════════════════════

let _msDown = null;
let _msDragging = false;

canvas.addEventListener('pointerdown', (e) => {
  if (!state.multiSelect) return;
  _msDown = { x: e.clientX, y: e.clientY, t: Date.now() };
  _msDragging = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.multiSelect || !_msDown) return;
  if (Math.hypot(e.clientX - _msDown.x, e.clientY - _msDown.y) > 6) {
    _msDragging = true;
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!state.multiSelect || !_msDown) return;
  const dx = e.clientX - _msDown.x;
  const dy = e.clientY - _msDown.y;
  const dt = Date.now() - _msDown.t;
  const dragged = _msDragging || Math.hypot(dx, dy) > 6 || dt > 500;
  _msDown = null;
  _msDragging = false;

  // سحب → لا تفعل شيئاً (OrbitControls يعمل)
  if (dragged) return;

  // نقرة قصيرة → تحديد
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, S.camera);
  const hits = raycaster.intersectObjects(state.root.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.partId) o = o.parent;
    if (o && o.userData.partId) {
      toggleMultiSelection(o.userData.partId);
      return;
    }
  }
  // نقرة على فراغ → إلغاء كل التحديد
  state.multiSelected.clear();
  updateMultiHighlight();
  updateMultiChip();
});

console.log('✔ مستمع التحديد المتعدد (bubble) جاهز');

// ═══════════════════════════════════════════════════════════
// performCSG — نسخة نهائية موثوقة
// ═══════════════════════════════════════════════════════════
async function performCSG(mode) {
  // 1) حفظ الاختيار
  const savedIds = [...state.multiSelected];
  if (savedIds.length < 2) {
    toast('اختر عنصرين على الأقل');
    return;
  }

  // 2) الخروج من وضع التحديد المتعدد (قبل أي شيء)
  state.multiSelect = false;
  const chipEl = document.getElementById('multi-chip');
  if (chipEl) chipEl.remove();
  updateMultiHighlight();

  // 3) حفظ الكاميرا
  const cam = {
    pos: S.camera.position.clone(),
    quat: S.camera.quaternion.clone(),
    up: S.camera.up.clone(),
    target: S.controls.target.clone(),
    near: S.camera.near,
    far: S.camera.far
  };

  // 4) قفل التحكم + مؤشر
  S.controls.enabled = false;
  tc.detach();
  const prevCursor = document.body.style.cursor;
  document.body.style.cursor = 'wait';

  const loadEl = document.createElement('div');
  loadEl.textContent = mode === 'subtract' ? 'جاري الاقتطاع…' : 'جاري الدمج…';
  loadEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(28,32,40,0.96);color:#fff;padding:14px 22px;border-radius:14px;font-size:14px;font-weight:700;z-index:9999;border:1px solid rgba(59,130,246,0.5);font-family:inherit;';
  document.body.appendChild(loadEl);

  let success = false;
  let newId = null;

  try {
    // 5) المكتبة
    console.log('[CSG] importing library…');
    const csgMod = await import('three-bvh-csg');
    const { Evaluator, Brush, SUBTRACTION, ADDITION } = csgMod;
    if (!Evaluator || !Brush) throw new Error('المكتبة غير محملة');

    // 6) القطع
    const parts = savedIds.map(id => state.json.parts.find(p => p.id === id)).filter(Boolean);
    if (parts.length < 2) throw new Error('عناصر غير كافية');

    // 7) brushes بإحداثيات عالمية
    const brushes = [];
    for (const p of parts) {
      const d = state.root.userData.parts.get(p.id);
      if (!d) { console.warn('[CSG] missing', p.id); continue; }

      d.mesh.updateWorldMatrix(true, false);
      const worldMat = d.mesh.matrixWorld.clone();

      let geo;
      if (p.shape === 'csg' && p.csg && p.csg.positions) {
        geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(p.csg.positions, 3));
        if (p.csg.normals && p.csg.normals.length) {
          geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.csg.normals, 3));
        } else {
          geo.computeVertexNormals();
        }
        if (p.csg.indices) geo.setIndex(p.csg.indices);
      } else {
        geo = buildGeometry(p.shape || p.type || 'box', p.size, p.options || {});
      }
      if (!geo.attributes.normal) geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const brush = new Brush(geo, mat);
      brush.matrixAutoUpdate = false;
      brush.matrix.copy(worldMat);
      brush.matrixWorld.copy(worldMat);
      brushes.push(brush);
      console.log(`[CSG] brush ${p.id} verts=${geo.attributes.position.count}`);
    }
    if (brushes.length < 2) throw new Error('لا توجد brushes كافية');

    // 8) التقييم
    const evaluator = new Evaluator();
    evaluator.attributes = ['position', 'normal'];
    evaluator.useGroups = false;

    const op = mode === 'subtract' ? SUBTRACTION : ADDITION;
    let result = brushes[0];
    for (let k = 1; k < brushes.length; k++) {
      result = evaluator.evaluate(result, brushes[k], op);
      result.updateMatrixWorld(true);
      console.log(`[CSG] step ${k} OK`);
    }

    const srcGeo = result.geometry;
    if (!srcGeo || !srcGeo.attributes.position) throw new Error('لا يوجد هندسة ناتجة');

    const vertCount = srcGeo.attributes.position.count;
    console.log('[CSG] result verts:', vertCount);
    if (vertCount === 0) throw new Error('النتيجة فارغة');
    if (vertCount > 200000) throw new Error(`كبير جداً: ${vertCount.toLocaleString()}`);

    // تحقق من NaN
    const posArr0 = srcGeo.attributes.position.array;
    for (let i = 0; i < posArr0.length; i++) {
      if (Number.isNaN(posArr0[i])) throw new Error('قيم NaN');
    }

    // 9) توسيط
    srcGeo.computeBoundingBox();
    const bb = srcGeo.boundingBox;
    if (bb.isEmpty()) throw new Error('bbox فارغ');
    const center = bb.getCenter(new THREE.Vector3());
    const sizeV = bb.getSize(new THREE.Vector3());
    console.log(`[CSG] size ${sizeV.x.toFixed(1)} × ${sizeV.y.toFixed(1)} × ${sizeV.z.toFixed(1)}`);
    srcGeo.translate(-center.x, -center.y, -center.z);

    const positions = Array.from(srcGeo.attributes.position.array);
    const normals = Array.from(srcGeo.attributes.normal.array);
    const indices = srcGeo.index ? Array.from(srcGeo.index.array) : null;

    // 10) حرّر
    brushes.forEach(b => { try { b.geometry.dispose(); b.material.dispose(); } catch {} });

    // 11) القطعة الجديدة
    newId = 'csg_' + Math.random().toString(36).slice(2, 6);
    const matId = parts[0].material?.materialId || 'sapin';
    const newPart = {
      id: newId, shape: 'csg', type: 'csg',
      size: [sizeV.x, sizeV.y, sizeV.z],
      pos: [center.x, center.y, center.z],
      rotation: [0, 0, 0],
      material: { materialId: matId },
      csg: { positions, normals, indices, baseSize: [sizeV.x, sizeV.y, sizeV.z] }
    };

    // 12) Snapshot + تعديل JSON
    snapshot();
    state.json.parts = state.json.parts.filter(p => !savedIds.includes(p.id));
    state.json.parts.push(newPart);

    // 13) إعادة بناء المشهد
    console.log('[CSG] rebuilding scene…');
    rebuildFromJson();

    success = true;
    console.log('[CSG] done');
  } catch (err) {
    console.error('[CSG ERROR]', err);
    toast('خطأ: ' + (err.message || err));
  } finally {
    // ═══ استعد الكاميرا دائمًا ═══
    try {
      S.camera.position.copy(cam.pos);
      S.camera.quaternion.copy(cam.quat);
      S.camera.up.copy(cam.up);
      S.camera.near = cam.near;
      S.camera.far = cam.far;
      S.camera.updateProjectionMatrix();
      S.controls.target.copy(cam.target);
      S.controls.enabled = true;
      S.controls.enableDamping = true;
      S.controls.enablePan = true;
      S.controls.enableRotate = true;
      S.controls.enableZoom = true;
      S.controls.update();
    } catch (e) { console.warn('camera restore failed', e); }

    // نظّف
    state.multiSelect = false;
    state.multiSelected.clear();
    updateMultiHighlight();
    updateMultiChip();
    loadEl.remove();
    document.body.style.cursor = prevCursor;

    // اختر القطعة الجديدة عند النجاح
    if (success && newId) {
      try { attachToPart(newId); } catch {}
      toast(mode === 'subtract' ? '✓ تم الاقتطاع' : '✓ تم الدمج');
    }

    // أعِد الرسم
    try { S.renderer.render(S.scene, S.camera); } catch {}
    console.log('[CSG] finally — controls restored');
  }
}

window.performCSG = performCSG;

console.log('✔ CSG v4 جاهز');

// ═══════════════════════════════════════════════════════════
// التركيز الذكي — على المحدد أو الكل
// ═══════════════════════════════════════════════════════════

// تركيز سلس (بدون قفزات)
function smartFocus(duration = 500) {
  if (!state.root) return;

  // 1) حدد هدف التركيز
  let targetBox = null;
  let focusName = '';

  if (state.selectedId && state.root.userData.parts.get(state.selectedId)) {
    // الحالة 1: قطعة محددة
    const d = state.root.userData.parts.get(state.selectedId);
    targetBox = new THREE.Box3().setFromObject(d.group);
    focusName = 'على: ' + state.selectedId;
  } else if (state.multiSelect && state.multiSelected.size > 0) {
    // الحالة 2: تحديد متعدد
    targetBox = new THREE.Box3();
    let first = true;
    for (const id of state.multiSelected) {
      const d = state.root.userData.parts.get(id);
      if (!d) continue;
      const b = new THREE.Box3().setFromObject(d.group);
      if (first) { targetBox.copy(b); first = false; }
      else targetBox.union(b);
    }
    focusName = `${state.multiSelected.size} عناصر`;
  } else if (state.root.children.length > 0) {
    // الحالة 3: الكل
    targetBox = new THREE.Box3().setFromObject(state.root);
    focusName = 'على الكل';
  } else {
    return;
  }

  if (!targetBox || targetBox.isEmpty()) return;

  // 2) احسب مركز + حجم
  const center = targetBox.getCenter(new THREE.Vector3());
  const size = targetBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  // 3) احسب المسافة المطلوبة
  const fov = S.camera.fov * Math.PI / 180;
  const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

  // 4) احفظ الاتجاه الحالي (لا نغير زاوية الرؤية)
  const currentDir = S.camera.position.clone().sub(S.controls.target).normalize();
  // إذا كان الاتجاه موازياً تماماً لـ Y (نادراً) → أضف ميلاً
  if (Math.abs(currentDir.y) > 0.99) currentDir.set(0.7, 0.5, 0.7).normalize();

  const newPos = center.clone().add(currentDir.multiplyScalar(dist));
  const newTarget = center.clone();

  // 5) حركة سلسة
  animateCamera(S.camera.position, newPos, S.controls.target, newTarget, duration);

  toast('التركيز ' + focusName);
}

// محرك تحريك سلس للكاميرا
function animateCamera(fromPos, toPos, fromTarget, toTarget, duration) {
  const start = performance.now();
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const p0 = fromPos.clone();
  const p1 = toPos.clone();
  const t0 = fromTarget.clone();
  const t1 = toTarget.clone();

  // عطّل التحكم مؤقتاً لتجنّب التعارض
  const wasEnabled = S.controls.enabled;
  S.controls.enabled = false;

  function step() {
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / duration);
    const e = ease(t);

    S.camera.position.lerpVectors(p0, p1, e);
    S.controls.target.lerpVectors(t0, t1, e);
    S.camera.lookAt(S.controls.target);
    S.controls.update();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      S.controls.enabled = wasEnabled;
    }
  }
  requestAnimationFrame(step);
}

window.smartFocus = smartFocus;

// ربط زر "المركز" في الشريط الأيسر
const _centerBtn = document.getElementById('btn-center');
if (_centerBtn) {
  _centerBtn.onclick = () => {
    try { smartFocus(500); }
    catch (e) { console.error(e); toast('تعذّر التركيز'); }
  };
}

// ═══════════════════════════════════════════════════════════
// تركيز تلقائي عند التحديد (اختياري — يمكن تعطيله)
// ═══════════════════════════════════════════════════════════
const _autoFocusOnSelect = false; // ← اجعلها true للتفعيل

if (_autoFocusOnSelect && typeof attachToPart === 'function') {
  const _origAttach = attachToPart;
  attachToPart = function(id) {
    _origAttach.apply(this, arguments);
    setTimeout(() => smartFocus(400), 30);
  };
}

console.log('✔ التركيز الذكي جاهز');

// ربط بطاقة التركيز في الإعدادات
const _tileFocus = document.getElementById('tile-focus');
if (_tileFocus) {
  _tileFocus.onclick = () => {
    closeSettingsSheet();
    setTimeout(() => smartFocus(500), 150);
  };
}

// ═══════════════════════════════════════════════════════════
// نظام الأبواب والأدراج
// ═══════════════════════════════════════════════════════════

// ربط زر 🚪
const _doorBtn = document.getElementById('btn-door');
if (_doorBtn) {
  _doorBtn.onclick = () => {
    if (!state.selectedId) { toast('اختر قطعة أولاً'); return; }
    openDoorPanel();
  };
}

function openDoorPanel() {
  if (!state.selectedId) return;
  closeSettings();
  const panel = document.getElementById('door-panel');
  panel.classList.remove('hidden');
  syncDoorPanel();
}

function closeDoorPanel() {
  document.getElementById('door-panel')?.classList.add('hidden');
}

document.getElementById('dp-close')?.addEventListener('click', closeDoorPanel);

// مزامنة الحقول مع القطعة المحددة
function syncDoorPanel() {
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  const p = d.def;
  const role = p.role || 'none';
  const motion = p.motion || {};

  // الأزرار الثلاثة
  document.querySelectorAll('.dp-type').forEach(b => {
    b.classList.toggle('active', b.dataset.role === role);
  });

  const fieldsWrap = document.getElementById('dp-motion-fields');
  const pivotSec = document.getElementById('dp-pivot-section');

  if (role === 'none') {
    fieldsWrap.classList.add('hidden');
    return;
  }
  fieldsWrap.classList.remove('hidden');

  const isSlide = (motion.type === 'slide');
  pivotSec.classList.toggle('hidden', isSlide);

  document.getElementById('dp-axis').value = motion.axis || (isSlide ? 'z' : 'y');
  document.getElementById('dp-dir').value = String(motion.direction || 1);
  document.getElementById('dp-range').value = motion.range ?? (isSlide ? 45 : 90);
  document.getElementById('dp-range-label').textContent = isSlide ? 'المدى (سم)' : 'المدى (درجة)';
  document.getElementById('dp-speed').value = motion.speed ?? 8;
  document.getElementById('dp-label').value = motion.label || '';

  const pv = motion.pivot || p.pos || [0, 0, 0];
  document.getElementById('dp-px').value = pv[0].toFixed(1);
  document.getElementById('dp-py').value = pv[1].toFixed(1);
  document.getElementById('dp-pz').value = pv[2].toFixed(1);
}

// تغيير النوع
document.querySelectorAll('.dp-type').forEach(btn => {
  btn.onclick = () => {
    if (!state.selectedId) return;
    const role = btn.dataset.role;
    snapshot();
    const d = state.root.userData.parts.get(state.selectedId);
    const p = d.def;

    if (role === 'none') {
      delete p.role;
      delete p.motion;
    } else if (role === 'door') {
      p.role = 'door';
      p.motion = {
        type: 'rotate',
        axis: p.motion?.axis || 'y',
        direction: p.motion?.direction ?? 1,
        range: p.motion?.range ?? 90,
        speed: p.motion?.speed ?? 8,
        pivot: p.motion?.pivot || [p.pos[0], p.pos[1], p.pos[2]],
        label: p.motion?.label || 'باب'
      };
    } else if (role === 'drawer') {
      p.role = 'drawer';
      p.motion = {
        type: 'slide',
        axis: p.motion?.axis || 'z',
        direction: p.motion?.direction ?? 1,
        range: p.motion?.range ?? 45,
        speed: p.motion?.speed ?? 8,
        label: p.motion?.label || 'درج'
      };
    }

    rebuildFromJson();
    attachToPart(state.selectedId);
    syncDoorPanel();
    toast('تم التحديث');
  };
});

// حقول الحركة
['dp-axis', 'dp-dir', 'dp-range', 'dp-speed', 'dp-label'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.oninput = () => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d || !d.def.motion) return;
    const m = d.def.motion;
    if (id === 'dp-axis') m.axis = el.value;
    if (id === 'dp-dir') m.direction = parseInt(el.value);
    if (id === 'dp-range') m.range = parseFloat(el.value) || (m.type === 'slide' ? 45 : 90);
    if (id === 'dp-speed') m.speed = parseInt(el.value) || 8;
    if (id === 'dp-label') m.label = el.value;

    // حدّث الـinteraction
    if (state.interaction) state.interaction.rebuild();
  };
  el.addEventListener('focus', () => { state._dragStartSnapshot = JSON.stringify(state.json); });
  el.addEventListener('blur', () => {
    if (state._dragStartSnapshot && state._dragStartSnapshot !== JSON.stringify(state.json)) {
      state.history.push(state._dragStartSnapshot);
      if (state.history.length > 60) state.history.shift();
      state.future = [];
      updateUndoRedo();
    }
    state._dragStartSnapshot = null;
  });
});

// حقول pivot
['dp-px', 'dp-py', 'dp-pz'].forEach((id, i) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.oninput = () => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d || !d.def.motion || d.def.motion.type !== 'rotate') return;
    const m = d.def.motion;
    m.pivot = m.pivot || [0, 0, 0];
    m.pivot[i] = parseFloat(el.value) || 0;

    // أعِد ترتيب المجموعة
    const p = d.def;
    d.group.position.set(m.pivot[0], m.pivot[1], m.pivot[2]);
    d.mesh.position.set(
      p.pos[0] - m.pivot[0],
      p.pos[1] - m.pivot[1],
      p.pos[2] - m.pivot[2]
    );
    d.group.userData.basePos = d.group.position.clone();
    d.group.updateMatrixWorld(true);
    if (state.interaction) state.interaction.rebuild();
  };
});

// التقاط pivot من الحافة
document.querySelectorAll('.dp-pick').forEach(btn => {
  btn.onclick = () => {
    if (!state.selectedId) return;
    const d = state.root.userData.parts.get(state.selectedId);
    if (!d || !d.def.motion || d.def.motion.type !== 'rotate') {
      toast('التقاط Pivot للأبواب فقط');
      return;
    }
    const p = d.def;
    const edge = btn.dataset.edge;
    const [w, h, dd] = p.size;
    const px = p.pos[0], py = p.pos[1], pz = p.pos[2];

    let pivot;
    if (edge === 'left')       pivot = [px - w / 2, py, pz];
    else if (edge === 'right') pivot = [px + w / 2, py, pz];
    else if (edge === 'top')   pivot = [px, py + h / 2, pz];
    else if (edge === 'bottom') pivot = [px, py - h / 2, pz];
    else pivot = [px, py, pz];

    snapshot();
    p.motion.pivot = pivot;
    rebuildFromJson();
    attachToPart(state.selectedId);
    syncDoorPanel();
    toast('تم التقاط Pivot: ' + edge);
  };
});

// اختبار الفتح / الغلق
document.getElementById('dp-test-open')?.addEventListener('click', () => {
  if (!state.interaction) return;
  state.interaction.toggle(state.selectedId, true);
});
document.getElementById('dp-test-close')?.addEventListener('click', () => {
  if (!state.interaction) return;
  state.interaction.toggle(state.selectedId, false);
});

// حذف الحركة
document.getElementById('dp-remove')?.addEventListener('click', () => {
  if (!state.selectedId) return;
  const d = state.root.userData.parts.get(state.selectedId);
  if (!d) return;
  if (!d.def.role && !d.def.motion) { toast('لا يوجد ما يُحذف'); return; }
  snapshot();
  delete d.def.role;
  delete d.def.motion;
  rebuildFromJson();
  attachToPart(state.selectedId);
  syncDoorPanel();
  toast('تم حذف الحركة');
});

// أغلق اللوحة عند إلغاء التحديد
const _origDeselectDoor = deselectAll;
deselectAll = function() {
  _origDeselectDoor.apply(this, arguments);
  closeDoorPanel();
};

// أغلق اللوحة عند فتح لوحة أخرى
['btn-material', 'btn-settings'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const _old = el.onclick;
  el.onclick = function(e) {
    closeDoorPanel();
    if (_old) _old.call(this, e);
  };
});

// زر الإضافة الجديد لا يغلق اللوحة
console.log('✔ نظام الأبواب والأدراج جاهز');

// ═══════════════════════════════════════════════════════════
// [إصلاح] تشغيل الباب + تشخيص كامل
// ═══════════════════════════════════════════════════════════

const _dpOpenFix = document.getElementById('dp-test-open');
const _dpCloseFix = document.getElementById('dp-test-close');

if (_dpOpenFix) {
  _dpOpenFix.onclick = (e) => {
    e.preventDefault();
    const sid = state.selectedId;
    const it = state.interaction;
    const d = sid && state.root ? state.root.userData.parts.get(sid) : null;

    console.log('════ [DOOR-OPEN] ════');
    console.log('selectedId:', sid);
    console.log('interaction?:', !!it);
    console.log('movable.length:', it?.movable?.length);
    console.log('movable ids:', it?.movable?.map(x => x.id));
    console.log('selected part.role:', d?.def?.role);
    console.log('selected part.motion:', JSON.stringify(d?.def?.motion));

    if (!it) { toast('لا يوجد نظام حركة'); return; }
    if (!sid) { toast('لم يتم تحديد شيء'); return; }

    const m = it.movable.find(x => x.id === sid);
    if (!m) {
      toast('القطعة ليست باباً — اختر "باب" من الأعلى');
      return;
    }
    it.toggle(sid, true);
    console.log('after toggle: t=' + m.t + ' target=' + m.target);
    console.log('════════════════════');
  };
}

if (_dpCloseFix) {
  _dpCloseFix.onclick = (e) => {
    e.preventDefault();
    if (!state.interaction || !state.selectedId) return;
    state.interaction.toggle(state.selectedId, false);
    console.log('[DOOR-CLOSE] requested');
  };
}

// ضمان وجود tick للحركة
if (typeof S !== 'undefined' && S.addUpdater) {
  S.addUpdater(() => {
    if (state.interaction) {
      try { state.interaction.apply(); } catch (e) {}
    }
  });
  console.log('[DOOR] global tick added');
}

console.log('✔ إصلاح الباب جاهز');
