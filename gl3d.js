'use strict';
// gl3d.js — small dependency-free WebGL1 renderer: Block/Ball/Cylinder parts, Neon, transparency,
// ParticleEmitters (point sprites) and Explosion effects. Reads the shim's Instance tree each frame.
(function (root) {
  const VS = `attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uR; uniform vec3 uInvS;
varying vec3 vN; varying vec3 vWP;
void main(){ vec4 wp = uM * vec4(aPos, 1.0); vWP = wp.xyz; vN = uR * (aNrm * uInvS); gl_Position = uVP * wp; }`;
  const FS = `precision mediump float;
varying vec3 vN; varying vec3 vWP;
uniform vec3 uCol; uniform float uAlpha; uniform float uEmis; uniform float uSpec; uniform vec3 uCam; uniform vec3 uFog; uniform float uFogD;
void main(){
  vec3 n = normalize(vN); vec3 L = normalize(vec3(0.35, 0.85, 0.4)); vec3 V = normalize(uCam - vWP);
  if (dot(n, V) < 0.0) n = -n;
  float d = max(dot(n, L), 0.0); float back = max(dot(n, -L), 0.0) * 0.18;
  vec3 H = normalize(L + V); float sp = pow(max(dot(n, H), 0.0), 36.0) * uSpec;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.12;
  vec3 lit = uCol * (0.38 + 0.72 * d + back) + vec3(sp) + uCol * rim;
  vec3 c = mix(lit, uCol * 1.3, uEmis);
  float f = clamp(length(uCam - vWP) / uFogD, 0.0, 1.0);
  c = mix(c, uFog, f * f * 0.85);
  gl_FragColor = vec4(c, uAlpha);
}`;
  const PVS = `attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform mat4 uVP; uniform float uFocal; varying vec4 vC;
void main(){ vec4 p = uVP * vec4(aPos, 1.0); gl_Position = p; vC = aCol; gl_PointSize = clamp(aSize * uFocal / max(p.w, 0.1), 1.0, 96.0); }`;
  const PFS = `precision mediump float; varying vec4 vC;
void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; float a = (1.0 - r) * vC.a; gl_FragColor = vec4(vC.rgb * a, a); }`;

  // ---- mesh builders (interleaved pos,normal) ----
  function boxMesh() {
    const v = [], idx = []; const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    for (const [n, u, w] of faces) { const b = v.length / 6; for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push(0.5 * (n[0] + a * u[0] + c * w[0]), 0.5 * (n[1] + a * u[1] + c * w[1]), 0.5 * (n[2] + a * u[2] + c * w[2]), n[0], n[1], n[2]); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    return { v: new Float32Array(v), i: new Uint16Array(idx) };
  }
  function sphereMesh(la = 14, lo = 22) {
    const v = [], idx = [];
    for (let i = 0; i <= la; i++) { const t = i / la * Math.PI, st = Math.sin(t), ct = Math.cos(t); for (let j = 0; j <= lo; j++) { const p = j / lo * 2 * Math.PI, x = st * Math.cos(p), z = st * Math.sin(p); v.push(0.5 * x, 0.5 * ct, 0.5 * z, x, ct, z); } }
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = i * (lo + 1) + j, b = a + lo + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    return { v: new Float32Array(v), i: new Uint16Array(idx) };
  }
  function cylMesh(seg = 28) { // axis along X (Roblox cylinder), unit height & diameter
    const v = [], idx = [];
    for (let j = 0; j <= seg; j++) { const p = j / seg * 2 * Math.PI, y = Math.cos(p), z = Math.sin(p); v.push(-0.5, 0.5 * y, 0.5 * z, 0, y, z, 0.5, 0.5 * y, 0.5 * z, 0, y, z); }
    for (let j = 0; j < seg; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    for (const sx of [-1, 1]) { const c = v.length / 6; v.push(sx * 0.5, 0, 0, sx, 0, 0); for (let j = 0; j <= seg; j++) { const p = j / seg * 2 * Math.PI; v.push(sx * 0.5, 0.5 * Math.cos(p), 0.5 * Math.sin(p), sx, 0, 0); } for (let j = 0; j < seg; j++) idx.push(c, c + 1 + j, c + 2 + j); }
    return { v: new Float32Array(v), i: new Uint16Array(idx) };
  }
  const MAT = { // emissive, specular
    Neon: [1, 0.0], ForceField: [1, 0.0], Metal: [0, 0.55], CorrodedMetal: [0, 0.3], DiamondPlate: [0, 0.5], Glass: [0, 0.7], Ice: [0, 0.45], SmoothPlastic: [0, 0.22], Foil: [0, 0.6], Marble: [0, 0.3], Granite: [0, 0.2],
  };
  const NORMAL_DIR = { Right: [1, 0, 0], Left: [-1, 0, 0], Top: [0, 1, 0], Bottom: [0, -1, 0], Back: [0, 0, 1], Front: [0, 0, -1] };

  function createRenderer(canvas, world, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    const P = prog(VS, FS), PP = prog(PVS, PFS);
    const U = n => gl.getUniformLocation(P, n), PU = n => gl.getUniformLocation(PP, n);
    const u = { vp: U('uVP'), m: U('uM'), r: U('uR'), invS: U('uInvS'), col: U('uCol'), alpha: U('uAlpha'), emis: U('uEmis'), spec: U('uSpec'), cam: U('uCam'), fog: U('uFog'), fogD: U('uFogD') };
    const pu = { vp: PU('uVP'), focal: PU('uFocal') };
    const mk = m => { const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, m.v, gl.STATIC_DRAW); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.i, gl.STATIC_DRAW); return { vb, ib, n: m.i.length }; };
    const meshes = { box: mk(boxMesh()), ball: mk(sphereMesh()), cyl: mk(cylMesh()) };
    const aPos = gl.getAttribLocation(P, 'aPos'), aNrm = gl.getAttribLocation(P, 'aNrm');
    const pPos = gl.getAttribLocation(PP, 'aPos'), pCol = gl.getAttribLocation(PP, 'aCol'), pSize = gl.getAttribLocation(PP, 'aSize');
    const FOG = [0.012, 0.016, 0.04];
    // ---- sky: driven by Lighting.SkyColor (horizon/bottom), optional Lighting.SkyTop, Lighting.FogDist; eased toward target ----
    const lightSvc = world.getSvc('Lighting');
    const SKY_BLACK = [0.012, 0.016, 0.04];
    const skyBot = SKY_BLACK.slice(), skyTop = SKY_BLACK.slice(); let fogDist = 9000, skyT = world.time;
    const SP = prog('attribute vec2 p; varying float v; void main(){ v = p.y * 0.5 + 0.5; gl_Position = vec4(p, 0.999, 1.0); }',
      'precision mediump float; uniform vec3 uTop; uniform vec3 uBot; varying float v; void main(){ gl_FragColor = vec4(mix(uBot, uTop, smoothstep(0.0, 1.0, v)), 1.0); }');
    const spPos = gl.getAttribLocation(SP, 'p'), spTop = gl.getUniformLocation(SP, 'uTop'), spBot = gl.getUniformLocation(SP, 'uBot');
    const spBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, spBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    function updateSky() {
      const dt = Math.max(0, Math.min(0.25, world.time - skyT)); skyT = world.time; const k = 1 - Math.exp(-dt * 3.5);
      const b = lightSvc.props.SkyColor, t = lightSvc.props.SkyTop || b, fd = lightSvc.props.FogDist || 9000;
      const tb = b ? [b.r, b.g, b.b] : SKY_BLACK, tt = t ? [t.r, t.g, t.b] : SKY_BLACK;
      for (let i = 0; i < 3; i++) { skyBot[i] += (tb[i] - skyBot[i]) * k; skyTop[i] += (tt[i] - skyTop[i]) * k; FOG[i] = skyBot[i] * 0.5 + skyTop[i] * 0.5; }
      fogDist += (fd - fogDist) * k;
    }
    function drawSky() {
      if (Math.abs(skyTop[0] - skyBot[0]) + Math.abs(skyTop[1] - skyBot[1]) + Math.abs(skyTop[2] - skyBot[2]) < 0.004) return; // flat sky: clear color is enough
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.useProgram(SP);
      gl.bindBuffer(gl.ARRAY_BUFFER, spBuf); gl.enableVertexAttribArray(spPos); gl.vertexAttribPointer(spPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3f(spTop, skyTop[0], skyTop[1], skyTop[2]); gl.uniform3f(spBot, skyBot[0], skyBot[1], skyBot[2]); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(spPos); gl.enable(gl.DEPTH_TEST);
      curMesh = null; // sky pass reused attribute slot 0: force the mesh pass to re-bind its buffers (was making the floor vanish on alternate frames)
    }

    // ---- scene cache ----
    let dirty = true, parts = [], emitters = [], explosions = new Set();
    const mark = () => { dirty = true; };
    world.on('reparent', (o, old, p) => { dirty = true; if (o.cls === 'Explosion' && p) explosions.add({ inst: o, t0: world.time }); });
    world.on('destroyed', mark);
    function rebuild() {
      parts = []; emitters = [];
      for (const d of world.descendants(world.workspace)) {
        if (d.cf) parts.push(d);
        else if (d.cls === 'ParticleEmitter' && d.parent && d.parent.cf) emitters.push({ inst: d, acc: 0 });
      }
      dirty = false;
    }
    const emitterState = new WeakMap();

    // ---- matrices ----
    const vp = new Float32Array(16), m4 = new Float32Array(16), r3 = new Float32Array(9);
    let camPos = [0, 0, 0], viewR = null, fovTan = 1, aspect = 1;
    function setCamera(W, H) {
      const cam = world.camera, cf = cam.props.CFrame, r = cf.r, p = cf.p, f = 1 / Math.tan(cam.props.FieldOfView * Math.PI / 360); aspect = W / H; fovTan = 1 / f;
      const n = 2, fa = 20000; // larger near plane = ~4x better depth precision (fixes far-floor z-fighting)
      // view = R^T * (x - p); columns of view matrix (column-major)
      const tx = -(r[0] * p[0] + r[3] * p[1] + r[6] * p[2]), ty = -(r[1] * p[0] + r[4] * p[1] + r[7] * p[2]), tz = -(r[2] * p[0] + r[5] * p[1] + r[8] * p[2]);
      const V = [r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1]; // rows of view = columns of R
      // build view (row-major rows): row0 = right, row1 = up, row2 = back
      const vr = [[r[0], r[3], r[6], tx], [r[1], r[4], r[7], ty], [r[2], r[5], r[8], tz]];
      const A = f / aspect, B = f, C = (fa + n) / (n - fa), D = 2 * fa * n / (n - fa);
      // proj * view, column-major output
      const rows = [[A * vr[0][0], A * vr[0][1], A * vr[0][2], A * vr[0][3]], [B * vr[1][0], B * vr[1][1], B * vr[1][2], B * vr[1][3]],
        [C * vr[2][0], C * vr[2][1], C * vr[2][2], C * vr[2][3] + D], [-vr[2][0], -vr[2][1], -vr[2][2], -vr[2][3]]];
      for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) vp[c * 4 + rr] = rows[rr][c];
      camPos = p; viewR = vr;
    }
    const vdepth = (x, y, z) => -(viewR[2][0] * x + viewR[2][1] * y + viewR[2][2] * z + viewR[2][3]);

    function shapeOf(d) {
      const sh = d.props.Shape; if (sh && sh.name === 'Ball') return 'ball'; if (sh && sh.name === 'Cylinder') return 'cyl';
      for (const c of d.children) if (c.cls === 'SpecialMesh' && c.props.MeshType && c.props.MeshType.name === 'Sphere') return 'ball';
      return 'box';
    }
    let curMesh = null;
    function bind(mesh) { if (curMesh === mesh) return; curMesh = mesh; gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 24, 12); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib); }
    function drawMesh(kind, cf, sx, sy, sz, col, alpha, emis, spec) {
      const r = cf.r, p = cf.p;
      m4[0] = r[0] * sx; m4[1] = r[3] * sx; m4[2] = r[6] * sx; m4[3] = 0; m4[4] = r[1] * sy; m4[5] = r[4] * sy; m4[6] = r[7] * sy; m4[7] = 0; m4[8] = r[2] * sz; m4[9] = r[5] * sz; m4[10] = r[8] * sz; m4[11] = 0; m4[12] = p[0]; m4[13] = p[1]; m4[14] = p[2]; m4[15] = 1;
      r3[0] = r[0]; r3[1] = r[3]; r3[2] = r[6]; r3[3] = r[1]; r3[4] = r[4]; r3[5] = r[7]; r3[6] = r[2]; r3[7] = r[5]; r3[8] = r[8];
      gl.uniformMatrix4fv(u.m, false, m4); gl.uniformMatrix3fv(u.r, false, r3); gl.uniform3f(u.invS, 1 / (sx || 1e-4), 1 / (sy || 1e-4), 1 / (sz || 1e-4));
      gl.uniform3f(u.col, col.r, col.g, col.b); gl.uniform1f(u.alpha, alpha); gl.uniform1f(u.emis, emis); gl.uniform1f(u.spec, spec);
      const mesh = meshes[kind]; bind(mesh); gl.drawElements(gl.TRIANGLES, mesh.n, gl.UNSIGNED_SHORT, 0);
    }

    // ---- particles ----
    const MAXP = 6000; const pArr = new Float32Array(MAXP * 8); const pBuf = gl.createBuffer(); let pCount = 0;
    const plist = []; // {x,y,z,vx,vy,vz,age,life,size,r,g,b,a,ax,ay,az,add}
    let lastT = world.time;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const seq0 = (s, d) => { const k = s && s.props && s.props.Keypoints && s.props.Keypoints.get(1); return k ? k.props.Value : d; };
    const range = rg => rg && rg.props ? [rg.props.Min, rg.props.Max] : [1, 1];
    function updateParticles(dt) {
      for (const e of emitters) {
        const ins = e.inst, part = ins.parent; if (!part.cf || ins.props.Enabled === false || ins.destroyed || part.destroyed) continue;
        e.acc += (ins.props.Rate || 20) * dt; let n = Math.floor(e.acc); e.acc -= n; if (n > 400) n = 400;
        const [l0, l1] = range(ins.props.Lifetime), [s0, s1] = range(ins.props.Speed || { props: { Min: 0, Max: 0 } }); const dir = NORMAL_DIR[ins.props.EmissionDirection && ins.props.EmissionDirection.name] || [0, 1, 0];
        const sp = ins.props.SpreadAngle ? [ins.props.SpreadAngle.x, ins.props.SpreadAngle.y] : [0, 0]; const acc = ins.props.Acceleration; const col = seq0(ins.props.Color, { r: 1, g: 1, b: 1 }); const size = seq0(ins.props.Size, 1) ; const tr = seq0(ins.props.Transparency, 0);
        const cf = part.cf, ps = part.props.Size, r = cf.r;
        for (let i = 0; i < n && plist.length < MAXP; i++) {
          const ax1 = dir[0] ? [0, 1, 0] : [1, 0, 0], ax2 = dir[2] ? [0, 1, 0] : [0, 0, 1], ta = Math.tan(rnd(-sp[0], sp[0]) * Math.PI / 180), tb = Math.tan(rnd(-sp[1], sp[1]) * Math.PI / 180);
          let d = [dir[0] + ax1[0] * ta + ax2[0] * tb, dir[1] + ax1[1] * ta + ax2[1] * tb, dir[2] + ax1[2] * ta + ax2[2] * tb];
          const dm = Math.hypot(...d) || 1; d = d.map(v => v / dm); const sv = rnd(s0, s1);
          const off = [rnd(-.5, .5) * ps.x, rnd(-.5, .5) * ps.y, rnd(-.5, .5) * ps.z];
          const w = o => [r[0] * o[0] + r[1] * o[1] + r[2] * o[2], r[3] * o[0] + r[4] * o[1] + r[5] * o[2], r[6] * o[0] + r[7] * o[1] + r[8] * o[2]];
          const wo = w(off), wd = w(d);
          plist.push({ x: cf.p[0] + wo[0], y: cf.p[1] + wo[1], z: cf.p[2] + wo[2], vx: wd[0] * sv, vy: wd[1] * sv, vz: wd[2] * sv, age: 0, life: rnd(l0, l1) || 1, size, r: col.r, g: col.g, b: col.b, a: 1 - tr, ax: acc ? acc.x : 0, ay: acc ? acc.y : 0, az: acc ? acc.z : 0, add: (ins.props.LightEmission || 0) > 0.2 });
        }
      }
      let w = 0; for (let i = 0; i < plist.length; i++) { const q = plist[i]; q.age += dt; if (q.age >= q.life) continue; q.vx += q.ax * dt; q.vy += q.ay * dt; q.vz += q.az * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; plist[w++] = q; } plist.length = w;
    }
    function drawParticles(ph) {
      if (!plist.length) return; pCount = 0;
      for (const q of plist) { if (pCount >= MAXP) break; const o = pCount * 8, f = 1 - q.age / q.life; pArr[o] = q.x; pArr[o + 1] = q.y; pArr[o + 2] = q.z; pArr[o + 3] = q.r; pArr[o + 4] = q.g; pArr[o + 5] = q.b; pArr[o + 6] = q.a * Math.min(1, f * 1.6); pArr[o + 7] = q.size * (0.6 + 0.4 * f); pCount++; }
      gl.useProgram(PP); gl.uniformMatrix4fv(pu.vp, false, vp); gl.uniform1f(pu.focal, (ph / 2) / fovTan);
      gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pArr.subarray(0, pCount * 8), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pPos); gl.enableVertexAttribArray(pCol); gl.enableVertexAttribArray(pSize);
      gl.vertexAttribPointer(pPos, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(pCol, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(pSize, 1, gl.FLOAT, false, 32, 28);
      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, pCount);
      gl.disableVertexAttribArray(pPos); gl.disableVertexAttribArray(pCol); gl.disableVertexAttribArray(pSize); gl.useProgram(P); curMesh = null; gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aNrm);
    }

    const stats = { parts: 0, drawn: 0, particles: 0 };
    const tmpCF = { p: [0, 0, 0], r: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    function render(W, H, dpr) {
      const pw = Math.round(W * dpr), ph = Math.round(H * dpr); if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      gl.viewport(0, 0, pw, ph); updateSky(); gl.clearColor(skyBot[0], skyBot[1], skyBot[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); drawSky();
      if (dirty) rebuild();
      const dt = Math.min(0.1, world.time - lastT); lastT = world.time; if (dt > 0) updateParticles(dt);
      setCamera(W, H);
      gl.useProgram(P); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aNrm);
      gl.uniformMatrix4fv(u.vp, false, vp); gl.uniform3f(u.cam, camPos[0], camPos[1], camPos[2]); gl.uniform3f(u.fog, FOG[0], FOG[1], FOG[2]); gl.uniform1f(u.fogD, fogDist);
      gl.disable(gl.CULL_FACE); // spheres/cylinders mix winding conventions; shading flips back-faces instead
      const opaque = [], trans = [];
      for (const d of parts) {
        if (d.destroyed) continue; const tr = d.props.Transparency; if (tr >= 0.999) continue;
        const s = d.props.Size, cf = d.cf, depth = vdepth(cf.p[0], cf.p[1], cf.p[2]), rad = Math.hypot(s.x, s.y, s.z) / 2;
        if (depth < -rad || depth > 14000) continue;
        if (depth > 0 && (Math.abs(viewR[0][0] * cf.p[0] + viewR[0][1] * cf.p[1] + viewR[0][2] * cf.p[2] + viewR[0][3]) > depth * fovTan * aspect + rad || Math.abs(viewR[1][0] * cf.p[0] + viewR[1][1] * cf.p[1] + viewR[1][2] * cf.p[2] + viewR[1][3]) > depth * fovTan + rad)) continue;
        (tr > 0.001 ? trans : opaque).push(d); d.$z = depth;
      }
      trans.sort((a, b) => b.$z - a.$z);
      const emit = d => { const s = d.props.Size, mt = d.props.Material && d.props.Material.name, mm = MAT[mt] || [0, 0.06]; const a = 1 - d.props.Transparency; drawMesh(shapeOf(d), d.cf, s.x, s.y, s.z, d.props.Color, a, mm[0], mm[1]); };
      gl.disable(gl.BLEND); gl.depthMask(true); for (const d of opaque) emit(d);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); for (const d of trans) emit(d);
      // explosions: expanding emissive spheres
      for (const e of explosions) { const age = world.time - e.t0, dur = 0.55; if (age > dur || e.inst.destroyed) { explosions.delete(e); continue; } const k = age / dur, R = (e.inst.props.BlastRadius || 4) * (0.35 + 0.9 * k), pos = e.inst.props.Position;
        tmpCF.p = [pos.x, pos.y, pos.z]; gl.blendFunc(gl.SRC_ALPHA, gl.ONE); drawMesh('ball', tmpCF, R * 2, R * 2, R * 2, { r: 1, g: 0.55 - 0.3 * k, b: 0.15 }, 0.7 * (1 - k), 1, 0); }
      drawParticles(ph);
      gl.depthMask(true); gl.disable(gl.BLEND);
      stats.parts = parts.length; stats.drawn = opaque.length + trans.length; stats.particles = plist.length;
      return stats;
    }
    return { render, stats, gl };
  }
  const api = { createRenderer };
  if (typeof module !== 'undefined') module.exports = api; else root.LuauGL3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
