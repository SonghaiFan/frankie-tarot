# F.Tarot directory listing draft

Prepared 6 October 2026. The English listing fields are saved in `plugin.json` under `extensions.com.openai.interface`. This is a local draft; it has not been uploaded or submitted for review.

## English listing

**Name:** F.Tarot

**Subtitle:** Draw cards. Find perspective.

F.Tarot is an interactive tarot table for taking a moment to reflect on a question, a creative block, or a choice.

Choose from 11 spreads, pick and turn over your cards, and explore a 78-card deck with English and Simplified Chinese meanings. Switch between original, redrawn, and dreamy artwork as you explore the cards.

When you're ready, invite ChatGPT to interpret your spread. A brief reading appears in the card table; use Ask Deeper to continue the conversation with the same cards. Save Result exports a PNG of your cards, question, and reading.

Designed for personal reflection and exploring possibilities.

### Starter prompts

1. Open F.Tarot. I'd like to explore how to keep a steady creative rhythm.
2. Open F.Tarot so I can choose a spread, pick my cards, and turn them over myself.
3. Open F.Tarot. I want to reflect on what deserves my attention this week.

## Chinese translation draft

**名称：** F.Tarot

**副标题：** 一个问题，几张牌，换一个视角。

留一点时间，给自己。带着心里的问题、创作中的停顿，或正在考虑的选择，打开 F.Tarot，从几张牌里发现新的视角。

选择一个牌阵，亲手选牌、逐张翻开。探索 78 张塔罗牌、11 种牌阵，以及中英文牌义；也可以切换原版、重绘和梦幻三种牌面。

准备好后，邀请 ChatGPT 一起解读。简短答案会留在牌桌里；点击「深入问问」，在聊天中继续探索同一组牌。点击「保存结果」，将问题、牌面和解读保存成一张 PNG 图片。

用塔罗作为自我探索的起点，看看自己的想法，也看看更多可能。

### 中文示例提示

1. 打开 F.Tarot，我想探索如何保持创作的节奏。
2. 打开 F.Tarot，让我选择牌阵，自己选牌并逐张翻开。
3. 打开 F.Tarot，我想看看这周有哪些值得我留意的事。

The Chinese subtitle and description are declared under `publication.translations.zh-CN`. The base package listing and its starter prompts are English; the Chinese starter prompts above are suggestions for use in the translated listing or walkthrough. The portal currently retains imported translations, but its documentation says this does not yet change Directory display text; verify the saved version before publication.

## Assets and website

- Website: https://tarot.songhai.site/ — opened anonymously in Chrome during preparation; it shows the original tarot app and creator attribution.
- Icon: `assets/aura-logo.png` — a 512×512 PNG rendering of the creator's supplied `aura-logo.svg`, proportionally centered on a transparent square without changing its design. Used for the directory logo and composer icon; the original SVG is also preserved.
- Existing brand color: `#7A688A`.
- Intended publisher: Songhai Fan, individual, as confirmed by the creator. OpenAI identity verification has not been confirmed.
- Category: choose an available category in the target portal after checking its actual options; no guessed category is written into the package.

## Details still to confirm

| Detail | Status |
| --- | --- |
| Publisher | Individual, Songhai Fan, based in Australia as confirmed; verification status unknown |
| Supported countries | All available countries, confirmed; `publication.countries: []` removes country restrictions |
| Payments or purchases | None, confirmed; `review.commerce: false` |
| Public support page and working contact | Creator confirmed songhai.fan2022@gmail.com; published and anonymously verified at https://tarot.songhai.site/support/ |
| Published privacy policy | Minimal bilingual page in `public/privacy/index.html`; creator confirmed no saved user questions/information; published and anonymously verified on production |
| Published terms of service | Minimal bilingual page in `public/terms/index.html`; Australia confirmed; published and anonymously verified on production |

The creator chose a minimal policy approach and confirmed the app does not save user questions or information. The prepared privacy page distinguishes this from temporary processing, local browser preferences, ChatGPT files/conversations, provider logs and optional support email. The email is a required working support contact, not a request to create a user-history system. No fixed 90-day email rule or automatic deletion has been configured.

The creator confirmed ownership or authorization for the supplied logo/card materials. The concise terms preserve artwork ownership and existing result export, without adding an independent 18+ restriction or an invented court jurisdiction. Policy source text lives only in the published HTML pages; the old draft notes link there.

Optional dark-mode icon/color choices can reuse the existing brand; no separate dark-mode asset is currently declared.

## Submission boundary

This listing is not a complete public submission. Five positive and three negative review cases and release notes are now saved in the source manifest. Their natural-language host flows have not yet been run against a portal submission. The actual demo recording and accessible URL, developer and domain verification, and required portal checks remain open. Support/privacy/terms pages are now live and their URLs are in the manifest. See `SUBMISSION.md` for the walkthrough, data inventory and evidence status.

Keep the original private app binding intact. The public packaging script generates a separate upload copy that omits `.app.json` and `extensions.com.openai.apps`, and declares the existing verified `/mcp` endpoint in `mcp.json` instead. An incomplete archive is only a draft, not ready for review.

The listing deliberately promises PNG export, not automatic registration in the conversation's Outputs panel. It does not promise identical model responses, speech generation, prediction accuracy, or support for unverified clients.

References: [OpenAI submission fields and translation behavior](https://developers.openai.com/plugins/deploy/submission#automatically-provide-submission-and-review-information), [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).
