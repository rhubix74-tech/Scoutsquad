'use strict';
// build.js — bundles everything into one self-contained dist/index.html (works from file://, no server needed).
const fs = require('fs'); const path = require('path');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SERVER = arg('server', 'Server_server__30_.js'), CLIENT = arg('client', 'Client_client__28_.js'), OUT = arg('out', 'dist/index.html');
const rd = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const str = s => safe(JSON.stringify(s)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
let html = rd('index.template.html');
const parts = { RUNTIME: safe(rd('runtime.js')), ROBLOX: safe(rd('roblox.js')), HOST: safe(rd('host.js')), VIEW2D: safe(rd('view2d.js')), GL3D: safe(rd('gl3d.js')), GUI: safe(rd('gui.js')), AUDIO: safe(rd('audio.js')), SERVER_SRC: str(rd(SERVER)), CLIENT_SRC: str(rd(CLIENT)) };
for (const k in parts) html = html.split('/*@' + k + '@*/').join(parts[k]);
fs.mkdirSync(path.dirname(path.join(__dirname, OUT)), { recursive: true });
fs.writeFileSync(path.join(__dirname, OUT), html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB');
