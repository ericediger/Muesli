// Builds the recording stage: the real web GUI from web/, with demo/mock-api.js loaded before it so every /api/
// call is answered from fictional data in memory. Nothing reads data/ or .env.
// Run from the app folder (or anywhere): node explainer/demo/build-stage.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demo = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(demo, '../../web');
const stage = path.join(demo, 'stage');

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

for (const f of ['app.js', 'style.css']) fs.copyFileSync(path.join(web, f), path.join(stage, f));
fs.copyFileSync(path.join(demo, 'mock-api.js'), path.join(stage, 'mock-api.js'));

const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const marker = '<link rel="stylesheet" href="style.css">';
if (!html.includes(marker)) throw new Error(`web/index.html no longer has ${marker}; update build-stage.mjs`);
fs.writeFileSync(path.join(stage, 'index.html'), html.replace(marker, `<script src="mock-api.js"></script>\n${marker}`));

console.log(`Stage built in ${path.relative(process.cwd(), stage) || stage}`);
