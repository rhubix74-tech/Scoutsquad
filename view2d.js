'use strict';
// view2d.js — debug wireframe renderer (stand-in until the three.js renderer in M3).
// projectScene() is pure (testable in Node); draw() needs a 2D canvas context.
(function (root) {
  const CORNERS = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  function projectScene(world, W, H, maxDist = 3000) {
    const cam = world.camera, cf = cam.props.CFrame, inv = world.math.cfInv(cf), pt = world.math.cfPoint;
    const f = (H / 2) / Math.tan(cam.props.FieldOfView * Math.PI / 360), V3 = world.types.V3;
    const out = [];
    for (const d of world.descendants(world.workspace)) {
      if (!d.cf || d.props.Transparency > 0.95 || d.destroyed) continue;
      const s = d.props.Size, c = d.props.Color;
      const ctr = pt(inv, new V3(d.cf.p[0], d.cf.p[1], d.cf.p[2])); const depth = -ctr.z;
      if (depth < 1 || depth > maxDist) continue;
      const pts = []; let ok = true;
      for (const k of CORNERS) {
        const q = pt(inv, pt(d.cf, new V3(k[0] * s.x / 2, k[1] * s.y / 2, k[2] * s.z / 2)));
        if (-q.z < 0.3) { ok = false; break; }
        pts.push([W / 2 + q.x / -q.z * f, H / 2 - q.y / -q.z * f]);
      }
      if (!ok) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) continue;
      out.push({ depth, pts, bbox: [x0, y0, x1, y1], color: c ? c.toHex() : '#aaaaaa', ball: d.props.Shape && d.props.Shape.name === 'Ball', neon: d.props.Material && d.props.Material.name === 'Neon' });
    }
    out.sort((a, b) => b.depth - a.depth);
    return out;
  }
  function draw(ctx, world, W, H) {
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
    const list = projectScene(world, W, H);
    for (const p of list) {
      const [x0, y0, x1, y1] = p.bbox, w = x1 - x0, h = y1 - y0;
      ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
      if (w < 3 && h < 3) { ctx.fillRect(x0, y0, 2, 2); continue; }
      ctx.globalAlpha = p.neon ? 0.35 : 0.14; if (p.ball) { ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, w / 2, h / 2, 0, 0, 7); ctx.fill(); } else ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = 1;
      if (p.ball) { ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, w / 2, h / 2, 0, 0, 7); ctx.stroke(); continue; }
      ctx.beginPath(); for (const [a, b] of EDGES) { ctx.moveTo(p.pts[a][0], p.pts[a][1]); ctx.lineTo(p.pts[b][0], p.pts[b][1]); } ctx.stroke();
    }
    const m = world.mouse; ctx.strokeStyle = '#0ff'; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, 7); ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x + 14, m.y); ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y + 14); ctx.stroke();
    return list.length;
  }
  const api = { projectScene, draw };
  if (typeof module !== 'undefined') module.exports = api; else root.LuauView2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
