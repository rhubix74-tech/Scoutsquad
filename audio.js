'use strict';
// audio.js — plays the game's Sound instances in the browser.
// A Sound's SoundId is treated as a plain file path (e.g. "sounds/shoot.mp3"), resolved relative to index.html.
// Missing files are skipped silently (one console note per file), so you can add/rename mp3s at any time.
// To rename a sound for deployment, rename the file in /sounds — or change the path in the game script's sound table.
(function (root) {
  function create(world, opt) {
    opt = opt || {};
    const MAX_VOICES = opt.maxVoices || 28;
    const missing = new Set(), noted = new Set();
    const live = new Map(); // Sound instance -> { a: HTMLAudioElement, src, want }
    const api = { master: opt.master == null ? 1 : opt.master, missing, live };
    const isPath = id => typeof id === 'string' && id !== '' && !/^rbxasset(id)?:\/\//i.test(id) && !/^\d+$/.test(id);

    function endVoice(o, fire) {
      const v = live.get(o); if (!v) return;
      live.delete(o);
      try { v.a.onended = v.a.onerror = null; v.a.pause(); v.a.removeAttribute('src'); v.a.load(); } catch (_) {}
      o.props.Playing = false; o.props.IsPlaying = false;
      if (fire) { try { o.signal('Ended')?.fire(o.props.SoundId); } catch (e) { /* script errors surface via world.onError elsewhere */ } }
    }
    function start(o) {
      const src = o.props.SoundId;
      if (!isPath(src) || missing.has(src)) return;
      if (typeof Audio === 'undefined') return;
      let v = live.get(o);
      if (v && v.src === src) { try { v.a.currentTime = o.props.TimePosition || 0; } catch (_) {} v.want = true; return; }
      if (v) endVoice(o, false);
      if (live.size >= MAX_VOICES) return;
      const a = new Audio(); a.preload = 'auto'; a.src = src;
      a.onended = () => { if (!o.props.Looped) endVoice(o, true); };
      a.onerror = () => {
        missing.add(src);
        if (!noted.has(src)) { noted.add(src); console.info('[audio] file not found, skipping: ' + src); }
        endVoice(o, true);
      };
      v = { a, src, want: true, tries: 0 };
      live.set(o, v);
      o.props.Playing = true; o.props.IsPlaying = true;
      try { a.currentTime = o.props.TimePosition || 0; } catch (_) {}
      sync(o, v); attempt(v);
    }
    function attempt(v) {
      v.tries++;
      const p = v.a.play();
      if (p && p.catch) p.catch(e => { v.blocked = e && e.name === 'NotAllowedError'; });
    }
    function sync(o, v) {
      const p = o.props, a = v.a;
      const vol = Math.max(0, Math.min(1, (+p.Volume || 0) * api.master));
      if (a.volume !== vol) a.volume = vol;
      const sp = Math.max(0.0625, Math.min(16, +p.PlaybackSpeed || 1));
      if (a.playbackRate !== sp) a.playbackRate = sp;
      const lp = p.Looped === true; if (a.loop !== lp) a.loop = lp;
    }
    let retryT = 0;
    // called once per rendered frame
    api.update = function (now) {
      const retry = now - retryT > 400; if (retry) retryT = now;
      for (const [o, v] of live) {
        if (o.destroyed || !o.parent) { endVoice(o, false); continue; }
        if (!v.want) continue;
        sync(o, v);
        if (retry && v.a.paused && !v.a.ended && v.tries < 400) attempt(v); // autoplay was blocked: retry until the first click/keypress
      }
    };
    // hook invoked by roblox.js Sound:Play/Stop/Pause/Resume
    world.audioHook = function (o, what) {
      if (what === 'play' || what === 'resume') start(o);
      else if (what === 'pause') { const v = live.get(o); if (v) { v.want = false; v.a.pause(); } o.props.Playing = false; o.props.IsPlaying = false; }
      else if (what === 'stop') { endVoice(o, false); }
    };
    // first user gesture: unlock playback for anything that was blocked
    const unlock = () => { for (const v of live.values()) if (v.a.paused && v.want) attempt(v); };
    if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
    api.setMaster = x => { api.master = Math.max(0, Math.min(1, x)); };
    return api;
  }
  root.LuauAudio = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
