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

<!-- series-footer:start -->

<p align="center">
<a href="https://songhaifan.github.io/frankie-brain/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-brain.svg" width="32" height="32" alt="Frankie Brain" title="Frankie Brain"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-brain-ios/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-brain-ios.svg" width="32" height="32" alt="Frankie Brain · iOS" title="Frankie Brain · iOS"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-cards/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-cards.svg" width="32" height="32" alt="Frankie Cards" title="Frankie Cards"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-dictionary/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-dictionary.svg" width="32" height="32" alt="Blue Dictionary" title="Blue Dictionary"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-generative-art/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-generative-art.svg" width="32" height="32" alt="Frankie Generative Art Gallery" title="Frankie Generative Art Gallery"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-goal/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-goal.svg" width="32" height="32" alt="Frankie Goal" title="Frankie Goal"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-guitar/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-guitar.svg" width="32" height="32" alt="Frankie Guitar" title="Frankie Guitar"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-list/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-list.svg" width="32" height="32" alt="Frank’s Life List" title="Frank’s Life List"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-mbti/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-mbti.svg" width="32" height="32" alt="Frankie MBTI" title="Frankie MBTI"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-onitama/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-onitama.svg" width="32" height="32" alt="Frankie Onitama" title="Frankie Onitama"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-owspace-api/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-owspace-api.svg?v=symbol-1" width="32" height="32" alt="OWSPACE Archive" title="OWSPACE Archive"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-poker/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-poker.svg" width="32" height="32" alt="Frankie Poker" title="Frankie Poker"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-stocks/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-stocks.svg" width="32" height="32" alt="Frankie Stocks" title="Frankie Stocks"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-tarot/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-tarot.svg" width="32" height="32" alt="Frankie Tarot" title="Frankie Tarot"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-tarot-api/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-tarot-api.svg" width="32" height="32" alt="Frankie Tarot API" title="Frankie Tarot · API"></a> &nbsp; <a href="https://songhaifan.github.io/frankie-werewolf/"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/frankie-werewolf.svg" width="32" height="32" alt="Werewolf Local" title="Werewolf Local"></a>
</p>

<p align="center"><sub>Frankie series · Made by <a href="https://github.com/SonghaiFan">Songhai Fan</a></sub></p>

<!-- series-footer:end -->

<p align="right"><picture><source media="(prefers-color-scheme: dark)" srcset=".github/brand/signature-dark.svg"><img src=".github/brand/signature-light.svg" width="90" alt="Frankie"></picture></p>
