import * as THREE from 'three';

const texCache = new Map();

export function getWoodTexture(id, baseColor, grainColor, seed = 1) {
  if (texCache.has(id)) return texCache.get(id);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = grainColor;
    ctx.globalAlpha = 0.03 + Math.random() * 0.13;
    ctx.lineWidth = 0.4 + Math.random() * 1.6;
    ctx.beginPath();
    const x = Math.random() * 512;
    ctx.moveTo(x, 0);
    for (let y = 0; y < 512; y += 14) {
      ctx.lineTo(x + Math.sin(y * 0.03 + seed * (i + 1)) * 3 + (Math.random() - 0.5) * 1.8, y);
    }
    ctx.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const cx = Math.random() * 512, cy = Math.random() * 512;
    const r = 8 + Math.random() * 14;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, grainColor);
    grad.addColorStop(0.55, grainColor + 'aa');
    grad.addColorStop(1, baseColor);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(id, tex);
  return tex;
}

export const MATERIALS = {
  sapin:       { id:'sapin',       name:'Sapin',         cat:'wood', color:'#e8d9b8', grain:'#c9a97a', seed:1, roughness:0.85, metalness:0.02 },
  pin:         { id:'pin',         name:'Pin',           cat:'wood', color:'#e5c995', grain:'#b08b55', seed:2, roughness:0.8,  metalness:0.02 },
  chene:       { id:'chene',       name:'Chêne',         cat:'wood', color:'#c9a26a', grain:'#7a5a35', seed:3, roughness:0.75, metalness:0.03 },
  hetre:       { id:'hetre',       name:'Hêtre',         cat:'wood', color:'#e0c69a', grain:'#b48a5c', seed:4, roughness:0.78, metalness:0.02 },
  hevea:       { id:'hevea',       name:'Hévéa',         cat:'wood', color:'#ebd8ba', grain:'#c9a87c', seed:5, roughness:0.8,  metalness:0.02 },
  peuplier:    { id:'peuplier',    name:'Peuplier',      cat:'wood', color:'#f0e2c4', grain:'#d0b48a', seed:6, roughness:0.82, metalness:0.02 },
  contreplaque:{ id:'contreplaque',name:'Contreplaqué',  cat:'wood', color:'#e5cda0', grain:'#b89060', seed:7, roughness:0.8,  metalness:0.02 },
  mdf:         { id:'mdf',         name:'MDF',           cat:'wood', color:'#e8d8b8', grain:'#c4a878', seed:8, roughness:0.9,  metalness:0 },
  osb:         { id:'osb',         name:'OSB',           cat:'wood', color:'#d4a86c', grain:'#9c7040', seed:9, roughness:0.95, metalness:0 },

  blanc1:      { id:'blanc1',      name:'Blanc 1',       cat:'color', color:'#f5f5f5', roughness:0.5, metalness:0 },
  blanc2:      { id:'blanc2',      name:'Blanc 2',       cat:'color', color:'#e8e8e8', roughness:0.5, metalness:0 },
  blanc3:      { id:'blanc3',      name:'Blanc 3',       cat:'color', color:'#dcdcdc', roughness:0.5, metalness:0 },
  gris:        { id:'gris',        name:'Gris',          cat:'color', color:'#8a8a8a', roughness:0.5, metalness:0 },
  grisFonce:   { id:'grisFonce',   name:'Gris foncé',    cat:'color', color:'#3a3a3a', roughness:0.5, metalness:0 },
  noir:        { id:'noir',        name:'Noir',          cat:'color', color:'#1a1a1a', roughness:0.5, metalness:0 },
  beigeGris:   { id:'beigeGris',   name:'Beige gris',    cat:'color', color:'#8a8070', roughness:0.6, metalness:0 },
  beige:       { id:'beige',       name:'Beige',         cat:'color', color:'#c9a860', roughness:0.6, metalness:0 },
  blancPerle:  { id:'blancPerle',  name:'Blanc perlé',   cat:'color', color:'#f0e8d8', roughness:0.55,metalness:0 },
  rougeFram:   { id:'rougeFram',   name:'Rouge framboise',cat:'color',color:'#d02040', roughness:0.55,metalness:0 },
  rougeSaumon: { id:'rougeSaumon', name:'Rouge saumon',  cat:'color', color:'#e05020', roughness:0.55,metalness:0 },
  rosePerle:   { id:'rosePerle',   name:'Rose perlé',    cat:'color', color:'#c06060', roughness:0.55,metalness:0 },
  jauneOrange: { id:'jauneOrange', name:'Jaune orange',  cat:'color', color:'#d88020', roughness:0.55,metalness:0 },
  jauneSoleil: { id:'jauneSoleil', name:'Jaune soleil',  cat:'color', color:'#e0a020', roughness:0.55,metalness:0 },
  jauneColza:  { id:'jauneColza',  name:'Jaune colza',   cat:'color', color:'#e0d020', roughness:0.55,metalness:0 },
  roseClair:   { id:'roseClair',   name:'Rose clair',    cat:'color', color:'#e8a0b0', roughness:0.55,metalness:0 },
  violetPerle: { id:'violetPerle', name:'Violet perlé',  cat:'color', color:'#8a7090', roughness:0.55,metalness:0 },
  violetPastel:{ id:'violetPastel',name:'Violet pastel', cat:'color', color:'#b090a0', roughness:0.55,metalness:0 },

  metalNoir:   { id:'metalNoir',   name:'Noir',          cat:'metal', color:'#0a0a0a', roughness:0.15, metalness:1 },
  argent:      { id:'argent',      name:'Argent',        cat:'metal', color:'#d8d8d8', roughness:0.1,  metalness:1 },
  aluminium:   { id:'aluminium',   name:'Aluminium',     cat:'metal', color:'#a0a0a0', roughness:0.25, metalness:1 },
  chrome:      { id:'chrome',      name:'Chrome',        cat:'metal', color:'#e8e8e8', roughness:0.05, metalness:1 },
  galvanise:   { id:'galvanise',   name:'Galvanisé',     cat:'metal', color:'#9098a0', roughness:0.35, metalness:1 },
  or:          { id:'or',          name:'Or',            cat:'metal', color:'#d4a860', roughness:0.15, metalness:1 },
  cuivre:      { id:'cuivre',      name:'Cuivre',        cat:'metal', color:'#b87333', roughness:0.25, metalness:1 },
  laiton:      { id:'laiton',      name:'Laiton',        cat:'metal', color:'#b0a050', roughness:0.2,  metalness:1 },
  bronze:      { id:'bronze',      name:'Bronze',        cat:'metal', color:'#8a7040', roughness:0.3,  metalness:1 },

  verre:       { id:'verre',       name:'Verre',         cat:'textile', color:'#c8d8e0', roughness:0.05, metalness:0, opacity:0.35, transparent:true },
  liege:       { id:'liege',       name:'Liège',         cat:'textile', color:'#c89860', roughness:0.95, metalness:0 },
  tresse1:     { id:'tresse1',     name:'Tressé 1',      cat:'textile', color:'#e8e0c8', roughness:0.85, metalness:0 },
  tresse2:     { id:'tresse2',     name:'Tressé 2',      cat:'textile', color:'#e8c8a0', roughness:0.85, metalness:0 },
  tresse3:     { id:'tresse3',     name:'Tressé 3',      cat:'textile', color:'#f0e8d0', roughness:0.85, metalness:0 },
  tresse4:     { id:'tresse4',     name:'Tressé 4',      cat:'textile', color:'#f0e8d0', roughness:0.85, metalness:0 },
  cuir:        { id:'cuir',        name:'Cuir',          cat:'textile', color:'#5a4830', roughness:0.7,  metalness:0 },
  cuirSuede:   { id:'cuirSuede',   name:'Cuir suède',    cat:'textile', color:'#c8a060', roughness:0.9,  metalness:0 },
  briques:     { id:'briques',     name:'Briques',       cat:'textile', color:'#a04030', roughness:0.9,  metalness:0 }
};

export const CATEGORIES = [
  { id:'wood',    name:'الخشب',   icon:'🪵' },
  { id:'color',   name:'الألوان', icon:'🎨' },
  { id:'metal',   name:'المعدن',  icon:'⚙️' },
  { id:'textile', name:'أخرى',    icon:'🧵' }
];

export function buildMaterial(def) {
  if (!def) return null;
  let preset = null;
  if (def.materialId) preset = MATERIALS[def.materialId];
  if (!preset) return null;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(preset.color),
    roughness: preset.roughness ?? 0.7,
    metalness: preset.metalness ?? 0,
    transparent: !!preset.transparent,
    opacity: preset.opacity ?? 1
  });
  if (preset.cat === 'wood') m.map = getWoodTexture(preset.id, preset.color, preset.grain, preset.seed);
  m.userData.materialId = preset.id;
  return m;
}

export function getPreview(id) {
  const p = MATERIALS[id];
  return p ? { color: p.color, roughness: p.roughness, metalness: p.metalness } : null;
}

export function listByCategory(cat) {
  return Object.values(MATERIALS).filter(m => m.cat === cat);
}
