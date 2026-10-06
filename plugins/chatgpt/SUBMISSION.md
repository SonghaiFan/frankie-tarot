# F.Tarot public submission preparation

Prepared 6 October 2026 for the existing F.Tarot project. This document is preparation evidence, not a published policy or a claim of review approval.

## Prepared materials

- Directory copy, bilingual description, three starter prompts and the verified website URL are in `plugin.json`; readable copy is in `LISTING.md`.
- Creator: individual, Songhai Fan, based in Australia as confirmed by the creator; OpenAI verification status remains unknown.
- Country targeting: all available countries. Commerce: none. Both confirmed by the creator.
- New icon: `assets/aura-logo.svg` from the creator; `assets/aura-logo.png` is the square 512×512 submission rendering.
- Exactly five positive and three negative cases are in `extensions.com.openai.review.test_cases`. Release notes are in `publication.release_notes`.
- Minimal bilingual support, privacy and terms pages are prepared in `public/support/index.html`, `public/privacy/index.html` and `public/terms/index.html`. These are the canonical policy texts; the former draft notes point to them. The pages are published and anonymously verified as listing URLs.
- Tools declare boolean `readOnlyHint`, `destructiveHint` and `openWorldHint` annotations. They create/restore self-contained reading state and do not modify an external account, transact, or browse another service. PNG file export is a separate explicit UI action through host file APIs.

## Review cases and evidence

| Case | Coverage | Full natural-language review status |
| --- | --- | --- |
| P1 | Chinese spread catalog; no draw | Not run against a portal submission |
| P2 | Question opens input; user controls the ritual | Not run against a portal submission |
| P3 | English three-card flow, deliberate reveal, brief interpretation | Not run against a portal submission |
| P4 | Partial reveal and restoration without hidden-card leakage | Not run against a portal submission |
| P5 | Actual PNG save, deeper discussion and same-window new question | Not run against a portal submission |
| N1 | No guaranteed lottery prediction | Not run against a portal submission |
| N2 | No access to concealed card identities | Not run against a portal submission |
| N3 | No payments or purchases | Not run against a portal submission |

Automated engine/protocol/export tests cover parts of these expectations. Passing those tests does not establish that the model routes every natural-language prompt correctly, that all eight portal cases passed, or that a target host reuses its widget correctly. Save test results separately from manifest case definitions. Random draws must be checked against actual returned cards, not a scripted card identity. Never record session handles or credentials in public materials.

## Demo recording plan

Use the existing F.Tarot development connection in ChatGPT, with sample questions and no unrelated private conversations on screen. Use a dedicated clean browser view. Rehearse before recording, then record real interactions; screenshots or this script alone are not a demo video.

1. Ask: “有哪些塔罗牌阵可选？请用中文介绍，不要抽牌。” Show the localized catalog and that no reading was drawn.
2. Ask: “打开 F.Tarot，我想探索如何保持创作节奏。让我自己选择牌阵和选牌，先不要解读。” Show the original inline input screen with the question filled.
3. Choose a three-card spread, start the ritual and pick the cards. Flip only one; briefly show that the assistant has not started an interpretation. Show the remaining cards face down.
4. Ask for the hidden identities without flipping them. Show the assistant's explanation without any automatic reveal. Then flip the remaining cards yourself.
5. Click the interpretation button. Show the brief answer in the original table and the deeper chat response outside it. Open a card detail and switch artwork to demonstrate the original app's interaction.
6. Click Save Result. Show successful file export and open the resulting PNG so the question, same cards and short reading are legible. Do not claim it was added to Outputs unless that actually happens.
7. Click Ask Deeper, then ask a new question. Show continued discussion using the current cards, followed by the same table returning to input without an automatic draw.
8. Briefly demonstrate English mode with the P3 prompt and the unsupported prediction/purchase prompts from N1/N3. Keep responses legible; cut pauses only, not failed behavior.

The walkthrough can be recorded in sections if necessary, provided each section shows the actual app/version. Cover every review case, including P4 restoration, before submission. Play back the finished recording to verify readable prompts, actual card images, successful export and absence of private content. Host it at a reviewer-accessible URL, verify playback without a private login, then set `review.demo_recording_url` and rebuild.

Recording status: **not recorded**. No video URL has been supplied or invented. Computer interaction alone does not establish video-recording capability. The creator can start their existing screen recorder while the visible walkthrough is performed; the local/source work does not depend on a submission-portal upload.

## Reviewer access

The existing MCP tools declare no authentication and the Vercel handler has no user-login gate. Do not invent reviewer credentials or include any account secret in the ZIP. Confirm anonymous connectivity for the exact portal-saved MCP connection. If the service later gains authentication, provide dedicated reviewer credentials only in secure portal fields.

## Privacy facts found in current source

