/* Muesli recording stage: answers the GUI's /api/ calls from fictional data held in memory.
 * Every person, company, meeting, transcript, answer and profile below is invented for the explainer video.
 * Loaded before web/app.js (see build-stage.mjs). Each scene loads the page afresh, so the data resets per scene.
 *
 * A route may end in @<preset> to set the scene's starting state; the suffix is removed before the app reads it:
 *   @billing  the three newest billing-migration meetings are already ticked (the sidebar selection).
 */
(() => {
  // ---------- presets and preferences (before the app starts) ----------
  const presetMatch = location.hash.match(/@([a-z-]+)$/);
  const preset = presetMatch ? presetMatch[1] : null;
  if (presetMatch) history.replaceState(null, '', location.pathname + location.hash.slice(0, presetMatch.index));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DAY = 86400000;
  const iso = (d) => new Date(d).toISOString();

  // ---------- people ----------
  const ME = { name: 'Sam Rivera', email: 'sam.rivera@example.com' };
  const P = {};
  for (const name of ['Dana Whitfield', 'Priya Raman', 'Marcus Bell', 'Lena Okafor', 'Tomás Ortega', 'Jordan Hale', 'Aisha Khan', 'Owen Price', 'Mei Lin', 'Ben Carver', 'Grace Mendel', 'Hugo Laine']) {
    P[name.split(' ')[0]] = { name, email: `${name.toLowerCase().replace(/á/g, 'a').replace(/\s+/g, '.')}@example.com` };
  }

  // ---------- notes ----------
  // Hand-written: the newest notes (the rows on screen) and every note the scenes open or ask about.
  const HAND = [
    { d: '2026-11-14T15:00', title: 'Weekly product sync', who: ['Priya', 'Marcus', 'Lena'], folders: ['Product'], words: 6120, me: 0.31 },
    { d: '2026-11-13T10:30', title: '261113 - Dana Whitfield', who: ['Dana'], folders: ['1:1s'], words: 4870, me: 0.44 },
    { key: 'cutover', d: '2026-11-12T14:00', title: 'Billing migration: cutover plan', who: ['Dana', 'Priya', 'Marcus'], folders: ['Billing migration'], words: 7340, me: 0.22 },
    { d: '2026-11-11T16:00', title: 'Hiring debrief: data engineer', who: ['Jordan', 'Aisha'], folders: ['Hiring'], words: 3920, me: 0.38 },
    { d: '2026-11-10T09:30', title: '261110 - Tomás Ortega', who: ['Tomás'], folders: ['1:1s'], words: 4410, me: 0.47 },
    { d: '2026-11-07T13:00', title: 'Customer call: Ferncastle Outfitters', who: ['Ben', 'Lena'], folders: ['Customers'], words: 5260, me: 0.29 },
    { key: 'finance', d: '2026-11-06T11:00', title: 'Billing migration: finance review', who: ['Dana', 'Owen'], folders: ['Billing migration'], words: 6080, me: 0.27 },
    { d: '2026-11-05T10:30', title: '261105 - Priya Raman', who: ['Priya'], folders: ['1:1s'], words: 4630, me: 0.41 },
    { d: '2026-11-04T09:00', title: 'Q1 planning workshop', who: ['Dana', 'Priya', 'Marcus', 'Lena', 'Jordan', 'Owen'], folders: ['Planning'], words: 11850, me: 0.12 },
    { d: '2026-11-03T10:30', title: '261103 - Dana Whitfield', who: ['Dana'], folders: ['1:1s'], words: 5010, me: 0.46 },
    { d: '2026-10-30T15:00', title: 'Design review: invoice emails', who: ['Mei', 'Marcus'], folders: ['Product'], words: 4280, me: 0.24 },
    { key: 'kickoff', d: '2026-10-28T14:00', title: 'Billing migration kickoff', who: ['Dana', 'Priya', 'Marcus', 'Owen'], folders: ['Billing migration'], words: 8120, me: 0.19 },
    { d: '2026-10-27T11:00', title: '261027 - Lena Okafor', who: ['Lena'], folders: ['1:1s'], words: 4190, me: 0.45 },
    { d: '2026-10-23T16:00', title: 'Incident review: duplicate charges', who: ['Dana', 'Priya', 'Marcus'], folders: ['Incidents'], words: 5540, me: 0.18 },
    { d: '2026-10-20T10:30', title: '261020 - Dana Whitfield', who: ['Dana'], folders: ['1:1s'], words: 4720, me: 0.43 },
    { d: '2026-10-06T10:30', title: '261006 - Dana Whitfield', who: ['Dana'], folders: ['1:1s'], words: 4380, me: 0.48 },
    { d: '2026-09-22T10:30', title: '260922 - Dana Whitfield', who: ['Dana'], folders: ['1:1s'], words: 4060, me: 0.5 },
    { d: '2026-09-18T13:30', title: 'Billing support handoff', who: ['Grace', 'Hugo'], folders: ['Support'], words: 3880, me: 0.33 },
  ];
  // Generated: the older archive, so the counts are believable. None of these mention billing.
  const GROUP_TITLES = ['Weekly product sync', 'Roadmap review', 'Team retro', 'Analytics deep dive', 'Security review', 'Pricing working session', 'Platform standup', 'Customer call: Larkspur Studios', 'Customer call: Halden Freight', 'Vendor check-in: Quillstone', 'Design crit: onboarding flow', 'Support escalations review'];
  const ONE_ON_ONE = ['Priya', 'Tomás', 'Lena', 'Marcus', 'Jordan', 'Aisha'];
  const TOTAL = 412;
  const yymmdd = (d) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);
  const generated = [];
  const handIsoDates = new Set(HAND.map((h) => h.d.slice(0, 10)));
  let t = Date.parse('2026-09-16T10:00:00Z');
  for (let i = 0; generated.length < TOTAL - HAND.length; i++) {
    t -= Math.round(DAY * (0.95 + ((i * 37) % 11) / 10));
    const date = iso(t).slice(0, 16);
    if (handIsoDates.has(date.slice(0, 10))) continue;
    const isOne = i % 3 === 0;
    const person = ONE_ON_ONE[i % ONE_ON_ONE.length];
    generated.push(
      isOne
        ? { d: date, title: `${yymmdd(date)} - ${P[person].name}`, who: [person], folders: ['1:1s'], words: 3600 + ((i * 131) % 1900), me: 0.38 + ((i * 7) % 12) / 100 }
        : { d: date, title: GROUP_TITLES[i % GROUP_TITLES.length], who: [ONE_ON_ONE[(i + 1) % 6], ONE_ON_ONE[(i + 3) % 6], 'Owen'], folders: [GROUP_TITLES[i % GROUP_TITLES.length].startsWith('Customer') ? 'Customers' : 'Product'], words: 4200 + ((i * 173) % 5200), me: 0.15 + ((i * 11) % 20) / 100, transcript: i % 29 !== 7 },
    );
  }

  let seq = 0;
  const toEntry = (h) => {
    seq += 1;
    const attendees = [ME, ...h.who.map((k) => P[k])].map((u) => ({ name: u.name, email: u.email }));
    const onePerson = /^\d{6} - (.+)$/.exec(h.title);
    return {
      id: `not_${(9_000_000 + seq * 7919).toString(36)}Qm${seq}`,
      key: h.key,
      title: h.title,
      title_person: onePerson ? onePerson[1] : null,
      created_at: `${h.d}:00Z`,
      updated_at: `${h.d}:00Z`,
      owner: { name: ME.name, email: ME.email },
      web_url: '#',
      attendees,
      folder_ids: h.folders.map((f) => `fol_${f.replace(/\W/g, '').toLowerCase()}`),
      folder_names: h.folders,
      summary_text: `${h.title}. Notes and decisions.`,
      has_private_notes: false,
      has_transcript: h.transcript !== false,
      transcript_items: Math.round(h.words / 18),
      word_count: h.words,
      me_word_share: h.me,
      duration_minutes: Math.round(h.words / 140),
      speaker_names: onePerson ? [ME.name, onePerson[1]] : [ME.name, 'Them'],
      fetched_at: '2026-11-14T18:05:00Z',
    };
  };
  const NOTES = [...HAND, ...generated].map(toEntry).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const byKey = (k) => NOTES.find((n) => n.key === k);
  const BILLING = ['cutover', 'finance', 'kickoff'].map(byKey);

  // localStorage: dark theme, title search, and the preset's selection.
  try {
    localStorage.setItem('theme', JSON.stringify('dark'));
    localStorage.setItem('searchFields', JSON.stringify(['title']));
    localStorage.setItem('basket', JSON.stringify(preset === 'billing' ? BILLING.map((n) => ({ id: n.id, title: n.title })) : []));
  } catch {}

  const archive = { notes: TOTAL, withTranscripts: NOTES.filter((n) => n.has_transcript).length, lastSync: '2026-11-14T18:05:00Z' };

  // ---------- transcripts (the note drawer) ----------
  const TRANSCRIPTS = {
    cutover: {
      summary: ['Cutover moves to Sunday 30 November, after the October invoice run closes.', 'Plan changes freeze on the 28th; dual-write checks run through December 5.', 'Marcus drafts the customer email by November 14.'],
      lines: [
        ['00:00:06', 'Sam Rivera', 'Okay, we have everyone. Dana, do you want to start with the date?'],
        ['00:00:11', 'Dana Whitfield', 'Yes. We freeze plan changes on the 28th and flip on the 30th. No exceptions.'],
        ['00:00:19', 'Priya Raman', 'That works if dual-write stays on for a week after. I want every invoice checked against both systems.'],
        ['00:00:27', 'Dana Whitfield', 'Through December 5, then. Priya owns that check.'],
        ['00:00:33', 'Marcus Bell', 'Customers need two weeks of notice, so the email goes out on the 16th. I can have a draft by Friday.'],
        ['00:00:41', 'Sam Rivera', 'Good. What happens to refunds issued during the freeze?'],
        ['00:00:46', 'Dana Whitfield', 'Nobody has that yet. Let us take it to the finance review.'],
        ['00:00:52', 'Priya Raman', 'I will list the refund cases we saw in October so we can size it.'],
        ['00:01:01', 'Marcus Bell', 'And support needs the freeze window before the email goes out.'],
        ['00:01:06', 'Sam Rivera', 'I will confirm that with support today.'],
      ],
    },
  };
  const noteMarkdown = (n) => {
    const tr = TRANSCRIPTS[n.key];
    const date = n.created_at.slice(0, 16).replace('T', ' ');
    const who = n.attendees.map((a) => a.name).join(', ');
    const summary = tr ? tr.summary.map((s) => `- ${s}`).join('\n') : `- ${n.title}: discussion and next steps.`;
    const lines = tr
      ? tr.lines.map(([ts, spk, text]) => `[${ts}] ${spk}: ${text}`).join('\n')
      : `[00:00:05] ${ME.name}: Thanks for making the time.\n[00:00:09] ${n.attendees[1]?.name ?? 'Them'}: Of course. Where do you want to start?`;
    return `# ${n.title}\n\n**Date:** ${date} · **Duration:** ${n.duration_minutes} min · **Folder:** ${n.folder_names.join(', ')}\n\n**Attendees:** ${who}\n\n## Summary\n\n${summary}\n\n## Transcript\n\n${lines}\n`;
  };

  // ---------- search ----------
  const words = (s) => String(s ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  function search(q) {
    const terms = words(q.get('search'));
    const fields = (q.get('fields') || 'title').split(',');
    const person = q.get('person')?.trim().toLowerCase();
    const ids = q.get('ids') ? q.get('ids').split(',') : null;
    const hay = (n) =>
      [
        fields.includes('title') ? n.title : '',
        fields.includes('summary') ? n.summary_text : '',
        fields.includes('people') ? [n.title_person, ...n.attendees.map((a) => a.name), ...n.speaker_names].join(' ') : '',
        fields.includes('folders') ? n.folder_names.join(' ') : '',
        fields.includes('transcript') ? n.summary_text : '',
      ]
        .join(' ')
        .toLowerCase();
    return NOTES.filter(
      (n) =>
        (!ids || ids.includes(n.id)) &&
        terms.every((w) => hay(n).includes(w)) &&
        (!person || n.attendees.some((a) => a.name.toLowerCase().includes(person)) || (n.title_person ?? '').toLowerCase().includes(person)),
    );
  }

  // ---------- canned answers ----------
  const ANSWER = `**Decision:** cut over on **Sunday 30 November**, once the October invoice run has closed (Billing migration: cutover plan, 2026-11-12).

> Dana Whitfield: "We freeze plan changes on the 28th and flip on the 30th. No exceptions."

**Owners**
- **Priya Raman**: dual-write check on every invoice through December 5 (Billing migration: cutover plan, 2026-11-12).
- **Marcus Bell**: customer email two weeks out, draft by November 14 (Billing migration kickoff, 2026-10-28).
- **Owen Price**: finance sign-off on the reconciliation report by November 27 (Billing migration: finance review, 2026-11-06).
- **You**: confirm the freeze window with support (Billing migration: cutover plan, 2026-11-12).

**Still open:** refunds issued during the freeze have no owner yet (Billing migration: finance review, 2026-11-06).`;

  const PROFILE = `# Dana Whitfield: working profile

_From 9 meetings, 2026-09-22 to 2026-11-13 · transcripts only · a working-relationship aid, not a review_

## Snapshot
Dana runs the billing migration like a launch: fixed dates, named owners and few open loops. Decisions come quickly once the numbers are on the table.

## EQ
- **Names the risk plainly.** "Tell me the worst case first, then the plan." (261103 - Dana Whitfield, 2026-11-03)
- **Credits people by name.** "Priya caught the duplicate charges before a single customer did." (Incident review: duplicate charges, 2026-10-23)

## Professional
- **Commits in public, then holds the line.** "We freeze plan changes on the 28th and flip on the 30th. No exceptions." (Billing migration: cutover plan, 2026-11-12)
- **Closes every meeting with owners.** "Through December 5, then. Priya owns that check." (Billing migration: cutover plan, 2026-11-12)

## How to work with Dana
- Bring a date and an owner for every ask.
- Lead with the downside; optimism without a plan reads as a gap.`;

  const DANA = NOTES.filter((n) => n.attendees.some((a) => a.name === 'Dana Whitfield') && n.title !== 'Q1 planning workshop');
  const profiles = [
    { person: 'Priya Raman', slug: 'priya-raman', file: 'data/profiles/priya-raman/priya-raman_2026-10-30.md', generated_at: '2026-10-30T17:12:00Z', meetings: 11, model: 'claude-opus-5-5' },
    { person: 'Marcus Bell', slug: 'marcus-bell', file: 'data/profiles/marcus-bell/marcus-bell_2026-10-09.md', generated_at: '2026-10-09T15:40:00Z', meetings: 8, model: 'claude-sonnet-5-5' },
  ];

  const MODEL_CHOICES = [
    { id: 'claude-fable-5-2', label: 'Claude Fable 5.2', provider: 'anthropic', effort: 'max', group: 'strongest', note: '$8 / $40 per MTok' },
    { id: 'gpt-6-astra', label: 'GPT-6 Astra', provider: 'openai', effort: 'max', group: 'strongest', note: '$10 / $50 per MTok' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic', effort: 'max', group: 'strongest', note: '$4 / $20 per MTok' },
    { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon', provider: 'gemini', effort: 'high', group: 'strongest', note: '$4 / $20 per MTok ($2 / $10 until Nov 30); high is its top level' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic', effort: 'max', group: 'faster', note: '$2 / $10 per MTok' },
    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', provider: 'gemini', effort: 'xhigh', group: 'faster', note: '$1.50 / $7.50 per MTok; xhigh is its top level' },
    { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', provider: 'openai', effort: 'max', group: 'faster', note: '$1 / $5 per MTok' },
  ];

  // ---------- responses ----------
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  /** A newline-delimited JSON stream, like the server's: [{ wait, ev }] — ev omitted for a pause. */
  function ndjson(steps) {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(c) {
        for (const s of steps) {
          await sleep(s.wait ?? 0);
          if (s.ev) c.enqueue(enc.encode(JSON.stringify(s.ev) + '\n'));
        }
        c.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  }
  /** Splits text into small chunks, the way a model streams. */
  function textSteps(text, perChunk = 9, wait = 26) {
    const out = [];
    for (let i = 0; i < text.length; i += perChunk) out.push({ wait, ev: { type: 'text', text: text.slice(i, i + perChunk) } });
    return out;
  }
  const tokensFor = (ns) => Math.round(ns.reduce((s, n) => s + n.word_count, 0) * 1.78);
  const status = () => ({
    keys: { granola: true, anthropic: true, openai: true, gemini: true },
    masked: { granola: 'grn_8Kd…7f3a', anthropic: 'sk-ant-…c41d', openai: 'sk-proj…92be', gemini: 'AIzaSyB…0e5k' },
    modelChoices: MODEL_CHOICES,
    model: 'claude-opus-5-5',
    extractModel: 'claude-opus-5-5',
    effort: 'high',
    extractEffort: 'medium',
    meName: '',
    meEmail: '',
    dataDir: 'data',
    archive: {
      notes: archive.notes,
      withTranscripts: archive.withTranscripts,
      lastSync: archive.lastSync,
      me: ME,
      newest: { title: NOTES[0].title, created_at: NOTES[0].created_at },
      oldest: { title: NOTES[NOTES.length - 1].title, created_at: NOTES[NOTES.length - 1].created_at },
    },
    effortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  });

  async function handle(method, url, body) {
    const route = `${method} ${url.pathname}`;
    if (route === 'GET /api/status') return json(status());

    if (route === 'POST /api/sync') {
      // The page re-reads /api/status once the stream ends, so it shows the new count.
      archive.notes = TOTAL + 3;
      archive.withTranscripts += 3;
      archive.lastSync = '2026-11-16T09:12:00Z';
      return ndjson([
        { wait: 150, ev: { type: 'log', message: 'Listing notes updated since 2026-11-14…' } },
        { wait: 380, ev: { type: 'log', message: 'Listed 3 note(s).' } },
        { wait: 300, ev: { type: 'log', message: '3 to download, 0 already current.' } },
        { wait: 700, ev: { type: 'log', message: '3/3 downloaded' } },
        { wait: 320, ev: { type: 'log', message: `Done. Archive has ${archive.notes} notes (${archive.withTranscripts} with transcripts).` } },
        { wait: 120, ev: { type: 'done', result: { listed: 3, downloaded: 3, skipped: 0, counts: { failed: 0 }, archiveNotes: archive.notes } } },
        // Hold the finished log on screen before the page refreshes.
        { wait: 1100 },
      ]);
    }

    if (route === 'POST /api/doctor') {
      await sleep(500);
      return json({
        granola: { ok: true, message: 'Connected. 412 notes visible to this key.' },
        providers: [
          { id: 'anthropic', ok: true, configured: true, message: 'Key works.', usedFor: ['answers', 'extraction'] },
          { id: 'openai', ok: true, configured: true, message: 'Key works.', usedFor: [] },
          { id: 'gemini', ok: true, configured: true, message: 'Key works.', usedFor: [] },
        ],
        archive: { notes: archive.notes, withTranscripts: archive.withTranscripts, me: ME },
      });
    }

    if (route === 'GET /api/search') {
      const q = url.searchParams;
      const all = search(q);
      const offset = Math.max(0, Number(q.get('offset') ?? 0) || 0);
      const limit = q.get('all') === '1' ? all.length : Math.max(1, Number(q.get('limit') ?? 100) || 100);
      // The archive count includes notes older than the generated ones; keep the totals believable.
      const unfiltered = !q.get('search') && !q.get('person') && !q.get('since') && !q.get('until') && !q.get('folder') && !q.get('ids');
      await sleep(120);
      return json({
        me: ME,
        total: archive.notes,
        matches: unfiltered ? archive.notes : all.length,
        offset,
        range: { oldest: NOTES[NOTES.length - 1].created_at, newest: NOTES[0].created_at },
        entries: all.slice(offset, offset + limit),
      });
    }

    if (route === 'GET /api/people') {
      const m = new Map();
      for (const n of NOTES)
        for (const a of n.attendees) {
          if (a.name === ME.name) continue;
          const p = m.get(a.name) ?? { name: a.name, meetings: 0, via: { title: 0, attendee: 0, speaker: 0 }, emails: [a.email], last_seen: n.created_at };
          p.meetings += 1;
          p.via.attendee += 1;
          if (n.title_person === a.name) p.via.title += 1, (p.via.speaker += 1);
          m.set(a.name, p);
        }
      return json({ people: [...m.values()].sort((a, b) => b.meetings - a.meetings) });
    }

    if (method === 'GET' && url.pathname.startsWith('/api/note/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/note/'.length));
      const n = NOTES.find((x) => x.id === id);
      await sleep(140);
      if (!n) return json({ error: 'Note is not in the local archive' }, 404);
      return json({ id, title: n.title, web_url: '#', markdown: noteMarkdown(n) });
    }

    if (route === 'POST /api/ask/preview') {
      const ns = body?.ids ? NOTES.filter((n) => body.ids.includes(n.id)) : BILLING;
      await sleep(260);
      return json({ selection: {}, content: 'transcript', tokens: tokensFor(ns), notesWithoutTranscript: 0, confirmAbove: 300000, entries: ns.map((n) => ({ id: n.id, title: n.title, created_at: n.created_at, word_count: n.word_count })) });
    }

    if (route === 'POST /api/ask') {
      const ns = body?.ids ? NOTES.filter((n) => body.ids.includes(n.id)) : BILLING;
      const model = body?.model || 'claude-opus-5-5';
      const effort = body?.effort || 'high';
      const tokens = tokensFor(ns);
      return ndjson([
        { wait: 200, ev: { type: 'session', sessionId: 'ask_demo', selection: {}, content: 'transcript', tokens, notes: ns.length, model, effort } },
        { wait: 250 },
        ...textSteps(ANSWER, 14, 26),
        // Leave the page's last animation frame time to draw before 'done' removes the typing cursor.
        { wait: 350, ev: { type: 'done', usage: { input_tokens: tokens + 512, cache_read_input_tokens: 0, output_tokens: 418 }, model, saved: 'data/conversations/ask_demo.md' } },
      ]);
    }

    if (route === 'POST /api/profile/preview') {
      await sleep(220);
      return json({
        source: 'auto',
        content: 'transcript',
        explicit: 0,
        missing: [],
        candidates: DANA.length,
        skipped: 0,
        me: ME,
        selected: DANA.map((n) => ({ id: n.id, title: n.title, created_at: n.created_at, kind: n.title_person ? 'one_on_one' : 'group', word_count: n.word_count, me_word_share: n.me_word_share })),
      });
    }

    if (route === 'POST /api/profile') {
      const ones = DANA.filter((n) => n.title_person).length;
      const file = 'data/profiles/dana-whitfield/dana-whitfield_2026-11-16.md';
      // The page reloads the list of existing profiles when the build is done.
      profiles.unshift({ person: 'Dana Whitfield', slug: 'dana-whitfield', file, generated_at: '2026-11-16T09:20:00Z', meetings: DANA.length, model: 'claude-opus-5-5' });
      return ndjson([
        { wait: 120, ev: { type: 'log', message: `${DANA.length} meetings with Dana Whitfield (${ones} one-on-one, ${DANA.length - ones} group).` } },
        { wait: 250, ev: { type: 'log', message: 'Evidence: 7 cached, 2 to extract with claude-opus-5-5 (medium).' } },
        { wait: 400, ev: { type: 'log', message: 'Extracted 2/2: 14 observations, 11 verbatim quotes.' } },
        { wait: 200, ev: { type: 'log', message: 'Writing the profile with claude-opus-5-5 (high)…' } },
        { wait: 150 },
        ...textSteps(PROFILE, 24, 22),
        { wait: 350, ev: { type: 'done', file, usage: { input_tokens: 61840, cache_read_input_tokens: 0, output_tokens: 1290 }, model: 'claude-opus-5-5', meetings: DANA.length } },
      ]);
    }

    if (route === 'GET /api/profiles') return json({ profiles });
    if (route === 'GET /api/conversations') return json({ conversations: [] });
    if (route === 'POST /api/export') return json({ count: 0, outDir: 'data/exports', files: [] });
    if (route === 'POST /api/settings') return json({ ok: true, masked: status().masked });
    // Never answer downloads (/api/file): the browser would navigate away from the recorder's overlays.
    return json({ error: `No route ${route} on the recording stage` }, 404);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {}
    await sleep(30);
    return handle(method, url, body);
  };
})();
