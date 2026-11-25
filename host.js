'use strict';
// host.js — DOM-free game host: boots server+client scripts, runs a fixed-timestep loop, maps input.
// Works in Node (tests) and the browser (index.html).
(function (root) {
  const KEYMAP = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Space: 'Space', Enter: 'Return', NumpadEnter: 'KeypadEnter', ShiftLeft: 'LeftShift', ShiftRight: 'RightShift',
    ControlLeft: 'LeftControl', ControlRight: 'RightControl', AltLeft: 'LeftAlt', AltRight: 'RightAlt', Backquote: 'Backquote', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace' };
  const DIGITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  function keyName(code) { // KeyboardEvent.code -> Enum.KeyCode name
    if (KEYMAP[code]) return KEYMAP[code];
    let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return DIGITS[+m[1]];
    return code;
  }
  function createHost(o) {
    const R = o.R, world = o.createRoblox(R).init();
    const DT = 1 / 60;
    const host = { world, DT, speed: 1, paused: false, acc: 0, steps: 0, simMs: 0 };
    const server = world.loadScript('server', o.serverSrc, 'server');
    server.start();
    if (o.unlockAll) server.G.get('L4').set('UNLOCK_ALL', true);
    server.G.get('PARTY').set('on', o.party !== undefined ? !!o.party : new Date().getMonth() === 10); // party decorations: November by default
    const lp = world.addLocalPlayer(o.userId || 1001, o.name || 'Player');
    world.joinPlayer(lp);
    world.loadScript('client', o.clientSrc, 'client').start();
    host.server = server; host.player = lp;
    host.playerGui = lp.children.find(c => c.name === 'PlayerGui');
    host.tick = function (dt) { // call with real elapsed seconds; returns number of sim steps run
      if (host.paused) return 0;
      host.acc += Math.min(dt, 0.25) * host.speed;
      let n = 0; const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      while (host.acc >= DT && n < 8) { world.step(DT); host.acc -= DT; n++; }
      if (n === 8) host.acc = 0; // fell behind: drop the backlog instead of spiralling
      host.steps += n; host.simMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      return n;
    };
    host.key = (code, down, e) => world.sendKey(keyName(code), down, false);
    host.pointer = (phase, p) => world.sendPointer(phase, p);
    host.resize = (w, h) => world.setViewport(w, h);
    host.buttons = () => { const out = []; for (const d of world.descendants(host.playerGui)) if (/Button$/.test(d.cls) && world.guiShown(d)) out.push({ inst: d, label: world.guiText(d) || (d.parent && d.parent.children.length <= 6 && world.guiText(d.parent)) || d.name }); return out; };
    host.labels = () => { const out = []; for (const d of world.descendants(host.playerGui)) if (d.cls === 'TextLabel' && d.props.Text && world.guiShown(d)) out.push(String(d.props.Text)); return out; };
    host.click = b => world.click(b.inst || b);
    return host;
  }
  const api = { createHost, keyName };
  if (typeof module !== 'undefined') module.exports = api; else root.LuauHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
