import * as THREE from 'three';

// ════════════════ أيقونات SVG خطية (نمط Moblo) ════════════════
const I = {
  box:        '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 13l12-7 12 7v14l-12 7-12-7z"/><path d="M8 13l12 7 12-7M20 20v14"/></svg>',
  cylinder:   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="20" cy="11" rx="11" ry="4"/><path d="M9 11v18M31 11v18"/><path d="M9 29a11 4 0 0022 0"/></svg>',
  sphere:     '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><circle cx="20" cy="20" r="12"/></svg>',
  cone:       '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 8L31 31a12 3 0 01-22 0z"/></svg>',
  pyramid:    '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 8L32 30H8z"/><path d="M20 8v22"/></svg>',
  hexPrism:   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 10h12l6 10-6 10H14l-6-10z"/></svg>',
  torus:      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><circle cx="20" cy="20" r="12"/><circle cx="20" cy="20" r="5"/></svg>',
  tube:       '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="20" cy="12" rx="11" ry="4"/><ellipse cx="20" cy="12" rx="7" ry="2.5"/><path d="M9 12v16M31 12v16"/><path d="M9 28a11 4 0 0022 0"/></svg>',
  halfSphere: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 26a12 12 0 0124 0"/><path d="M8 26h24"/></svg>',

  triangle:   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 8L32 30H8z"/></svg>',
  Lshape:     '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 8v24h22v-6H16V8z"/></svg>',
  Ushape:     '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 8v22h22V8h-6v16H15V8z"/></svg>',
  Tshape:     '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 10h28v6H23v16h-6V16H6z"/></svg>',
  arch:       '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 32V20a12 12 0 0124 0v12"/><path d="M15 32V20a5 5 0 0110 0v12"/></svg>',
  quarter:    '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 32V8a24 24 0 0124 24z"/></svg>',

  coude:      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 32V17a5 5 0 015-5h17"/><path d="M8 32V17a9 9 0 019-9h17"/></svg>',
  ring:       '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="6"/></svg>',
  knob:       '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 22v6h12v-6"/><path d="M20 14a7 7 0 017 7 7 7 0 01-14 0 7 7 0 017-7z"/></svg>',
  plate:      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="15" width="30" height="10" rx="1"/></svg>',
  halfCyl:    '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 22v-4a11 11 0 0122 0v4"/><path d="M9 22h22"/><ellipse cx="20" cy="22" rx="11" ry="3" stroke-dasharray="2 2"/></svg>',
  bolt:       '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M15 10h10v6l-3 4v12h-4V20l-3-4z"/></svg>'
};

// ════════════════ أدوات بناء الأشكال ════════════════
function extrudeFromShape(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
  g.center();
  return g;
}
function LPath(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w/2, -h/2); s.lineTo(w/2, -h/2); s.lineTo(w/2, -h/2+t);
  s.lineTo(-w/2+t, -h/2+t); s.lineTo(-w/2+t, h/2); s.lineTo(-w/2, h/2); s.lineTo(-w/2, -h/2);
  return s;
}
function UPath(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w/2, -h/2); s.lineTo(w/2, -h/2); s.lineTo(w/2, h/2);
  s.lineTo(w/2-t, h/2); s.lineTo(w/2-t, -h/2+t); s.lineTo(-w/2+t, -h/2+t);
  s.lineTo(-w/2+t, h/2); s.lineTo(-w/2, h/2); s.lineTo(-w/2, -h/2);
  return s;
}
function TPath(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w/2, h/2); s.lineTo(w/2, h/2); s.lineTo(w/2, h/2-t);
  s.lineTo(t/2, h/2-t); s.lineTo(t/2, -h/2); s.lineTo(-t/2, -h/2);
  s.lineTo(-t/2, h/2-t); s.lineTo(-w/2, h/2-t); s.lineTo(-w/2, h/2);
  return s;
}
function ArchPath(w, h) {
  const s = new THREE.Shape();
  const r = w/2;
  s.moveTo(-r, -h/2); s.lineTo(r, -h/2); s.lineTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, false); s.lineTo(-r, -h/2);
  return s;
}
function QuarterPath(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w/2, -h/2); s.lineTo(w/2, -h/2); s.lineTo(w/2, h/2);
  s.absarc(w/2, -h/2, w, -Math.PI/2, 0, false); s.lineTo(-w/2, -h/2);
  return s;
}
function buildTube(size, options = {}) {
  const [w, h] = size;
  const innerRatio = options.innerRatio ?? 0.72;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, w/2, 0, Math.PI*2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, w/2 * innerRatio, 0, Math.PI*2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 40 });
  g.rotateX(-Math.PI/2); g.center();
  return g;
}
function buildHalfCyl(size) {
  const [w, h] = size;
  const g = new THREE.CylinderGeometry(w/2, w/2, h, 40, 1, false, 0, Math.PI);
  g.rotateZ(Math.PI/2); g.center();
  return g;
}
function buildElbow(size, options = {}) {
  const [w, h] = size;
  const tubeRatio = options.tubeRatio ?? 0.18;
  const tube = Math.min(w, h) * tubeRatio;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -h/2, 0),
    new THREE.Vector3(0, h/2 - tube*2, 0),
    new THREE.Vector3(tube, h/2, 0),
    new THREE.Vector3(h/2, h/2, 0)
  ]);
  const g = new THREE.TubeGeometry(curve, 32, tube, 14, false);
  g.center();
  return g;
}
function buildDome(size) {
  const [w, h] = size;
  const g = new THREE.SphereGeometry(w/2, 40, 20, 0, Math.PI*2, 0, Math.PI/2);
  g.scale(1, h / (w/2), 1);
  return g;
}

