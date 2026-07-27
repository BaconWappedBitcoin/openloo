/**
 * A snippet the user runs on their own Symbaloo webmix page to export it.
 *
 * Symbaloo has no export feature, and its data cannot be fetched from OpenLoo
 * (cross-origin requests are blocked, and the endpoint needs the page's own
 * session). Running this on the Symbaloo tab sidesteps both.
 *
 * Two data sources, tried in order for robustness:
 *  1. The mix JSON the page loaded (`/cache/user/N/desktop/<spec>`), re-read
 *     from the page's own resource timings with `cache:'reload'`. Cleanest, but
 *     the cached response can be stale/empty on a long-open tab.
 *  2. The rendered tiles themselves — `a[id^="smarkTile-"]` elements carry the
 *     real destination href, an image, a colour, and a CSS `grid-area` for
 *     position. This works whenever the tiles are on screen, regardless of the
 *     endpoint, so it is the fallback.
 *
 * Each tile is converted to OpenLoo's import format and downloaded as a file to
 * load via Import/Export → Import. Written without backslashes so it survives
 * copy/paste intact.
 */
export const SYMBALOO_EXPORT_SNIPPET = `(async () => {
  const rgbToHex = (rgb) => {
    const n = (rgb || '').replace(/[^0-9,]/g, '').split(',').filter(Boolean).map(Number);
    return n.length >= 3 ? '#' + n.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('') : null;
  };
  const fromSmarks = (data) => {
    const tiles = (data.smarks || []).filter(s => s.typed && s.typed.url).map(s => {
      const t = { title: (s.name || s.typed.url).slice(0, 120), url: s.typed.url,
        x: s.x, y: s.y, w: s.width, h: s.height, openInNewTab: true };
      if (/^[0-9a-fA-F]{6}$/.test(s.color || '')) t.color = '#' + s.color;
      if (s.image) t.icon = { kind: 'url', src: s.image };
      return t;
    });
    return { name: data.name || 'Symbaloo', cols: data.width || 12, rows: data.height || 6, tiles };
  };
  const fromCache = async () => {
    const urls = [...new Set(performance.getEntriesByType('resource').map(e => e.name)
      .filter(n => n.indexOf('/cache/user/') > -1 && n.indexOf('/desktop/') > -1))];
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'reload', credentials: 'include' });
        const txt = await r.text();
        if (r.ok && txt) { const j = JSON.parse(txt); if (j && Array.isArray(j.smarks) && j.smarks.length) return fromSmarks(j); }
      } catch (e) { /* try the next candidate */ }
    }
    return null;
  };
  const fromDom = () => {
    const tiles = [];
    document.querySelectorAll('a[id^="smarkTile-"]').forEach(a => {
      const href = a.href;
      if (!/^https?:/.test(href) || href.indexOf('symbaloo.com') > -1) return;
      const li = a.closest('[style*="grid-area"]');
      let x = 0, y = 0, w = 1, h = 1;
      if (li) {
        const g = (li.style.gridArea || '').split('/').map(s => parseInt(s.trim(), 10));
        if (g.length === 4 && g.every(v => !isNaN(v))) { y = g[0] - 1; x = g[1] - 1; h = g[2] - g[0]; w = g[3] - g[1]; }
      }
      const img = a.querySelector('img');
      const label = a.getAttribute('aria-label');
      const title = (label && label !== 'Open link') ? label : (a.textContent || '').trim();
      const t = { title: (title || new URL(href).hostname).slice(0, 120), url: href, x, y, w, h, openInNewTab: true };
      const hex = rgbToHex(a.style.backgroundColor);
      if (hex) t.color = hex;
      if (img && img.src) t.icon = { kind: 'url', src: img.src };
      tiles.push(t);
    });
    if (!tiles.length) return null;
    const cols = Math.max(12, ...tiles.map(t => t.x + t.w));
    const rows = Math.max(6, ...tiles.map(t => t.y + t.h));
    return { name: 'Symbaloo', cols, rows, tiles };
  };
  const webmix = (await fromCache()) || fromDom();
  if (!webmix || !webmix.tiles.length) {
    alert('Could not read your Symbaloo webmix. Open the mix so its tiles are visible on screen, then run this again.');
    return;
  }
  const blob = new Blob([JSON.stringify(webmix)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (webmix.name || 'symbaloo').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-openloo.json';
  a.click();
  alert('Downloaded ' + webmix.tiles.length + ' tiles. Now import that file into OpenLoo (Import/Export -> Import).');
})();`
