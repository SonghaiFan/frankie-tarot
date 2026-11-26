<h1 align="center"><picture><source media="(prefers-color-scheme: dark)" srcset=".github/brand/icon-dark.svg"><img src=".github/brand/icon-light.svg" width="56" height="56" alt=""></picture><br>Frankie Tarot</h1>

<p align="center"><b>在安静的空间里选牌、揭开牌阵，围绕一个问题展开思考。</b></p>

<p align="center"><a href="https://songhaifan.github.io/frankie-tarot/zh/">项目介绍</a> · <a href="https://tarot.songhai.site">打开应用</a> · <a href="docs/guide.md">使用指南</a> · <a href="README.md">English</a></p>

<p align="center"><img src="docs/readme/assets/current-mobile.png" width="320" alt="Frankie Tarot — actual application interface"></p>

## 可以做什么

- 选择牌阵，在交互牌桌上手动选牌。
- 在牌库中浏览画作、卡包与牌背。
- 揭开解读，并返回该次解读的私密恢复状态。

## 本地运行

```sh
npm ci
npm run dev
```

应用默认使用 `https://tarot-api.songhai.site`。公共服务地址选项见 `.env.example`。

## 开始之前

应用自行管理正逆位与解读状态，不使用 API 的随机抽牌端点。选牌或翻牌不会请求 AI 解读；解读只在用户明确操作后开始。

## 开发说明

```sh
npm run typecheck
npm run build:vercel
npm run mcp:test
npm run test:interaction
npm run test:vercel
```

项目指南包含 MCP 预览配置与浏览器验收步骤。

[项目指南](docs/guide.md) · [Banner 维护](docs/readme/README.md)

---

<p align="center"><a href="https://songhaifan.github.io/frankie-brain/"><img src=".github/brand/series/brain.svg" width="28" height="28" alt="Frankie Brain" title="Frankie Brain"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-brain-ios/"><img src=".github/brand/series/brain-ios.svg" width="28" height="28" alt="Frankie Brain · iOS" title="Frankie Brain · iOS"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-cards/"><img src=".github/brand/series/cards.svg" width="28" height="28" alt="Frankie Cards" title="Frankie Cards"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-dictionary/"><img src=".github/brand/series/dictionary.svg" width="28" height="28" alt="Blue Dictionary" title="Blue Dictionary"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-generative-art/"><img src=".github/brand/series/generative-art.svg" width="28" height="28" alt="Frankie Generative Art Gallery" title="Frankie Generative Art Gallery"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-goal/"><img src=".github/brand/series/goal.svg" width="28" height="28" alt="Frankie Goal" title="Frankie Goal"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-guitar/"><img src=".github/brand/series/guitar.svg" width="28" height="28" alt="Frankie Guitar" title="Frankie Guitar"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-list/"><img src=".github/brand/series/list.svg" width="28" height="28" alt="Frank’s Life List" title="Frank’s Life List"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-mbti/"><img src=".github/brand/series/mbti.svg" width="28" height="28" alt="Frankie MBTI" title="Frankie MBTI"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-onitama/"><img src=".github/brand/series/onitama.svg" width="28" height="28" alt="Frankie Onitama" title="Frankie Onitama"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-poker/"><img src=".github/brand/series/poker.svg" width="28" height="28" alt="Frankie Poker" title="Frankie Poker"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-stocks/"><img src=".github/brand/series/stocks.svg" width="28" height="28" alt="Frankie Stocks" title="Frankie Stocks"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-tarot/"><img src=".github/brand/series/tarot.svg" width="28" height="28" alt="Frankie Tarot" title="Frankie Tarot"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-tarot-api/"><img src=".github/brand/series/tarot-api.svg" width="28" height="28" alt="Frankie Tarot API" title="Frankie Tarot API"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-werewolf/"><img src=".github/brand/series/werewolf.svg" width="28" height="28" alt="Werewolf Local" title="Werewolf Local"></a></p>

<p align="center"><sub>Frankie 系列 · 制作：<a href="https://github.com/SonghaiFan">Songhai Fan</a></sub></p>

<p align="right"><picture><source media="(prefers-color-scheme: dark)" srcset=".github/brand/signature-dark.svg"><img src=".github/brand/signature-light.svg" width="90" alt="Frankie"></picture></p>
