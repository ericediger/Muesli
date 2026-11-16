export function log(msg: string): void {
  process.stderr.write(msg + "\n");
}

export function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active -= 1;
    const fn = queue.shift();
    if (fn) fn();
  };
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      next();
    }
  };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isoDate(s: string): string {
  return s.slice(0, 10);
}

export function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/** Render rows as an aligned plain-text table. */
export function table(rows: Array<Record<string, string | number | null | undefined>>, columns: string[]): string {
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join("  ");
  const out = [line(columns), line(widths.map((w) => "-".repeat(w)))];
  for (const r of rows) out.push(line(columns.map((c) => String(r[c] ?? ""))));
  return out.join("\n");
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/** Parse a user-supplied date ("2026-08-01", "30d", "6m", "1y") into an ISO timestamp. */
export function parseSince(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const rel = v.match(/^(\d+)([dwmy])$/i);
  if (rel) {
    const n = Number(rel[1]);
    const d = new Date();
    switch (rel[2].toLowerCase()) {
      case "d":
        d.setDate(d.getDate() - n);
        break;
      case "w":
        d.setDate(d.getDate() - 7 * n);
        break;
      case "m":
        d.setMonth(d.getMonth() - n);
        break;
      case "y":
        d.setFullYear(d.getFullYear() - n);
        break;
    }
    return d.toISOString();
  }
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new Error(`Cannot parse date "${v}". Use YYYY-MM-DD or a relative form like 30d, 6m, 1y.`);
  return new Date(t).toISOString();
}