// ════════════════ سجل الأشكال ════════════════
export const SHAPES = {
  box:        { name:'مكعب', icon:I.box, cat:'basic', size:[60,60,60], build: s => new THREE.BoxGeometry(s[0], s[1], s[2]),
    params: [{k:'size.0',label:'العرض'},{k:'size.1',label:'الارتفاع'},{k:'size.2',label:'العمق'}] },
  cylinder:   { name:'أسطوانة', icon:I.cylinder, cat:'basic', size:[50,70,50], build: s => new THREE.CylinderGeometry(s[0]/2, s[0]/2, s[1], 40),
    params: [{k:'size.0',label:'القطر'},{k:'size.1',label:'الارتفاع'}] },
  sphere:     { name:'كرة', icon:I.sphere, cat:'basic', size:[55,55,55], build: s => new THREE.SphereGeometry(s[0]/2, 40, 28),
    params: [{k:'size.0',label:'القطر'}] },
  cone:       { name:'مخروط', icon:I.cone, cat:'basic', size:[55,75,55], build: (s,o) => new THREE.CylinderGeometry(s[0]/2*(o.topRatio??0), s[0]/2, s[1], 40),
    params: [{k:'size.0',label:'قطر القاعدة'},{k:'size.1',label:'الارتفاع'},{k:'options.topRatio',label:'نسبة القمة',min:0,max:0.9,step:0.05,default:0}] },
  pyramid:    { name:'هرم', icon:I.pyramid, cat:'basic', size:[55,65,55], build: (s,o) => new THREE.CylinderGeometry(s[0]/2*(o.topRatio??0), s[0]/2, s[1], 4),
    params: [{k:'size.0',label:'عرض القاعدة'},{k:'size.1',label:'الارتفاع'},{k:'options.topRatio',label:'نسبة القمة',min:0,max:0.9,step:0.05,default:0}] },
  hexPrism:   { name:'سُدَاسي', icon:I.hexPrism, cat:'basic', size:[55,55,55], build: s => new THREE.CylinderGeometry(s[0]/2, s[0]/2, s[1], 6),
    params: [{k:'size.0',label:'القطر'},{k:'size.1',label:'الارتفاع'}] },
  torus:      { name:'حلقة', icon:I.torus, cat:'basic', size:[55,18,55], build: s => new THREE.TorusGeometry(s[0]/2, s[1]/2, 20, 60),
    params: [{k:'size.0',label:'القطر الرئيسي'},{k:'size.1',label:'قطر الأنبوب'}] },
  tube:       { name:'أنبوب', icon:I.tube, cat:'basic', size:[55,65,55], build: (s,o) => buildTube(s, o),
    params: [{k:'size.0',label:'القطر الخارجي'},{k:'size.1',label:'الارتفاع'},{k:'options.innerRatio',label:'نسبة الفتحة',min:0.3,max:0.95,step:0.05,default:0.72}] },
  halfSphere: { name:'نصف كرة', icon:I.halfSphere, cat:'basic', size:[55,40,55], build: s => buildDome(s),
    params: [{k:'size.0',label:'القطر'},{k:'size.1',label:'الارتفاع'}] },

  triangle:   { name:'مثلث', icon:I.triangle, cat:'profile', size:[60,60,40], build: s => new THREE.CylinderGeometry(s[0]/2, s[0]/2, s[1], 3),
    params: [{k:'size.0',label:'القاعدة'},{k:'size.1',label:'الارتفاع'}] },
  Lshape:     { name:'L', icon:I.Lshape, cat:'profile', size:[55,55,20], build: (s,o) => extrudeFromShape(LPath(s[0], s[1], Math.min(s[0],s[1])*(o.barRatio??0.22)), s[2]),
    params: [{k:'size.0',label:'العرض'},{k:'size.1',label:'الارتفاع'},{k:'size.2',label:'العمق'},{k:'options.barRatio',label:'نسبة القضيب',min:0.1,max:0.5,step:0.02,default:0.22}] },
  Ushape:     { name:'U', icon:I.Ushape, cat:'profile', size:[55,55,20], build: (s,o) => extrudeFromShape(UPath(s[0], s[1], Math.min(s[0],s[1])*(o.barRatio??0.22)), s[2]),
    params: [{k:'size.0',label:'العرض'},{k:'size.1',label:'الارتفاع'},{k:'size.2',label:'العمق'},{k:'options.barRatio',label:'نسبة القضيب',min:0.1,max:0.5,step:0.02,default:0.22}] },
  Tshape:     { name:'T', icon:I.Tshape, cat:'profile', size:[60,55,20], build: (s,o) => extrudeFromShape(TPath(s[0], s[1], Math.min(s[0],s[1])*(o.barRatio??0.22)), s[2]),
    params: [{k:'size.0',label:'العرض'},{k:'size.1',label:'الارتفاع'},{k:'size.2',label:'العمق'},{k:'options.barRatio',label:'نسبة القضيب',min:0.1,max:0.5,step:0.02,default:0.22}] },
  arch:       { name:'قوس', icon:I.arch, cat:'profile', size:[60,50,20], build: s => extrudeFromShape(ArchPath(s[0], s[1]), s[2]),
    params: [{k:'size.0',label:'العرض'},{k:'size.1',label:'الارتفاع'},{k:'size.2',label:'العمق'}] },
  quarter:    { name:'ربع دائري', icon:I.quarter, cat:'profile', size:[55,55,20], build: s => extrudeFromShape(QuarterPath(s[0], s[1]), s[2]),
    params: [{k:'size.0',label:'العرض'},{k:'size.1',label:'الارتفاع'},{k:'size.2',label:'العمق'}] },

  coude:      { name:'كوع', icon:I.coude, cat:'detail', size:[50,50,50], build: (s,o) => buildElbow(s, o),
    params: [{k:'size.0',label:'القطر'},{k:'size.1',label:'الطول'},{k:'options.tubeRatio',label:'نسبة الأنبوب',min:0.08,max:0.4,step:0.02,default:0.18}] },
  ring:       { name:'حلقة صغيرة', icon:I.ring, cat:'detail', size:[36,12,36], build: s => new THREE.TorusGeometry(s[0]/2, s[1]/2, 16, 40),
    params: [{k:'size.0',label:'القطر الرئيسي'},{k:'size.1',label:'قطر الأنبوب'}] },
  knob:       { name:'مقبض', icon:I.knob, cat:'detail', size:[24,24,24], build: s => new THREE.SphereGeometry(s[0]/2, 24, 18),
    params: [{k:'size.0',label:'القطر'}] },
  plate:      { name:'لوح', icon:I.plate, cat:'detail', size:[90,6,60], build: s => new THREE.BoxGeometry(s[0], s[1], s[2]),
    params: [{k:'size.0',label:'الطول'},{k:'size.1',label:'السماكة'},{k:'size.2',label:'العرض'}] },
  halfCyl:    { name:'نصف أسطوانة', icon:I.halfCyl, cat:'detail', size:[55,65,55], build: s => buildHalfCyl(s),
    params: [{k:'size.0',label:'القطر'},{k:'size.1',label:'الطول'}] },
  bolt:       { name:'برغي', icon:I.bolt, cat:'detail', size:[24,24,60], build: s => new THREE.CylinderGeometry(s[0]/2, s[0]/2, s[1], 6),
    params: [{k:'size.0',label:'قطر الرأس'},{k:'size.1',label:'الطول'}] }
};

