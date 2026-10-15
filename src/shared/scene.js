import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createScene(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.bg ?? 0x2b303b);
  scene.fog = new THREE.Fog(0x2b303b, 1800, 4500);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 20000);
  camera.position.set(350, 300, 500);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI; // دوران كامل حتى من الأسفل
  controls.minDistance = 5;
  controls.maxDistance = 5000;
  controls.target.set(0, 100, 0);

  scene.add(new THREE.HemisphereLight(0xbcd0e8, 0x2a2f38, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(400, 600, 500);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const d = 800;
  Object.assign(key.shadow.camera, { left:-d, right:d, top:d, bottom:-d, near:1, far:2500 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xa8c0e0, 0.45);
  fill.position.set(-500, 300, -400);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(0, 200, -600);
  scene.add(rim);

  // بيئة انعكاس
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x5060a0);
  scene.environment = pmrem.fromScene(envScene, 0.05).texture;

  // لا أرضية بيضاء، فقط شبكة على خلفية داكنة
  const grid = new THREE.GridHelper(2400, 60, 0x3a4250, 0x2f3743);
  grid.position.y = 0;
  grid.material.transparent = true;
  grid.material.opacity = 0.85;
  scene.add(grid);

  // ظل شفاف أسفل المنتج
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.ShadowMaterial({ opacity: 0.35 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.1;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  if (opts.showHuman) {
    const human = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b7d92, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(18, 60, 6, 12), mat);
    body.position.y = 90; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 16), mat);
    head.position.y = 150; head.castShadow = true;
    human.add(body, head);
    human.name = '__human__';
    human.visible = false;
    scene.add(human);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w*pr) || canvas.height !== Math.floor(h*pr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
  }

  const clock = new THREE.Clock();
  const updaters = [];
  function addUpdater(fn) { updaters.push(fn); }

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    resize();
    for (const u of updaters) u(dt);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  function fitToObject(obj, mult = 1.35) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fov = camera.fov * Math.PI / 180;
    const dist = (maxDim / 2) / Math.tan(fov / 2) * mult;
    const dir = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    controls.target.copy(center);
    camera.near = Math.max(0.5, dist / 200);
    camera.far = dist * 200;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function setView(name) {
    const t = controls.target.clone();
    const dist = camera.position.distanceTo(t) || 500;
    const dirs = {
      front: new THREE.Vector3(0,0,1),
      back:  new THREE.Vector3(0,0,-1),
      left:  new THREE.Vector3(-1,0,0),
      right: new THREE.Vector3(1,0,0),
      top:   new THREE.Vector3(0,1,0.001),
      iso:   new THREE.Vector3(1,0.6,1).normalize()
    };
    const dir = dirs[name]; if (!dir) return;
    camera.position.copy(t.clone().add(dir.clone().multiplyScalar(dist)));
    controls.update();
  }

  return { renderer, scene, camera, controls, fitToObject, setView, addUpdater, grid, shadowPlane };
}
