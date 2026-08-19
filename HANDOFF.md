# QMoji i18n — handoff state

Written so a future session does not have to infer where things stand.
Repo root: `/Users/loganliu/Projects/Claude/Projects/qmoji` (six sibling repos).

## The invariants (do not relitigate these)

- **Interface language = `uiLang` / `qmoji.uiLang`. Gameplay language =
  `lang` / `qmoji.lang`. Never merged.** This document is about `uiLang`.
- Canonical codes: `en, fr, es, pt-br, pt-pt, ru`. **Lowercase-with-hyphens
  everywhere** — codes become filenames, and Vercel's filesystem is
  case-sensitive even though macOS is not.
- `normalizeLang()`: lowercase → underscores to hyphens → bare `pt` maps to
  `pt-br`. There is deliberately no `pt.json`. Implemented identically in
  `public/i18n.js`, `public/arcade-client.js` (vanilla) and `src/i18n.tsx`
  (React).
- Locale format is identical in every repo: `public/locales/<lang>.json`,
  snake_case keys, per-key English fallback, `<lang>.overrides.json` that
  humans edit and the generator never writes to.
- `scripts/translate.mjs` and `scripts/glossary.json` are **byte-identical
  across all repos**. If one needs a change, all of them get it.

## Standing rules from the user

1. **Never change English source text without showing a before/after list
   and stopping for approval.** Mechanism changes are free; content is not.
2. **One `translate.mjs` run at a time across the whole suite.** DeepL's
   Free tier allows a single glossary on the account; concurrent runs
   clobber each other.
3. API key lives at `~/.config/qmoji/deepl.env`, outside every repo. Run as
   `node --env-file=$HOME/.config/qmoji/deepl.env scripts/translate.mjs`.
   Never copy it into a repo, a `.env`, or a shell profile.
4. Do not merge any branch. Do not translate qmoji-2's admin page.
5. Do not convert qmoji-2's inline `QMOJI_STRINGS` to locale JSON (logged
   as debt, deliberately not done).

## Status by repo

| Repo | Branch | State |
|---|---|---|
| survey-scramble-rebuild (**Moji Mojo**) | `i18n-locale-json` | **Done.** 5 languages, 40 overrides, notes written. |
| emoji-muncher-rebuild | `i18n-locale-json` | **Done.** 5 languages, 37 overrides, notes written. |
| oddoneout-rebuild | `i18n-locale-json` | **Done.** React runtime, 5 languages, 22 overrides, notes written. |
| **Mindreader** | `i18n-locale-json` | **IN PROGRESS — see below.** |
| emoji-blaster-multiplayer | `main` | Not started. Extract-only, no arcade integration. |
| qmoji-2 | `fix-invite-uilang` | One-line invite fix, rebased on current main. |

Nothing has been pushed. Nothing is merged.

## Mindreader — what is next (Pass A)

The React runtime in `oddoneout-rebuild/src/i18n.tsx` was designed to be
ported here; copy it rather than rewriting.

1. Re-key `qmoji/en.json` (84 keys) from its **text-as-key** convention to
   snake_case. **Keys change, values do not.** Reuse key names from the
   other games wherever the English matches exactly (`loading`,
   `connection_error`, `leaderboard_heading`, …) so terminology stays
   consistent across the suite.
2. Port `src/i18n.tsx`; wrap the app in `<I18nProvider>` in `src/main.tsx`.
3. Wire components with the `useT()` hook. Bulk is `src/Room.tsx` (~1,250
   lines) and `src/SingleplayerGame.tsx` (~800); also `App.tsx`,
   `Start.tsx`, `Multiplayerlobby.tsx`.
4. Fix `src/arcade.ts` exactly as oddoneout's was: `uiLang` in
   `readParams()`, persisted **normalized**, returned normalized from
   `initArcade()`. It is a pre-`uiLang` TypeScript port, so the homescreen's
   choice is currently dropped on the floor.
5. Copy `scripts/translate.mjs` + `scripts/glossary.json` in unchanged.
6. **STOP and report. No translation in Pass A.**

Pass B is the five languages, quality review, overrides, and
`TRANSLATION_NOTES.md`.

## Known debt / deliberately not done

- `<title>` stays English in Moji Mojo and Emoji Munchers (queued).
- `page_title` / `page_description` in Odd One Out are translated but unused
  — `index.html` is static.
- qmoji-2 offers only generic `pt`; the `pt → pt-br` alias covers it.
- qmoji-2's `backToHomescreenUrl` is called with 3 args by both finished
  games, dropping `uiLang`. Harmless today (the homescreen re-reads
  localStorage) but latent.
- Cross-game key-name drift, not yet unified: `return_to_launch_pad` (Odd
  One Out) vs `back_to_launchpad` (others); `score` vs `score_line`;
  `hud_score` is `🏆: {score}` with a colon while Moji Mojo's `score_line`
  is `🏆 {score}` without one.
- **No string in any repo has been checked by a native speaker.** Every
  override is logged `claude-corrected, unverified`.
