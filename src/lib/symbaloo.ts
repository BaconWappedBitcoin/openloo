/**
 * A snippet the user runs on their own Symbaloo webmix page to export it.
 *
 * Symbaloo has no export feature. Its per-mix data lives at a JSON endpoint
 * (`/cache/user/N/desktop/<spec>`) that requires the page's own session, so it
 * cannot be fetched from OpenLoo — cross-origin requests are blocked, and the
 * URL 404s server-side without the cookie. Running this on the Symbaloo tab
 * itself sidesteps both: it re-reads the mix JSON the page already loaded
 * (found among the page's own resource timings, so the user shard need not be
 * known), converts each tile to OpenLoo's import format, and downloads a file.
 * It reads only the current page and makes no request Symbaloo did not already
 * make. The user then imports the file with Share → Import.
 *
 * Deliberately written without backslashes so it survives copy/paste intact.
 */
export const SYMBALOO_EXPORT_SNIPPET = `(async () => {
  const entries = performance.getEntriesByType('resource')
    .filter(e => e.name.indexOf('/cache/user/') > -1 && e.name.indexOf('/desktop/') > -1);
  if (!entries.length) { alert('Open your Symbaloo webmix in this tab first (so its tiles are visible), then run this again.'); return; }
  let data = null;
  for (const e of entries) {
    try {
      // cache:'reload' forces a fresh response — a stale/304 one has no body.
      const res = await fetch(e.name, { cache: 'reload', credentials: 'include' });
      const text = await res.text();
      if (res.ok && text) { const j = JSON.parse(text); if (j && Array.isArray(j.smarks)) { data = j; break; } }
    } catch (err) { /* try the next candidate */ }
  }
  if (!data) { alert('Could not read your Symbaloo webmix. Reload the Symbaloo page, wait for the tiles to appear, then run this again.'); return; }
  const tiles = (data.smarks || [])
    .filter(s => s.typed && s.typed.url)
    .map(s => {
      const t = { title: (s.name || s.typed.url).slice(0, 120), url: s.typed.url,
        x: s.x, y: s.y, w: s.width, h: s.height, openInNewTab: true };
      if (/^[0-9a-fA-F]{6}$/.test(s.color || '')) t.color = '#' + s.color;
      if (s.image) t.icon = { kind: 'url', src: s.image };
      return t;
    });
  const webmix = { name: data.name || 'Symbaloo', cols: data.width || 12, rows: data.height || 6, tiles };
  const blob = new Blob([JSON.stringify(webmix)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (data.name || 'symbaloo').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-openloo.json';
  a.click();
  alert('Downloaded ' + tiles.length + ' tiles. Now import that file into OpenLoo (Import/Export -> Import).');
})();`
