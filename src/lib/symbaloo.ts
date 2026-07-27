/**
 * A snippet the user runs on their own Symbaloo page to export ALL their
 * webmixes at once.
 *
 * Symbaloo has no export, and its data cannot be read from OpenLoo (cross-origin
 * is blocked, and the endpoints need the page's own session). Running this on
 * the Symbaloo tab sidesteps both. Symbaloo is a single-page app, so this clicks
 * through each webmix tab in turn (in-page navigation — no reload), and for each
 * reads the mix data two ways for robustness:
 *   1. the mix JSON the app loads on demand (`/cache/user/N/desktop/<spec>`),
 *      which is populated once a tab has been opened;
 *   2. failing that, the rendered `a[id^="smarkTile-"]` tiles (real href, image,
 *      colour, grid-area position).
 *
 * Output is a JSON array of webmixes; OpenLoo's Import adds them all to your
 * current profile (it does not overwrite your existing boards). Written without
 * backslashes so it survives copy/paste intact.
 */
export const SYMBALOO_EXPORT_SNIPPET = `(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
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
  const anyCache = performance.getEntriesByType('resource').map(e => e.name).find(n => n.indexOf('/cache/user/') > -1);
  let base = null;
  if (anyCache) { const i = anyCache.indexOf('/cache/user/'); const shard = anyCache.slice(i + '/cache/user/'.length).split('/')[0]; base = anyCache.slice(0, i) + '/cache/user/' + shard + '/desktop/'; }
  const specOf = (href) => { const i = href.indexOf('/mix/'); return i > -1 ? href.slice(i + 5).split('/')[0].split('?')[0] : null; };
  const fetchSpec = async (spec) => {
    if (!base || !spec) return null;
    try { const r = await fetch(base + spec, { cache: 'reload', credentials: 'include' }); if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.smarks) && j.smarks.length) return fromSmarks(j); } } catch (e) {}
    return null;
  };

  const tabs = [...new Map([...document.querySelectorAll('a[href*="/mix/"]')].map(a => { const s = specOf(a.href); return s ? [s, { name: (a.textContent || '').trim().slice(0, 60), spec: s }] : null; }).filter(Boolean)).values()];
  const webmixes = [];

  if (tabs.length <= 1) {
    const wm = (await fetchSpec(tabs[0] && tabs[0].spec)) || fromDom();
    if (wm && wm.tiles.length) { if (tabs[0] && tabs[0].name) wm.name = tabs[0].name; webmixes.push(wm); }
  } else {
    for (const tab of tabs) {
      const link = [...document.querySelectorAll('a[href*="/mix/"]')].find(a => specOf(a.href) === tab.spec);
      if (link) link.click();
      let wm = null;
      for (let i = 0; i < 20; i++) { await wait(400); wm = await fetchSpec(tab.spec); if (wm) break; }
      if (!wm) { await wait(700); wm = fromDom(); }
      if (wm && wm.tiles.length) { wm.name = tab.name || wm.name; webmixes.push(wm); console.log('OpenLoo: exported "' + wm.name + '" (' + wm.tiles.length + ' tiles)'); }
    }
  }

  if (!webmixes.length) { alert('Could not read your Symbaloo webmixes. Make sure the mix tiles are visible on screen, then run this again.'); return; }
  const blob = new Blob([JSON.stringify(webmixes)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'symbaloo-openloo.json';
  a.click();
  const total = webmixes.reduce((n, w) => n + w.tiles.length, 0);
  alert('Downloaded ' + webmixes.length + ' webmix(es), ' + total + ' tiles total. Now import the file into OpenLoo (Import/Export -> Import). It adds them to your current profile.');
})();`
