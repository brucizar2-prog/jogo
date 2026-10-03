// Arthur (com e sem armadura), o sapo do feitiço e a ossada da morte.
import * as THREE from 'three';
import { OrganicModel, staticSpecies } from './core.js';
import { weaponMesh } from '../base.js';

const ARMOR_LAYERS = ['armor', 'mail', 'belt', 'gold', 'helmet', 'visor'];
const BODY_LAYERS = ['skin', 'boxers', 'hair'];

class FrogPart extends OrganicModel {
  constructor() { super('frog'); this.obj.visible = false; }
}

export class ArthurOrganic extends OrganicModel {
  constructor() {
    super('arthur');
    this.frogM = new FrogPart();
    this.obj.add(this.frogM.obj);
    this.bonesM = staticSpecies('bones');
    this.obj.add(this.bonesM);
    // arma na mão do lado da câmera (direita = +z)
    this.handWeapon = new THREE.Group();
    this.attach('hand.R', this.handWeapon, 0.1, 0.72, 0.46);
    this.heldType = null;
    this.phase = 0;
  }
  update(p, dt, time) {
    const st = p.state;
    const armored = p.armor && !p.dead;
    const frog = !!p.frog && !p.dead;
    this.inner.visible = !frog && !(p.dead && p.deathT > 50);
    this.frogM.obj.visible = frog;
    this.bonesM.visible = !!p.dead && p.deathT > 40 && ['touch', 'shot', 'timeup', 'spell'].includes(p.deathKind);
    const showArmor = armored || (p.dead && p.deathT < 40 && p.armorAtDeath);
    for (const k of ARMOR_LAYERS) this.showLayer(k, showArmor);
    for (const k of BODY_LAYERS) this.showLayer(k, !showArmor);
    this.resetPose();
    const B = this.B;
    let hipsY = 0, lean = 0;
    // braços junto ao corpo (o modelo é esculpido com os braços levemente abertos)
    const tuck = (side, a) => { B['upperarm.' + side].rotation.x = (side === 'R' ? 1 : -1) * a; };
    const tk = showArmor ? 0.12 : 0.17;
    tuck('R', tk); tuck('L', tk);
    let climbing = false;
    if (p.dead) {
      const k = Math.min(1, p.deathT / 30);
      this.inner.rotation.z = -k * 1.3 * (p.facing || 1);
      hipsY = -k * 0.55;
      this.bonesM.rotation.y = this.yaw;
    } else {
      this.inner.rotation.z = 0;
      // perna/braço "R" fica do lado da câmera
      const legs = (rz, lz, rk, lk) => { B['thigh.R'].rotation.z = rz; B['thigh.L'].rotation.z = lz; B['shin.R'].rotation.z = rk; B['shin.L'].rotation.z = lk; };
      const arms = (rz, lz, re, le) => { B['upperarm.R'].rotation.z = rz; B['upperarm.L'].rotation.z = lz; B['forearm.R'].rotation.z = re; B['forearm.L'].rotation.z = le; };
      if (st === 'walk') {
        this.phase += 0.16;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        legs(s * 0.62, -s * 0.62, -Math.max(0, -s) * 1.05 - 0.08, -Math.max(0, s) * 1.05 - 0.08);
        B['foot.R'].rotation.z = Math.max(0, -s) * 0.4; B['foot.L'].rotation.z = Math.max(0, s) * 0.4;
        arms(-s * 0.55, s * 0.55, 0.5 + Math.max(0, -s) * 0.35, 0.5 + Math.max(0, s) * 0.35);
        hipsY = Math.abs(c) * 0.05 - 0.025;
        B.hips.rotation.y = s * 0.12; B.chest.rotation.y = -s * 0.16;
        B.head.rotation.y = s * 0.06;
        lean = -0.08;
      } else if (st === 'jump' || st === 'fall' || st === 'hit') {
        const up = p.vy < 0;
        legs(up ? 1.0 : 0.45, up ? 0.15 : -0.25, up ? -1.6 : -0.65, up ? -0.85 : -0.35);
        arms(up ? 1.45 : 0.8, up ? -0.45 : 0.5, 0.65, 0.6);
        if (st === 'hit') { lean = 0.5; arms(2.3, 2.1, 0.3, 0.3); }
      } else if (st === 'crouch' || st === 'crouchthrow') {
        hipsY = -0.38;
        legs(1.45, 0.3, -2.4, -1.8);
        B['foot.R'].rotation.z = 0.95; B['foot.L'].rotation.z = 1.4;
        lean = -0.3;
        arms(0.65, 0.45, 0.85, 0.65);
      } else if (st === 'climb') {
        climbing = true;
        const c = Math.sin((p.climbAnim || 0) * 0.14);
        tuck('R', -0.05); tuck('L', -0.05);
        arms(2.6 + c * 0.4, 2.6 - c * 0.4, 0.6, 0.6);
        legs(0.45 + c * 0.45, 0.45 - c * 0.45, -0.9 - c * 0.3, -0.9 + c * 0.3);
      } else if (st === 'win') {
        arms(2.8, 0.3, 0.2, 0.3);
      } else {
        const b = Math.sin(time * 2.4);
        hipsY = b * 0.008;
        arms(0.12, -0.04, 0.3, 0.28);
        B.chest.rotation.z = b * 0.015;
        B.head.rotation.z = Math.sin(time * 0.7) * 0.04;
      }
      if (st === 'throw' || st === 'crouchthrow' || p.airThrowT > 0) {
        const k = st === 'throw' || st === 'crouchthrow' ? 1 - p.throwT / 8 : 1 - p.airThrowT / 10;
        B['upperarm.R'].rotation.z = -2.2 + k * 3.6;
        B['forearm.R'].rotation.z = 0.3;
        B.chest.rotation.y = 0.25 - k * 0.4;
        if (p.airThrowT > 0) p.airThrowT--;
        if (this.heldType !== p.weapon) {
          this.handWeapon.clear();
          const w = weaponMesh(p.weapon); w.scale.setScalar(0.7); w.rotation.z = -Math.PI / 2;
          this.handWeapon.add(w); this.heldType = p.weapon;
        }
        this.handWeapon.visible = k < 0.55;
      } else this.handWeapon.visible = false;
    }
    B.hips.position.y += hipsY;
    B.spine.rotation.z += lean * 0.5; B.chest.rotation.z += lean * 0.5;
    if (climbing) {
      this.yaw += (Math.PI / 2 - this.yaw) * 0.4;
      this.inner.rotation.y = this.yaw;
    } else if (!p.dead) this.face(p.facing, 0.6);
    if (frog) {
      this.frogM.obj.rotation.y = p.facing > 0 ? -0.4 : Math.PI + 0.4;
      this.frogM.obj.scale.set(1, p.onGround ? 1 : 1.2, 1);
    }
    this.obj.visible = !(p.invuln > 1 && !p.dead && Math.floor(p.invuln / 3) % 2 === 0);
  }
}
