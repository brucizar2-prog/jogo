// Teclado, gamepad e controles de toque unificados em "botões virtuais".
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', KeyK: 'jump', Space: 'jump',
  KeyX: 'fire', KeyJ: 'fire', ControlLeft: 'fire', ControlRight: 'fire',
  Enter: 'start', NumpadEnter: 'start',
  Escape: 'pause', KeyP: 'pause',
  KeyC: 'crt', KeyM: 'mute', KeyF: 'fullscreen',
};
const BUTTONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'start', 'pause', 'crt', 'mute', 'fullscreen'];

export class Input {
  constructor() {
    this.held = {};
    this.prev = {};
    this.pressed = {};
    this.kb = {};
    this.touch = {};
    this.pad = {};
    this.anyKey = false;
    this.usingTouch = false;
    for (const b of BUTTONS) { this.held[b] = this.prev[b] = this.pressed[b] = false; }
    window.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (b) { this.kb[b] = true; e.preventDefault(); }
      this.anyKey = true;
      this.debugKey = e.code;
    });
    window.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (b) { this.kb[b] = false; e.preventDefault(); }
    });
    window.addEventListener('blur', () => { this.kb = {}; this.touch = {}; });
    this._setupTouch();
  }

  _setupTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) { root.classList.remove('hidden'); this.usingTouch = true; }
    const active = new Map();
    const update = () => {
      this.touch = {};
      for (const k of active.values()) this.touch[k] = true;
      root.querySelectorAll('button').forEach((b) => b.classList.toggle('on', !!this.touch[b.dataset.k]));
    };
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el && el.dataset && el.dataset.k ? el.dataset.k : null;
    };
    const onDown = (e) => {
      for (const t of e.changedTouches) { const k = hit(t.clientX, t.clientY); if (k) active.set(t.identifier, k); }
      this.anyKey = true; update(); e.preventDefault();
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (!active.has(t.identifier)) continue;
        const k = hit(t.clientX, t.clientY);
        if (k && k !== 'start') active.set(t.identifier, k);
      }
      update(); e.preventDefault();
    };
    const onUp = (e) => { for (const t of e.changedTouches) active.delete(t.identifier); update(); e.preventDefault(); };
    root.addEventListener('touchstart', onDown, { passive: false });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onUp, { passive: false });
    root.addEventListener('touchcancel', onUp, { passive: false });
  }

  _pollPad() {
    this.pad = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      if (ax < -0.4 || b(14)) this.pad.left = true;
      if (ax > 0.4 || b(15)) this.pad.right = true;
      if (ay < -0.5 || b(12)) this.pad.up = true;
      if (ay > 0.5 || b(13)) this.pad.down = true;
      if (b(0)) this.pad.jump = true;
      if (b(2) || b(1) || b(3)) this.pad.fire = true;
      if (b(9)) this.pad.start = true;
      if (b(8)) this.pad.pause = true;
      for (const k in this.pad) if (this.pad[k]) this.anyKey = true;
    }
  }

  // chamado uma vez por quadro de lógica
  update() {
    this._pollPad();
    for (const b of BUTTONS) {
      this.prev[b] = this.held[b];
      this.held[b] = !!(this.kb[b] || this.touch[b] || this.pad[b]);
      this.pressed[b] = this.held[b] && !this.prev[b];
    }
  }

  consumeAny() { const a = this.anyKey; this.anyKey = false; return a; }
}
