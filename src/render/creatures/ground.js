// Animação do Zumbi e do Esqueleto soldado (lado 'R' = +z, voltado para a câmera).
import { OrganicModel, staticSpecies } from './core.js';

class ZombieO extends OrganicModel {
  constructor() {
    super('zombie');
    this.parts.pot.visible = false;
  }
  update(e) {
    this.face(e.facing);
    this.resetPose();
    const B = this.B;
    const rise = e.state === 'walk' ? 1 : (e.rise ?? 0);
    // sai da terra (ou afunda) inclinado
    B.root.position.y = -1.75 * (1 - rise);
    B.root.rotation.z = (1 - rise) * 0.45;
    const T = e.animT * 0.13;
    const s = Math.sin(T);
    if (e.state === 'walk') {
      // andar arrastado: passo curto, joelho dobrado, balanço lateral
      B['thigh.R'].rotation.z = s * 0.42 + 0.08; B['thigh.L'].rotation.z = -s * 0.42 + 0.08;
      B['shin.R'].rotation.z = -Math.max(0, -s) * 0.7 - 0.12; B['shin.L'].rotation.z = -Math.max(0, s) * 0.7 - 0.12;
      B['foot.R'].rotation.z = Math.max(0, -s) * 0.3; B['foot.L'].rotation.z = Math.max(0, s) * 0.3;
      B.hips.position.y += Math.abs(Math.cos(T)) * 0.035 - 0.03;
      B.hips.rotation.x = s * 0.06;
    } else {
      B['thigh.R'].rotation.z = 0.15; B['thigh.L'].rotation.z = -0.05;
      B['shin.R'].rotation.z = -0.25; B['shin.L'].rotation.z = -0.15;
    }
    // corcunda e cabeça pendendo
    B.spine.rotation.z = -0.12; B.chest.rotation.z = -0.14 + Math.sin(T * 0.5) * 0.04;
    B.neck.rotation.z = 0.12;
    B.head.rotation.z = 0.12 + Math.sin(T * 0.37) * 0.06; B.head.rotation.x = Math.sin(T * 0.41) * 0.18;
    // braços pendurados para a frente, balançando soltos
    for (const [sd, k] of [['R', 1], ['L', -1]]) {
      B['upperarm.' + sd].rotation.z = 0.32 + Math.sin(T + (k > 0 ? 0 : 2.2)) * 0.16;
      B['upperarm.' + sd].rotation.x = 0.1 * k;
      B['forearm.' + sd].rotation.z = 0.3 + Math.sin(T + 1 + (k > 0 ? 0 : 2.2)) * 0.12;
      B['hand.' + sd].rotation.z = -0.2;
    }
    const pot = !!e.pot && rise > 0.6;
    this.parts.pot.visible = pot;
    if (pot) { B['upperarm.L'].rotation.z = 1.0; B['forearm.L'].rotation.z = 0.7; B['hand.L'].rotation.z = -0.9; }
  }
}

class SkeletonO extends OrganicModel {
  constructor() {
    super('skeleton');
    this.skull = staticSpecies('skull');
    this.inner.add(this.skull);
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B;
    const skullOnly = e.state === 'skull';
    this.skull.visible = skullOnly;
    this.body.visible = !skullOnly;
    if (skullOnly) { this.skull.rotation.z = Math.sin(e.animT * 0.05) * 0.08; return; }
    // monta-se a partir do chão
    const k = e.state === 'rise' ? Math.min(1, e.t / 30) : 1;
    B.root.scale.set(1, Math.max(0.05, k), 1);
    const s = Math.sin(e.animT * 0.25);
    if (e.state === 'jump') {
      B['thigh.R'].rotation.z = 0.9; B['thigh.L'].rotation.z = 0.4;
      B['shin.R'].rotation.z = -1.3; B['shin.L'].rotation.z = -0.8;
      B['upperarm.R'].rotation.z = 2.2; B['forearm.R'].rotation.z = 0.6;
      B.head.rotation.z = 0.3;
    } else {
      B['thigh.R'].rotation.z = s * 0.5; B['thigh.L'].rotation.z = -s * 0.5;
      B['shin.R'].rotation.z = -Math.max(0, -s) * 0.7; B['shin.L'].rotation.z = -Math.max(0, s) * 0.7;
      B.hips.position.y += Math.abs(Math.cos(e.animT * 0.25)) * 0.03;
      // espada erguida, escudo à frente
      B['upperarm.R'].rotation.z = 0.5 + s * 0.25; B['forearm.R'].rotation.z = 0.9 - s * 0.2;
      B.head.rotation.z = Math.sin(e.animT * 0.3) * 0.12;
    }
    B['upperarm.R'].rotation.x = 0.12;
    B['upperarm.L'].rotation.z = 0.35; B['forearm.L'].rotation.z = 1.0; B['upperarm.L'].rotation.x = -0.1;
    B.spine.rotation.z = -0.1;
  }
}

export const CREATURES = {
  zombie: { keys: ['zombie'], make: () => new ZombieO() },
  skeleton: { keys: ['skeleton', 'skull'], make: () => new SkeletonO() },
};
