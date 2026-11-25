'use strict';
// luau2js runtime: Lua/Luau semantics for translated code (tables, nil, truthiness, multiple returns, strings, patterns, math...).
// nil is JS `undefined` everywhere. Roblox userdata (Vector3, Instance, ...) plugs in through $index/$newindex/$arith/$eq/$lt/$le/$len/$tostring/$typeof.
class LuaTable {
  constructor() { this.arr = []; this.hash = new Map(); }
  get(k) {
    if (typeof k === 'number') { const a = this.arr; if (k >= 1 && k <= a.length && Number.isInteger(k)) return a[k - 1]; if (k === 0) k = 0; }
    return this.hash.get(k);
  }
  set(k, v) {
    if (k === undefined || k === null) throw new LuaError('table index is nil');
    if (typeof k === 'number') {
      if (k !== k) throw new LuaError('table index is NaN');
      const a = this.arr, n = a.length;
      if (Number.isInteger(k) && k >= 1) {
        if (k <= n) { if (v === undefined) { if (k === n) { a.pop(); while (a.length && a[a.length - 1] === undefined) a.pop(); } else a[k - 1] = undefined; } else a[k - 1] = v; return; }
        if (k === n + 1) { if (v === undefined) { this.hash.delete(k); return; } a.push(v); const h = this.hash; if (h.size) { while (h.has(a.length + 1)) { const nk = a.length + 1; a.push(h.get(nk)); h.delete(nk); } } return; }
      }
      if (k === 0) k = 0;
    }
    if (v === undefined) this.hash.delete(k); else this.hash.set(k, v);
  }
  length() { return this.arr.length; }
  *entries() {
    const a = this.arr, n = a.length;
    for (let i = 0; i < n; i++) { const v = a[i]; if (v !== undefined) yield [i + 1, v]; }
    if (this.hash.size) for (const k of Array.from(this.hash.keys())) { const v = this.hash.get(k); if (v !== undefined) yield [k, v]; }
  }
}
class Multi { constructor(v) { this.v = v; } }
class LuaError extends Error { constructor(v) { super(typeof v === 'string' ? v : 'lua error: ' + (v && v.$tostring ? v.$tostring() : String(v))); this.value = v; } }
class PairsMarker { constructor(t) { this.t = t; } }
class IpairsMarker { constructor(t) { this.t = t; } }

const T = x => x !== undefined && x !== null && x !== false;
const M = (...v) => v.length === 0 ? undefined : v.length === 1 ? v[0] : new Multi(v);
const $1 = x => x instanceof Multi ? x.v[0] : x;
const spread = x => x instanceof Multi ? x.v : [x];
const isGen = r => r !== null && typeof r === 'object' && typeof r.next === 'function' && typeof r[Symbol.iterator] === 'function' && Object.prototype.toString.call(r) === '[object Generator]';
function* $y(r) { return isGen(r) ? yield* r : r; }