export const SHAPE_CATEGORIES = [
  { id:'basic',   name:'أساسي',  icon: I.box },
  { id:'profile', name:'ملفات',  icon: I.triangle },
  { id:'detail',  name:'تفاصيل', icon: I.coude }
];

export function listShapes(cat) {
  return Object.entries(SHAPES)
    .filter(([k, v]) => v.cat === cat)
    .map(([k, v]) => ({ id: k, ...v }));
}
export function buildGeometry(shapeId, size, options = {}) {
  if (shapeId === 'csg') {
    // CSG parts — نبنيها في modelLoader
    return new THREE.BoxGeometry(10, 10, 10);
  }
  const s = SHAPES[shapeId];
  if (!s) return new THREE.BoxGeometry(size[0]||50, size[1]||50, size[2]||50);
  return s.build(size, options || {});
}
export function defaultSize(shapeId) {
  const s = SHAPES[shapeId];
  return s ? [...s.size] : [50, 50, 50];
}
export function defaultOptions(shapeId) {
  const s = SHAPES[shapeId];
  if (!s || !s.params) return {};
  const out = {};
  for (const p of s.params) if (p.k.startsWith('options.')) out[p.k.slice(8)] = p.default;
  return out;
}
export function shapeParams(shapeId) {
  const s = SHAPES[shapeId];
  return s?.params || [];
}
