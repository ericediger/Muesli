import type { VideoSpec } from '@explainer/src/spec';

/**
 * Storyboard for Muesli's explainer video. Each scene is one idea: its words (`narration`, which the captions
 * show) and either an animated component (`kind: 'animated'`) or a page of the GUI to film (`kind: 'footage'`,
 * opened at `#<route>` on the stage page). A scene lasts leadInSec + its narration + tailSec, so the voice sets
 * the pace and record.ts paces the footage to it.
 *
 * The footage films the real web GUI (web/) on a stage page whose API answers with fictional meetings
 * (demo/mock-api.js). Nothing is read from data/ or .env. Build the stage before recording:
 *   node explainer/demo/build-stage.mjs
 * A route may end in @<preset> to start a scene with notes already ticked (see mock-api.js).
 *
 * Re-run from the app's folder after any edit: npm --prefix <engine> run build
 */
const STAGED = 'Sample data. All people, companies and meetings shown are fictional.';

export const spec: VideoSpec = {
  id: 'muesli',
  name: 'Muesli',
  fps: 30,
  // The kit is laid out for 1920x1080: keep these.
  width: 1920,
  height: 1080,
  repoUrl: 'github.com/ericediger/Muesli',
  // The GUI's own address when it runs locally.
  demoUrl: '127.0.0.1:4747',
  record: {
    appDir: 'explainer/demo/stage',
    page: 'index.html',
    // The GUI lays out as at 1280 x 720 and is drawn twice as large, so camera zooms stay sharp.
    viewport: { width: 2560, height: 1440 },
    dpr: 1,
    zoom: 2,
    // Viewport units ignore CSS zoom: halve the GUI's full-height boxes.
    css: [
      'html .app { min-height: calc(100vh / 2); }',
      'html .sidebar { height: calc(100vh / 2); }',
      'html .drawer { height: calc(100vh / 2); }',
      'html .table-wrap { max-height: calc(62vh / 2); }',
    ].join(' '),
    // Every page draws its h1 once it has rendered.
    readySelector: '#main h1',
  },
  // No voice id here: the engine's .env picks the ElevenLabs voice.
  voice: { say: 'Samantha', rate: 175 },
  // Muesli's dark theme and accent, from web/style.css.
  theme: {
    accent: '#d97a3a',
    accentDeep: '#9c4f1f',
    bg0: '#0f1012',
    bg1: '#17181b',
    panel: '#1e2125',
    panel2: '#24282d',
    line: '#2b2f35',
    ink: '#e8e6e1',
    muted: '#a4a49d',
    warm: '#e0a545',
    red: '#e0625e',
    glowA: '#2a1a0f',
    glowB: '#1a1712',
    grid: '#1f2226',
  },
  style: { frame: 'mac', captions: 'pill', lowerThird: 'bar', background: 'mesh', transition: 'fade' },
  // The Overview, wide and settled, at the end of the sync scene.
  poster: { atSec: 20.2 },
  // "Sunset in Ibiza", from the author's own ElevenLabs Music workspace (2:30, longer than the video).
  music: { file: 'music/Sunset_in_Ibiza.mp3', volume: 0.13, duckTo: 0.05, fadeOutSec: 3 },
  // Web players expect about -16 LUFS; narration alone comes out much quieter.
  loudness: { lufs: -16 },
  scenes: [
    {
      id: 'intro',
      kind: 'animated',
      component: 'ColdOpen',
      title: '',
      narration:
        'Meeting summaries are tidy, but they lose what people actually said. Muesli is granola before the baking: your raw transcripts, read by your own model.',
      leadInSec: 0.8,
    },
    {
      id: 'archive',
      kind: 'footage',
      route: '/home',
      title: 'A local archive',
      narration:
        'Muesli syncs your Granola notes into a local archive, transcripts included. Sync now fetches only what changed since last time.',
      note: STAGED,
    },
    {
      id: 'find',
      kind: 'footage',
      route: '/notes',
      title: 'Find the meetings',
      narration: 'Search by title, person or transcript text. Tick the meetings you want, and they collect in the sidebar.',
      note: STAGED,
    },
    {
      id: 'read',
      kind: 'footage',
      route: '/notes?search=billing@billing',
      title: 'Read the transcript',
      narration: 'Click any meeting to read the full transcript, speaker by speaker, with timestamps.',
      note: STAGED,
    },
    {
      id: 'ask',
      kind: 'footage',
      route: '/ask@billing',
      title: 'Ask across them',
      narration:
        'On Ask, the meetings you ticked become the corpus, and you pick the model. Ask a question, and the answer streams back, citing each meeting by title and date.',
      note: `${STAGED} The answer is scripted.`,
    },
    {
      id: 'profile',
      kind: 'footage',
      route: '/profiles?name=Dana%20Whitfield',
      title: 'Profile a person',
      narration:
        'Profiles finds every meeting with one person, one-on-one or group. It writes a working profile, backed by verbatim quotes.',
      note: `${STAGED} The profile is scripted.`,
    },
    {
      id: 'outro',
      kind: 'animated',
      component: 'Outro',
      title: '',
      narration:
        'Your archive stays on your machine. You choose the meetings and the model. Answers quote the transcript, not a summary. Muesli is open source, on GitHub.',
      leadInSec: 0.8,
      tailSec: 2.6,
    },
  ],
};
