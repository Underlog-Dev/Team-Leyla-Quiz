# 🐣 Team Leyla Quiz Hub — Phase 1

A static website (plain HTML/CSS/JS, **no build step**) that runs on GitHub Pages.

## Deploy from your iPhone
1. In the GitHub app or github.com (Safari → "Request Desktop Website" helps): create a new **public** repository, e.g. `team-leyla-quiz`.
2. Upload every file from this one folder (all files sit at the top level - no subfolders needed).
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, folder: / (root) → Save**.
4. After about a minute your site is at `https://YOUR-USERNAME.github.io/team-leyla-quiz/`.
5. Open it in Safari → Share → **Add to Home Screen** for the app icon.
6. If you update files later, change `VERSION` in `sw.js` (e.g. `tlqh-v2`) so phones refresh the offline cache.

## Test checklist on iPhone
- Host mode, Football, 10 questions → Start. Tap **Copy question**, open TikTok/Notes, paste: `Question 1: …`.
- Answer is hidden until **Reveal answer**; **Copy answer** appears only after reveal.
- Type a name → **+pts** adds a player; same name again does not double-score; **Undo** works.
- **Hint** lowers points once (Easy 1→1, Medium 2→1, Hard 3→2).
- **Refresh** swaps the question, keeps number, theme and difficulty.
- Last question copies as `Final question: …`; last answer ends `That’s the end of the quiz!`.
- Reload the page mid-quiz: progress is still there.
- 🏆 (top bar) shows the leaderboard on phones; **Copy top three** and the final **winner announcement**.
- ⚙️ lets you edit the copy wording and turn on an edit box before copying.

## Question bank
- Currently **167 starter questions** across 15 themes. This is **not** 10,000 and not claimed to be.
- All are marked `status: "unreviewed"` — written from general knowledge, **not yet independently verified**. The app says so in the 📊 panel. Only mark `verified` once checked against a source and fill `source.verifiedBy`.
- Add questions: edit/add files in `tools/src/*.js` (append only), then `node tools/build-bank.js` and `node tools/validate.js` (needs Node; on iPhone you can ask Claude to run these).
- Validation checks: required fields, 3 distinct wrong options, hint leaking the answer, TTS length, duplicate IDs, near-duplicates (same wording **and** same answer; same answer with different questions is allowed).
- "Report wrong" hides a question from that device's future quizzes.

## Tests
`npm test` runs scoring/copy/ranking/duplicate/refresh/persistence tests (22). `tests/e2e.js` is a browser test (needs Playwright).

## How "no repeats" works (Phase 1)
Played question IDs are stored per device in `localStorage` (guest mode). One person's history never affects another visitor. Clearing Safari data or using another device resets it. Cross-device history needs Phase 2 accounts.

## Status
| Phase | Status |
|---|---|
| 1 Playable core (setup, solo, host, copy buttons, hints, refresh, backdrops, local persistence, PWA) | **Built & tested** |
| 2 Accounts + cloud history (Supabase + row-level security) | Not started |
| 3 Large verified question library, import tools, correction workflow | Started (schema, validator, builder only) |
| 4 Hall of Fame, extra animations, optional AI generation (server-side only) | Not started |

Known Phase 1 limits: backdrops use emoji illustrations (lightweight, local) rather than custom artwork; sounds not implemented; no public leaderboard.
