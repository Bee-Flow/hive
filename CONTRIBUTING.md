# Contributing to Bee Flow Frontend

Thanks for your interest! This SPA powers every Bee Flow deployment, so we
care a lot about it staying clean, accessible, and easy to read.

## Ground rules

1. **Open an issue first** for non-trivial changes (new pages, refactors,
   dependency upgrades). Saves you and us time before you put serious work
   in. Tiny fixes (typos, dead code, one-line bug fixes) — just send a PR.
2. **Match the existing style.** No new state-management library, no new CSS
   framework, no new icon set. We use Tailwind utility classes + CSS
   custom properties (`var(--bg-secondary)`, etc.).
3. **Don't introduce purple.** Bee Flow's design system explicitly avoids
   purple/violet/indigo because the "AI brand" stereotype is overdone. Use
   amber/honey accents for AI moments instead.
4. **No unsolicited dependencies.** Adding a package crosses the
   maintenance + bundle-size threshold; please justify it in your PR.

## Setup

```bash
git clone https://github.com/Bee-Flow/hive.git
cd bee-flow-frontend
cp .env.example .env       # point VITE_API_URL at a running Bee Flow server
npm install
npm run dev
```

Without a Bee Flow server you can still develop visually — the SPA renders
its empty/loading states gracefully — but interactive flows need the API.
You can run a local server with the open-source
[bee-flow-server](https://github.com/Bee-Flow/beeflow) repo.

## What to work on

- **Bugs**: see issues labelled `bug` and `good first issue`.
- **Translations**: every UI string lives in `src/i18n/en-defaults.js`. PRs
  adding/improving non-English locales are very welcome.
- **Performance**: if you spot a slow render or wasteful re-render, please
  send before/after numbers in the PR description.
- **Accessibility**: keyboard navigation, focus-traps, screen-reader labels.
  We aim for WCAG AA.

## What we'll likely *not* merge

- New top-level pages without an issue first.
- "I rewrote the state model" PRs.
- Wrapping existing libraries in unnecessary abstractions.
- Code style that diverges from what's already there.

## Pull request checklist

- [ ] `npm run lint` is clean (or you've explained the new disable).
- [ ] `npm run build` succeeds.
- [ ] No new dependencies, or you've justified them in the description.
- [ ] You've tested the change in both light and dark theme.
- [ ] Screenshots / GIFs for any visible UI change.
- [ ] You've signed off the DCO line in commit messages
      (`Signed-off-by: Your Name <you@example.com>` — `git commit -s`).

## Licensing of contributions

By submitting a PR you agree that your contribution is licensed under the
[Sustainable Use Licence](./LICENSE.md). You retain copyright on your
contribution. We don't require a CLA.

## Code of conduct

Be kind, assume good faith, and don't be the reason maintainers stop
maintaining. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Questions

- Architecture / "why is X like this": GitHub Discussions
- Security issues: **tomkooy@beeflow.nl** (do *not* open a public issue)
- Commercial: **tomkooy@beeflow.nl**
