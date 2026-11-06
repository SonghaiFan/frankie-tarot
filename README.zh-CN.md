![Frankie Tarot](docs/readme/banner.png)

# Frankie Tarot

[English](README.md) · [简体中文](README.zh-CN.md)

在安静的空间里选牌、揭开牌阵，围绕一个问题展开思考。

[介绍页](https://songhaifan.github.io/frankie-tarot/zh/) · [打开应用](https://tarot.songhai.site) · [Tarot API](https://github.com/SonghaiFan/frankie-tarot-api) · [项目指南](docs/guide.md) · [本地运行](#本地运行)

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

由 [Songhai Fan](https://github.com/SonghaiFan) 制作 · Frankie 系列项目 · [许可说明](docs/guide.md#license)
