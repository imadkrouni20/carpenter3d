import * as THREE from 'three';
import { buildMaterial } from './materials.js';
import { buildGeometry, defaultSize, defaultOptions } from './shapes.js';

const matCache = new Map();

function legacyMat(def) {
  const key = `${def.color}|${def.roughness}|${def.metalness}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color || '#c9a26a'),
    roughness: def.roughness ?? 0.7,
    metalness: def.metalness ?? 0.05
  });
  matCache.set(key, m);
  return m;
}

function resolveMaterial(def) {
  if (def && def.materialId) {
    const m = buildMaterial(def);
    if (m) return m;
  }
  return legacyMat(def || {});
}


// ═══════════════════════════════════════════════════════════
// بناء هندسة CSG من بيانات محفوظة
// ═══════════════════════════════════════════════════════════
function buildCSGGeometry(csg) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(csg.positions, 3));
  if (csg.normals && csg.normals.length) {
    g.setAttribute('normal', new THREE.Float32BufferAttribute(csg.normals, 3));
  } else {
    g.computeVertexNormals();
  }
  if (csg.indices) g.setIndex(csg.indices);
  return g;
}

export function loadModel(json) {
  const root = new THREE.Group();
  root.userData.modelId = json.id;
  root.userData.json = json;
  const partsMap = new Map();

  for (const p of json.parts || []) {
    const size = p.size || defaultSize(p.shape || 'box');
    const shapeId = p.shape || p.type || 'box';
    const options = p.options || {};
    let geo;
    if (shapeId === 'csg' && p.csg) {
      geo = buildCSGGeometry(p.csg);
    } else {
      geo = buildGeometry(shapeId, size, options);
    }
    const mat = resolveMaterial(p.material);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.partId = p.id;
    mesh.userData.isMovable = !!p.axis;

    const group = new THREE.Group();
    group.name = 'part_' + p.id;

    if (p.axis && p.pivot) {
      // القطع المتحركة (أبواب/أدراج): المحور عند pivot
      group.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
      mesh.position.set(p.pos[0]-p.pivot[0], p.pos[1]-p.pivot[1], p.pos[2]-p.pivot[2]);
    } else {
      // القطع العادية: gizmo في مركز العنصر
      group.position.set(p.pos?.[0] ?? 0, p.pos?.[1] ?? 0, p.pos?.[2] ?? 0);
      mesh.position.set(0, 0, 0);
    }
    if (p.rotation) {
      group.rotation.set(p.rotation[0]||0, p.rotation[1]||0, p.rotation[2]||0);
    }
    group.add(mesh);
    group.userData.partDef = p;
    group.userData.basePos = group.position.clone();
    root.add(group);
    partsMap.set(p.id, { group, mesh, def: p });
  }
  root.userData.parts = partsMap;
  return root;
}

export function emptyModel(id = 'model_' + Date.now()) {
  return {
    id, name: 'منتج جديد', category: 'عام',
    dimensions: { w:100, h:100, d:50, unit:'cm' },
    parts: [], price: 0, currency: 'MAD', tags: [], notes: '',
    published: false, version: 1, createdAt: new Date().toISOString()
  };
}

export function newPartId(shapeId = 'part') {
  return shapeId + '_' + Math.random().toString(36).slice(2, 6);
}

// ✅ اللون الافتراضي ثابت لكل قطعة جديدة
export const DEFAULT_MATERIAL_ID = 'sapin';

export function makePart(shapeId, materialId = DEFAULT_MATERIAL_ID) {
  const size = defaultSize(shapeId);
  const options = defaultOptions(shapeId);
  return {
    id: newPartId(shapeId),
    shape: shapeId,
    type: shapeId,
    size,
    options,
    pos: [0, size[1]/2, 0],
    rotation: [0, 0, 0],
    material: { materialId }
  };
}