| Data / behavior | Source evidence | What still needs confirmation |
| --- | --- | --- |
| Question, spread, language and card/reveal state | `engine.ts`, `flow.ts`, `mcp.ts` and `ui/index.tsx` use them to draw, restore and interpret a reading | Exact live deployment/version and any additional systems receiving requests |
| Session restoration | The engine signs a reading snapshot and encrypts the session envelope; the snapshot lifetime is seven days | This is token validity, not a promise that all hosting/chat/file data is deleted after seven days |
| Server persistence | The inspected MCP handlers do not write reading histories to a database; state is carried by the caller | Creator confirmed no saved user questions or information in the app; provider request-log configuration remains separate |
| ChatGPT context | Revealed cards, question and shared prompts enter the current ChatGPT conversation; full concealed draw data is sent privately to the UI | OpenAI account retention controls and applicable provider disclosures |
| Generated PNG | Explicit Save Result generates the PNG in the browser; the host receives it for download or an optional ChatGPT file-library upload | File-library deletion/retention follows the user's host account; no automatic Outputs registration is promised |
| Browser preferences | `src/shared/storage.ts`, `App.tsx`, language setup and card-back appearance store language/artwork preferences when localStorage is permitted | Explain how to clear these preferences; do not describe this as a reading-history store |
| Network requests | Public pages/artwork/audio are served from the app host; embedded fonts reference Google Fonts | Actual Vercel/Cloudflare logging, enabled analytics, their retention and recipients |
| Support contact | Creator approved `songhai.fan2022@gmail.com`; support messages and attachments would be received through Gmail | Contact mail is used only to handle the request, with deletion available on request; no fixed retention period or automatic mailbox deletion is configured |
| Model provider | The ChatGPT adapter excludes Gemini provider code from its build and uses the current conversation | Confirm ordinary website provider behavior for the exact deployed version before covering both surfaces in one policy |

No claim of “zero data collection,” automatic deletion, a fixed hosting-log retention period, or no third-party processing is supported by this inspection alone.

On 6 October 2026, the connected Vercel API listed the existing `frank-tarot` project and its `tarot.songhai.site` domain. The project-scoped Drains response was empty. Project/team responses did **not** include analytics activation, account plan or log-retention fields; missing fields do not establish that those features are disabled. Vercel's current runtime-log documentation describes plan-dependent retention, which is distinct from application reading history and cannot yet be assigned to this project. No hosting configuration was changed and no request/conversation log content was retrieved for this check.

## Minimal pages published

The creator asked for the simplest approach and confirmed the app does not save user questions or information. The privacy page states this as no application-database question, reading or profile history, while disclosing the transient current-reading processing, browser preferences, ChatGPT conversations/files, infrastructure records and optional contact email. It does not claim that hosting providers or ChatGPT retain no data.

The support page provides the approved email directly, with no form, ticket system, account requirement or extra data collection. Public MCP review requires a support page with a working contact method; it does not require storing reading histories. The earlier suggestion of a 90-day email rule was not adopted. No mailbox settings were changed or email deletion performed.

The terms are concise: intended reflective use, no commerce, lawful use, host eligibility, result saving, artwork ownership, privacy link, availability and mandatory consumer rights. The publisher is Songhai Fan, an individual in Australia. There is no invented exclusive court, arbitration, damages cap, response-time promise or new age-verification system.

The creator confirmed rights/authorization for the supplied logo and card materials. The pages allow the existing Save Result behavior without asserting transfer of artwork ownership.

Prepared routes are `/support/`, `/privacy/` and `/terms/` on the existing site. Both forms with and without trailing slash have explicit Vercel rewrites before the app fallback. Anonymous production checks confirmed the exact content of all six routes on 6 October 2026; their verified URLs are now in the manifest. Hosting-log retention is a technical verification item, not another policy questionnaire for the creator. The provider retention link in the prepared privacy page does not verify this account's exact setting.

Identity/domain verification, an actual reviewer-accessible demo recording, review-case execution against the saved portal version and developer attestations still remain. Preparing pages or a ZIP does not complete those steps.

On 6 October 2026, anonymous initialization and tool discovery succeeded against `https://tarot.songhai.site/mcp`. It reported the five expected tools and all required boolean annotations. The current local plugin test suite passed 49/49. These checks do not replace the eight natural-language portal review cases or a recorded demo.

The new Aura logo was converted proportionally to a 512 × 512 transparent PNG and checked on light and dark backgrounds. The bilingual support page was checked in a real browser with its logo and contact link loaded. Explicit Vercel rewrites for support, privacy and terms, with and without trailing slashes, are prepared locally. The generated 0.3.4 draft ZIP passed its CRC check and contains only `plugin.json`, `mcp.json` and the referenced Aura PNG; no private app binding is included. The source changes were deployed to Vercel production as commit `d2f1830` and verified on `tarot.songhai.site`; no Directory submission has been made.

## Public package and final portal steps

Run `node plugins/chatgpt/prepare-submission.mjs` to generate a public draft ZIP from the canonical source manifest and its referenced assets. The script uses an allowlist and preserves private source bindings. It reports missing preparation fields; successful archive creation is not submission readiness.

Once all preparation fields and the recording are complete, inspect the ZIP, upload it to the intended existing publisher/plugin in the portal, connect and scan the real MCP endpoint, complete the generated domain challenge, and run the cases against that saved version. Record the actual findings. Submission for review and publication after approval remain separate authorized actions.

References: [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission), [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).

Policy preparation references: [OpenAI age and access terms](https://openai.com/policies/terms-of-use/#registration-and-access), [Vercel runtime-log retention](https://vercel.com/docs/logs/runtime#limits).

## Production release verification — 6 October 2026

Commit `d2f1830` is pushed to GitHub main. Vercel deployment `dpl_5Ww5nA9xQYoBWiGUEyrW3Hzhep3d` reached READY and was aliased to `tarot.songhai.site`. Anonymous checks verified exact support/privacy/terms content both with and without trailing slashes, the new favicon, an actual WebP from each of the three card styles, MCP initialization and all five tools. The live support and privacy pages were also checked in Chrome. The isolated release passed typechecking, 49 plugin tests, 2 Vercel integration tests and the full production build.

Cleanup removed the obsolete Sites export/Worker pipeline, old logo and preview assets, duplicate `/cards` delivery alias and unused image-manifest generator/static-script constants. Source PNG masters and all three 78-card WebP sets were retained. Other unfinished UI/audio changes in the workspace were excluded from this release.
