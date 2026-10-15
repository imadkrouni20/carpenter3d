import * as THREE from 'three';

export class Interaction {
  constructor(camera, canvas, root) {
    this.camera = camera;
    this.canvas = canvas;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.root = root;
    this.movable = [];
    this.onPick = null;
    this.enabled = true;

    for (const [id, d] of root.userData.parts) {
      if (d.def.axis) {
        this.movable.push({
          id, def: d.def, group: d.group, base: d.group.position.clone(),
          t: 0, target: 0, open: false
        });
      }
    }

    this._down = null;
    this._onDown = (e) => { this._down = { x: e.clientX, y: e.clientY, t: Date.now() }; };
    this._onUp = (e) => this._handleUp(e);
    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointerup', this._onUp);
  }

  detach() {
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointerup', this._onUp);
  }

  _handleUp(e) {
    if (!this._down || !this.enabled) return;
    const dx = e.clientX - this._down.x;
    const dy = e.clientY - this._down.y;
    const dt = Date.now() - this._down.t;
    const moved = Math.hypot(dx, dy);
    this._down = null;
    if (moved > 8 || dt > 600) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const roots = [...this.root.children];
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.partId) o = o.parent;
      if (o && o.userData.isMovable) {
        this.toggle(o.userData.partId);
        if (this.onPick) this.onPick(o.userData.partId);
        return;
      }
    }
  }

  toggle(partId, state = null) {
    const m = this.movable.find(x => x.id === partId);
    if (!m) return;
    m.target = state === null ? (m.open ? 0 : 1) : (state ? 1 : 0);
    m.open = m.target === 1;
  }

  toggleAll(state = null) {
    for (const m of this.movable) this.toggle(m.id, state);
  }

  isAnyOpen() {
    return this.movable.some(m => m.open);
  }

  apply() {
    for (const m of this.movable) {
      const { def, group, base } = m;
      if (Math.abs(m.t - m.target) > 0.001) {
        const dir = Math.sign(m.target - m.t);
        m.t = THREE.MathUtils.clamp(m.t + dir * 0.08, 0, 1);
      }
      const e = m.t * m.t * (3 - 2 * m.t);
      const maxV = def.max ?? (def.motion === 'slide' ? 45 : 90);
      const sign = def.direction === -1 ? -1 : 1;

      group.rotation.set(0, 0, 0);
      group.position.copy(base);

      if (def.motion === 'slide') {
        const axis = def.axis || 'z';
        group.position[axis] = base[axis] + sign * maxV * e;
      } else {
        group.rotation[def.axis || 'y'] = sign * (maxV * Math.PI / 180) * e;
      }
    }
  }
}
