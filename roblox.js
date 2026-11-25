'use strict';
// roblox.js — Roblox API shim for the luau2js runtime. Headless core (M1): math types, Instance tree,
// signals, cooperative scheduler, services, remotes. A renderer (M3) hooks in via world.onInstance*.
function createRoblox(R) {
  const { LuaTable, LuaError, M, $1, spread, isGen, mkT, tostr, fmtNum } = R;
  const err = m => { throw new LuaError(m); };
  const isN = x => typeof x === 'number';
  const f3 = n => fmtNum(n);

  // ---------- value types ----------
  class V3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    $typeof() { return 'Vector3'; }
    $tostring() { return `${f3(this.x)}, ${f3(this.y)}, ${f3(this.z)}`; }
    $eq(o) { return o instanceof V3 && o.x === this.x && o.y === this.y && o.z === this.z; }
    $arith(op, a, b) {
      if (op === 'unm') return new V3(-a.x, -a.y, -a.z);
      const va = a instanceof V3, vb = b instanceof V3;
      const f = { add: (p, q) => p + q, sub: (p, q) => p - q, mul: (p, q) => p * q, div: (p, q) => p / q, idiv: (p, q) => Math.floor(p / q) }[op];
      if (!f) err('attempt to perform arithmetic (' + op + ') on Vector3');
      if (va && vb) return new V3(f(a.x, b.x), f(a.y, b.y), f(a.z, b.z));
      if (va && isN(b)) return new V3(f(a.x, b), f(a.y, b), f(a.z, b));
      if (vb && isN(a)) return new V3(f(a, b.x), f(a, b.y), f(a, b.z));
      err('attempt to perform arithmetic (' + op + ') on Vector3 and ' + R.ty(va ? b : a));
    }
    $index(k) {
      switch (k) {
        case 'X': return this.x; case 'Y': return this.y; case 'Z': return this.z;
        case 'Magnitude': return Math.hypot(this.x, this.y, this.z);
        case 'Unit': { const m = Math.hypot(this.x, this.y, this.z); return m === 0 ? new V3(0, 0, 0) : new V3(this.x / m, this.y / m, this.z / m); }
      }
      return V3methods[k];
    }
    $newindex(k) { err(k + ' cannot be assigned to'); }
  }
  const V3methods = {
    Dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    Cross: (a, b) => new V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x),
    Lerp: (a, b, t) => new V3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t),
    Abs: a => new V3(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)),
    Floor: a => new V3(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)),
    Max: (a, b) => new V3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)),
    Min: (a, b) => new V3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)),
    FuzzyEq: (a, b, e = 1e-5) => Math.abs(a.x - b.x) <= e && Math.abs(a.y - b.y) <= e && Math.abs(a.z - b.z) <= e,
    Angle: (a, b) => { const d = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)); return Math.acos(Math.max(-1, Math.min(1, d))); },
  };
  const vec3 = (x, y, z) => new V3(x, y, z);

  class V2 {
    constructor(x, y) { this.x = x; this.y = y; }
    $typeof() { return 'Vector2'; }
    $tostring() { return `${f3(this.x)}, ${f3(this.y)}`; }
    $eq(o) { return o instanceof V2 && o.x === this.x && o.y === this.y; }
    $arith(op, a, b) {
      if (op === 'unm') return new V2(-a.x, -a.y);
      const f = { add: (p, q) => p + q, sub: (p, q) => p - q, mul: (p, q) => p * q, div: (p, q) => p / q }[op]; if (!f) err('bad Vector2 op ' + op);
      const ax = a instanceof V2 ? a.x : a, ay = a instanceof V2 ? a.y : a, bx = b instanceof V2 ? b.x : b, by = b instanceof V2 ? b.y : b;
      return new V2(f(ax, bx), f(ay, by));
    }
    $index(k) {
      switch (k) { case 'X': return this.x; case 'Y': return this.y; case 'Magnitude': return Math.hypot(this.x, this.y);
        case 'Unit': { const m = Math.hypot(this.x, this.y); return m === 0 ? new V2(0, 0) : new V2(this.x / m, this.y / m); } }
      return V2methods[k];
    }
  }
  const V2methods = { Dot: (a, b) => a.x * b.x + a.y * b.y, Lerp: (a, b, t) => new V2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) };

  class UD { // UDim
    constructor(s, o) { this.s = s; this.o = o; }
    $typeof() { return 'UDim'; } $tostring() { return `${f3(this.s)}, ${f3(this.o)}`; }
    $eq(b) { return b instanceof UD && b.s === this.s && b.o === this.o; }
    $index(k) { return k === 'Scale' ? this.s : k === 'Offset' ? this.o : undefined; }
  }
  class UD2 {
    constructor(xs, xo, ys, yo) { this.xs = xs; this.xo = xo; this.ys = ys; this.yo = yo; }
    $typeof() { return 'UDim2'; } $tostring() { return `{${f3(this.xs)}, ${f3(this.xo)}}, {${f3(this.ys)}, ${f3(this.yo)}}`; }
    $eq(b) { return b instanceof UD2 && b.xs === this.xs && b.xo === this.xo && b.ys === this.ys && b.yo === this.yo; }
    $arith(op, a, b) {
      if (op === 'add') return new UD2(a.xs + b.xs, a.xo + b.xo, a.ys + b.ys, a.yo + b.yo);
      if (op === 'sub') return new UD2(a.xs - b.xs, a.xo - b.xo, a.ys - b.ys, a.yo - b.yo);
      err('attempt to perform arithmetic (' + op + ') on UDim2');
    }
    $index(k) {
      switch (k) { case 'X': return new UD(this.xs, this.xo); case 'Y': return new UD(this.ys, this.yo);
        case 'Width': return new UD(this.xs, this.xo); case 'Height': return new UD(this.ys, this.yo); }
      return k === 'Lerp' ? (a, b, t) => new UD2(a.xs + (b.xs - a.xs) * t, a.xo + (b.xo - a.xo) * t, a.ys + (b.ys - a.ys) * t, a.yo + (b.yo - a.yo) * t) : undefined;
    }
  }

  class C3 {
    constructor(r, g, b) { this.r = r; this.g = g; this.b = b; }
    $typeof() { return 'Color3'; } $tostring() { return `${f3(this.r)}, ${f3(this.g)}, ${f3(this.b)}`; }
    $eq(o) { return o instanceof C3 && o.r === this.r && o.g === this.g && o.b === this.b; }
    $index(k) {
      switch (k) { case 'R': return this.r; case 'G': return this.g; case 'B': return this.b; }
      return C3methods[k];
    }
    toHex() { const h = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); return '#' + h(this.r) + h(this.g) + h(this.b); }
  }
  const C3methods = {
    Lerp: (a, b, t) => new C3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t),
    ToHSV: c => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), d = mx - mn; let h = 0;
      if (d) { if (mx === c.r) h = ((c.g - c.b) / d + 6) % 6; else if (mx === c.g) h = (c.b - c.r) / d + 2; else h = (c.r - c.g) / d + 4; h /= 6; }
      return M(h, mx ? d / mx : 0, mx); },
  };
  const hsv = (h, s, v) => { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; };

  // CFrame: position p[3], rotation r[9] row-major (R00 R01 R02 / R10 R11 R12 / R20 R21 R22), columns = right, up, back.
  class CF {
    constructor(p, r) { this.p = p; this.r = r; }
    $typeof() { return 'CFrame'; }
    $tostring() { return this.p.concat(this.r).map(f3).join(', '); }
    $eq(o) { return o instanceof CF && o.p.every((v, i) => v === this.p[i]) && o.r.every((v, i) => v === this.r[i]); }
    $arith(op, a, b) {
      if (op === 'mul') {
        if (b instanceof V3) return cfPoint(a, b);
        if (b instanceof CF) return cfMul(a, b);
        err('attempt to multiply CFrame by ' + R.ty(b));
      }
      if (op === 'add' && b instanceof V3) return new CF([a.p[0] + b.x, a.p[1] + b.y, a.p[2] + b.z], a.r);
      if (op === 'sub' && b instanceof V3) return new CF([a.p[0] - b.x, a.p[1] - b.y, a.p[2] - b.z], a.r);
      err('attempt to perform arithmetic (' + op + ') on CFrame');
    }
    $index(k) {
      const r = this.r, p = this.p;
      switch (k) {
        case 'Position': return new V3(p[0], p[1], p[2]);
        case 'X': return p[0]; case 'Y': return p[1]; case 'Z': return p[2];
        case 'RightVector': return new V3(r[0], r[3], r[6]);
        case 'UpVector': return new V3(r[1], r[4], r[7]);
        case 'LookVector': return new V3(-r[2], -r[5], -r[8]);
        case 'Rotation': return new CF([0, 0, 0], r);
      }
      return CFmethods[k];
    }
  }
  const cfPoint = (c, v) => new V3(c.r[0] * v.x + c.r[1] * v.y + c.r[2] * v.z + c.p[0], c.r[3] * v.x + c.r[4] * v.y + c.r[5] * v.z + c.p[1], c.r[6] * v.x + c.r[7] * v.y + c.r[8] * v.z + c.p[2]);
  const cfVec = (c, v) => new V3(c.r[0] * v.x + c.r[1] * v.y + c.r[2] * v.z, c.r[3] * v.x + c.r[4] * v.y + c.r[5] * v.z, c.r[6] * v.x + c.r[7] * v.y + c.r[8] * v.z);
  const mm = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  const mT = a => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
  const cfMul = (a, b) => { const q = cfPoint(a, new V3(b.p[0], b.p[1], b.p[2])); return new CF([q.x, q.y, q.z], mm(a.r, b.r)); };
  // Gram-Schmidt: keeps rotations rigid so repeated pivoting can't amplify float error
  const orthoR = r => { let a = [r[0], r[3], r[6]], b = [r[1], r[4], r[7]];
    let m = Math.hypot(...a); a = a.map(v => v / m);
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; b = [b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]; m = Math.hypot(...b); b = b.map(v => v / m);
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]]; };
  const cfInv = c => { const rt = mT(c.r); return new CF([-(rt[0] * c.p[0] + rt[1] * c.p[1] + rt[2] * c.p[2]), -(rt[3] * c.p[0] + rt[4] * c.p[1] + rt[5] * c.p[2]), -(rt[6] * c.p[0] + rt[7] * c.p[1] + rt[8] * c.p[2])], rt); };
  const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const quatOf = m => { const t = m[0] + m[4] + m[8]; let w, x, y, z;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s; }
    else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / s; x = s / 4; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s; }
    else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = s / 4; z = (m[5] + m[7]) / s; }
    else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = s / 4; }
    return [w, x, y, z]; };
  const matOfQ = ([w, x, y, z]) => [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  const lookRot = (look, up) => { // columns right, up, back
    const back = [-look.x, -look.y, -look.z];
    let right = [up.y * back[2] - up.z * back[1], up.z * back[0] - up.x * back[2], up.x * back[1] - up.y * back[0]];
    let m = Math.hypot(...right); if (m < 1e-9) { right = [1, 0, 0]; m = 1; } right = right.map(v => v / m);
    const u = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]];
    return [right[0], u[0], back[0], right[1], u[1], back[1], right[2], u[2], back[2]];
  };
  const cfLookAt = (at, to, up) => { let d = new V3(to.x - at.x, to.y - at.y, to.z - at.z); const m = Math.hypot(d.x, d.y, d.z); if (m < 1e-12) return new CF([at.x, at.y, at.z], I3.slice()); d = new V3(d.x / m, d.y / m, d.z / m);
    return new CF([at.x, at.y, at.z], lookRot(d, up || new V3(0, 1, 0))); };
  const eulerXYZ = (a, b, c) => new CF([0, 0, 0], mm(mm(rx(a), ry(b)), rz(c)));
  const eulerYXZ = (a, b, c) => new CF([0, 0, 0], mm(mm(ry(b), rx(a)), rz(c)));
  const CFmethods = {
    Inverse: cfInv,
    ToWorldSpace: (a, b) => cfMul(a, b), ToObjectSpace: (a, b) => cfMul(cfInv(a), b),
    PointToWorldSpace: cfPoint, PointToObjectSpace: (a, v) => cfPoint(cfInv(a), v),
    VectorToWorldSpace: cfVec, VectorToObjectSpace: (a, v) => cfVec(cfInv(a), v),
    Lerp: (a, b, t) => { let qa = quatOf(a.r), qb = quatOf(b.r); let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]; if (d < 0) { qb = qb.map(v => -v); d = -d; }
      let q; if (d > 0.9995) q = qa.map((v, i) => v + (qb[i] - v) * t); else { const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s; q = qa.map((v, i) => v * wa + qb[i] * wb); }
      const n = Math.hypot(...q); return new CF(a.p.map((v, i) => v + (b.p[i] - v) * t), matOfQ(q.map(v => v / n))); },
    GetComponents: c => M(...c.p, ...c.r), components: c => M(...c.p, ...c.r),
    ToEulerAnglesXYZ: c => { const r = c.r; return M(Math.atan2(-r[5], r[8]), Math.asin(Math.max(-1, Math.min(1, r[2]))), Math.atan2(-r[1], r[0])); },
    ToOrientation: c => { const r = c.r; return M(Math.asin(-Math.max(-1, Math.min(1, r[5]))), Math.atan2(-r[2], r[8]), Math.atan2(r[3], r[4])); },
    ToEulerAnglesYXZ: c => { const r = c.r; return M(Math.asin(-Math.max(-1, Math.min(1, r[5]))), Math.atan2(r[2], r[8]), Math.atan2(r[3], r[4])); },
    FuzzyEq: (a, b, e = 1e-5) => a.p.every((v, i) => Math.abs(v - b.p[i]) <= e) && a.r.every((v, i) => Math.abs(v - b.r[i]) <= e),
    Orthonormalize: c => new CF(c.p, orthoR(c.r)),
  };
  const cfNew = (a, b, c, ...rest) => {
    if (a === undefined) return new CF([0, 0, 0], I3.slice());
    if (a instanceof V3) return b instanceof V3 ? cfLookAt(a, b) : new CF([a.x, a.y, a.z], I3.slice());
    if (rest.length >= 9) return new CF([a, b, c], rest.slice(0, 9));
    if (rest.length === 4) { const q = rest; const n = Math.hypot(...q); return new CF([a, b, c], matOfQ([q[3] / n, q[0] / n, q[1] / n, q[2] / n])); }
    return new CF([a, b, c], I3.slice());
  };

  class Enm { // enum item
    constructor(type, name, value) { this.type = type; this.name = name; this.value = value; }
    $typeof() { return 'EnumItem'; } $tostring() { return `Enum.${this.type.name}.${this.name}`; }
    $index(k) { return k === 'Name' ? this.name : k === 'Value' ? this.value : k === 'EnumType' ? this.type : undefined; }
  }
  class EnmType {
    constructor(name) { this.name = name; this.items = new Map(); }
    $typeof() { return 'Enum'; } $tostring() { return 'Enum.' + this.name; }
    $index(k) { if (k === 'GetEnumItems') return () => mkT([...this.items.values()]);
      let it = this.items.get(k); if (!it) { it = new Enm(this, k, this.items.size); this.items.set(k, it); } return it; }
  }
  const enumTypes = new Map();
  const Enum = { $typeof() { return 'Enums'; }, $tostring() { return 'Enum'; },
    $index(k) { let t = enumTypes.get(k); if (!t) { t = new EnmType(k); enumTypes.set(k, t); } return t; } };

  // generic tagged value objects (TweenInfo, NumberRange, sequences, Rays, ...)
  class Rec {
    constructor(tn, props, extra) { this.tn = tn; this.props = props; Object.assign(this, extra); }
    $typeof() { return this.tn; } $tostring() { return this.tn; }
    $index(k) { return this.props[k]; }
  }
  const mkLib = o => { const t = new LuaTable(); for (const k in o) t.set(k, o[k]); return t; };

  class Rand {
    constructor(seed) { this.s = (seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Math.floor(seed)) >>> 0; }
    next() { let t = (this.s += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    $typeof() { return 'Random'; } $tostring() { return 'Random'; }
    $index(k) { return RandM[k]; }
  }
  const RandM = {
    NextNumber: (r, a, b) => a === undefined ? r.next() : a + (b - a) * r.next(),
    NextInteger: (r, a, b) => a + Math.floor(r.next() * (b - a + 1)),
    NextUnitVector: r => { const z = r.next() * 2 - 1, t = r.next() * Math.PI * 2, s = Math.sqrt(1 - z * z); return new V3(s * Math.cos(t), z, s * Math.sin(t)); },
    Clone: r => { const n = new Rand(0); n.s = r.s; return n; },
  };

  // ---------- scheduler & signals ----------
  const emit = (n, ...a) => { const l = world.hooks[n]; if (l) for (let i = 0; i < l.length; i++) l[i](...a); };
  const world = { time: 0, frame: 0, errors: [], onError: null, threads: [], seq: 0, tweens: [], hooks: {} };
  function report(e, where) {
    let msg = e instanceof LuaError ? tostr(e.value) : (e && e.stack) || String(e);
    if (e instanceof LuaError && e.stack) { const m = /(\w+\.lua\.js):(\d+)/.exec(e.stack); if (m) msg += '  @' + m[1] + ':' + m[2]; }
    world.errors.push({ where, msg, time: world.time });
    if (world.onError) world.onError(msg, where); else console.error('[error' + (where ? ' in ' + where : '') + '] ' + msg);
  }
  function drive(th, v) {
    let x;
    try { x = th.gen.next(v); } catch (e) { th.dead = true; report(e, th.label); return; }
    if (x.done) { th.dead = true; return; }
    const y = x.value; th.wake = world.time + Math.max(0, (y && y.wait) || 0); th.waitStart = world.time; th.seq = world.seq++; world.threads.push(th);
  }
  function spawnFn(fn, args, label) {
    let r;
    try { r = fn(...(args || [])); } catch (e) { report(e, label); return; }
    if (isGen(r)) { const th = { gen: r, label, wake: 0 }; drive(th, undefined); return th; }
  }
  function step(dt) {
    world.time += dt; world.frame++;
    for (const t of world.tweens.slice()) tweenStep(t, dt);
    const due = world.threads.filter(t => t.wake <= world.time + 1e-9 && !t.dead).sort((a, b) => a.wake - b.wake || a.seq - b.seq);
    world.threads = world.threads.filter(t => !due.includes(t) && !t.dead);
    for (const t of due) drive(t, world.time - t.waitStart);
    for (const [svc, names] of world.stepSignals || []) for (const n of names) svc.signal(n, true)?.fire(dt);
  }

  class Conn {
    constructor(sig, fn, once) { this.sig = sig; this.fn = fn; this.once = once; this.connected = true; }
    $typeof() { return 'RBXScriptConnection'; } $tostring() { return 'RBXScriptConnection'; }
    $index(k) { return k === 'Connected' ? this.connected : k === 'Disconnect' || k === 'disconnect' ? ConnM.Disconnect : undefined; }
  }
  const ConnM = { Disconnect: c => { c.connected = false; const i = c.sig.conns.indexOf(c); if (i >= 0) c.sig.conns.splice(i, 1); } };
  class Signal {
    constructor(name) { this.name = name || 'Signal'; this.conns = []; }
    $typeof() { return 'RBXScriptSignal'; } $tostring() { return 'Signal ' + this.name; }
    $index(k) { return SigM[k]; }
    fire(...args) { for (const c of this.conns.slice()) { if (!c.connected) continue; if (c.once) ConnM.Disconnect(c); spawnFn(c.fn, args, this.name); } }
  }
  const SigM = {
    Connect: (s, fn) => { if (typeof fn !== 'function') err('Argument 1 missing or nil'); const c = new Conn(s, fn, false); s.conns.push(c); return c; },
    Once: (s, fn) => { const c = new Conn(s, fn, true); s.conns.push(c); return c; },
    Wait: function* (s) { const w = { done: false, args: [] }; const c = new Conn(s, (...a) => { w.done = true; w.args = a; }, true); s.conns.push(c); while (!w.done) yield { wait: 0 }; return M(...w.args); },
  };

  // ---------- Instances ----------
  const HIER = { Instance: null, PVInstance: 'Instance', BasePart: 'PVInstance', Part: 'BasePart', MeshPart: 'BasePart', WedgePart: 'BasePart', SpawnLocation: 'Part', Model: 'PVInstance',
    GuiObject: 'Instance', Frame: 'GuiObject', TextLabel: 'GuiObject', TextButton: 'GuiObject', ImageLabel: 'GuiObject', ImageButton: 'GuiObject', ScrollingFrame: 'GuiObject', TextBox: 'GuiObject', ViewportFrame: 'GuiObject',
    LayerCollector: 'Instance', ScreenGui: 'LayerCollector', SurfaceGui: 'LayerCollector', BillboardGui: 'LayerCollector', Sound: 'Instance', ParticleEmitter: 'Instance',
    Attachment: 'Instance', Light: 'Instance', PointLight: 'Light', SpotLight: 'Light', SurfaceLight: 'Light', RemoteEvent: 'Instance', RemoteFunction: 'Instance', BindableEvent: 'Instance', BindableFunction: 'Instance',
    Tool: 'Instance', Humanoid: 'Instance', Camera: 'Instance', Folder: 'Instance', Player: 'Instance', Explosion: 'Instance', Smoke: 'Instance', Fire: 'Instance', Trail: 'Instance', Beam: 'Instance',
    SpecialMesh: 'Instance', UICorner: 'Instance', UIStroke: 'Instance', UIGradient: 'Instance', UIListLayout: 'Instance', UIPadding: 'Instance', UIAspectRatioConstraint: 'Instance', UIScale: 'Instance' };
  const isA = (cls, want) => { for (let c = cls; c; c = HIER[c]) if (c === want) return true; return false; };
  const EVENTS = new Set(['Changed', 'ChildAdded', 'ChildRemoved', 'DescendantAdded', 'DescendantRemoving', 'Destroying', 'AncestryChanged', 'Touched', 'TouchEnded', 'Activated',
    'MouseButton1Click', 'MouseButton1Down', 'MouseButton1Up', 'MouseButton2Click', 'MouseEnter', 'MouseLeave', 'MouseMoved', 'InputBegan', 'InputEnded', 'InputChanged', 'FocusLost', 'Focused',
    'OnServerEvent', 'OnClientEvent', 'Event', 'Heartbeat', 'RenderStepped', 'Stepped', 'PreRender', 'PreSimulation', 'PostSimulation', 'PlayerAdded', 'PlayerRemoving', 'Completed', 'Died', 'Ended',
    'Loaded', 'Played', 'Paused', 'Stopped', 'CharacterAdded', 'CharacterRemoving', 'TouchTap', 'TouchPan', 'TouchPinch', 'TouchLongPress', 'TouchSwipe', 'WindowFocused', 'WindowFocusReleased',
    'PromptGamePassPurchaseFinished', 'PlaybackStateChanged', 'Equipped', 'Unequipped', 'MouseWheelForward', 'MouseWheelBackward']);
  const DEFAULTS = {
    Instance: () => ({}),
    BasePart: () => ({ Size: vec3(4, 1, 2), Anchored: false, CanCollide: true, CanTouch: true, CanQuery: true, Transparency: 0, Reflectance: 0, Color: new C3(0.63, 0.64, 0.63), Material: Enum.$index('Material').$index('Plastic'), CastShadow: true, Massless: false, Velocity: vec3(0, 0, 0), AssemblyLinearVelocity: vec3(0, 0, 0), AssemblyAngularVelocity: vec3(0, 0, 0), Shape: Enum.$index('PartType').$index('Block'), LocalTransparencyModifier: 0 }),
    GuiObject: () => ({ Size: new UD2(0, 100, 0, 100), Position: new UD2(0, 0, 0, 0), AnchorPoint: new V2(0, 0), Visible: true, BackgroundTransparency: 0, BackgroundColor3: new C3(1, 1, 1), BorderSizePixel: 1, ZIndex: 1, LayoutOrder: 0, Rotation: 0, ClipsDescendants: false, AbsolutePosition: new V2(0, 0) }),
    TextLabel: () => ({ Font: Enum.$index('Font').$index('SourceSans'), TextXAlignment: Enum.$index('TextXAlignment').$index('Center'), TextYAlignment: Enum.$index('TextYAlignment').$index('Center'), TextStrokeTransparency: 1, TextStrokeColor3: new C3(0, 0, 0), BorderColor3: new C3(0.1, 0.17, 0.2), Text: '', TextSize: 14, TextColor3: new C3(0, 0, 0), TextTransparency: 0, TextScaled: false, TextWrapped: false, RichText: false }),
    TextButton: () => ({ Font: Enum.$index('Font').$index('SourceSans'), TextXAlignment: Enum.$index('TextXAlignment').$index('Center'), TextYAlignment: Enum.$index('TextYAlignment').$index('Center'), TextStrokeTransparency: 1, TextStrokeColor3: new C3(0, 0, 0), Text: '', TextSize: 14, TextColor3: new C3(0, 0, 0), TextTransparency: 0, AutoButtonColor: true }),
    TextBox: () => ({ Text: '', TextSize: 14, TextColor3: new C3(0, 0, 0), PlaceholderText: '' }),
    ImageLabel: () => ({ Image: '', ImageTransparency: 0, ImageColor3: new C3(1, 1, 1) }),
    ImageButton: () => ({ Image: '', ImageTransparency: 0, ImageColor3: new C3(1, 1, 1) }),
    ScreenGui: () => ({ Enabled: true, ResetOnSpawn: true, DisplayOrder: 0, IgnoreGuiInset: false }),
    Sound: () => ({ Volume: 0.5, Playing: false, Looped: false, PlaybackSpeed: 1, TimePosition: 0, IsPlaying: false, SoundId: '' }),
    Light: () => ({ Brightness: 1, Range: 8, Enabled: true, Color: new C3(1, 1, 1) }),
    ParticleEmitter: () => ({ Enabled: true, Rate: 20, Lifetime: new Rec('NumberRange', { Min: 1, Max: 2 }) }),
    BillboardGui: () => ({ Size: new UD2(0, 100, 0, 100), StudsOffset: vec3(0, 0, 0), AlwaysOnTop: false, Enabled: true, MaxDistance: 1e9 }),
    UICorner: () => ({ CornerRadius: new UD(0, 8) }),
    UIStroke: () => ({ Thickness: 1, Color: new C3(0, 0, 0), Transparency: 0, Enabled: true }),
    UIListLayout: () => ({ Padding: new UD(0, 0), FillDirection: Enum.$index('FillDirection').$index('Vertical'), SortOrder: Enum.$index('SortOrder').$index('LayoutOrder'), HorizontalAlignment: Enum.$index('HorizontalAlignment').$index('Left'), VerticalAlignment: Enum.$index('VerticalAlignment').$index('Top') }),
    UIGradient: () => ({ Rotation: 0, Enabled: true, Color: new Rec('ColorSequence', { Keypoints: mkT([new Rec('ColorSequenceKeypoint', { Time: 0, Value: new C3(1, 1, 1) }), new Rec('ColorSequenceKeypoint', { Time: 1, Value: new C3(1, 1, 1) })]) }) }),
    Explosion: () => ({ Position: vec3(0, 0, 0), BlastRadius: 4, BlastPressure: 500000 }),
    Humanoid: () => ({ Health: 100, MaxHealth: 100, WalkSpeed: 16 }),
    Camera: () => ({ CFrame: new CF([0, 0, 0], I3.slice()), FieldOfView: 70, CameraType: Enum.$index('CameraType').$index('Fixed'), ViewportSize: new V2(1280, 720), Focus: new CF([0, 0, 0], I3.slice()) }),
    Player: () => ({ UserId: 0, Name: 'Player', DisplayName: 'Player', AccountAge: 100 }),
  };
  function defaultsFor(cls) { const chain = []; for (let c = cls; c; c = HIER[c]) chain.unshift(c); const o = {}; for (const c of chain) if (DEFAULTS[c]) Object.assign(o, DEFAULTS[c]()); return o; }
  const worldCF = new CF([0, 0, 0], I3.slice());

  class Inst {
    constructor(cls) {
      this.cls = cls; this.name = cls; this.parent = undefined; this.children = []; this.props = defaultsFor(cls); this.signals = null; this.attrs = new Map(); this.destroyed = false;
      if (isA(cls, 'BasePart')) this.cf = new CF([0, 0, 0], I3.slice());
      if (isA(cls, 'Model')) this.primary = undefined;
    }
    $typeof() { return 'Instance'; } $tostring() { return this.name; }
    signal(k, create) { if (!this.signals) { if (!create) return undefined; this.signals = new Map(); } let s = this.signals.get(k); if (!s && create) { s = new Signal(k); this.signals.set(k, s); } return s; }
    $index(k) {
      switch (k) {
        case 'Name': return this.name; case 'Parent': return this.parent; case 'ClassName': return this.cls;
        case 'CFrame': if (this.cf) return this.cf; break;
        case 'Position': if (this.cf) return new V3(this.cf.p[0], this.cf.p[1], this.cf.p[2]); break;
        case 'Orientation': if (this.cf) { const e = CFmethods.ToOrientation(this.cf).v; return new V3(e[0] * 180 / Math.PI, e[1] * 180 / Math.PI, e[2] * 180 / Math.PI); } break;
        case 'PrimaryPart': if (isA(this.cls, 'Model')) return this.primary; break;
        case 'AbsoluteSize': if (this.cls === 'BillboardGui') return new V2(this.props.Size.xo, this.props.Size.yo); if (isA(this.cls, 'LayerCollector')) return world.viewport; if (isA(this.cls, 'GuiObject')) { const pa = this.parent && this.parent.$index('AbsoluteSize'); const pw = pa ? pa.x : world.viewport.x, ph = pa ? pa.y : world.viewport.y, z = this.props.Size; return new V2(z.xs * pw + z.xo, z.ys * ph + z.yo); } break;
        case 'Rotation': if (this.cf) return V3methods.Dot ? new V3(0, 0, 0) : undefined; break;
      }
      if (k in this.props) return this.props[k];
      const m = this.methods()[k]; if (m !== undefined) return m;
      if (EVENTS.has(k)) return this.signal(k, true);
      for (const c of this.children) if (c.name === k) return c;
      return undefined;
    }
    $newindex(k, v) {
      switch (k) {
        case 'Name': this.name = tostr(v); return;
        case 'Parent': setParent(this, v); return;
        case 'CFrame': if (this.cf) { if (!(v instanceof CF)) err('CFrame expected'); if (world.debugNaN && (v.p.some(Number.isNaN) || v.r.some(Number.isNaN))) err('NaN CFrame assigned to ' + fullName(this)); this.cf = v; touch(this, k); return; } break;
        case 'Position': if (this.cf) { this.cf = new CF([v.x, v.y, v.z], this.cf.r); touch(this, k); return; } break;
        case 'PrimaryPart': if (isA(this.cls, 'Model')) { this.primary = v; return; } break;
        case 'Orientation': if (this.cf) { this.cf = new CF(this.cf.p, mm(mm(ry(v.y * Math.PI / 180), rx(v.x * Math.PI / 180)), rz(v.z * Math.PI / 180))); touch(this, k); return; } break;
      }
      this.props[k] = v; touch(this, k);
    }
    methods() { return InstM; }
  }
  function touch(o, k) {
    emit('propChanged', o, k);
    if (o.signals) { o.signals.get('Changed')?.fire(k); o.signals.get('$prop:' + k)?.fire(); }
  }
  function isDescendantOf(o, anc) { for (let p = o.parent; p; p = p.parent) if (p === anc) return true; return false; }
  function* descendants(o) { for (const c of o.children) { yield c; yield* descendants(c); } }
  function setParent(o, p) {
    if (p !== undefined && !(p instanceof Inst)) err('Parent must be an Instance or nil');
    if (o.parent === p) return;
    if (p && (p === o || isDescendantOf(p, o))) err('Attempt to set ' + o.name + ' as its own descendant');
    const old = o.parent;
    if (old) { old.children.splice(old.children.indexOf(o), 1); old.signal('ChildRemoved')?.fire(o); }
    o.parent = p;
    if (p) { p.children.push(o); p.signal('ChildAdded')?.fire(o); for (let a = p; a; a = a.parent) a.signal('DescendantAdded')?.fire(o); }
    o.signal('AncestryChanged')?.fire(o, p);
    emit('reparent', o, old, p);
  }
  function destroy(o) {
    if (o.destroyed) return; o.destroyed = true;
    o.signal('Destroying')?.fire();
    for (const c of o.children.slice()) destroy(c);
    setParent(o, undefined);
    if (o.signals) for (const s of o.signals.values()) s.conns.length = 0;
    emit('destroyed', o);
  }
  function clone(o) {
    const n = newInst(o.cls); n.name = o.name; Object.assign(n.props, o.props); if (o.cf) n.cf = o.cf;
    for (const [k, v] of o.attrs) n.attrs.set(k, v);
    for (const c of o.children) setParent(clone(c), n);
    if (o.primary) { /* map to cloned primary by path */ const path = []; for (let c = o.primary; c && c !== o; c = c.parent) path.unshift(c); let t = n; for (const s of path) t = t.children[s.parent.children.indexOf(s)]; n.primary = t; }
    return n;
  }
  const findFirst = (o, name, rec) => { for (const c of o.children) if (c.name === name) return c; if (rec) for (const d of descendants(o)) if (d.name === name) return d; return undefined; };
  function* waitForChild(o, name, timeout) {
    let waited = 0, warned = false; for (;;) { const c = findFirst(o, name); if (c) return c;
      if (timeout !== undefined && waited >= timeout) return undefined;
      if (!warned && waited > 5) { warned = true; console.warn(`[infinite yield possible] ${fullName(o)}:WaitForChild("${name}")`); }
      const t0 = world.time; yield { wait: 0 }; waited += Math.max(world.time - t0, 1e-6); }
  }
  const fullName = o => { const p = []; for (let c = o; c && c !== world.game; c = c.parent) p.unshift(c.name); return p.join('.'); };
  function projectPoint(cam, v) { const c = cfPoint(cfInv(cam.props.CFrame), v), vp = world.viewport, depth = -c.z, f = (vp.y / 2) / Math.tan(cam.props.FieldOfView * Math.PI / 360);
    return { x: vp.x / 2 + (depth > 0 ? c.x / depth * f : 0), y: vp.y / 2 - (depth > 0 ? c.y / depth * f : 0), depth }; }
  const pivot = o => { if (o.cf) return o.cf; if (o.primary) return o.primary.cf; for (const d of descendants(o)) if (d.cf) return d.cf; return worldCF; };
  function pivotTo(o, cf) {
    if (o.cf) { o.$newindex('CFrame', cf); return; }
    const cur0 = pivot(o), cur = new CF(cur0.p, orthoR(cur0.r)), delta = cfMul(cf, cfInv(cur));
    for (const d of descendants(o)) if (d.cf) { const n = cfMul(delta, d.cf); d.$newindex('CFrame', new CF(n.p, orthoR(n.r))); }
  }
  const InstM = {
    Destroy: destroy, Remove: destroy, Clone: clone,
    ClearAllChildren: o => { for (const c of o.children.slice()) destroy(c); },
    GetChildren: o => mkT(o.children.slice()), GetDescendants: o => mkT([...descendants(o)]),
    FindFirstChild: (o, n, rec) => findFirst(o, n, rec),
    FindFirstChildOfClass: (o, c) => o.children.find(x => x.cls === c),
    FindFirstChildWhichIsA: (o, c, rec) => { for (const x of rec ? descendants(o) : o.children) if (isA(x.cls, c)) return x; },
    FindFirstAncestor: (o, n) => { for (let p = o.parent; p; p = p.parent) if (p.name === n) return p; },
    FindFirstAncestorOfClass: (o, c) => { for (let p = o.parent; p; p = p.parent) if (p.cls === c) return p; },
    FindFirstAncestorWhichIsA: (o, c) => { for (let p = o.parent; p; p = p.parent) if (isA(p.cls, c)) return p; },
    WaitForChild: (o, n, t) => findFirst(o, n) || waitForChild(o, n, t),
    IsA: (o, c) => isA(o.cls, c), IsDescendantOf: (o, a) => isDescendantOf(o, a), IsAncestorOf: (o, d) => isDescendantOf(d, o),
    GetFullName: fullName,
    SetAttribute: (o, k, v) => { o.attrs.set(k, v); o.signal('$attr:' + k)?.fire(); }, GetAttribute: (o, k) => o.attrs.get(k),
    GetAttributes: o => { const t = new LuaTable(); for (const [k, v] of o.attrs) t.set(k, v); return t; },
    GetAttributeChangedSignal: (o, k) => o.signal('$attr:' + k, true),
    GetPropertyChangedSignal: (o, k) => o.signal('$prop:' + k, true),
    GetPivot: pivot, PivotTo: pivotTo, SetPrimaryPartCFrame: pivotTo,
    GetBoundingBox: o => M(pivot(o), vec3(1, 1, 1)), GetExtentsSize: () => vec3(1, 1, 1),
    GetPartBoundsInRadius: () => mkT([]),
    // Sound
    Play: o => { o.props.Playing = true; o.props.IsPlaying = true; touch(o, 'Playing'); if (world.audioHook) world.audioHook(o, 'play'); }, Stop: o => { o.props.Playing = false; o.props.IsPlaying = false; touch(o, 'Playing'); if (world.audioHook) world.audioHook(o, 'stop'); },
    Pause: o => { o.props.Playing = false; o.props.IsPlaying = false; if (world.audioHook) world.audioHook(o, 'pause'); },
    Resume: o => { o.props.Playing = true; o.props.IsPlaying = true; if (world.audioHook) world.audioHook(o, 'resume'); },
    // Camera
    ViewportPointToRay: (o, x, y) => { const cf = o.props.CFrame, vp = world.viewport, t = Math.tan(o.props.FieldOfView * Math.PI / 360);
      const d = cfVec(cf, new V3((x / vp.x * 2 - 1) * t * (vp.x / vp.y), (1 - y / vp.y * 2) * t, -1)), m = Math.hypot(d.x, d.y, d.z);
      return new Rec('Ray', { Origin: new V3(cf.p[0], cf.p[1], cf.p[2]), Direction: new V3(d.x / m, d.y / m, d.z / m) }); },
    WorldToViewportPoint: (o, v) => { const r = projectPoint(o, v); return M(new V3(r.x, r.y, r.depth), r.depth > 0 && r.x >= 0 && r.y >= 0 && r.x <= world.viewport.x && r.y <= world.viewport.y); },
    WorldToScreenPoint: (o, v) => { const r = projectPoint(o, v); return M(new V3(r.x, r.y, r.depth), r.depth > 0); },
    // Remotes
    FireServer: (o, ...a) => { const lp = world.localPlayer; if (!lp) err('FireServer without a local player'); o.signal('OnServerEvent')?.fire(lp, ...a); },
    FireClient: (o, pl, ...a) => { if (pl === world.localPlayer) o.signal('OnClientEvent')?.fire(...a); },
    FireAllClients: (o, ...a) => { o.signal('OnClientEvent')?.fire(...a); },
    Fire: (o, ...a) => { o.signal('Event', true).fire(...a); },
    InvokeServer: function* (o, ...a) { const f = o.props.OnServerInvoke; if (!f) err('InvokeServer: no OnServerInvoke'); const r = f(world.localPlayer, ...a); return isGen(r) ? yield* r : r; },
    InvokeClient: function* (o, pl, ...a) { const f = o.props.OnClientInvoke; if (!f) err('InvokeClient: no OnClientInvoke'); const r = f(...a); return isGen(r) ? yield* r : r; },
    Invoke: function* (o, ...a) { const f = o.props.OnInvoke; const r = f ? f(...a) : undefined; return isGen(r) ? yield* r : r; },
    // Humanoid / Player
    TakeDamage: (o, n) => { o.$newindex('Health', o.props.Health - n); }, LoadCharacter: () => undefined, Kick: () => undefined,
    GetMouseLocation: () => world.mouse,
  };
  // Players / services / misc get their own subclass method tables through ServiceInst
  function newInst(cls) { const o = new Inst(cls); emit('created', o); return o; }
  const Instance = mkLib({ new: (cls, parent) => { if (typeof cls !== 'string') err('Instance.new: class name expected'); const o = newInst(cls); if (parent) setParent(o, parent); return o; } });

  // ---------- services ----------
  const services = new Map();
  const svcMethods = {
    Players: { GetPlayers: o => mkT(o.children.filter(c => c.cls === 'Player')), GetPlayerFromCharacter: () => undefined, GetPlayerByUserId: (o, id) => o.children.find(c => c.cls === 'Player' && c.props.UserId === id) },
    TweenService: { Create: (o, inst, info, goal) => makeTween(inst, info, goal) },
    RunService: { IsServer: () => world.ctx === 'server', IsClient: () => world.ctx === 'client', IsStudio: () => false, IsRunning: () => true, IsRunMode: () => true, BindToRenderStep: (o, n, p, f) => { world.renderBinds.set(n, f); }, UnbindFromRenderStep: (o, n) => { world.renderBinds.delete(n); } },
    UserInputService: { IsKeyDown: (o, k) => world.keysDown.has(k), IsMouseButtonPressed: () => false, GetMouseLocation: () => world.mouse, GetFocusedTextBox: () => undefined, GetMouseDelta: () => new V2(0, 0), GetKeysPressed: () => mkT([]) },
    DataStoreService: { GetDataStore: (o, name) => dataStore(name), GetGlobalDataStore: () => dataStore('global') },
    MarketplaceService: { UserOwnsGamePassAsync: () => false, PromptGamePassPurchase: () => undefined, PromptProductPurchase: () => undefined, GetProductInfo: () => new LuaTable() },
    Debris: { AddItem: (o, item, t = 10) => { spawnFn(function* () { yield { wait: t }; destroy(item); }, [], 'Debris'); } },
    HttpService: { GenerateGUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => ((Math.random() * 16) | 0).toString(16)), JSONEncode: (o, v) => JSON.stringify(v), JSONDecode: (o, s) => JSON.parse(s) },
    Lighting: { GetMinutesAfterMidnight: () => 840, SetMinutesAfterMidnight: () => undefined },
  };
  class Service extends Inst { constructor(n) { super(n); this.name = n; } methods() { return svcM(this.cls); } }
  const svcCache = new Map();
  const svcM = n => { let m = svcCache.get(n); if (!m) { m = Object.assign(Object.create(InstM), svcMethods[n] || {}); svcCache.set(n, m); } return m; };
  // DataStores persist to localStorage (key "starblox.ds.<store name>") so saved progress survives page reloads.
  // Values are stored as JSON; Luau tables round-trip as {$t:[[key,value],...]}. Reads return fresh copies like Roblox does.
  const dataStores = new Map();
  const lsOK = () => { try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (_) { return false; } };
  const dsSer = v => { if (v instanceof LuaTable) { const e = []; for (const [k, x] of v.entries()) { const sx = dsSer(x); if (sx !== undefined && (typeof k === 'number' || typeof k === 'string')) e.push([k, sx]); } return { $t: e }; }
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0; if (typeof v === 'string' || typeof v === 'boolean') return v; return undefined; };
  const dsDes = j => { if (j && typeof j === 'object' && Array.isArray(j.$t)) { const t = new LuaTable(); for (const [k, x] of j.$t) t.set(k, dsDes(x)); return t; } return j === null ? undefined : j; };
  function dataStore(name) {
    let st = dataStores.get(name);
    const lsKey = 'starblox.ds.' + name;
    if (!st) { st = new Map(); dataStores.set(name, st);
      if (lsOK()) { try { const raw = localStorage.getItem(lsKey); if (raw) for (const [k, v] of JSON.parse(raw)) st.set(k, v); } catch (_) {} } }
    const persist = () => { if (lsOK()) { try { localStorage.setItem(lsKey, JSON.stringify(Array.from(st))); } catch (_) {} } };
    const put = (k, v) => { const j = dsSer(v); if (j === undefined) st.delete(k); else st.set(k, j); persist(); };
    return new Rec('DataStore', {
      GetAsync: (o, k) => dsDes(st.get(k)), SetAsync: (o, k, v) => { put(k, v); return v; },
      UpdateAsync: (o, k, fn) => { const r = $1(fn(dsDes(st.get(k)))); if (r !== undefined) put(k, r); return r; },
      RemoveAsync: (o, k) => { const v = dsDes(st.get(k)); st.delete(k); persist(); return v; }, IncrementAsync: (o, k, d = 1) => { const v = (st.get(k) || 0) + d; st.set(k, v); persist(); return v; },
    });
  }
  // Tween
  const lerpV = (a, b, t) => { if (isN(a)) return a + (b - a) * t; if (a instanceof V3) return V3methods.Lerp(a, b, t); if (a instanceof C3) return C3methods.Lerp(a, b, t); if (a instanceof CF) return CFmethods.Lerp(a, b, t);
    if (a instanceof V2) return V2methods.Lerp(a, b, t); if (a instanceof UD2) return a.$index('Lerp')(a, b, t); return t >= 1 ? b : a; };
  const easeFn = (style, dir) => { const s = style && style.name || 'Quad'; const inF = { Linear: t => t, Sine: t => 1 - Math.cos(t * Math.PI / 2), Quad: t => t * t, Cubic: t => t ** 3, Quart: t => t ** 4, Quint: t => t ** 5, Exponential: t => t === 0 ? 0 : 2 ** (10 * t - 10), Back: t => 2.70158 * t ** 3 - 1.70158 * t * t, Circular: t => 1 - Math.sqrt(1 - t * t) }[s] || (t => t);
    const d = dir && dir.name || 'Out'; return d === 'In' ? inF : d === 'Out' ? t => 1 - inF(1 - t) : t => t < 0.5 ? inF(t * 2) / 2 : 1 - inF((1 - t) * 2) / 2; };
  function makeTween(inst, info, goal) {
    const ip = info.props; const tw = new Inst('Tween'); tw.name = 'Tween';
    Object.assign(tw.props, { PlaybackState: Enum.$index('PlaybackState').$index('Begin') });
    tw.tw = { inst, goal: [...goal.entries()], dur: Math.max(ip.Time, 1e-6), delay: ip.DelayTime || 0, rep: ip.RepeatCount || 0, rev: !!ip.Reverses, ease: easeFn(ip.EasingStyle, ip.EasingDirection), el: 0, play: false, from: null, n: 0 };
    tw.methods = () => TweenM; return tw;
  }
  const TweenM = Object.assign(Object.create(InstM), {
    Play: o => { const t = o.tw; if (!t.from) t.from = t.goal.map(([k]) => R.idx(t.inst, k)); t.play = true; t.el = t.el || 0; if (!world.tweens.includes(o)) world.tweens.push(o); o.props.PlaybackState = Enum.$index('PlaybackState').$index('Playing'); },
    Pause: o => { o.tw.play = false; o.props.PlaybackState = Enum.$index('PlaybackState').$index('Paused'); },
    Cancel: o => { o.tw.play = false; o.tw.el = 0; world.tweens.splice(world.tweens.indexOf(o), 1); o.props.PlaybackState = Enum.$index('PlaybackState').$index('Cancelled'); },
  });
  function tweenStep(tw, dt) {
    const t = tw.tw; if (!t.play) return;
    t.el += dt; const e = t.el - t.delay; if (e < 0) return;
    const cyc = t.dur * (t.rev ? 2 : 1); const total = cyc * (t.rep + 1);
    const done = e >= total; const ph = done ? (t.rev ? 0 : t.dur) : (e % cyc);
    let a = ph / t.dur; if (t.rev && ph > t.dur) a = 2 - a; a = Math.min(1, Math.max(0, a));
    if (done && !t.rev) a = 1; const k = t.ease(a);
    try { t.goal.forEach(([prop, to], i) => R.setidx(t.inst, prop, lerpV(t.from[i], to, k))); } catch (er) { report(er, 'Tween'); t.play = false; }
    if (done) { t.play = false; world.tweens.splice(world.tweens.indexOf(tw), 1); tw.props.PlaybackState = Enum.$index('PlaybackState').$index('Completed'); tw.signal('Completed', true).fire(Enum.$index('PlaybackState').$index('Completed')); }
  }
  // Players: make local player
  function makePlayer(userId, name) {
    const p = newInst('Player'); p.props.UserId = userId; p.name = name; p.props.Name = name; p.props.DisplayName = name;
    const gui = newInst('PlayerGui'); gui.name = 'PlayerGui'; setParent(gui, p);
    const bp = newInst('Backpack'); bp.name = 'Backpack'; setParent(bp, p);
    return p;
  }

  // ---------- per-context views ----------
  class View { // a service as seen by one context (overrides, e.g. Players.LocalPlayer, RunService:IsClient)
    constructor(inner, ov, mov) { this.inner = inner; this.ov = ov; this.mov = mov || {}; }
    $typeof() { return 'Instance'; } $tostring() { return this.inner.name; }
    $index(k) { if (k in this.mov) return this.mov[k]; if (k in this.ov) return this.ov[k](); const v = this.inner.$index(k);
      return typeof v === 'function' && k in this.inner.methods() ? (o, ...a) => v(o === this ? this.inner : o, ...a) : v; }
    $newindex(k, v) { this.inner.$newindex(k, v); }
    $eq(o) { return o === this.inner || (o instanceof View && o.inner === this.inner); }
  }

  // ---------- world setup ----------
  function init() {
    world.keysDown = new Set(); world.viewport = new V2(1280, 720); world.mouse = new V2(640, 360); world.touches = new Map(); world.renderBinds = new Map(); world.stepSignals = [];
    const game = new Service('DataModel'); game.name = 'Game'; world.game = game;
    const getSvc = n => { let s = services.get(n); if (!s) { s = new Service(n); services.set(n, s); setParent(s, game); } return s; };
    for (const n of ['Workspace', 'Players', 'ReplicatedStorage', 'Lighting', 'RunService', 'UserInputService', 'TweenService', 'SoundService', 'DataStoreService', 'ServerStorage', 'StarterGui', 'Debris', 'MarketplaceService']) getSvc(n);
    world.getSvc = getSvc;
    Object.assign(getSvc('UserInputService').props, { TouchEnabled: false, KeyboardEnabled: true, MouseEnabled: true, GamepadEnabled: false, MouseIconEnabled: true, MouseBehavior: Enum.$index('MouseBehavior').$index('Default') });
    const ws = getSvc('Workspace'); const cam = newInst('Camera'); cam.name = 'Camera'; setParent(cam, ws); ws.props.CurrentCamera = cam; world.workspace = ws; world.camera = cam;
    world.stepSignals.push([getSvc('RunService'), ['Heartbeat', 'Stepped', 'PreSimulation', 'PostSimulation', 'RenderStepped', 'PreRender']]);
    return world;
  }
  world.init = init;
  world.on = (name, fn) => { (world.hooks[name] || (world.hooks[name] = [])).push(fn); };
  function ctxGlobals(ctx, G) {
    const g = world.game, wsv = world.workspace;
    const isServer = ctx === 'server';
    const views = {
      Players: new View(world.getSvc('Players'), { LocalPlayer: () => isServer ? undefined : world.localPlayer }),
      RunService: new View(world.getSvc('RunService'), {}, { IsServer: () => isServer, IsClient: () => !isServer }),
    };
    const gameView = new View(g, {}, { GetService: (o, n) => views[n] || (['Workspace', 'Players', 'ReplicatedStorage', 'Lighting', 'RunService', 'UserInputService', 'TweenService', 'SoundService', 'DataStoreService', 'ServerStorage', 'StarterGui', 'Debris', 'MarketplaceService', 'HttpService', 'Chat', 'ContextActionService', 'GuiService', 'TextService', 'CollectionService', 'PhysicsService', 'Teams', 'StarterPlayer', 'ServerScriptService', 'MessagingService', 'TeleportService'].includes(n) ? world.getSvc(n) : err(n + ' is not a valid Service name')),
      BindToClose: () => undefined, Workspace: wsv, IsLoaded: () => true, PlaceId: 1, JobId: 'local', GameId: 1 });
    G.set('game', gameView); G.set('workspace', wsv); G.set('Workspace', wsv);
    G.set('Instance', Instance);
    G.set('Vector3', mkLib({ new: (x = 0, y = 0, z = 0) => new V3(x, y, z), zero: vec3(0, 0, 0), one: vec3(1, 1, 1), xAxis: vec3(1, 0, 0), yAxis: vec3(0, 1, 0), zAxis: vec3(0, 0, 1) }));
    G.set('Vector2', mkLib({ new: (x = 0, y = 0) => new V2(x, y), zero: new V2(0, 0), one: new V2(1, 1) }));
    G.set('UDim', mkLib({ new: (s = 0, o = 0) => new UD(s, o) }));
    G.set('UDim2', mkLib({ new: (xs = 0, xo = 0, ys = 0, yo = 0) => (xs instanceof UD ? new UD2(xs.s, xs.o, xo.s, xo.o) : new UD2(xs, xo, ys, yo)), fromScale: (x = 0, y = 0) => new UD2(x, 0, y, 0), fromOffset: (x = 0, y = 0) => new UD2(0, x, 0, y) }));
    G.set('Color3', mkLib({ new: (r = 0, g = 0, b = 0) => new C3(r, g, b), fromRGB: (r = 0, g = 0, b = 0) => new C3(r / 255, g / 255, b / 255), fromHSV: (h, s, v) => new C3(...hsv(h, s, v)), fromHex: s => { const n = parseInt(s.replace('#', ''), 16); return new C3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); } }));
    G.set('CFrame', mkLib({ new: cfNew, Angles: eulerXYZ, fromEulerAnglesXYZ: eulerXYZ, fromEulerAnglesYXZ: eulerYXZ, fromOrientation: eulerYXZ, lookAt: cfLookAt, identity: new CF([0, 0, 0], I3.slice()),
      fromAxisAngle: (ax, a) => { const m = Math.hypot(ax.x, ax.y, ax.z), s = Math.sin(a / 2); return new CF([0, 0, 0], matOfQ([Math.cos(a / 2), ax.x / m * s, ax.y / m * s, ax.z / m * s])); } }));
    G.set('Enum', Enum);
    G.set('Random', mkLib({ new: seed => new Rand(seed) }));
    G.set('TweenInfo', mkLib({ new: (time = 1, style, dir, rep = 0, rev = false, delay = 0) => new Rec('TweenInfo', { Time: time, EasingStyle: style || Enum.$index('EasingStyle').$index('Quad'), EasingDirection: dir || Enum.$index('EasingDirection').$index('Out'), RepeatCount: rep, Reverses: rev, DelayTime: delay }) }));
    G.set('NumberRange', mkLib({ new: (a, b) => new Rec('NumberRange', { Min: a, Max: b === undefined ? a : b }) }));
    const kp = (tn, t, v, e) => new Rec(tn, { Time: t, Value: v, Envelope: e || 0 });
    G.set('NumberSequenceKeypoint', mkLib({ new: (t, v, e = 0) => kp('NumberSequenceKeypoint', t, v, e) }));
    G.set('NumberSequence', mkLib({ new: (a, b) => new Rec('NumberSequence', { Keypoints: a instanceof LuaTable ? a : mkT(b === undefined ? [kp('NumberSequenceKeypoint', 0, a), kp('NumberSequenceKeypoint', 1, a)] : [kp('NumberSequenceKeypoint', 0, a), kp('NumberSequenceKeypoint', 1, b)]) }) }));
    G.set('ColorSequenceKeypoint', mkLib({ new: (t, c) => kp('ColorSequenceKeypoint', t, c) }));
    G.set('ColorSequence', mkLib({ new: (a, b) => new Rec('ColorSequence', { Keypoints: a instanceof LuaTable ? a : mkT([kp('ColorSequenceKeypoint', 0, a), kp('ColorSequenceKeypoint', 1, b === undefined ? a : b)]) }) }));
    G.set('Ray', mkLib({ new: (o, d) => new Rec('Ray', { Origin: o, Direction: d }) }));
    const task = mkLib({
      wait: function* (s = 0) { const dt = yield { wait: s }; return dt; },
      spawn: (f, ...a) => { spawnFn(f, a, 'task.spawn'); return undefined; },
      defer: (f, ...a) => { spawnFn(function* () { yield { wait: 0 }; const r = f(...a); if (isGen(r)) yield* r; }, [], 'task.defer'); },
      delay: (t, f, ...a) => { spawnFn(function* () { yield { wait: t }; const r = f(...a); if (isGen(r)) yield* r; }, [], 'task.delay'); },
      cancel: () => undefined,
    });
    G.set('task', task);
    G.set('wait', task.get('wait')); G.set('spawn', task.get('spawn')); G.set('delay', task.get('delay'));
    G.set('tick', () => Date.now() / 1000); G.set('time', () => world.time); G.set('elapsedTime', () => world.time);
    G.set('shared', new LuaTable());
    const os = G.get('os'); if (os instanceof LuaTable) { os.set('clock', () => world.time); }
    G.set('debug', mkLib({ traceback: m => m === undefined ? '' : m, profilebegin() {}, profileend() {} }));
    G.set('Instance', Instance);
  }
  // load a translated script into its own global environment
  function loadScript(ctx, code, label) {
    const G = new LuaTable(); for (const [k, v] of R.G.entries()) G.set(k, v); G.set('_G', G);
    ctxGlobals(ctx, G);
    const R2 = Object.assign({}, R, { G });
    const main = (0, eval)(code + '\n//# sourceURL=' + (label || ctx) + '.lua.js')(R2);
    world.ctx = ctx; // only meaningful during synchronous prelude; views carry their own ctx
    return { ctx, G, start: () => spawnFn(main, [], label || ctx) };
  }
  Object.assign(world, { step, spawnFn, loadScript, makePlayer, setParent, Inst, Signal, newInst, destroy, descendants, isA,
    types: { V3, V2, C3, CF, UD2, Enm }, report });
  // ---- input injection (host calls these) ----
  const kc = n => Enum.$index('KeyCode').$index(n), uit = n => Enum.$index('UserInputType').$index(n), ust = n => Enum.$index('UserInputState').$index(n);
  const inputObj = (o) => new Rec('InputObject', Object.assign({ KeyCode: kc('Unknown'), UserInputType: uit('None'), UserInputState: ust('Begin'), Position: vec3(0, 0, 0), Delta: vec3(0, 0, 0) }, o));
  const uis = () => world.getSvc('UserInputService');
  world.setViewport = (w, h) => { world.viewport = new V2(w, h); if (world.camera) world.camera.props.ViewportSize = world.viewport; };
  world.sendKey = (name, down, processed = false) => {
    const item = kc(name); if (down === world.keysDown.has(item)) return;
    if (down) world.keysDown.add(item); else world.keysDown.delete(item);
    uis().signal(down ? 'InputBegan' : 'InputEnded', true).fire(inputObj({ KeyCode: item, UserInputType: uit('Keyboard'), UserInputState: ust(down ? 'Begin' : 'End') }), processed);
  };
  // phase: 'down' | 'move' | 'up'; opts: {id, x, y, button (0 left, 2 right), touch, processed}
  world.sendPointer = (phase, o) => {
    const pos = vec3(o.x, o.y, 0); const prev = world.mouse; if (!o.touch) world.mouse = new V2(o.x, o.y);
    const type = o.touch ? uit('Touch') : o.button === 2 ? uit('MouseButton2') : uit('MouseButton1');
    if (o.touch) {
      let t = world.touches.get(o.id);
      if (phase === 'down') { t = inputObj({ UserInputType: type, Position: pos }); world.touches.set(o.id, t); uis().signal('InputBegan', true).fire(t, !!o.processed); }
      else if (t) { t.props.Delta = vec3(o.x - t.props.Position.x, o.y - t.props.Position.y, 0); t.props.Position = pos;
        if (phase === 'move') { t.props.UserInputState = ust('Change'); uis().signal('InputChanged', true).fire(t, false); }
        else { t.props.UserInputState = ust('End'); world.touches.delete(o.id); uis().signal('InputEnded', true).fire(t, false); } }
      return;
    }
    if (phase === 'move') uis().signal('InputChanged', true).fire(inputObj({ UserInputType: uit('MouseMovement'), UserInputState: ust('Change'), Position: pos, Delta: vec3(o.x - prev.x, o.y - prev.y, 0) }), false);
    else uis().signal(phase === 'down' ? 'InputBegan' : 'InputEnded', true).fire(inputObj({ UserInputType: type, UserInputState: ust(phase === 'down' ? 'Begin' : 'End'), Position: pos }), !!o.processed);
  };
  // GUI helpers for hosts
  const guiShown = o => { for (let c = o; c; c = c.parent) { if (c.cls === 'PlayerGui') return true; if (isA(c.cls, 'GuiObject') && c.props.Visible === false) return false; if (isA(c.cls, 'LayerCollector') && c.props.Enabled === false) return false; } return false; };
  world.guiShown = guiShown;
  world.click = b => { const s = n => b.signal(n); s('MouseButton1Down')?.fire(0, 0); s('MouseButton1Up')?.fire(0, 0); s('MouseButton1Click')?.fire(); s('Activated')?.fire(inputObj({ UserInputType: uit('MouseButton1') }), 1); };
  world.guiText = o => { if (o.props.Text) return String(o.props.Text); for (const d of descendants(o)) if (d.props.Text) return String(d.props.Text); return ''; };
  world.project = v => projectPoint(world.camera, v);
  world.math = { cfPoint, cfInv, cfVec };
  world.addLocalPlayer = (id, name) => { const p = makePlayer(id, name); world.localPlayer = p; return p; };
  world.joinPlayer = p => { setParent(p, world.getSvc('Players')); world.getSvc('Players').signal('PlayerAdded', true).fire(p); };
  return world;
}
if (typeof module !== 'undefined') module.exports = createRoblox; else globalThis.createRoblox = createRoblox;