function ty(v) {
  if (v === undefined || v === null) return 'nil'; const t = typeof v;
  if (t === 'number') return 'number'; if (t === 'string') return 'string'; if (t === 'boolean') return 'boolean'; if (t === 'function') return 'function';
  if (v instanceof LuaTable) return 'table'; return 'userdata';
}
function tyof(v) { return (v && v.$typeof) ? v.$typeof() : ty(v); }
function fmtNum(n) {
  if (n !== n) return 'nan'; if (n === Infinity) return 'inf'; if (n === -Infinity) return '-inf';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n === 0 ? 0 : n);
  let s = n.toPrecision(14);
  if (s.indexOf('e') >= 0) { let [m, e] = s.split('e'); if (m.indexOf('.') >= 0) m = m.replace(/\.?0+$/, ''); const ex = parseInt(e, 10); return m + 'e' + (ex < 0 ? '-' : '+') + String(Math.abs(ex)).padStart(2, '0'); }
  if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, ''); return s;
}
let idCounter = 0x1000; const ids = new WeakMap();
const addr = o => { let a = ids.get(o); if (!a) { a = (idCounter += 0x20).toString(16).padStart(8, '0'); ids.set(o, a); } return a; };
function tostr(v) {
  if (v === undefined || v === null) return 'nil'; const t = typeof v;
  if (t === 'string') return v; if (t === 'number') return fmtNum(v); if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'function') return 'function: 0x' + addr(v);
  if (v instanceof LuaTable) return 'table: 0x' + addr(v);
  return v.$tostring ? v.$tostring() : 'userdata: 0x' + addr(v);
}
const num = v => typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined);
function arith(op, a, b) {
  if (a !== undefined && a !== null && typeof a === 'object' && a.$arith) return a.$arith(op, a, b);
  if (b !== undefined && b !== null && typeof b === 'object' && b.$arith) return b.$arith(op, a, b);
  const x = num(a), y = num(b);
  if (x === undefined || y === undefined) throw new LuaError('attempt to perform arithmetic (' + op + ') on ' + ty(x === undefined ? a : b) + ' value');
  switch (op) { case 'add': return x + y; case 'sub': return x - y; case 'mul': return x * y; case 'div': return x / y; case 'mod': return y === 0 ? NaN : x - Math.floor(x / y) * y; case 'pow': return Math.pow(x, y); case 'idiv': return Math.floor(x / y); }
}
const add = (a, b) => typeof a === 'number' && typeof b === 'number' ? a + b : arith('add', a, b);
const sub = (a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : arith('sub', a, b);
const mul = (a, b) => typeof a === 'number' && typeof b === 'number' ? a * b : arith('mul', a, b);
const div = (a, b) => typeof a === 'number' && typeof b === 'number' ? a / b : arith('div', a, b);
const mod = (a, b) => typeof a === 'number' && typeof b === 'number' ? (b === 0 ? NaN : a - Math.floor(a / b) * b) : arith('mod', a, b);
const pow = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.pow(a, b) : arith('pow', a, b);
const idiv = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.floor(a / b) : arith('idiv', a, b);
const unm = a => typeof a === 'number' ? -a : (a && a.$arith ? a.$arith('unm', a) : -num(a));
const len = a => typeof a === 'string' ? a.length : a instanceof LuaTable ? a.length() : (a && a.$len ? a.$len() : (() => { throw new LuaError('attempt to get length of a ' + ty(a) + ' value'); })());
const eq = (a, b) => a === b || (a !== undefined && a !== null && typeof a === 'object' && a.$eq ? a.$eq(b) : false);
function lt(a, b) { if (typeof a === 'number' && typeof b === 'number' || typeof a === 'string' && typeof b === 'string') return a < b; if (a && a.$lt) return a.$lt(b); throw new LuaError('attempt to compare ' + ty(a) + ' < ' + ty(b)); }
function le(a, b) { if (typeof a === 'number' && typeof b === 'number' || typeof a === 'string' && typeof b === 'string') return a <= b; if (a && a.$le) return a.$le(b); throw new LuaError('attempt to compare ' + ty(a) + ' <= ' + ty(b)); }
const cat = (a, b) => { const ta = typeof a, tb = typeof b; if ((ta === 'string' || ta === 'number') && (tb === 'string' || tb === 'number')) return (ta === 'string' ? a : fmtNum(a)) + (tb === 'string' ? b : fmtNum(b)); throw new LuaError('attempt to concatenate a ' + ty(ta === 'string' || ta === 'number' ? b : a) + ' value'); };
function cats(...p) { let s = ''; for (const x of p) { const t = typeof x; if (t === 'string') s += x; else if (t === 'number') s += fmtNum(x); else throw new LuaError('attempt to concatenate a ' + ty(x) + ' value'); } return s; }

let stringLib;
function idx(o, k) {
  if (o instanceof LuaTable) return o.get(k);
  if (typeof o === 'string') return stringLib.get(k);
  if (o === undefined || o === null) throw new LuaError("attempt to index nil with '" + tostr(k) + "'");
  if (o.$index) return o.$index(k);
  throw new LuaError('attempt to index a ' + ty(o) + " value with '" + tostr(k) + "'");
}
function setidx(o, k, v) {
  if (o instanceof LuaTable) return o.set(k, v);
  if (o === undefined || o === null) throw new LuaError("attempt to index nil with '" + tostr(k) + "'");
  if (o.$newindex) return o.$newindex(k, v);
  throw new LuaError('attempt to index a ' + ty(o) + " value with '" + tostr(k) + "'");
}
function cm(o, name, ...args) {
  const f = idx(o, name);
  if (typeof f !== 'function') throw new LuaError("attempt to call a " + ty(f) + " value (method '" + name + "')");
  return f(o, ...args);
}
function mkT(arr, kv) { const t = new LuaTable(); for (let i = 0; i < arr.length; i++) { if (arr[i] !== undefined) t.set(i + 1, arr[i]); } if (arr.length && arr[arr.length - 1] === undefined) { /* trailing nils are dropped */ } if (kv) for (let i = 0; i < kv.length; i += 2) t.set(kv[i], kv[i + 1]); return t; }
function* ipairsGen(t) { for (let i = 1; ; i++) { const v = idx(t, i); if (v === undefined) return; yield [i, v]; } }
function* fnIter(f, s, c) { for (;;) { const r = spread(f(s, c)); if (r[0] === undefined) return; c = r[0]; yield r; } }
function it(x, s, c) {
  if (x instanceof PairsMarker) return x.t.entries();
  if (x instanceof IpairsMarker) return ipairsGen(x.t);
  if (x instanceof LuaTable) return x.entries();
  if (typeof x === 'function') { if (x === nextFn) return s.entries(); return fnIter(x, s, c); }
  throw new LuaError('attempt to iterate over a ' + ty(x) + ' value');
}
function nextFn(t, k) { let take = k === undefined; for (const [kk, v] of t.entries()) { if (take) return M(kk, v); if (kk === k) take = true; } return undefined; }

// ---- Lua patterns (port of lstrlib) ----
function luaPattern() {
  const L_ESC = '%', SPECIALS = '^$*+?.([%-';
  function classEnd(ms, p) { if (p >= ms.pat.length) throw new LuaError('malformed pattern (ends with \'%\')'); const c = ms.pat[p++]; if (c === L_ESC) { if (p >= ms.pat.length) throw new LuaError("malformed pattern (ends with '%')"); return p + 1; } if (c === '[') { if (ms.pat[p] === '^') p++; do { if (p >= ms.pat.length) throw new LuaError("malformed pattern (missing ']')"); const cc = ms.pat[p++]; if (cc === L_ESC) p++; } while (ms.pat[p] !== ']'); return p + 1; } return p; }
  function isClass(c, cl) { const code = c.charCodeAt(0); let r; switch (cl.toLowerCase()) { case 'a': r = /[A-Za-z]/.test(c); break; case 'c': r = code < 32 || code === 127; break; case 'd': r = code >= 48 && code <= 57; break; case 'g': r = code > 32 && code < 127; break; case 'l': r = code >= 97 && code <= 122; break; case 'p': r = /[!-\/:-@\[-`{-~]/.test(c); break; case 's': r = c === ' ' || (code >= 9 && code <= 13); break; case 'u': r = code >= 65 && code <= 90; break; case 'w': r = /[A-Za-z0-9]/.test(c); break; case 'x': r = /[A-Fa-f0-9]/.test(c); break; default: return cl === c; } return (cl >= 'A' && cl <= 'Z') ? !r : r; }
  function matchBracket(ms, c, p, ec) { let sig = true; p++; if (ms.pat[p] === '^') { sig = false; p++; } while (p < ec) { if (ms.pat[p] === L_ESC) { p++; if (isClass(c, ms.pat[p])) return sig; p++; } else if (ms.pat[p + 1] === '-' && p + 2 < ec) { if (ms.pat[p] <= c && c <= ms.pat[p + 2]) return sig; p += 3; } else { if (ms.pat[p] === c) return sig; p++; } } return !sig; }
  function single(ms, s, p, ep) { if (s >= ms.src.length) return false; const c = ms.src[s]; switch (ms.pat[p]) { case '.': return true; case L_ESC: return isClass(c, ms.pat[p + 1]); case '[': return matchBracket(ms, c, p, ep - 1); default: return ms.pat[p] === c; } }
  function matchBalance(ms, s, p) { if (p + 1 >= ms.pat.length) throw new LuaError("missing arguments to '%b'"); if (s >= ms.src.length || ms.src[s] !== ms.pat[p]) return -1; const b = ms.pat[p], e = ms.pat[p + 1]; let cont = 1; while (++s < ms.src.length) { if (ms.src[s] === e) { if (--cont === 0) return s + 1; } else if (ms.src[s] === b) cont++; } return -1; }
  function maxExpand(ms, s, p, ep) { let i = 0; while (single(ms, s + i, p, ep)) i++; while (i >= 0) { const r = doMatch(ms, s + i, ep + 1); if (r !== -1) return r; i--; } return -1; }
  function minExpand(ms, s, p, ep) { for (;;) { const r = doMatch(ms, s, ep + 1); if (r !== -1) return r; if (single(ms, s, p, ep)) s++; else return -1; } }
  function startCap(ms, s, p, what) { ms.cap.push({ init: s, len: what }); const r = doMatch(ms, s, p); if (r === -1) ms.cap.pop(); return r; }
  function endCap(ms, s, p) { let l = -1; for (let i = ms.cap.length - 1; i >= 0; i--) if (ms.cap[i].len === -1) { l = i; break; } if (l < 0) throw new LuaError('invalid pattern capture'); ms.cap[l].len = s - ms.cap[l].init; const r = doMatch(ms, s, p); if (r === -1) ms.cap[l].len = -1; return r; }
  function doMatch(ms, s, p) {
    for (;;) {
      if (p >= ms.pat.length) return s;
      const pc = ms.pat[p];
      if (pc === '(') { if (ms.pat[p + 1] === ')') return startCap(ms, s, p + 2, -2); return startCap(ms, s, p + 1, -1); }
      if (pc === ')') return endCap(ms, s, p + 1);
      if (pc === '$' && p + 1 === ms.pat.length) return s === ms.src.length ? s : -1;
      if (pc === L_ESC) {
        const nx = ms.pat[p + 1];
        if (nx === 'b') { s = matchBalance(ms, s, p + 2); if (s !== -1) { p += 4; continue; } return -1; }
        if (nx === 'f') { p += 2; if (ms.pat[p] !== '[') throw new LuaError("missing '[' after '%f' in pattern"); const ep = classEnd(ms, p); const prev = s === 0 ? '\0' : ms.src[s - 1]; const cur = s < ms.src.length ? ms.src[s] : '\0'; if (!matchBracket(ms, prev, p, ep - 1) && matchBracket(ms, cur, p, ep - 1)) { p = ep; continue; } return -1; }
        if (nx >= '0' && nx <= '9') { const l = nx.charCodeAt(0) - 49; const c = ms.cap[l]; if (!c || c.len === -1) throw new LuaError('invalid capture index'); const cs = ms.src.substr(c.init, c.len); if (ms.src.substr(s, cs.length) === cs) { s += cs.length; p += 2; continue; } return -1; }
      }
      const ep = classEnd(ms, p); const epc = ms.pat[ep];
      if (epc === '?') { if (single(ms, s, p, ep)) { const r = doMatch(ms, s + 1, ep + 1); if (r !== -1) return r; } p = ep + 1; continue; }
      if (epc === '+') return single(ms, s, p, ep) ? maxExpand(ms, s + 1, p, ep) : -1;
      if (epc === '*') return maxExpand(ms, s, p, ep);
      if (epc === '-') return minExpand(ms, s, p, ep);
      if (!single(ms, s, p, ep)) return -1;
      s++; p = ep;
    }
  }
  function getCap(ms, i, s, e) { if (i >= ms.cap.length) { if (i === 0) return ms.src.slice(s, e); throw new LuaError('invalid capture index'); } const c = ms.cap[i]; if (c.len === -2) return c.init + 1; if (c.len === -1) throw new LuaError('unfinished capture'); return ms.src.substr(c.init, c.len); }
  function caps(ms, s, e, whole) { const n = (ms.cap.length === 0 && whole) ? 1 : ms.cap.length; const out = []; for (let i = 0; i < n; i++) out.push(getCap(ms, i, s, e)); return out; }
  function find(src, pat, init, plain, isFind) {
    if (init === undefined) init = 1; if (init < 0) init = Math.max(src.length + init + 1, 1); else if (init === 0) init = 1;
    if (init > src.length + 1) return undefined;
    if (isFind && (plain || !/[\^$*+?.(\[%-]/.test(pat))) { const i = src.indexOf(pat, init - 1); return i < 0 ? undefined : M(i + 1, i + pat.length); }
    const anchor = pat[0] === '^'; let p0 = anchor ? 1 : 0; let s = init - 1;
    do { const ms = { src, pat, cap: [] }; const e = doMatch(ms, s, p0); if (e !== -1) { if (isFind) return M(s + 1, e, ...caps(ms, s, e, false)); return M(...caps(ms, s, e, true)); } s++; } while (s <= src.length && !anchor);
    return undefined;
  }
  function* gmatchGen(src, pat) { let s = 0; for (;;) { if (s > src.length) return; const ms = { src, pat, cap: [] }; let found = false; for (; s <= src.length; s++) { ms.cap = []; const e = doMatch(ms, s, 0); if (e !== -1) { const c = caps(ms, s, e, true); s = e === s ? e + 1 : e; found = true; yield c; break; } } if (!found) return; } }
  function gsub(src, pat, repl, maxN) {
    const anchor = pat[0] === '^'; const p0 = anchor ? 1 : 0; let s = 0, n = 0, out = ''; if (maxN === undefined) maxN = Infinity;
    while (n < maxN) {
      const ms = { src, pat, cap: [] }; const e = doMatch(ms, s, p0);
      if (e !== -1) {
        n++; const whole = src.slice(s, e); let r;
        if (typeof repl === 'string') { r = repl.replace(/%(.)/g, (m, d) => d === '%' ? '%' : (d >= '0' && d <= '9') ? (d === '0' ? whole : String(getCap(ms, d.charCodeAt(0) - 49, s, e))) : (() => { throw new LuaError("invalid use of '%' in replacement string"); })()); }
        else if (repl instanceof LuaTable) r = repl.get(getCap(ms, 0, s, e)); else r = $1(repl(...caps(ms, s, e, true)));
        out += (r === undefined || r === false) ? whole : (typeof r === 'number' ? fmtNum(r) : r);
      }
      if (e !== -1 && e > s) s = e; else if (s < src.length) out += src[s++]; else break;
      if (anchor) break;
    }
    if (s < src.length) out += src.slice(s); return M(out, n);
  }
  return { find, gmatchGen, gsub };
}
const P = luaPattern();

function format(fmt, ...a) {
  let ai = 0;
  return fmt.replace(/%([-+ #0]*)(\d*)(?:\.(\d+))?([diuoxXeEfgGqscaA%])/g, (m, flags, width, prec, c) => {
    if (c === '%') return '%';
    const v = a[ai++]; let s;
    switch (c) {
      case 'd': case 'i': case 'u': { const n = num(v); if (n === undefined) throw new LuaError("bad argument to 'format' (number expected)"); s = String(Math.trunc(n)); if (flags.indexOf('+') >= 0 && n >= 0) s = '+' + s; else if (flags.indexOf(' ') >= 0 && n >= 0) s = ' ' + s; break; }
      case 'f': { const n = num(v); s = n.toFixed(prec === undefined ? 6 : +prec); if (flags.indexOf('+') >= 0 && n >= 0) s = '+' + s; break; }
      case 'e': case 'E': { const n = num(v); s = n.toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); if (c === 'E') s = s.toUpperCase(); break; }
      case 'g': case 'G': { const n = num(v); const p = prec === undefined ? 6 : (+prec || 1); s = Number(n.toPrecision(p)).toString(); if (/e/.test(s)) s = s.replace(/e([+-])(\d)$/, 'e$10$2'); break; }
      case 'x': s = Math.trunc(num(v)).toString(16); break; case 'X': s = Math.trunc(num(v)).toString(16).toUpperCase(); break; case 'o': s = Math.trunc(num(v)).toString(8); break;
      case 'c': s = String.fromCharCode(num(v)); break;
      case 'q': s = '"' + tostr(v).replace(/[\\"\n]/g, x => x === '\n' ? '\\n' : '\\' + x) + '"'; break;
      default: s = tostr(v); if (prec !== undefined) s = s.slice(0, +prec);
    }
    if (width && s.length < +width) { if (flags.indexOf('-') >= 0) s = s.padEnd(+width); else if (flags.indexOf('0') >= 0 && c !== 's') { const neg = /^[+-]/.test(s) ? s[0] : ''; s = neg + s.slice(neg.length).padStart(+width - neg.length, '0'); } else s = s.padStart(+width); }
    return s;
  });
}

function tableOf(obj) { const t = new LuaTable(); for (const k of Object.keys(obj)) t.set(k, obj[k]); return t; }
const strIdx = (s, i) => { const n = s.length; if (i < 0) i = n + i + 1; return i; };
stringLib = tableOf({
  len: s => s.length,
  sub: (s, i, j) => { const n = s.length; i = i === undefined ? 1 : i; j = j === undefined ? -1 : j; if (i < 0) i = Math.max(n + i + 1, 1); else if (i === 0) i = 1; if (j < 0) j = n + j + 1; else if (j > n) j = n; return i > j ? '' : s.slice(i - 1, j); },
  upper: s => s.toUpperCase(), lower: s => s.toLowerCase(), rep: (s, n, sep) => n <= 0 ? '' : (sep === undefined ? s.repeat(n) : Array(n).fill(s).join(sep)), reverse: s => s.split('').reverse().join(''),
  byte: (s, i, j) => { i = i === undefined ? 1 : strIdx(s, i); j = j === undefined ? i : strIdx(s, j); const o = []; for (let k = i; k <= j && k <= s.length; k++) o.push(s.charCodeAt(k - 1)); return M(...o); },
  char: (...c) => String.fromCharCode(...c), format: (f, ...a) => format(f, ...a),
  find: (s, p, i, plain) => P.find(s, p, i, T(plain), true), match: (s, p, i) => P.find(s, p, i, false, false),
  gmatch: (s, p) => { const g = P.gmatchGen(s, p); return () => { const r = g.next(); return r.done ? undefined : M(...r.value); }; },
  gsub: (s, p, r, n) => P.gsub(s, p, r, n),
  split: (s, sep) => mkT(s.split(sep === undefined ? ',' : sep)),
});
const utf8Lib = tableOf({ len: s => Array.from(s).length, char: (...c) => String.fromCodePoint(...c) });

const mathLib = tableOf({
  abs: Math.abs, acos: Math.acos, asin: Math.asin, atan: Math.atan, atan2: Math.atan2, ceil: Math.ceil, cos: Math.cos, cosh: Math.cosh, deg: x => x * 180 / Math.PI, exp: Math.exp, floor: Math.floor,
  fmod: (a, b) => a % b, huge: Infinity, log: (x, b) => b === undefined ? Math.log(x) : (b === 10 ? Math.log10(x) : b === 2 ? Math.log2(x) : Math.log(x) / Math.log(b)), log10: Math.log10,
  max: (...a) => Math.max(...a), min: (...a) => Math.min(...a), modf: x => { const i = Math.trunc(x); return M(i, x - i); }, pi: Math.PI, pow: Math.pow, rad: x => x * Math.PI / 180, round: x => x < 0 ? -Math.round(-x) : Math.round(x),
  sign: x => x > 0 ? 1 : x < 0 ? -1 : 0, sin: Math.sin, sinh: Math.sinh, sqrt: Math.sqrt, tan: Math.tan, tanh: Math.tanh,
  clamp: (x, a, b) => Math.min(Math.max(x, a), b), noise: () => 0,
  random: (m, n) => { const r = Math.random(); if (m === undefined) return r; if (n === undefined) { n = m; m = 1; } return Math.floor(r * (n - m + 1)) + m; }, randomseed: () => undefined,
});

const tableLib = tableOf({
  insert: (t, a, b) => { if (b === undefined) { t.set(t.length() + 1, a); } else { const n = t.length(); for (let i = n; i >= a; i--) t.set(i + 1, t.get(i)); t.set(a, b); } },
  remove: (t, pos) => { const n = t.length(); if (pos === undefined) pos = n; if (n === 0) return undefined; const v = t.get(pos); for (let i = pos; i < n; i++) t.set(i, t.get(i + 1)); t.set(n, undefined); return v; },
  find: (t, v, init) => { const n = t.length(); for (let i = init === undefined ? 1 : init; i <= n; i++) if (t.get(i) === v) return i; return undefined; },
  concat: (t, sep, i, j) => { sep = sep === undefined ? '' : sep; i = i === undefined ? 1 : i; j = j === undefined ? t.length() : j; const o = []; for (let k = i; k <= j; k++) o.push(tostr(t.get(k))); return o.join(sep); },
  sort: (t, cmp) => { const a = t.arr; if (cmp === undefined) a.sort((x, y) => lt(x, y) ? -1 : lt(y, x) ? 1 : 0); else a.sort((x, y) => T($1(cmp(x, y))) ? -1 : (T($1(cmp(y, x))) ? 1 : 0)); },
  unpack: (t, i, j) => { i = i === undefined ? 1 : i; j = j === undefined ? t.length() : j; const o = []; for (let k = i; k <= j; k++) o.push(t.get(k)); return M(...o); },
  clone: t => { const c = new LuaTable(); for (const [k, v] of t.entries()) c.set(k, v); return c; },
  clear: t => { t.arr.length = 0; t.hash.clear(); },
  move: (a, f, e, t2, b) => { b = b || a; if (t2 > f) for (let i = e; i >= f; i--) b.set(t2 + i - f, a.get(i)); else for (let i = f; i <= e; i++) b.set(t2 + i - f, a.get(i)); return b; },
  create: (n, v) => { const t = new LuaTable(); for (let i = 1; i <= n; i++) t.set(i, v); return t; },
  freeze: t => t, isfrozen: () => false, getn: t => t.length(),
});

function pcall(f, ...args) {
  try {
    const r = f(...args);
    if (isGen(r)) return (function* () { try { const v = yield* r; return M(true, ...(v === undefined ? [] : spread(v))); } catch (e) { return M(false, errval(e)); } })();
    return M(true, ...(r === undefined ? [] : spread(r)));
  } catch (e) { return M(false, errval(e)); }
}
function xpcall(f, h, ...args) {
  const wrap = e => $1(h(errval(e)));
  try {
    const r = f(...args);
    if (isGen(r)) return (function* () { try { const v = yield* r; return M(true, ...(v === undefined ? [] : spread(v))); } catch (e) { return M(false, wrap(e)); } })();
    return M(true, ...(r === undefined ? [] : spread(r)));
  } catch (e) { return M(false, wrap(e)); }
}
const errval = e => e instanceof LuaError ? e.value : (e instanceof Error ? (e.message + '\n' + (e.stack || '')) : e);

const G = new LuaTable();
const out = []; // captured print output (tests)
let printHook = null;
const gset = (k, v) => G.set(k, v);
gset('_G', G); gset('_VERSION', 'Luau (luau2js)');
gset('print', (...a) => { const s = a.map(tostr).join('\t'); if (printHook) printHook(s); else console.log(s); });
gset('warn', (...a) => { const s = a.map(tostr).join('\t'); if (printHook) printHook('warn: ' + s); else console.warn(s); });
gset('type', v => ty(v)); gset('typeof', v => tyof(v)); gset('tostring', v => tostr(v));
gset('tonumber', (v, base) => { if (typeof v === 'number') return v; if (typeof v !== 'string') return undefined; const s = v.trim(); if (base !== undefined && base !== 10) { const n = parseInt(s, base); return isNaN(n) ? undefined : n; } if (/^0[xX][0-9a-fA-F]+$/.test(s)) return parseInt(s, 16); if (s === '' || isNaN(Number(s))) return undefined; return Number(s); });
gset('pairs', t => { if (!(t instanceof LuaTable)) throw new LuaError('invalid argument #1 to \'pairs\' (table expected, got ' + ty(t) + ')'); return new PairsMarker(t); });
gset('ipairs', t => new IpairsMarker(t));
gset('next', nextFn);
gset('select', (n, ...a) => { if (n === '#') return a.length; if (n < 0) n = a.length + n + 1; return M(...a.slice(n - 1)); });
gset('pcall', pcall); gset('xpcall', xpcall);
gset('error', (v) => { throw new LuaError(v); });
gset('assert', (v, msg, ...rest) => { if (!T(v)) throw new LuaError(msg === undefined ? 'assertion failed!' : msg); return M(v, msg, ...rest); });
gset('rawget', (t, k) => t.get(k)); gset('rawset', (t, k, v) => { t.set(k, v); return t; }); gset('rawequal', (a, b) => a === b); gset('rawlen', t => t.length());
gset('unpack', tableLib.get('unpack')); gset('setmetatable', t => t); gset('getmetatable', () => undefined);
gset('string', stringLib); gset('math', mathLib); gset('table', tableLib); gset('utf8', utf8Lib);
gset('os', tableOf({ clock: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000, time: () => Math.floor(Date.now() / 1000), date: () => new Date().toISOString() }));

const R = {
  LuaTable, Multi, LuaError, G, T, M, $1, spread, $y, isGen, tostr, fmtNum, ty, tyof, add, sub, mul, div, mod, pow, idiv, unm, len, eq, lt, le, cat, cats, idx, setidx, cm, mkT, it,
  setPrintHook: f => { printHook = f; }, tableOf,
};
if (typeof module !== 'undefined') module.exports = R; else globalThis.LuauRuntime = R;
