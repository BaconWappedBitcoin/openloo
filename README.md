# OpenLoo

A self-hosted visual bookmark dashboard — a grid of colourful tiles you can use
as your browser's start page. An open alternative to Symbaloo, with no account,
no tracking, and no server holding your links.

![OpenLoo dashboard](docs/screenshot.png)

**[Try the live demo →](https://baconwappedbitcoin.github.io/openloo/)** — it runs
entirely in your browser. Any boards you make there are stored only on your own
device; nothing is uploaded, and no one else can see them.

## What it is

OpenLoo is a **static web app**. There is no backend, no database, and no API.
Your bookmarks live in your browser's local storage and never leave the device
unless you export them yourself.

That has a real consequence worth stating up front: **your data is per-browser.**
It does not sync between your laptop and your phone, and clearing site data
deletes it. Export a backup if it matters to you. If you want an account that
follows you between devices, OpenLoo is not that — see
[Wanting a real backend](#wanting-a-real-backend).

## Features

- **Grid of tiles** — 1×1 up to 3×2, drag to rearrange, arrow keys to nudge
- **Tile icons** — the site's real favicon, a curated set of ready-made icons
  to pick from, any emoji, or an image you upload
- **Multiple webmixes** — tabs along the bottom, one board each
- **Local profiles** — separate sets of boards in one browser (work, home, kids)
- **Search bar** — DuckDuckGo, Startpage, Brave, Google, Bing, Ecosia, Wikipedia,
  YouTube, or your own `%s` template; typing a bare domain goes straight there
- **Share by link** — the whole board is packed into the URL, so there is
  nothing to host
- **Import / export** — plain JSON, for backups and moving between browsers
- **Light and dark** — follows your system by default
- **Undo** — `Ctrl`/`Cmd`+`Z` for every destructive action
- **No third-party requests by default** — see [Privacy](#privacy)

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search bar |
| `E` | Toggle edit mode |
| `N` | Add a tile |
| `Ctrl`/`Cmd` + `Z` | Undo |
| Arrow keys | Move the focused tile (in edit mode) |
| `Esc` | Close a dialog |

## Run it

### Docker (recommended for self-hosting)

```bash
docker compose up -d
```

Then open <http://localhost:8086>. The container runs nginx as a non-root user
with a read-only filesystem and a restrictive Content-Security-Policy.

The host port defaults to **8086** (8080 is so commonly already in use). Change
the left-hand number of the `ports` mapping in `docker-compose.yml` to serve it
elsewhere; nginx always listens on 8080 inside the container.

### Static files

Any static host will do — there is nothing to configure.

```bash
npm ci && npm run build
```

Serve the contents of `dist/`. If you are hosting under a subpath, set the base
path at build time:

```bash
BASE_PATH=/openloo/ npm run build
```

### GitHub Pages

The included workflow (`.github/workflows/pages.yml`) builds and publishes on
every push to `main`. Enable it under **Settings → Pages → Source: GitHub
Actions**. The base path is set automatically from the repository name.

### Development

```bash
npm ci && npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on <http://localhost:5173> |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript, no emit |

## Privacy

Self-hosting a dashboard that quietly phoned home would defeat the point, so:

- **Favicon fetching is off by default.** Asking DuckDuckGo or Google for a
  site's icon tells them which sites you have bookmarked. With the default
  setting of `None`, OpenLoo makes **no third-party requests at all** — tiles
  fall back to initials, a ready-made icon, an emoji, or an image you upload.
  Choosing the "Favicon" icon while it is off shows the trade-off inline and
  lets you enable it in one click, so the choice is informed rather than buried.
- **Share links contain the board itself**, in the URL fragment. Fragments are
  never sent to a server, so even the host serving the app does not see what
  you shared.
- **No analytics, no telemetry, no fonts or scripts from a CDN.** The bundle is
  entirely self-contained.

### Handling untrusted boards

A shared link or an imported file is data from someone else, and OpenLoo treats
it that way:

- Every URL is validated; `javascript:`, `data:text/html`, `file:` and friends
  are dropped rather than rendered as clickable tiles.
- Uploaded and linked icons must be raster images. SVG data URIs are rejected
  because SVG can carry script.
- Control characters and Unicode bidi overrides are stripped from titles, so a
  tile cannot be made to display something other than what is stored.
- Geometry is clamped and overlaps resolved, so a malformed board cannot break
  the grid.
- Incoming shared boards are **previewed with their destination hostnames
  listed** before you accept them — a tile labelled "Bank" can point anywhere,
  and that is the moment to notice.

Unknown fields are discarded rather than passed through. See
[`src/lib/sanitize.ts`](src/lib/sanitize.ts) and the tests in
[`tests/sanitize.test.ts`](tests/sanitize.test.ts).

## Wanting a real backend

Accounts that sync across devices need a server; a static app cannot provide
them. OpenLoo is built so that adding one does not mean a rewrite: **all
persistence goes through a single `StorageAdapter` interface**
([`src/storage/adapter.ts`](src/storage/adapter.ts)), and the shipped
`LocalStorageAdapter` is one implementation of it. Adding a server-backed
adapter means writing a new class and switching on it in
[`src/storage/index.ts`](src/storage/index.ts) — the UI and store are untouched.

The interface is already async and has an optional `subscribe` hook for
external changes (used today to keep two open tabs in sync), so a networked
implementation is a drop-in rather than a refactor.

## Architecture

```
src/
  types.ts          Data model — no React, no DOM
  lib/              Pure logic: grid math, sanitising, sharing, URLs, colours
  storage/          StorageAdapter interface + the localStorage implementation
  store/            Zustand store, undo history, debounced persistence
  hooks/            Board measurement
  components/       UI
tests/              Unit tests for the grid and the trust boundary
```

The interesting parts are `lib/grid.ts` (placement, swapping, reflow) and
`lib/sanitize.ts` (the trust boundary). Both are pure functions and both are
tested.

## Contributing

Issues and pull requests are welcome. Please keep `npm test` and `npx tsc -b`
green — CI runs both on every push.

## Licence

[MIT](LICENSE).

Not affiliated with, endorsed by, or derived from Symbaloo. "Symbaloo" is a
trademark of its respective owner; it is referenced here only to describe what
kind of tool this is.
