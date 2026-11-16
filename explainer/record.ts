/**
 * Recorder choreography: one action per footage scene in script.ts, keyed by scene id. Each action drives the
 * Muesli GUI on the stage page (glide the cursor, click, type, spotlight) and leaves zoom cues that the render turns
 * into camera moves. The stage answers every /api/ call with fictional data (demo/mock-api.js).
 *
 * Times are seconds since the page was ready. Narration starts at leadInSec (0.6 s unless the scene sets it),
 * so T(narr, f) is the moment a fraction f of the line has been spoken: hang each beat on the words it illustrates.
 * The clip is held until the scene's full length, so an action may end early.
 */
import type { SceneAction } from '@explainer/scripts/lib/recorder';

const T = (narr: number, f: number): number => 0.6 + f * narr;

export const actions: Record<string, SceneAction> = {
  // "Muesli syncs your Granola notes into a local archive, transcripts included.
  //  Sync now fetches only what changed since last time."
  archive: async (r, narr) => {
    await r.until(0.3);
    await r.moveTo('main .grid.cols-3 .card:first-child', { at: [0.25, 0.4] });
    await r.until(T(narr, 0.06));
    await r.zoomUnion(['main .grid.cols-3 .card:nth-child(1)', 'main .grid.cols-3 .card:nth-child(2)'], 24);
    await r.until(T(narr, 0.18));
    await r.spot('main .grid.cols-3 .card:first-child', 8);
    await r.until(T(narr, 0.44));
    await r.unspot();
    r.zoomReset();
    await r.click('#sync-now');
    await r.wait(0.6);
    await r.zoom('main .grid.cols-2 .card:first-child', 36);
    // The log finishes, then the page refreshes to the new note count.
    await r.until(T(narr, 0.9));
    r.zoomReset();
    await r.moveTo('main .grid.cols-3 .card:first-child', { at: [0.2, 0.35] });
  },

  // "Search by title, person or transcript text. Tick the meetings you want, and they collect in the sidebar."
  find: async (r, narr) => {
    await r.until(0.3);
    await r.zoom('main > .card', 16);
    await r.type('#f-search', 'billing', { cps: 11 });
    await r.press('Enter');
    await r.wait(0.4);
    r.zoomReset();
    await r.until(T(narr, 0.32));
    await r.click('#rows tr:nth-child(1) input.pick');
    await r.click('#rows tr:nth-child(2) input.pick');
    await r.click('#rows tr:nth-child(3) input.pick');
    await r.until(T(narr, 0.74));
    await r.spot('#basket', 8);
    await r.until(T(narr, 1.0) + 0.2);
    await r.unspot();
  },

  // "Click any meeting to read the full transcript, speaker by speaker, with timestamps."
  read: async (r, narr) => {
    await r.until(0.3);
    await r.click('#rows tr:nth-child(1) td:nth-child(3)', { at: [0.3, 0.5] });
    await r.wait(0.5);
    await r.eval(() => {
      const lines = document.querySelectorAll('#drawer .transcript-line');
      lines[0]?.setAttribute('data-rec', 't-first');
      lines[6]?.setAttribute('data-rec', 't-last');
    });
    await r.until(T(narr, 0.3));
    await r.zoomUnion(['[data-rec="t-first"]', '[data-rec="t-last"]'], 14);
    await r.until(T(narr, 1.0) + 0.2);
    r.zoomReset();
  },

  // "On Ask, the meetings you ticked become the corpus, and you pick the model.
  //  Ask a question, and the answer streams back, citing each meeting by title and date."
  ask: async (r, narr) => {
    await r.until(0.3);
    await r.click('#preview');
    await r.wait(0.45);
    await r.zoomUnion(['#ask-setup select[name="model"]', '#preview-out'], 16);
    await r.until(T(narr, 0.22));
    await r.select('#ask-setup select[name="model"]', 'gpt-6-astra');
    await r.until(T(narr, 0.4));
    r.zoomReset();
    await r.scrollTo('#question');
    await r.type('#question', 'What did we decide on the cutover, and who owns what?', { cps: 32 });
    await r.press('Enter');
    await r.until(T(narr, 0.82));
    await r.zoom('#a-0', 12);
    await r.until(T(narr, 1.0) + 0.2);
    r.zoomReset();
  },

  // "Profiles finds every meeting with one person, one-on-one or group.
  //  It writes a working profile, backed by verbatim quotes."
  profile: async (r, narr) => {
    // Room below the page, so the output card can scroll to the top before the profile text has grown.
    await r.eval(() => {
      (document.querySelector('#main') as HTMLElement).style.paddingBottom = '720px';
    });
    await r.until(0.3);
    await r.moveTo('#p-preview-out .tag', { at: [0.5, 0.5] });
    await r.until(T(narr, 0.08));
    await r.zoom('#p-preview-out', 12);
    await r.until(T(narr, 0.42));
    r.zoomReset();
    await r.click('#p-build');
    await r.scrollTo('#p-output', 'start');
    await r.until(T(narr, 0.84));
    await r.spot('#p-md ul', 6);
    await r.until(T(narr, 1.0) + 0.2);
    await r.unspot();
  },
};
