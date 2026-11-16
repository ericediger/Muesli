(() => {
  // ---------- utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : "");
  const fmtNum = (n) => (n === null || n === undefined ? "" : Number(n).toLocaleString());
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const state = { status: null, basket: load("basket", []), meName: null, askSession: null, askThread: [] };

  // ---------- model / effort pickers ----------
  const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
  const PROVIDER_LABEL = { anthropic: "Claude", openai: "OpenAI", gemini: "Gemini" };
  const MODEL_GROUPS = [["strongest", "Strongest"], ["faster", "Faster and cheaper"]];
  function modelChoices() { return state.status?.modelChoices ?? []; }
  // Mirrors providerIdFor in src/llm/index.ts.
  function providerOf(model) { const m = String(model ?? "").trim(); return /^gemini/i.test(m) ? "gemini" : /^(gpt-|chatgpt-|o\d)/i.test(m) ? "openai" : "anthropic"; }
  function modelOptionsHtml(cur, withCustom) {
    const choices = modelChoices();
    const option = (c) => `<option value="${esc(c.id)}" ${c.id === cur ? "selected" : ""}>${esc(c.label)} (${esc(c.effort)}) — ${esc(c.note)}</option>`;
    const groups = MODEL_GROUPS.map(([g, label]) => { const cs = choices.filter((c) => c.group === g); return cs.length ? `<optgroup label="${esc(label)}">${cs.map(option).join("")}</optgroup>` : ""; });
    if (cur && !choices.some((c) => c.id === cur)) groups.push(`<option value="${esc(cur)}" selected>${esc(cur)} (custom)</option>`);
    return groups.join("") + (withCustom ? '<option value="__custom">Custom model id…</option>' : "");
  }
  function effortOptionsHtml(cur) { return EFFORTS.map((e) => `<option value="${e}" ${e === cur ? "selected" : ""}>${e}${e === "max" ? " (Gemini runs its top level)" : ""}</option>`).join(""); }
  /** Picking a listed model sets the paired effort picker to that model's effort. */
  function bindModelEffort(modelSel, effortSel) {
    if (!modelSel || !effortSel) return;
    modelSel.addEventListener("change", () => { const c = modelChoices().find((x) => x.id === modelSel.value); if (c) effortSel.value = c.effort; });
  }
  function providerRows(r) {
    return r.providers.map((p) => `<div class="status-row"><span class="dot ${p.ok ? "ok" : p.configured ? "err" : p.usedFor.length ? "err" : "warn"}"></span><div><strong>${PROVIDER_LABEL[p.id] ?? p.id}</strong><div class="small muted">${esc(p.message)}${p.usedFor.length ? ` Used for: ${esc(p.usedFor.join(", "))}.` : " Not used by the current settings."}</div></div></div>`).join("");
  }
  async function getStatus() { if (!state.status) state.status = await api("/api/status"); return state.status; }

  // ---------- search fields ("Search in") ----------
  const SEARCH_FIELDS = ["title", "summary", "people", "folders", "transcript"];
  function getSearchFields() { const f = load("searchFields", ["title"]); return Array.isArray(f) && f.length ? f.filter((x) => SEARCH_FIELDS.includes(x)) : ["title"]; }
  function applySearchFields(root, fields) { $$("input.sf", root).forEach((cb) => (cb.checked = fields.includes(cb.value))); }
  function readSearchFields(root) { const f = $$("input.sf:checked", root).map((cb) => cb.value); return f.length ? f : ["title"]; }
  function bindSearchFields(root) { $$("input.sf", root).forEach((cb) => cb.addEventListener("change", () => save("searchFields", readSearchFields(root)))); }

  // ---------- theme ----------
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#theme-label").textContent = t === "dark" ? "Dark" : "Light";
    save("theme", t);
  }
  applyTheme(load("theme", null) ?? "dark");
  $("#theme-toggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, isErr = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (isErr ? " err" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), isErr ? 7000 : 3500);
  }

  // ---------- api ----------
  async function api(url, body, method) {
    const res = await fetch(url, {
      method: method ?? (body ? "POST" : "GET"),
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
    return data;
  }
  async function stream(url, body, onEvent) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { msg = (await res.json()).error ?? msg; } catch {}
      throw new Error(msg);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) onEvent(JSON.parse(line));
      }
    }
  }

  // ---------- markdown ----------
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  }
  function md(src) {
    const lines = esc(src ?? "").split("\n");
    const out = [];
    let i = 0;
    const me = state.meName ?? state.status?.archive?.me?.name ?? null;
    while (i < lines.length) {
      let l = lines[i];
      if (/^```/.test(l)) {
        const code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++;
        out.push(`<pre><code>${code.join("\n")}</code></pre>`);
        continue;
      }
      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
        const head = cells(l);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
        out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d+[.)]\s+/.test(l);
        const items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          items.push({ depth: Math.floor(m[1].length / 2), text: m[3] });
          i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items[items.length - 1].text += " " + lines[i++].trim();
        }
        const tag = ordered ? "ol" : "ul";
        let html = `<${tag}>`;
        let depth = 0;
        for (const it of items) {
          while (depth < it.depth) { html += `<ul>`; depth++; }
          while (depth > it.depth) { html += `</ul>`; depth--; }
          html += `<li>${inline(it.text)}</li>`;
        }
        while (depth > 0) { html += `</ul>`; depth--; }
        out.push(html + `</${tag}>`);
        continue;
      }
      if (/^&gt;\s?/.test(l)) {
        const q = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i])) q.push(lines[i++].replace(/^&gt;\s?/, ""));
        out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
        continue;
      }
      const t = l.match(/^(\[\d\d:\d\d:\d\d\]\s+)?([^:\[\]]{1,60}):\s(.*)$/);
      if (t && (t[1] || /^(Me|Them|Speaker [A-Z])$/.test(t[2]) || (me && t[2].trim() === me))) {
        const isMe = me ? t[2].trim() === me : t[2].trim() === "Me";
        out.push(`<p class="transcript-line">${t[1] ? `<span class="ts">${t[1].trim()}</span>` : ""}<span class="spk${isMe ? " me" : ""}">${t[2].trim()}:</span> ${inline(t[3])}</p>`);
        i++;
        continue;
      }
      if (!l.trim()) { i++; continue; }
      const p = [l];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*([-*+]|\d+[.)])\s|\s*\||&gt;|\[\d\d:\d\d:\d\d\])/.test(lines[i])) p.push(lines[i++]);
      out.push(`<p>${inline(p.join(" "))}</p>`);
    }
    return `<div class="md">${out.join("\n")}</div>`;
  }

  // ---------- basket ----------
  function renderBasket() {
    const list = $("#basket-list");
    if (!state.basket.length) {
      list.innerHTML = '<span class="muted">None. Tick notes on the Notes page to use them in Ask or Export.</span>';
    } else {
      list.innerHTML = state.basket.map((b) => `<span class="chip" title="${esc(b.title)}"><span>${esc(b.title || b.id)}</span><button data-id="${esc(b.id)}" title="Remove">×</button></span>`).join("");
      $$("button", list).forEach((btn) => btn.addEventListener("click", () => toggleBasket({ id: btn.dataset.id })));
    }
    $("#basket-clear").onclick = () => { state.basket = []; save("basket", state.basket); renderBasket(); $$("input.pick").forEach((c) => (c.checked = false)); syncSelectionLabels(); };
    syncSelectionLabels();
  }
  function inBasket(id) { return state.basket.some((b) => b.id === id); }
  function toggleBasket(note) {
    if (inBasket(note.id)) state.basket = state.basket.filter((b) => b.id !== note.id);
    else state.basket.push({ id: note.id, title: note.title ?? note.id });
    save("basket", state.basket);
    renderBasket();
  }
  function syncSelectionLabels() {
    $$("[data-basket-count]").forEach((el) => (el.textContent = String(state.basket.length)));
  }

  // ---------- drawer ----------
  function openDrawer(html) {
    closeDrawer();
    const bd = document.createElement("div"); bd.className = "backdrop"; bd.id = "backdrop"; bd.onclick = closeDrawer;
    const d = document.createElement("div"); d.className = "drawer"; d.id = "drawer";
    d.innerHTML = `<button class="btn small close" id="drawer-close">Close</button>${html}`;
    document.body.append(bd, d);
    $("#drawer-close").onclick = closeDrawer;
  }
  function closeDrawer() { $("#drawer")?.remove(); $("#backdrop")?.remove(); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  async function openNote(id) {
    openDrawer('<div class="empty">Loading…</div>');
    try {
      const n = await api(`/api/note/${encodeURIComponent(id)}`);
      $("#drawer").innerHTML = `<button class="btn small close" id="drawer-close">Close</button>
        <div class="row" style="margin-bottom:8px"><button class="btn small" id="drawer-pick">${inBasket(id) ? "Remove from selection" : "Add to selection"}</button>
        <a class="btn small" href="${esc(n.web_url)}" target="_blank" rel="noopener">Open in Granola ↗</a>
        <a class="btn small" href="#/ask?ids=${encodeURIComponent(id)}">Ask about this note</a></div>${md(n.markdown)}`;
      $("#drawer-close").onclick = closeDrawer;
      $("#drawer-pick").onclick = () => { toggleBasket({ id, title: n.title }); $("#drawer-pick").textContent = inBasket(id) ? "Remove from selection" : "Add to selection"; const cb = $(`input.pick[value="${id}"]`); if (cb) cb.checked = inBasket(id); };
    } catch (err) { $("#drawer").innerHTML = `<button class="btn small close" id="drawer-close">Close</button><div class="empty">${esc(err.message)}</div>`; $("#drawer-close").onclick = closeDrawer; }
  }

  // ---------- selection form (shared by Ask and Export) ----------
  function selectionForm(p = {}) {
    const hasBasket = state.basket.length > 0;
    const mode = p.ids ? "basket" : hasBasket && !p.person && !p.search ? "basket" : "filter";
    return `
      <div class="row" style="margin-bottom:10px">
        <label class="check"><input type="radio" name="selmode" value="basket" ${mode === "basket" ? "checked" : ""}> Selected notes (<span data-basket-count>${state.basket.length}</span>)</label>
        <label class="check"><input type="radio" name="selmode" value="filter" ${mode === "filter" ? "checked" : ""}> Filter</label>
      </div>
      <div class="form-grid sel-filter">
        <div class="field"><label>Search text</label><input type="text" name="search" value="${esc(p.search ?? "")}" placeholder="title, summary, attendees…"></div>
        <div class="field"><label>Person</label><input type="text" name="person" value="${esc(p.person ?? "")}" placeholder="Dana Whitfield"></div>
        <div class="field"><label>Since</label><input type="text" name="since" value="${esc(p.since ?? "")}" placeholder="2026-06-01 or 30d / 6m / 1y"></div>
        <div class="field"><label>Until</label><input type="text" name="until" value="${esc(p.until ?? "")}" placeholder="YYYY-MM-DD"></div>
        <div class="field"><label>Folder</label><input type="text" name="folder" value="${esc(p.folder ?? "")}" placeholder="fol_… or name"></div>
        <div class="field"><label>Limit</label><input type="text" name="limit" value="${esc(p.limit ?? "")}" placeholder="max notes"></div>
      </div>
      <div class="row" style="margin-top:8px"><span class="muted small">Search in:</span>
          <label class="check"><input type="checkbox" class="sf" value="title"> Title</label>
          <label class="check"><input type="checkbox" class="sf" value="summary"> Summary</label>
          <label class="check"><input type="checkbox" class="sf" value="people" title="attendees, speaker tags, and the person in a YYMMDD - Name title"> People</label>
          <label class="check"><input type="checkbox" class="sf" value="folders"> Folders</label>
          <label class="check"><input type="checkbox" class="sf" value="transcript" title="slower: scans every transcript"> Transcript</label></div>`;
  }
  function readSelection(root) {
    const mode = root.querySelector('input[name="selmode"]:checked')?.value ?? "filter";
    if (mode === "basket") {
      if (!state.basket.length) throw new Error("No notes selected. Tick notes on the Notes page or switch to Filter.");
      return { ids: state.basket.map((b) => b.id) };
    }
    const v = (n) => root.querySelector(`[name="${n}"]`)?.value?.trim() || undefined;
    const sel = { search: v("search"), person: v("person"), since: v("since"), until: v("until"), folder: v("folder"), limit: v("limit"), fields: readSearchFields(root) };
    if (!sel.search && !sel.person && !sel.since && !sel.until && !sel.folder) throw new Error("Set at least one filter, or use the selected notes.");
    return sel;
  }

  // ---------- pages ----------
  const pages = {};

  pages.home = async (main) => {
    const s = await api("/api/status");
    state.status = s; state.meName = s.archive.me?.name ?? null;
    $("#brand-sub").textContent = s.archive.notes ? `${s.archive.notes} notes archived` : "no archive yet";
    const needed = new Set([providerOf(s.model), providerOf(s.extractModel)]);
    const needClaude = needed.has("anthropic"), needOpenAI = needed.has("openai"), needGemini = needed.has("gemini");
    const llmKeyOk = (!needClaude || s.keys.anthropic) && (!needOpenAI || s.keys.openai) && (!needGemini || s.keys.gemini);
    const archiveOnly = !s.keys.granola && s.archive.notes > 0;
    const keysOk = (s.keys.granola || archiveOnly) && llmKeyOk;
    main.innerHTML = `
      <h1>Overview</h1>
      <p class="lead">Your Granola notes, archived locally, queried with your own model.</p>
      ${archiveOnly ? `<div class="card"><strong>Archive-only mode.</strong> No Granola API key is set, so syncing is off and the ${fmtNum(s.archive.notes)} archived notes are the complete, read-only record. Search, Ask, Profiles and Export all work from this archive.</div>` : ""}
      ${keysOk ? "" : `<div class="card" style="border-color:var(--warn)"><strong>Setup needed.</strong> ${[!s.keys.granola && !archiveOnly ? "your Granola API key" : "", needClaude && !s.keys.anthropic ? "your Anthropic API key" : "", needOpenAI && !s.keys.openai ? "your OpenAI API key" : "", needGemini && !s.keys.gemini ? "your Gemini API key" : ""].filter(Boolean).join(" and ")} on the <a href="#/settings">Settings</a> page.</div>`}
      <div class="grid cols-3">
        <div class="card"><div class="stat">${fmtNum(s.archive.notes)}</div><div class="stat-label">notes in the local archive · ${fmtNum(s.archive.withTranscripts)} with transcripts</div></div>
        <div class="card"><div class="stat">${s.archive.lastSync ? fmtDate(s.archive.lastSync) : "never"}</div><div class="stat-label">last full sync${s.archive.oldest ? ` · notes from ${fmtDate(s.archive.oldest.created_at)} to ${fmtDate(s.archive.newest.created_at)}` : ""}</div></div>
        <div class="card"><div class="stat" style="font-size:18px">${esc(s.model)}</div><div class="stat-label">answers and profiles · effort ${esc(s.effort)}<br>extraction: ${esc(s.extractModel)} · effort ${esc(s.extractEffort)} · <a href="#/settings">change</a></div></div>
      </div>
      <div class="grid cols-2" style="margin-top:14px">
        <div class="card">
          <h2>Sync archive</h2>
          <p class="muted small">Downloads notes, summaries, private notes and transcripts from the Granola API into <code>${esc(s.dataDir)}</code>. Incremental after the first run.</p>
          <div class="row">
            <button class="btn primary" id="sync-now" ${s.keys.granola ? "" : "disabled"}>Sync now</button>
            <button class="btn" id="sync-30" ${s.keys.granola ? "" : "disabled"}>Last 30 days</button>
            <button class="btn" id="sync-full" ${s.keys.granola ? "" : "disabled"} title="Re-list the whole history and re-download every note">Full re-sync</button>
          </div>
          <div class="log" id="sync-log" style="margin-top:10px" hidden></div>
        </div>
        <div class="card">
          <h2>Connections</h2>
          <div id="doctor-out">
            <div class="status-row"><span class="dot ${s.keys.granola ? "warn" : archiveOnly ? "" : "err"}"></span><div><strong>Granola API</strong><div class="small muted">${s.keys.granola ? `Key ${esc(s.masked.granola)} set. Run checks to verify.` : archiveOnly ? "Disconnected; archive-only mode." : "No key set."}</div></div></div>
            <div class="status-row"><span class="dot ${s.keys.anthropic ? "warn" : needClaude ? "err" : ""}"></span><div><strong>Claude (Anthropic)</strong><div class="small muted">${s.keys.anthropic ? `Key ${esc(s.masked.anthropic)} set. Run checks to verify.` : "No key set."}</div></div></div>
            <div class="status-row"><span class="dot ${s.keys.openai ? "warn" : needOpenAI ? "err" : ""}"></span><div><strong>OpenAI</strong><div class="small muted">${s.keys.openai ? `Key ${esc(s.masked.openai)} set. Run checks to verify.` : "No key set."}</div></div></div>
            <div class="status-row"><span class="dot ${s.keys.gemini ? "warn" : needGemini ? "err" : ""}"></span><div><strong>Gemini (Google)</strong><div class="small muted">${s.keys.gemini ? `Key ${esc(s.masked.gemini)} set. Run checks to verify.` : "No key set."}</div></div></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn" id="doctor">Run checks</button></div>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2>What you can do here</h2>
        <ul class="small muted" style="margin:0;padding-left:18px">
          <li><a href="#/notes">Notes</a>: search the archive, read transcripts, tick notes to build a selection.</li>
          <li><a href="#/ask">Ask</a>: put an explicit set of transcripts in front of the model and ask anything; follow-ups reuse the cached corpus.</li>
          <li><a href="#/profiles">Profiles</a>: build an EQ / IQ / professional profile of a person from the transcripts of your meetings with them, with quoted evidence.</li>
          <li><a href="#/export">Export</a>: write any selection to Markdown, text or JSON with speaker labels and timestamps.</li>
        </ul>
      </div>`;
    const runSync = async (body) => {
      const log = $("#sync-log"); log.hidden = false; log.textContent = "";
      $$("#sync-now,#sync-30,#sync-full").forEach((b) => (b.disabled = true));
      try {
        await stream("/api/sync", body, (ev) => {
          if (ev.type === "log") log.textContent += ev.message + "\n";
          if (ev.type === "error") log.innerHTML += `<span class="err">${esc(ev.message)}</span>\n`;
          if (ev.type === "done") log.innerHTML += `<span class="ok">Listed ${ev.result.listed}, downloaded ${ev.result.downloaded}, skipped ${ev.result.skipped}, failed ${ev.result.counts.failed}. Archive: ${ev.result.archiveNotes} notes.</span>\n`;
          log.scrollTop = log.scrollHeight;
        });
        toast("Sync finished");
        pages.home(main);
      } catch (err) { log.innerHTML += `<span class="err">${esc(err.message)}</span>`; $$("#sync-now,#sync-30,#sync-full").forEach((b) => (b.disabled = false)); }
    };
    $("#sync-now").onclick = () => runSync({});
    $("#sync-30").onclick = () => runSync({ since: "30d" });
    $("#sync-full").onclick = () => { if (confirm("Re-list the entire history and re-download every note? This can take several minutes.")) runSync({ full: true, refresh: true }); };
    $("#doctor").onclick = async () => {
      const out = $("#doctor-out"); const btn = $("#doctor"); btn.disabled = true; out.innerHTML = '<div class="empty">Checking…</div>';
      try {
        const r = await api("/api/doctor", {});
        out.innerHTML = `
          <div class="status-row"><span class="dot ${r.granola.ok ? "ok" : "err"}"></span><div><strong>Granola API</strong><div class="small muted">${esc(r.granola.message)}</div></div></div>
          ${providerRows(r)}
          <div class="status-row"><span class="dot ${r.archive.notes ? "ok" : "warn"}"></span><div><strong>Archive</strong><div class="small muted">${r.archive.notes} notes, ${r.archive.withTranscripts} with transcripts; me = ${esc(r.archive.me.name ?? "?")} &lt;${esc(r.archive.me.email ?? "?")}&gt;</div></div></div>`;
      } catch (err) { out.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
      btn.disabled = false;
    };
  };

  pages.settings = async (main) => {
    const s = await api("/api/status");
    state.status = s;
    main.innerHTML = `
      <h1>Settings</h1>
      <p class="lead">Keys live in the <code>.env</code> file in the project folder; this page reads and writes that file, it has no store of its own. Edits you make to <code>.env</code> directly show up here without a restart. Each key is only ever sent to the vendor it belongs to, and the command-line tool reads the same file.</p>
      <div class="card">
        <h2>API keys</h2>
        <div class="grid cols-2">
          <div class="field key-field">
            <label>Granola API key</label>
            <input type="password" id="k-granola" placeholder="${s.keys.granola ? `current: ${esc(s.masked.granola)} (leave blank to keep)` : "grn_…"}" autocomplete="off" spellcheck="false">
            <button class="link eye" data-eye="k-granola">show</button>
            <div class="hint">Granola app → Settings → Connectors → API keys → Create new key (tick Personal notes and Public notes). ${s.keys.granola ? '<button class="link" id="clear-granola">Remove from .env</button>' : ""}</div>
          </div>
          <div class="field key-field">
            <label>Gemini API key (Google)</label>
            <input type="password" id="k-gemini" placeholder="${s.keys.gemini ? `current: ${esc(s.masked.gemini)} (leave blank to keep)` : "AIza…"}" autocomplete="off" spellcheck="false">
            <button class="link eye" data-eye="k-gemini">show</button>
            <div class="hint">From aistudio.google.com → Get API key. Needed only when a Gemini model is selected. ${s.keys.gemini ? '<button class="link" id="clear-gemini">Remove from .env</button>' : ""}</div>
          </div>
          <div class="field key-field">
            <label>Anthropic API key</label>
            <input type="password" id="k-anthropic" placeholder="${s.keys.anthropic ? `current: ${esc(s.masked.anthropic)} (leave blank to keep)` : "sk-ant-…"}" autocomplete="off" spellcheck="false">
            <button class="link eye" data-eye="k-anthropic">show</button>
            <div class="hint">From console.anthropic.com. ${s.keys.anthropic ? '<button class="link" id="clear-anthropic">Remove from .env</button>' : ""}</div>
          </div>
          <div class="field key-field">
            <label>OpenAI API key</label>
            <input type="password" id="k-openai" placeholder="${s.keys.openai ? `current: ${esc(s.masked.openai)} (leave blank to keep)` : "sk-…"}" autocomplete="off" spellcheck="false">
            <button class="link eye" data-eye="k-openai">show</button>
            <div class="hint">From platform.openai.com → API keys. Needed only when a GPT model is selected. ${s.keys.openai ? '<button class="link" id="clear-openai">Remove from .env</button>' : ""}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>Model</h2>
        <div class="form-grid">
          <div class="field"><label>Default model for answers and profile synthesis</label><select id="m-model">${modelOptionsHtml(s.model, true)}</select><div class="hint">Ask and Profiles let you override this per run.</div></div>
          <div class="field"><label>Default effort for answers and synthesis</label><select id="m-effort">${effortOptionsHtml(s.effort)}</select><div class="hint">Picking a model sets its listed effort; lower it to save time and cost.</div></div>
          <div class="field"><label>Default model for per-meeting evidence extraction</label><select id="m-extract">${modelOptionsHtml(s.extractModel, true)}</select><div class="hint">One call per meeting during profile builds; the faster, cheaper group suits this step.</div></div>
          <div class="field"><label>Default effort for extraction</label><select id="m-extract-effort">${effortOptionsHtml(s.extractEffort)}</select><div class="hint">medium is usually plenty for structured extraction.</div></div>
        </div>
        <div class="form-grid" id="custom-models" hidden style="margin-top:10px">
          <div class="field"><label>Custom model id</label><input type="text" id="m-model-custom" placeholder="claude-…"></div>
          <div class="field"><label>Custom extraction model id</label><input type="text" id="m-extract-custom" placeholder="claude-…"></div>
        </div>
      </div>
      <div class="card">
        <h2>Identity</h2>
        <p class="muted small">Normally detected from the notes you own. Override only if the "me" lines in transcripts are mislabelled.</p>
        <div class="form-grid">
          <div class="field"><label>Your name</label><input type="text" id="me-name" value="${esc(s.meName)}" placeholder="${esc(s.archive.me?.name ?? "")}"></div>
          <div class="field"><label>Your email</label><input type="email" id="me-email" value="${esc(s.meEmail)}" placeholder="${esc(s.archive.me?.email ?? "")}"></div>
        </div>
      </div>
      <div class="row end" style="margin-top:14px">
        <span class="muted small" id="save-msg"></span>
        <button class="btn" id="test">Test connections</button>
        <button class="btn primary" id="save">Save settings</button>
      </div>
      <div class="card" id="test-out" hidden></div>`;
    $$("[data-eye]").forEach((b) => (b.onclick = () => { const i = $("#" + b.dataset.eye); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "show" : "hide"; }));
    const customToggle = () => { $("#custom-models").hidden = !($("#m-model").value === "__custom" || $("#m-extract").value === "__custom"); };
    $("#m-model").onchange = customToggle; $("#m-extract").onchange = customToggle;
    bindModelEffort($("#m-model"), $("#m-effort")); bindModelEffort($("#m-extract"), $("#m-extract-effort"));
    const doSave = async (extra = {}) => {
      const body = { ...extra };
      const g = $("#k-granola").value.trim(); if (g) body.GRANOLA_API_KEY = g;
      const a = $("#k-anthropic").value.trim(); if (a) body.ANTHROPIC_API_KEY = a;
      const o = $("#k-openai").value.trim(); if (o) body.OPENAI_API_KEY = o;
      const gm = $("#k-gemini").value.trim(); if (gm) body.GEMINI_API_KEY = gm;
      body.LLM_MODEL = $("#m-model").value === "__custom" ? $("#m-model-custom").value.trim() : $("#m-model").value;
      body.LLM_EXTRACT_MODEL = $("#m-extract").value === "__custom" ? $("#m-extract-custom").value.trim() : $("#m-extract").value;
      body.LLM_EFFORT = $("#m-effort").value;
      body.LLM_EXTRACT_EFFORT = $("#m-extract-effort").value;
      body.ME_NAME = $("#me-name").value.trim() || null;
      body.ME_EMAIL = $("#me-email").value.trim() || null;
      if (!body.LLM_MODEL) delete body.LLM_MODEL;
      if (!body.LLM_EXTRACT_MODEL) delete body.LLM_EXTRACT_MODEL;
      $("#save").disabled = true;
      try { await api("/api/settings", body); toast("Settings saved to .env"); pages.settings(main); }
      catch (err) { toast(err.message, true); $("#save").disabled = false; }
    };
    $("#save").onclick = () => doSave();
    $("#clear-granola") && ($("#clear-granola").onclick = () => confirm("Remove the stored Granola key?") && doSave({ GRANOLA_API_KEY: null }));
    $("#clear-anthropic") && ($("#clear-anthropic").onclick = () => confirm("Remove the stored Anthropic key?") && doSave({ ANTHROPIC_API_KEY: null }));
    $("#clear-gemini") && ($("#clear-gemini").onclick = () => confirm("Remove the stored Gemini key?") && doSave({ GEMINI_API_KEY: null }));
    $("#clear-openai") && ($("#clear-openai").onclick = () => confirm("Remove the stored OpenAI key?") && doSave({ OPENAI_API_KEY: null }));
    $("#test").onclick = async () => {
      const out = $("#test-out"); out.hidden = false; out.innerHTML = '<div class="empty">Checking…</div>'; $("#test").disabled = true;
      try {
        const r = await api("/api/doctor", {});
        out.innerHTML = `<div class="status-row"><span class="dot ${r.granola.ok ? "ok" : "err"}"></span><div><strong>Granola API</strong><div class="small muted">${esc(r.granola.message)}</div></div></div>${providerRows(r)}`;
      } catch (err) { out.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
      $("#test").disabled = false;
    };
  };

  pages.notes = async (main, p) => {
    const PAGE = 100;
    let offset = 0;
    let shown = [];
    let meta = { total: 0, matches: 0, range: {}, me: null };
    main.innerHTML = `
      <h1>Notes</h1>
      <p class="lead">Search the local archive. Tick notes to build a selection for Ask or Export; click a row to read it.</p>
      <div class="card">
        <div class="form-grid">
          <div class="field"><label>Search text</label><input type="text" id="f-search" value="${esc(p.search ?? "")}" placeholder="words to find (all must match)"></div>
          <div class="field"><label>Person</label><input type="text" id="f-person" value="${esc(p.person ?? "")}" placeholder="Dana Whitfield"></div>
          <div class="field"><label>Since</label><input type="text" id="f-since" value="${esc(p.since ?? "")}" placeholder="2026-06-01 or 30d / 6m"></div>
          <div class="field"><label>Until</label><input type="text" id="f-until" value="${esc(p.until ?? "")}" placeholder="YYYY-MM-DD"></div>
          <div class="field"><label>Folder</label><input type="text" id="f-folder" value="${esc(p.folder ?? "")}" placeholder="fol_… or name"></div>
        </div>
        <div class="row" style="margin-top:10px">
          <span class="muted small">Search in:</span>
          <label class="check"><input type="checkbox" class="sf" value="title"> Title</label>
          <label class="check"><input type="checkbox" class="sf" value="summary"> Summary</label>
          <label class="check"><input type="checkbox" class="sf" value="people" title="attendees, speaker tags, and the person in a YYMMDD - Name title"> People</label>
          <label class="check"><input type="checkbox" class="sf" value="folders"> Folders</label>
          <label class="check"><input type="checkbox" class="sf" value="transcript" title="slower: scans every transcript"> Transcript</label>
          <span class="spacer"></span>
          <button class="btn" id="pick-all">Select all shown</button>
          <button class="btn primary" id="f-go">Search</button>
        </div>
      </div>
      <div class="card">
        <div class="row" style="margin-bottom:8px"><div class="muted small" id="count-line">Searching…</div><span class="spacer"></span><button class="btn small" id="show-all" hidden>Show all matches</button></div>
        <div id="results" class="empty"></div>
        <div class="row" style="margin-top:10px;justify-content:center"><button class="btn" id="load-more" hidden>Load more</button></div>
      </div>`;
    const who = (e) => {
      const me = meta.me;
      const sameName = (a) => !!(a.name && me?.name && a.name.trim().toLowerCase() === me.name.trim().toLowerCase());
      const others = e.attendees.filter((a) => !(me?.email && a.email.toLowerCase() === me.email.toLowerCase()) && !sameName(a)).map((a) => a.name ?? a.email);
      return others.length ? others.join(", ") : e.title_person ?? e.speaker_names.join(", ");
    };
    const rowHtml = (e) => `<tr class="clickable" data-id="${esc(e.id)}" data-title="${esc(e.title ?? "")}">
      <td><input type="checkbox" class="pick" value="${esc(e.id)}" ${inBasket(e.id) ? "checked" : ""}></td>
      <td class="mono">${fmtDate(e.created_at)}</td>
      <td>${esc(e.title ?? "(untitled)")}${e.has_transcript ? "" : ' <span class="tag">no transcript</span>'}</td>
      <td class="muted">${esc(who(e))}</td>
      <td class="num">${fmtNum(e.word_count)}</td>
      <td class="num">${e.me_word_share === null ? "" : Math.round(e.me_word_share * 100)}</td>
      <td class="muted small">${esc(e.folder_names.join(", "))}</td></tr>`;
    const bind = (root) => {
      $$("tr.clickable", root).forEach((tr) => { if (tr.dataset.bound) return; tr.dataset.bound = "1"; tr.addEventListener("click", (ev) => { if (ev.target.classList.contains("pick")) return; openNote(tr.dataset.id); }); });
      $$("input.pick", root).forEach((cb) => { if (cb.dataset.bound) return; cb.dataset.bound = "1"; cb.addEventListener("change", () => toggleBasket({ id: cb.value, title: cb.closest("tr").dataset.title })); });
    };
    const updateCount = () => {
      const r = meta.range;
      const span = r.oldest ? ` · archive spans ${fmtDate(r.oldest)} to ${fmtDate(r.newest)}` : "";
      const oldestShown = shown.length ? fmtDate(shown[shown.length - 1].created_at) : "";
      $("#count-line").innerHTML = shown.length === meta.matches
        ? `Showing all ${fmtNum(meta.matches)} matching notes of ${fmtNum(meta.total)} archived, newest first${span}.`
        : `Showing the newest ${fmtNum(shown.length)} of ${fmtNum(meta.matches)} matching notes (back to ${oldestShown}) of ${fmtNum(meta.total)} archived${span}.`;
      $("#load-more").hidden = shown.length >= meta.matches;
      $("#show-all").hidden = shown.length >= meta.matches;
    };
    const query = (all) => {
      const q = new URLSearchParams();
      const v = (id) => $(id).value.trim();
      if (v("#f-search")) q.set("search", v("#f-search"));
      if (v("#f-person")) q.set("person", v("#f-person"));
      if (v("#f-since")) q.set("since", v("#f-since"));
      if (v("#f-until")) q.set("until", v("#f-until"));
      if (v("#f-folder")) q.set("folder", v("#f-folder"));
      q.set("fields", readSearchFields(main).join(","));
      if (all) q.set("all", "1"); else { q.set("limit", String(PAGE)); q.set("offset", String(offset)); }
      return q;
    };
    const run = async ({ append = false, all = false } = {}) => {
      if (!append) { offset = 0; shown = []; }
      const out = $("#results");
      if (!append) { out.className = "empty"; out.textContent = "Searching…"; }
      try {
        const r = await api("/api/search?" + query(all).toString());
        meta = { total: r.total, matches: r.matches, range: r.range, me: r.me };
        state.meName = r.me?.name ?? state.meName;
        if (!r.total) { out.className = "empty"; out.innerHTML = 'The archive is empty. Go to <a href="#/home">Overview</a> and run a sync.'; $("#count-line").textContent = ""; return; }
        if (!r.matches) { out.className = "empty"; out.textContent = "No notes match."; $("#count-line").textContent = `0 of ${fmtNum(r.total)} archived notes match.`; $("#load-more").hidden = true; $("#show-all").hidden = true; return; }
        shown = append ? shown.concat(r.entries) : r.entries;
        offset = shown.length;
        if (!append) {
          out.className = "";
          out.innerHTML = `<div class="table-wrap"><table><thead><tr><th></th><th>Date</th><th>Title</th><th>Who</th><th class="num">Words</th><th class="num">Me %</th><th>Folders</th></tr></thead><tbody id="rows">${shown.map(rowHtml).join("")}</tbody></table></div>`;
        } else {
          $("#rows").insertAdjacentHTML("beforeend", r.entries.map(rowHtml).join(""));
        }
        bind(out);
        updateCount();
      } catch (err) { out.className = "empty"; out.textContent = err.message; }
    };
    applySearchFields(main, p.in ? p.in.split(",") : getSearchFields());
    bindSearchFields(main);
    $("#f-go").onclick = () => run();
    $("#load-more").onclick = () => run({ append: true });
    $("#show-all").onclick = () => run({ all: true });
    $("#pick-all").onclick = () => { $$("input.pick", $("#results")).forEach((cb) => { if (!cb.checked) { cb.checked = true; toggleBasket({ id: cb.value, title: cb.closest("tr").dataset.title }); } }); };
    $$("#f-search,#f-person,#f-since,#f-until,#f-folder").forEach((i) => i.addEventListener("keydown", (e) => e.key === "Enter" && run()));
    run();
  };

  pages.people = async (main) => {
    main.innerHTML = `<h1>People</h1><p class="lead">Detected from note titles (<span class="mono">YYMMDD - Name</span>), attendee lists and speaker tags.</p><div class="card"><div id="people" class="empty">Loading…</div></div>`;
    try {
      const r = await api("/api/people");
      const out = $("#people");
      if (!r.people.length) { out.textContent = "No people yet. Sync the archive first."; return; }
      out.className = "";
      out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th class="num">Meetings</th><th class="num">Title</th><th class="num">Attendee</th><th class="num">Speaker</th><th>Email</th><th>Last seen</th><th></th></tr></thead><tbody>
        ${r.people.map((p) => `<tr><td><strong>${esc(p.name)}</strong></td><td class="num">${p.meetings}</td><td class="num muted">${p.via.title}</td><td class="num muted">${p.via.attendee}</td><td class="num muted">${p.via.speaker}</td><td class="muted small">${esc(p.emails.join(", "))}</td><td class="mono">${fmtDate(p.last_seen)}</td>
          <td class="row" style="gap:6px;flex-wrap:nowrap"><a class="btn small" href="#/notes?person=${encodeURIComponent(p.name)}">Notes</a><a class="btn small" href="#/profiles?name=${encodeURIComponent(p.name)}${p.emails[0] ? `&email=${encodeURIComponent(p.emails[0])}` : ""}">Profile</a><a class="btn small" href="#/ask?person=${encodeURIComponent(p.name)}">Ask</a></td></tr>`).join("")}
        </tbody></table></div>`;
    } catch (err) { $("#people").textContent = err.message; }
  };

  pages.ask = async (main, p) => {
    if (p.ids) { const ids = p.ids.split(","); ids.forEach((id) => { if (!inBasket(id)) state.basket.push({ id, title: id }); }); save("basket", state.basket); renderBasket(); }
    const fresh = !state.askSession;
    const st = await getStatus();
    main.innerHTML = `
      <h1>Ask</h1>
      <p class="lead">Choose exactly which meetings the model sees, then ask. The model reads their transcripts only (no AI summaries or private notes). Follow-ups keep the same corpus loaded (cached for an hour).</p>
      <div class="card" id="ask-setup">
        <h2>Corpus</h2>
        ${selectionForm(p)}
        <div class="row" style="margin-top:10px">
          <span class="spacer"></span>
          <button class="btn" id="preview">Preview corpus</button>
        </div>
        <div class="row" style="margin-top:10px">
          <div class="field" style="min-width:300px"><label>Model</label><select name="model">${modelOptionsHtml(st.model, false)}</select></div>
          <div class="field" style="min-width:120px"><label>Effort</label><select name="effort">${effortOptionsHtml(st.effort)}</select></div>
          <span class="muted small" style="margin-top:18px">Fixed for the session: follow-ups reuse the cached corpus on the same model. Defaults come from <a href="#/settings">Settings</a>.</span>
        </div>
        <div id="preview-out" style="margin-top:10px"></div>
      </div>
      <div class="card">
        <div class="row" style="margin-bottom:8px"><h2 style="margin:0">Conversation</h2><span class="spacer"></span><span class="muted small" id="session-info">${state.askSession ? `${state.askSession.notes} notes · ${esc(state.askSession.content ?? "")} · ~${fmtNum(state.askSession.tokens)} tokens · ${esc(state.askSession.model)} · ${esc(state.askSession.effort ?? "")}` : ""}</span>${state.askSession ? '<button class="btn small" id="new-session">New session</button>' : ""}</div>
        <div class="thread" id="thread"></div>
        <div class="field" style="margin-top:12px"><textarea id="question" placeholder="${fresh ? "e.g. What did we decide about the billing migration, and who owns each follow-up?" : "Follow-up question…"}"></textarea><div class="hint">Enter to send · Shift+Enter for a new line</div></div>
        <div class="row end"><button class="btn primary" id="ask-go">Ask</button></div>
      </div>`;
    const thread = $("#thread");
    const renderThread = () => {
      thread.innerHTML = state.askThread.map((t, i) => `<div class="bubble q"><div class="who">You</div>${esc(t.q)}</div><div class="bubble a answer" id="a-${i}">${md(t.a)}${t.pending ? '<span class="cursor"></span>' : ""}${t.usage ? `<div class="faint small" style="margin-top:8px">${esc(t.model)} · in ${fmtNum(t.usage.input_tokens)} · cached ${fmtNum(t.usage.cache_read_input_tokens)} · out ${fmtNum(t.usage.output_tokens)}</div>` : ""}</div>`).join("");
    };
    renderThread();
    const setupCard = $("#ask-setup");
    applySearchFields(setupCard, p.in ? p.in.split(",") : getSearchFields());
    bindSearchFields(setupCard);
    bindModelEffort($('[name="model"]', setupCard), $('[name="effort"]', setupCard));
    if (state.askSession) setupCard.hidden = true;
    $("#new-session") && ($("#new-session").onclick = () => { state.askSession = null; state.askThread = []; pages.ask(main, p); });
    $("#preview").onclick = async () => {
      const out = $("#preview-out");
      try {
        const sel = readSelection(setupCard);
        out.innerHTML = '<div class="muted small">Building corpus…</div>';
        const r = await api("/api/ask/preview", { ...sel, content: "transcript" });
        out.innerHTML = `<div class="small ${r.tokens > r.confirmAbove ? "" : "muted"}">${r.entries.length} notes · ${esc(r.content)} · ~${fmtNum(r.tokens)} tokens${r.notesWithoutTranscript ? ` · ${r.notesWithoutTranscript} without transcript` : ""}${r.tokens > r.confirmAbove ? ` · <span style="color:var(--warn)">large corpus, this call will be expensive</span>` : ""}</div>
          <div class="table-wrap" style="max-height:220px;margin-top:6px"><table><tbody>${r.entries.map((e) => `<tr class="clickable" data-id="${esc(e.id)}"><td class="mono">${fmtDate(e.created_at)}</td><td>${esc(e.title ?? "(untitled)")}</td><td class="num muted">${fmtNum(e.word_count)} words</td></tr>`).join("")}</tbody></table></div>`;
        $$("tr.clickable", out).forEach((tr) => (tr.onclick = () => openNote(tr.dataset.id)));
      } catch (err) { out.innerHTML = `<div class="small" style="color:var(--err)">${esc(err.message)}</div>`; }
    };
    const send = async () => {
      const q = $("#question").value.trim();
      if (!q) return;
      let body = { question: q };
      try {
        if (state.askSession) body.sessionId = state.askSession.id;
        else body = { ...body, ...readSelection(setupCard), content: "transcript", model: $('[name="model"]').value, effort: $('[name="effort"]').value };
      } catch (err) { toast(err.message, true); return; }
      $("#question").value = "";
      $("#ask-go").disabled = true;
      const turn = { q, a: "", pending: true };
      state.askThread.push(turn);
      renderThread();
      let raf = null;
      const idx = state.askThread.length - 1;
      try {
        await stream("/api/ask", body, (ev) => {
          if (ev.type === "session") { state.askSession = { id: ev.sessionId, notes: ev.notes, tokens: ev.tokens, model: ev.model, effort: ev.effort, content: ev.content }; $("#session-info").textContent = `${ev.notes} notes · ${ev.content} · ~${fmtNum(ev.tokens)} tokens · ${ev.model} · ${ev.effort}`; setupCard.hidden = true; }
          if (ev.type === "text") { turn.a += ev.text; if (!raf) raf = requestAnimationFrame(() => { raf = null; const el = $(`#a-${idx}`); if (el) el.innerHTML = md(turn.a) + '<span class="cursor"></span>'; }); }
          if (ev.type === "done") { turn.pending = false; turn.usage = ev.usage; turn.model = ev.model; }
          if (ev.type === "error") { turn.pending = false; turn.a += `\n\n**Error:** ${ev.message}`; }
        });
      } catch (err) { turn.pending = false; turn.a += `\n\n**Error:** ${err.message}`; }
      renderThread();
      if (!$("#new-session")) pages.ask(main, p);
      else $("#ask-go").disabled = false;
    };
    $("#ask-go").onclick = send;
    $("#question").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  };

  pages.profiles = async (main, p) => {
    const st = await getStatus();
    main.innerHTML = `
      <h1>Profiles</h1>
      <p class="lead">An EQ / IQ / professional working profile of one person, built from the transcripts of your meetings with them (one-on-ones and group meetings), with verbatim evidence.</p>
      <div class="split">
        <div>
          <div class="card">
            <h2>Build a profile</h2>
            <div class="form-grid">
              <div class="field"><label>Person</label><input type="text" id="p-name" value="${esc(p.name ?? "")}" placeholder="Dana Whitfield"></div>
              <div class="field"><label>Email (optional)</label><input type="text" id="p-email" value="${esc(p.email ?? "")}" placeholder="dana@company.com"></div>
              <div class="field"><label>Since</label><input type="text" id="p-since" value="${esc(p.since ?? "")}" placeholder="1y, 6m or 2026-01-01"></div>
              <div class="field"><label>Until</label><input type="text" id="p-until" placeholder="YYYY-MM-DD"></div>
            </div>
            <div class="form-grid" style="margin-top:12px">
              <div class="field"><label>Meetings to use</label>
                <select id="p-source">
                  <option value="auto">Auto-detect meetings with this person</option>
                  <option value="ids">Selected notes only (${state.basket.length})</option>
                  <option value="both">Selected notes + auto-detected meetings</option>
                </select>
                <div class="hint" id="p-source-hint"></div>
              </div>
            </div>
            <div class="form-grid" style="margin-top:12px">
              <div class="field"><label>Synthesis model</label><select id="p-model">${modelOptionsHtml(st.model, false)}</select><div class="hint">Writes the final profile from all the evidence in one call.</div></div>
              <div class="field"><label>Synthesis effort</label><select id="p-effort">${effortOptionsHtml(st.effort)}</select></div>
              <div class="field"><label>Extraction model</label><select id="p-extract-model">${modelOptionsHtml(st.extractModel, false)}</select><div class="hint">One call per meeting. Cached evidence is reused unless you tick Re-extract.</div></div>
              <div class="field"><label>Extraction effort</label><select id="p-extract-effort">${effortOptionsHtml(st.extractEffort)}</select></div>
            </div>
            <div class="row" style="margin-top:10px">
              <label class="check"><input type="checkbox" id="p-corpus" checked> Give the model the full transcripts for synthesis</label>
              <label class="check"><input type="checkbox" id="p-refresh"> Re-extract cached evidence</label>
            </div>
            <div class="row" style="margin-top:12px"><button class="btn" id="p-preview">Preview meetings</button><span class="spacer"></span><button class="btn primary" id="p-build">Build profile</button></div>
            <div id="p-preview-out" style="margin-top:10px"></div>
          </div>
          <div class="card"><h2>Existing profiles</h2><div id="p-list" class="muted small">Loading…</div></div>
        </div>
        <div class="card" id="p-output" hidden>
          <h2>Output</h2>
          <div class="log" id="p-log"></div>
          <div id="p-md" style="margin-top:12px"></div>
        </div>
      </div>`;
    const opts = () => {
      const source = $("#p-source").value;
      if (source !== "auto" && !state.basket.length) throw new Error("No notes are selected. Tick notes on the Notes page, or switch to auto-detect.");
      return {
        name: $("#p-name").value.trim(), email: $("#p-email").value.trim(), since: $("#p-since").value.trim(), until: $("#p-until").value.trim(),
        ids: source === "auto" ? undefined : state.basket.map((b) => b.id), plusAuto: source === "both",
        content: "transcript", includeGroup: true, corpus: $("#p-corpus").checked, refresh: $("#p-refresh").checked,
        model: $("#p-model").value, effort: $("#p-effort").value, extractModel: $("#p-extract-model").value, extractEffort: $("#p-extract-effort").value,
      };
    };
    const sourceHint = () => {
      const v = $("#p-source").value;
      $("#p-source-hint").textContent = v === "auto" ? "Finds every meeting with the person, one-on-one or group, by name in titles, attendees and speaker tags." : v === "ids" ? `Uses exactly the ${state.basket.length} note(s) ticked on the Notes page.` : `Your ${state.basket.length} selected note(s) plus any meetings found by name.`;
    };
    $("#p-source").value = state.basket.length ? "ids" : "auto";
    $("#p-source").onchange = sourceHint;
    sourceHint();
    bindModelEffort($("#p-model"), $("#p-effort")); bindModelEffort($("#p-extract-model"), $("#p-extract-effort"));
    const loadList = async () => {
      try {
        const r = await api("/api/profiles");
        const el = $("#p-list");
        if (!r.profiles.length) { el.textContent = "None yet."; return; }
        el.className = "";
        el.innerHTML = `<table><tbody>${r.profiles.map((x) => `<tr class="clickable" data-path="${esc(x.file)}"><td><strong>${esc(x.person)}</strong></td><td class="muted small">${x.generated_at ? fmtDate(x.generated_at) : esc(x.file.split("/").pop())}</td><td class="muted small">${x.meetings ? `${x.meetings} meetings` : ""}</td><td class="muted small">${esc(x.model ?? "")}</td><td><a class="small" href="/api/file?path=${encodeURIComponent(x.file)}&download=1">download</a></td></tr>`).join("")}</tbody></table>`;
        $$("tr.clickable", el).forEach((tr) => (tr.onclick = async () => { openDrawer('<div class="empty">Loading…</div>'); const text = await (await fetch(`/api/file?path=${encodeURIComponent(tr.dataset.path)}`)).text(); $("#drawer").innerHTML = `<button class="btn small close" id="drawer-close">Close</button>${md(text)}`; $("#drawer-close").onclick = closeDrawer; }));
      } catch (err) { $("#p-list").textContent = err.message; }
    };
    loadList();
    $("#p-preview").onclick = async () => {
      const out = $("#p-preview-out");
      try {
        const o = opts(); if (!o.name) throw new Error("Enter the person's name; it is used in the prompts.");
        out.innerHTML = '<div class="muted small">Looking for meetings…</div>';
        const r = await api("/api/profile/preview", o);
        const bits = [];
        if (r.source !== "auto") bits.push(`${r.explicit} selected note(s)`);
        if (r.source !== "ids") bits.push(`${r.candidates} meeting(s) mention ${esc(o.name)}${r.skipped ? `, ${r.skipped} group/unclear skipped` : ""}`);
        out.innerHTML = `<div class="small muted">Using ${r.selected.length} meeting(s) · ${esc(r.content)} · ${bits.join(" + ")}.${r.missing.length ? ` <span style="color:var(--warn)">${r.missing.length} selected note(s) skipped (not archived or no transcript).</span>` : ""}</div>
          <div class="table-wrap" style="max-height:260px;margin-top:6px"><table><tbody>${r.selected.map((e) => `<tr class="clickable" data-id="${esc(e.id)}"><td class="mono">${fmtDate(e.created_at)}</td><td>${esc(e.title ?? "(untitled)")}</td><td><span class="tag ${e.kind === "one_on_one" ? "one" : "group"}">${e.kind.replace(/_/g, "-")}</span></td><td class="num muted">${fmtNum(e.word_count)} w · me ${e.me_word_share === null ? "?" : Math.round(e.me_word_share * 100) + "%"}</td></tr>`).join("")}</tbody></table></div>`;
        $$("tr.clickable", out).forEach((tr) => (tr.onclick = () => openNote(tr.dataset.id)));
      } catch (err) { out.innerHTML = `<div class="small" style="color:var(--err)">${esc(err.message)}</div>`; }
    };
    $("#p-build").onclick = async () => {
      let o;
      try { o = opts(); } catch (err) { toast(err.message, true); return; }
      if (!o.name) { toast("Enter the person's name; it is used in the prompts.", true); return; }
      $("#p-output").hidden = false; const log = $("#p-log"); const mdEl = $("#p-md"); log.textContent = ""; mdEl.innerHTML = "";
      $("#p-build").disabled = true;
      let text = "", raf = null;
      try {
        await stream("/api/profile", o, (ev) => {
          if (ev.type === "log") { log.textContent += ev.message + "\n"; log.scrollTop = log.scrollHeight; }
          if (ev.type === "text") { text += ev.text; if (!raf) raf = requestAnimationFrame(() => { raf = null; mdEl.innerHTML = md(text) + '<span class="cursor"></span>'; }); }
          if (ev.type === "done") { mdEl.innerHTML = md(text); log.innerHTML += `<span class="ok">Done. ${ev.meetings} meetings · ${esc(ev.model)} · in ${fmtNum(ev.usage.input_tokens)} (cached ${fmtNum(ev.usage.cache_read_input_tokens)}) · out ${fmtNum(ev.usage.output_tokens)}</span>\n<a href="/api/file?path=${encodeURIComponent(ev.file)}&download=1">Download Markdown</a>`; loadList(); }
          if (ev.type === "error") { log.innerHTML += `<span class="err">${esc(ev.message)}</span>\n`; mdEl.innerHTML = md(text); }
        });
      } catch (err) { log.innerHTML += `<span class="err">${esc(err.message)}</span>`; }
      $("#p-build").disabled = false;
    };
    if (p.name) $("#p-preview").click();
  };

  pages.export = async (main, p) => {
    main.innerHTML = `
      <h1>Export</h1>
      <p class="lead">Write any selection of notes to files with summaries, private notes and speaker-labelled transcripts.</p>
      <div class="card" id="exp-setup">
        <h2>Notes</h2>
        ${selectionForm(p)}
        <div class="row" style="margin-top:10px"><label class="check"><input type="checkbox" name="all"> Export the entire archive</label></div>
      </div>
      <div class="card">
        <h2>Format</h2>
        <div class="row">
          <div class="field"><label>Format</label><select id="e-format"><option value="md">Markdown</option><option value="txt">Plain text</option><option value="json">JSON (raw API objects)</option></select></div>
          <div class="field"><label>Content</label><select id="e-content"><option value="both">Transcripts + notes</option><option value="transcript">Transcripts only</option><option value="notes">Notes only (AI summary + private notes)</option></select></div>
          <label class="check"><input type="checkbox" id="e-bundle"> One combined file</label>
          <label class="check"><input type="checkbox" id="e-ts" checked> Timestamps on transcript lines</label>
          <span class="spacer"></span>
          <button class="btn primary" id="e-go">Export</button>
        </div>
        <div id="e-out" style="margin-top:12px"></div>
      </div>`;
    applySearchFields($("#exp-setup"), getSearchFields());
    bindSearchFields($("#exp-setup"));
    $("#e-go").onclick = async () => {
      const out = $("#e-out");
      try {
        const all = $('[name="all"]').checked;
        const sel = all ? { all: true } : readSelection($("#exp-setup"));
        out.innerHTML = '<div class="muted small">Exporting…</div>';
        const r = await api("/api/export", { ...sel, format: $("#e-format").value, content: $("#e-content").value, bundle: $("#e-bundle").checked, timestamps: $("#e-ts").checked });
        out.innerHTML = `<div class="small muted">${r.count} notes → <code>${esc(r.outDir)}</code></div><ul class="small" style="margin:8px 0 0;padding-left:18px">${r.files.map((f) => `<li><a href="/api/file?path=${encodeURIComponent(f.path)}&download=1">${esc(f.name)}</a></li>`).join("")}</ul>`;
      } catch (err) { out.innerHTML = `<div class="small" style="color:var(--err)">${esc(err.message)}</div>`; }
    };
  };

  // ---------- router ----------
  function route() {
    const hash = location.hash.replace(/^#\/?/, "") || "home";
    const [name, qs] = hash.split("?");
    const params = Object.fromEntries(new URLSearchParams(qs ?? ""));
    const page = pages[name] ? name : "home";
    $$(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
    closeDrawer();
    const main = $("#main");
    main.innerHTML = '<div class="empty">Loading…</div>';
    pages[page](main, params).catch((err) => { main.innerHTML = `<div class="card"><strong>Error:</strong> ${esc(err.message)}</div>`; });
  }
  window.addEventListener("hashchange", route);
  renderBasket();
  route();
})();
