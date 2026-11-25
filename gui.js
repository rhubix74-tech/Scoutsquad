'use strict';
// gui.js — maps the shim's GUI instances to DOM. ScreenGuis under PlayerGui render into `screenEl`;
// BillboardGuis (anywhere in Workspace) render into `billboardEl`, projected to screen each frame.
(function (root) {
  const MODS = new Set(['UICorner', 'UIStroke', 'UIListLayout', 'UIGradient', 'UIPadding', 'UIAspectRatioConstraint', 'UIScale', 'UIGridLayout']);
  const TEXT = new Set(['TextLabel', 'TextButton', 'TextBox']);
  const SANS = '"Montserrat","Gotham","Segoe UI","Helvetica Neue",Arial,sans-serif';
  const FONTS = { GothamBlack: [900, SANS, 0.76], GothamBold: [700, SANS, 0.68], GothamMedium: [500, SANS, 0.63], Gotham: [400, SANS, 0.56], GothamSemibold: [600, SANS, 0.6],
    Code: [400, 'ui-monospace,"SF Mono",Consolas,"DejaVu Sans Mono",monospace', 0.6], SourceSans: [400, '"Segoe UI",Arial,sans-serif', 0.5], SourceSansBold: [700, '"Segoe UI",Arial,sans-serif', 0.54],
    Arial: [400, 'Arial,sans-serif', 0.55], ArialBold: [700, 'Arial,sans-serif', 0.6], SciFi: [600, '"Orbitron","Segoe UI",sans-serif', 0.7] };
  const css = c => c ? `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}` : '0,0,0';
  const rgba = (c, a) => `rgba(${css(c)},${Math.max(0, Math.min(1, a))})`;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function richText(s) { // tiny subset: <b> <i> <u> <br/> <font color size>
    let out = esc(s).replace(/&lt;(\/?)(b|i|u|s)&gt;/g, '<$1$2>').replace(/&lt;br\s*\/?&gt;/g, '<br>');
    out = out.replace(/&lt;font([^&]*?)&gt;/g, (m, a) => { const col = /color\s*=\s*&quot;?([#\w(),\s]+?)&quot;?(\s|$)/.exec(a) || /color\s*=\s*"([^"]+)"/.exec(a); const sz = /size\s*=\s*"?(\d+)/.exec(a); return `<span style="${col ? 'color:' + col[1] : ''};${sz ? 'font-size:' + sz[1] + 'px' : ''}">`; }).replace(/&lt;\/font&gt;/g, '</span>');
    return out;
  }
  function seqCss(seq, rot) {
    const kps = seq && seq.props && seq.props.Keypoints; if (!kps) return '';
    const stops = []; for (let i = 1; kps.get(i); i++) { const k = kps.get(i); stops.push(`rgb(${css(k.props.Value)}) ${Math.round(k.props.Time * 100)}%`); }
    return stops.length ? `linear-gradient(${90 + (rot || 0)}deg,${stops.join(',')})` : '';
  }
  function createGuiLayer(o) {
    const { world, screenEl, billboardEl, playerGui } = o;
    const els = new Map(), dirty = new Set(), bbs = new Set();
    const isA = (c, k) => world.isA(c, k);
    const guiish = c => isA(c, 'GuiObject') || isA(c, 'LayerCollector');
    const inWorkspace = x => { for (let p = x.parent; p; p = p.parent) if (p === world.workspace) return true; return false; };
    const mods = (x, cls) => x.children.filter(c => c.cls === cls);
    const firstMod = (x, cls) => x.children.find(c => c.cls === cls && c.props.Enabled !== false);

    function create(x) {
      const el = document.createElement('div'); el.className = 'g'; el.style.position = 'absolute'; el.style.boxSizing = 'border-box'; el.style.margin = '0'; el.style.pointerEvents = 'none';
      els.set(x, el);
      if (x.cls === 'TextButton' || x.cls === 'ImageButton') interact(x, el);
      return el;
    }
    function interact(x, el) {
      el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer'; el.style.userSelect = 'none'; el.style.touchAction = 'none';
      const rel = e => { const r = screenEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, button: e.button, touch: e.pointerType === 'touch', processed: true }; };
      let down = false;
      el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); down = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} el.classList.add('pr'); world.sendPointer('down', rel(e)); });
      el.addEventListener('pointerup', e => { e.stopPropagation(); const wasDown = down; down = false; el.classList.remove('pr'); const r = el.getBoundingClientRect(); world.sendPointer('up', rel(e));
        if (wasDown && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { x.signal('TouchTap')?.fire(); world.click(x); } });
      el.addEventListener('pointercancel', () => { down = false; el.classList.remove('pr'); });
      el.addEventListener('pointerenter', () => { x.signal('MouseEnter')?.fire(0, 0); });
      el.addEventListener('pointerleave', () => { x.signal('MouseLeave')?.fire(0, 0); });
    }
    // build element subtree for x under parentEl
    function build(x, parentEl) {
      if (els.has(x)) return;
      if (MODS.has(x.cls)) return;
      if (!guiish(x.cls)) return;
      const el = create(x); parentEl.appendChild(el); apply(x, el);
      for (const c of x.children) build(c, el);
    }
    function remove(x) {
      const el = els.get(x); if (el) { el.remove(); }
      for (const d of [x, ...world.descendants(x)]) { els.delete(d); dirty.delete(d); bbs.delete(d); }
    }
    function markTree(x) { for (const d of world.descendants(x)) if (els.has(d)) dirty.add(d); }

    function listParent(x) { const p = x.parent; return p && p.children.some(c => c.cls === 'UIListLayout' && c.props.Enabled !== false) ? p : null; }
    function apply(x, el) {
      const p = x.props, st = el.style;
      if (isA(x.cls, 'LayerCollector')) {
        if (x.cls === 'BillboardGui') { st.width = (p.Size.xo || 0) + 'px'; st.height = (p.Size.yo || 0) + 'px'; return; }
        st.left = st.top = '0'; st.width = st.height = '100%'; st.overflow = 'hidden'; st.zIndex = String(p.DisplayOrder | 0); st.display = p.Enabled === false ? 'none' : 'block'; return;
      }
      const lp = listParent(x), S = p.Size, P = p.Position, A = p.AnchorPoint;
      const isText = TEXT.has(x.cls), lay = firstMod(x, 'UIListLayout');
      st.display = p.Visible === false ? 'none' : (isText || lay ? 'flex' : 'block');
      st.width = `calc(${S.xs * 100}% + ${S.xo}px)`; st.height = `calc(${S.ys * 100}% + ${S.yo}px)`;
      if (lp) { st.position = 'relative'; st.left = st.top = 'auto'; st.flex = 'none'; st.order = String(p.LayoutOrder | 0); }
      else { st.position = 'absolute'; st.order = ''; st.flex = ''; st.left = `calc(${(P.xs - A.x * S.xs) * 100}% + ${P.xo - A.x * S.xo}px)`; st.top = `calc(${(P.ys - A.y * S.ys) * 100}% + ${P.yo - A.y * S.yo}px)`; }
      st.transformOrigin = `${A.x * 100}% ${A.y * 100}%`; st.transform = p.Rotation ? `rotate(${p.Rotation}deg)` : '';
      st.zIndex = String(p.ZIndex | 0); st.overflow = p.ClipsDescendants ? 'hidden' : (x.cls === 'ScrollingFrame' ? 'auto' : 'visible');
      // background / border
      const bgA = 1 - (p.BackgroundTransparency == null ? 0 : p.BackgroundTransparency);
      const grad = firstMod(x, 'UIGradient');
      st.backgroundColor = bgA > 0.001 ? rgba(p.BackgroundColor3, bgA) : 'transparent';
      st.backgroundImage = grad && bgA > 0.001 ? seqCss(grad.props.Color, grad.props.Rotation) : '';
      st.border = bgA > 0.001 && p.BorderSizePixel > 0 ? `${p.BorderSizePixel}px solid rgb(${css(p.BorderColor3 || { r: 0.1, g: 0.17, b: 0.2 })})` : 'none';
      // corner + stroke
      const cr = firstMod(x, 'UICorner'), ab = x.$index('AbsoluteSize');
      st.borderRadius = cr ? `${Math.round(cr.props.CornerRadius.s * Math.min(ab.x, ab.y) + cr.props.CornerRadius.o)}px` : '';
      const stroke = firstMod(x, 'UIStroke'); st.boxShadow = ''; st.webkitTextStroke = '';
      if (stroke) { const sc = rgba(stroke.props.Color, 1 - stroke.props.Transparency); if (isText && bgA <= 0.001) { st.webkitTextStroke = `${stroke.props.Thickness}px ${sc}`; st.paintOrder = 'stroke fill'; } else st.boxShadow = `0 0 0 ${stroke.props.Thickness}px ${sc}`; }
      // layout list
      if (lay) { const lp2 = lay.props, horiz = lp2.FillDirection && lp2.FillDirection.name === 'Horizontal', pad = lp2.Padding; const ha = lp2.HorizontalAlignment && lp2.HorizontalAlignment.name, va = lp2.VerticalAlignment && lp2.VerticalAlignment.name;
        const j = { Left: 'flex-start', Center: 'center', Right: 'flex-end', Top: 'flex-start', Bottom: 'flex-end' };
        st.flexDirection = horiz ? 'row' : 'column'; st.gap = `${pad.o + pad.s * (horiz ? ab.x : ab.y)}px`; st.justifyContent = j[horiz ? ha : va] || 'flex-start'; st.alignItems = j[horiz ? va : ha] || 'flex-start'; }
      else if (!isText) { st.flexDirection = ''; st.gap = ''; }
      // text
      if (isText) text(x, el, ab);
      el.classList.toggle('ab', (x.cls === 'TextButton' || x.cls === 'ImageButton') && p.AutoButtonColor !== false);
    }
    function text(x, el, ab) {
      const p = x.props, st = el.style, f = FONTS[p.Font && p.Font.name] || FONTS.SourceSans, str = String(p.Text == null ? '' : p.Text);
      if (el._t !== str || el._rt !== p.RichText) { el._t = str; el._rt = p.RichText; if (p.RichText) el.innerHTML = richText(str); else el.textContent = str; }
      let size = p.TextSize || 14;
      if (p.TextScaled) {
        const lines = str.split('\n'), maxLen = Math.max(1, ...lines.map(l => l.length)); const fit = s => (p.TextWrapped ? Math.ceil(str.length * f[2] * s / Math.max(1, ab.x)) * 1.15 * s <= ab.y : (lines.length * 1.15 * s <= ab.y && maxLen * f[2] * s <= ab.x));
        size = 100; while (size > 6 && !fit(size)) size -= 1;
      }
      st.fontSize = size + 'px'; st.fontWeight = f[0]; st.fontFamily = f[1]; st.lineHeight = '1.15';
      const tc = p.TextColor3 || { r: 0, g: 0, b: 0 }; st.color = rgba(tc, 1 - (p.TextTransparency || 0));
      const xa = (p.TextXAlignment && p.TextXAlignment.name) || 'Center', ya = (p.TextYAlignment && p.TextYAlignment.name) || 'Center';
      const jm = { Left: 'flex-start', Center: 'center', Right: 'flex-end', Top: 'flex-start', Bottom: 'flex-end' };
      st.justifyContent = jm[xa] || 'center'; st.alignItems = jm[ya] || 'center'; st.textAlign = xa === 'Left' ? 'left' : xa === 'Right' ? 'right' : 'center';
      st.whiteSpace = p.TextWrapped ? 'pre-wrap' : 'pre'; st.wordBreak = p.TextWrapped ? 'break-word' : 'normal';
      const ts = p.TextStrokeTransparency; if (ts != null && ts < 0.99 && !st.webkitTextStroke) { const c = rgba(p.TextStrokeColor3, 1 - ts); st.textShadow = `1px 1px 0 ${c},-1px -1px 0 ${c},1px -1px 0 ${c},-1px 1px 0 ${c}`; } else st.textShadow = '';
    }

    // ---- hooks ----
    function considerAttach(x) { // x just got a (new) parent
      if (guiish(x.cls)) {
        if (x.cls === 'BillboardGui') { bbs.add(x); return; }
        const par = x.parent; if (!par) return;
        if (x.cls === 'ScreenGui') { if (par === playerGui) build(x, screenEl); return; }
        const pe = els.get(par); if (pe) build(x, pe);
      } else if (MODS.has(x.cls)) { const par = x.parent; if (par && els.has(par)) { dirty.add(par); if (x.cls === 'UIListLayout') for (const c of par.children) dirty.add(c); } }
      else { for (const d of world.descendants(x)) if (d.cls === 'BillboardGui') bbs.add(d); }
    }
    world.on('reparent', (x, old, nw) => {
      if (els.has(x)) remove(x);
      if (MODS.has(x.cls) && old && els.has(old)) { dirty.add(old); for (const c of old.children) dirty.add(c); }
      if (x.cls === 'BillboardGui' && !nw) bbs.delete(x);
      if (nw) considerAttach(x);
    });
    world.on('destroyed', x => { if (els.has(x)) remove(x); bbs.delete(x); });
    world.on('propChanged', (x, k) => {
      if (els.has(x)) { dirty.add(x); if (k === 'Size' && x.children.length) markTree(x); return; }
      if (MODS.has(x.cls) && x.parent && els.has(x.parent)) { dirty.add(x.parent); if (x.cls === 'UIListLayout') for (const c of x.parent.children) dirty.add(c); }
    });
    // initial scan
    for (const g of playerGui.children) considerAttach(g);

    function flush() { if (!dirty.size) return; const list = [...dirty]; dirty.clear(); for (const x of list) { const el = els.get(x); if (el) apply(x, el); } }
    function markAll() { for (const x of els.keys()) dirty.add(x); }
    function updateBillboards() {
      const cam = world.camera, cf = cam.props.CFrame, r = cf.r;
      for (const b of bbs) {
        let el = els.get(b); const part = b.props.Adornee || b.parent;
        const ok = part && part.cf && !b.destroyed && b.props.Enabled !== false && inWorkspace(b.parent === part ? b : b) ;
        if (!ok) { if (el) el.style.display = 'none'; continue; }
        if (!el) { el = create(b); billboardEl.appendChild(el); apply(b, el); for (const c of b.children) build(c, el); }
        const so = b.props.StudsOffset, ox = r[0] * so.x + r[1] * so.y + r[2] * so.z, oy = r[3] * so.x + r[4] * so.y + r[5] * so.z, oz = r[6] * so.x + r[7] * so.y + r[8] * so.z;
        const q = world.project(new world.types.V3(part.cf.p[0] + ox, part.cf.p[1] + oy, part.cf.p[2] + oz));
        if (q.depth <= 0.5 || q.depth > b.props.MaxDistance) { el.style.display = 'none'; continue; }
        const st = el.style; st.display = 'block'; st.left = q.x + 'px'; st.top = q.y + 'px'; st.transform = 'translate(-50%,-50%)'; st.zIndex = String(Math.max(1, 5000 - (q.depth | 0)));
      }
    }
    return { flush, markAll, updateBillboards, count: () => els.size };
  }
  const api = { createGuiLayer };
  if (typeof module !== 'undefined') module.exports = api; else root.LuauGui = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
