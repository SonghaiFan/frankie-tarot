# Frankie / Franklin migration

- Application repository: `SonghaiFan/frankie-tarot` (existing Git history retained).
- API and developer docs: `SonghaiFan/franklin-tarot-api` (independent repository).
- Vercel application project: renamed from `frank-tarot` to `frankie-tarot`, retaining its project ID and `tarot.songhai.site` domain.
- Vercel service project: `franklin-tarot-api`.

The app migration is based on the previously prepared local `frankie-tarot-app` copy plus fixes for cold-page recovery and remote context retrieval. The original API migration source was preserved in the Franklin repository; the pre-migration local code was also backed up before replacing it. The ChatGPT and DSH worktrees are not rewritten or removed.

A page refresh must restore saved cards before the remote spread catalog finishes loading. The same snapshot and revealed-card set are retained. Draw retries reuse the pending seed, and the server validates follow-up context. The browser no longer generates authoritative card meanings locally.

Previously published plugin resource URIs remain accepted. A real ChatGPT Refresh and a fresh host conversation are still needed to verify the actual host; local AppBridge/protocol tests are a separate evidence boundary.
