# Tarot introduction maintenance / Tarot 介绍页维护

The English root and Chinese `zh/` are independent explanatory pages for the current Aura app. They share the real dark sky palette, quiet light display type and rounded controls. The intro does not run Three.js or call a model. / 英文首页与中文页独立构建，沿用当前 Aura 的深色星空与轻盈字体；介绍页不启动 Three.js，也不调用模型。

## Content and implemented behavior / 内容与实际行为

Edit `site/content.json` in both languages, then build. Verify behavior in these sources before changing claims:

- `src/app/App.tsx`: input → picking → reading, local table, reveal, session recovery, host-only actions.
- `src/features/tarot/utils/localDraw.ts` and `cardPools.ts`: shuffled hidden table, uniqueness, pool constraints and orientation. Picking is manual; do not describe it as an automatic AI draw.
- `src/features/tarot/components/ReadingSection.tsx`: standalone Open in AI provider menu, image export, and host-only interpretation. `src/app/main.tsx` mounts ordinary `<App />` without a host. `mcp/ui` supplies the conversation integration.
- `src/api/client.ts`, `constants/spreads.ts`: API-owned card and spread definitions. Avoid duplicating catalog rules in the intro.
- `constants/cardPacks.ts`, `cardFaceStyles.ts`, `cardBacks.ts`, `DeckLibrary.tsx`: faces, backs, pack pairings and library filters.
- `src/host/readingSnapshot.ts`, `src/shared/storage.ts`: recovery validation versus appearance preferences. Session storage is not permanent history or account synchronization.

修改描述前，核对以上源码。尤其要区分普通网页版的“打开 AI”与 MCP 宿主中的当前对话解读，不要把当前局恢复写成云端档案。

## Replace these assets / 哪些素材需要替换

| Asset | Replace when |
| --- | --- |
| `site/assets/home-current.png` | Aura homepage, scene, title or start control changes |
| `site/assets/spreads-current.png` | Catalog layout, spread labels or count changes |
| `site/assets/picking-current.png` | Face-down table layout, selection or card-back rendering changes |
| `site/assets/library-current.png` | Pack names, library filters or face/back customization changes |
| `docs/readme/assets/fool.webp`, `star.webp` | Approved Dreamy Aura artwork changes; these are original app assets |
| `site/assets/demo.gif` | Homepage motion changes; retained old recording is explicitly labelled as earlier |
| `docs/readme/banner.png` | Approved banner changes; copied to Open Graph image |
| `docs/readme/assets/frankie.svg` | Approved Frankie signature changes |

Open the real app, switch to the desired interface language and wait for transitions/assets to settle. Use a clearly labelled sample question, never someone’s private question or stored reading. Capture the ordinary live UI; do not fabricate a generated interpretation. Do not click external AI providers, request a summary, or send a host interpretation while gathering screenshots. The hero is the current real home screenshot; adjust CSS cropping/shape only if needed.

截图来自稳定后的真实界面。使用明确标注的示例问题，不能包含私人问题或已有牌局；不要为了采集素材触发 AI 请求。新文件要同步 `build.py` 的复制列表、`content.json` 的双语说明与本指南。

## Catalog sample / 目录示例

`site/catalog-sample.json` is a captured response subset from the app’s actual public API. The interactive explainer uses only names and labels from `SINGLE` and `THREE`; it is not a second tarot engine. Refresh it when those definitions change:

```sh
python3 - <<'PY'
import json, urllib.request
url='https://tarot-api.songhai.site/api/v1/spreads?locale=en&revision=pkt-1911-v1'
payload=json.load(urllib.request.urlopen(url))
spreads=[s for s in payload['spreads'] if s['id'] in ('SINGLE','THREE')]
assert len(spreads)==2
from datetime import date
json.dump({'source':url,'captured_on':str(date.today()),'spreads':spreads},open('site/catalog-sample.json','w'),ensure_ascii=False,indent=2)
PY
```

Review the labels and descriptions in both languages. A position called Future is an interpretive label, not a factual prediction. The API source is primary evidence for this implementation; broader historical or efficacy claims need their own appropriate sources.

目录示例直接来自当前 API，构建时无需联网。更新后核对中英文位置含义；不能把“未来”标签写成预测保证。

## Build, check, publish / 构建、检查、发布

```sh
python3 site/build.py
python3 -m http.server 8080 --bind 127.0.0.1 --directory _site
node --check site/spreads.js
```

Open `/` and `/zh/` at desktop and 390px width. Toggle both spread controls and confirm one/three labels, selected button states, keyboard focus, image loading, no horizontal overflow and all links. Check every gallery image after scrolling. Keep `#use` and `#start` stable.

Commit reviewed `site/` changes and relevant Pages workflow paths, then push `main`. The existing Pages workflow builds only this static introduction. App deployment is independent. Do not publish environment files, private recovery snapshots or unrelated code.

检查双语、桌面与手机、位置切换、焦点、图片及链接。只提交本次审核的介绍页文件；不包含环境文件、私人恢复状态或其他未完成代码。
