# Bee Flow — Frontend (`@beeflow/frontend`)

The React + Vite single-page application that fronts every Bee Flow deployment:
the SaaS at [beeflow.nl](https://beeflow.nl), self-hosted installs, and
the embedded Nextcloud ExApp shipped via the
[Bee Flow Nextcloud connector](https://github.com/Bee-Flow/connector).

> **License**: Sustainable Use Licence (fair-code). You can use, modify and
> self-host this software for free. You cannot offer it to third parties as a
> paid service without a commercial agreement. See [LICENSE.md](./LICENSE.md).

## Status

This SPA is shipped publicly so that:

1. Nextcloud App Store reviewers can audit the source of the embedded app.
2. Self-hosters can build it themselves and verify what runs in the iframe.
3. Bug reports + community PRs are easier when the code is open.

The companion Bee Flow server is at
[bee-flow-server](https://github.com/Bee-Flow/beeflow). The
SPA is purely a client — it talks to the server via REST + SSE; nothing of
the SaaS-only logic ships in this repo.

## What this is — and isn't

- ✅ React 19 + Vite 7 SPA, code-split with vendor chunks
- ✅ All UI for chat, agents, knowledge bases, integrations, admin panels
- ✅ i18n via [`./src/i18n`](./src/i18n)
- ✅ Builds to a fully-static `dist/` that any web server can serve
- ❌ Not a Bee Flow server — this is the client only
- ❌ Not a Nextcloud app on its own — the connector packages it for the App Store

## Quick start (development)

```bash
git clone https://github.com/Bee-Flow/hive.git
cd bee-flow-frontend
cp .env.example .env       # set VITE_API_URL to your server
npm install
npm run dev
```

The dev server starts on http://localhost:5173 and proxies `/api`, `/auth`,
`/agents`, etc. to the backend at `VITE_API_URL` (default `http://localhost:3101`).

## Build

```bash
npm run build              # → dist/
npm run preview            # serve dist/ on http://localhost:4173
```

The bundle is fully static. Drop `dist/` behind any reverse proxy (Nginx,
Caddy, Cloudflare Pages) and point the API requests at your Bee Flow server.

## Environment variables

| Variable          | Default                  | Purpose                                         |
|-------------------|--------------------------|-------------------------------------------------|
| `VITE_API_URL`    | `http://localhost:3101`  | Base URL of the Bee Flow server (REST + SSE)    |
| `VITE_PUBLIC_URL` | `/`                      | Vite `--base` for hosting under a path prefix   |

## Consuming as an npm package

Tagged releases publish `@beeflow/frontend` to npm:

```bash
npm install @beeflow/frontend
```

The package contains only the built `dist/` — it has no runtime dependencies.
The Nextcloud connector consumes it this way (see its `Dockerfile`).

## Project layout

```
src/
├── App.jsx                    Root + auth-gating render-tree
├── pages/                     Top-level routes (Settings, Studio, …)
├── components/
│   ├── chat/                  Conversation UI + tool-result rendering
│   ├── admin/                 Org-admin panels (NC sync, integrations, …)
│   └── …
├── i18n/                      Translation defaults
└── utils/                     API helpers (authFetch), scoped storage, …
```

## Contributing

We welcome bug reports, feature requests, and PRs.

- Open an issue first for non-trivial changes — saves rework.
- Run `npm run lint` and `npm run build` before pushing.
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Security

Found a vulnerability? Please disclose responsibly via **tomkooy@beeflow.nl**.
See [SECURITY.md](./SECURITY.md).

## Trademarks

"Bee Flow" and the bee logo are trademarks of Bee Flow B.V. The Sustainable
Use Licence does not grant trademark rights — please don't ship a fork under
the Bee Flow name.

## Questions

- Commercial / hosted SaaS: **tomkooy@beeflow.nl**
