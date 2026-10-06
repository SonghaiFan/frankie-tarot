# 把 Frank Tarot 做成 DeepSeek Harness 客户端插件 — 实施方案

> 目标形态（已确认）：**Client UI 插件（完整牌桌）** —— 在 DSH Web GUI 里嵌入可交互的塔罗抽牌/翻牌牌桌，作为一次工具调用（`tarot_draw`）的专属视图。
> 交付方式（已确认）：**先出完整实施方案文档**（即本文）。

---

## 0. TL;DR

把 Frank Tarot 变成 DSH 插件，本质上是**两个半区的一对注册**：

1. **Host 半区（工具）**：一个 Cordis 插件，用 `ctx.tools.register(defineTool(...))` 注册 `tarot_draw`（和 `tarot_spreads`），复用 78 张牌 + 12 种牌阵的 `ground-truth.json`，由 DSH 自己的模型做解读（不再调 Gemini）。
2. **Client 半区（牌桌 UI）**：同一个包（或第二个包）的 `./client` 入口，把 wire 工具名 `tarot_draw` 注册进 `tool.call.toolview` 这个 keyed slot，渲染交互牌桌。

关键结论：**牌桌必须按 DSH 的 slot/样式/本地化纪律重写，而不是照搬现有 React 组件**（见 §7）。抽牌/翻牌的"仪式感"保留为**对已抽结果的纯客户端演示**——agent 负责抽牌和解读（权威），用户负责点击翻牌（仪式），卡片数据全部来自工具结果（replay 稳定）。

---

## 1. 背景：DSH 插件模型速览

- DSH 是 Cordis 框架："everything is a plugin"，最小插件 = 导出 `apply(ctx)` 的 TS 模块。核心文档见 [docs/architecture.md](file:///Users/songhaifan/Developer/deepseek-harness/docs/architecture.md)。
- **Host 工具**：`ctx.tools.register(defineTool({ name, description, parameters, output, execute }))`，`inject: ['tools']`。教程见 [Build a tool](file:///Users/songhaifan/Developer/deepseek-harness/docs/user/develop/basic/tool.md) 与 [tool 编写参考](file:///Users/songhaifan/Developer/deepseek-harness/docs/cookbook/adding-a-tool.md)。
- **Client 插件**：浏览器侧的插件，通过包的 `dsh.client` 声明被发现、打包、注入（[client-modules README](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/modules/README.md)）。
- **工具专属视图**：业务包用 `ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: '<wire tool name>' }, Component))` 注册（[ui-tool README](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-tool/README.md)）。参考实现是 `skill` 工具视图（[ui-skill](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-skill/src/client/index.ts)）。
- **客户端纪律**（必须遵守，否则加载/评审失败）：见 [packages/client/AGENTS.md](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/AGENTS.md)。

---

## 2. 目标架构

一个包同时拥有 Host 半区和 Client 半区（`ui-skill` 即此模式：Node 半区 `src/index.ts` + 浏览器半区 `src/client/`）：

```
frankie-tarot/
  └── dsh-plugin/                      # 新的插件包（建议放 frankie-tarot 仓库内，或独立 repo）
        ├── package.json               # exports "." / "./client"；dsh.client + dsh.bundle 声明
        ├── tsconfig.json
        ├── tsdown.config.ts           # clientBundle(...) 打包预设
        ├── cordis.patch.yml           # 插件行（insert 到 profile）
        ├── src/
        │     ├── index.ts             # Host 半区：注册 tarot_draw / tarot_spreads 工具
        │     ├── engine.ts            # 复用 main 的 mcp/engine.ts（抽牌 + 牌阵 + 本地化 + readingToken）
        │     └── client/
        │           ├── index.ts       # Client 半区：注册 tool.call.toolview
        │           ├── TarotCard.tsx  # 牌桌组件（翻牌/牌阵/含义）
        │           ├── TarotCard.module.css
        │           └── locales.ts     # zh / en 字典
        └── tests/
```

**两个替代结构**（方案里给出，实现时二选一）：

- **A（推荐，单包）**：如上。逻辑上就是一个"Frank Tarot 插件"，最接近第三方可安装 bundle 的最终形态。
- **B（DSH 一仓两包，更符合内置分层）**：`packages/tarot/tool-tarot`（Host 工具）+ `packages/client/ui-tarot`（Client UI）。更规范，但拆得碎、前期成本高。

本方案按 **A** 展开；若最终要合入 DSH 主仓，再切 B。

---

## 3. 数据复用策略

**能直接复用的**：

- [ground-truth.json](src/features/tarot/data/ground-truth.json) —— 唯一数据源（78 张牌 / 12 种牌阵 / 牌位几何 / 尺寸）。不再 vendor：Host 通过 `mcp/engine.ts` 读取；Client 只消费工具结果，需要牌位几何时直接 import 同一份 JSON。
- [mcp/engine.ts](mcp/engine.ts) —— main 上与平台无关的引擎（按牌池 `crypto.randomInt` 抽不重复牌 + 默认 40% 逆位、本地化牌阵与牌位、签名 `readingToken` 可还原同一次抽牌、卡图 URL 指向 `publicBaseUrl/assets/`）。`dsh-plugin/src/engine.ts` 直接 re-export，不重写。
- [src/core/promptBuilder.ts](src/core/promptBuilder.ts) 的"Grand Tarot Master / 一段话 / 120–180 字"指令——**写进 `tarot_draw` 的 `description`**（让 DSH 模型自行按此风格解读），而不是拼一个给 Gemini 的 prompt。
- 卡面美术 `public/images/cards*/`（webp）——牌桌要显示牌面时作为静态资源引用。

**必须重写 / 不能直接 import 的**：

- `src/core` 里间接引用了 React（`spreads.ts` → `icons/SpreadIcons.tsx`）和 `import.meta.env.BASE_URL`（`cards.ts`），在 Node Cordis 插件和浏览器 bundle 里都不能用。
- 所以 Host 不碰 `src/core`，改用 `mcp/engine.ts`：它只依赖 `ground-truth.json`、`node:crypto` 和 `zod`，没有 React/Vite/`import.meta`，适合 Node 侧的 Cordis 插件（不进浏览器 bundle）。

**Gemini 这层去掉**：`src/core/services.ts` 的 `generateTarotReading()` 在 DSH 里冗余——DSH 的 agent 本身就是模型。`tarot_draw` 只返回"抽出的牌 + 牌义素材"，解读交给会话里的模型。

---

## 4. Host 半区规格（`tarot_draw` 工具）

文件：`src/index.ts`。核心代码形态：

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { drawSpread, listSpreads, type DrawnCard, type SpreadResult } from './draw'

export const name = 'tarot-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'tarot_draw',
    description:
      'Draw a Rider-Waite tarot spread for the seeker. Return every card with its ' +
      'position label, orientation, keywords and meaning. Then interpret the spread ' +
      'yourself: one cohesive, restrained paragraph (120–180 Chinese characters or ' +
      '130–180 English words), weaving positions together rather than listing cards. ' +
      'Speak directly to the seeker. End with a short empowering line. Never claim the ' +
      'cards guarantee future outcomes.',
    parameters: {
      spread: { type: 'string', required: false, description: 'SINGLE|THREE|FOUR|TIMELINE|RELATION|CELTIC|...' },
      question: { type: 'string', required: false, description: "The seeker's question" },
      locale: { type: 'string', required: false, description: 'zh-CN or en' },
    },
    output: {
      // ① canonical 值：完整结构化结果，供 PTC 模式和 presentationMeta 使用
      schema: { /* object：spread, question, cards[{position,positionLabel,name,nameEn,isReversed,keywords,meaning}] */ },
      // ② 模型看的文本：铺出牌面 + 提示模型开始解读
      render: (_args, value) => [{ type: 'text', text: renderSpreadForModel(value) }],
      // ③ replay 稳定的结构化卡片数据：Client 牌桌从这里读
      presentationMeta: (_args, value) => value,  // 直接持久化 canonical 结果
    },
    async execute(args) {
      return drawSpread(args.spread ?? 'THREE', args.question ?? '', args.locale ?? 'zh-CN')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'tarot_spreads',
    description: 'List the supported tarot spreads with names and card counts.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute() { return listSpreads() },
  }))
}
```

**数据通路（关键）**：

- `execute` → canonical JSON（`output.schema`）。
- `output.render` → 模型可见文本。
- `output.presentationMeta(args, value)` → 持久化到 `tool/result` 的 `result.meta`；Client 从 `ToolCallBlock` 的 metadata 里读回结构化牌面（replay 稳定，见 [adding-a-tool.md](file:///Users/songhaifan/Developer/deepseek-harness/docs/cookbook/adding-a-tool.md) 的 "Web Client presentation" 一节）。

**"抽牌"语义的变化**（必须想清楚，写进文档）：在 DSH 里没有"用户点牌堆"来生成结果——抽牌是 agent 调用 `tarot_draw` 时在 Host 端用 `crypto.randomInt` 完成的一次随机抽牌。所以：

- 权威结果 = 工具返回的 `cards`。
- 用户"抽/翻"变成 Client 端对已知结果的**翻牌动画**（见 §5）。
- 不需要 ChatGPT 插件那套"sessionToken / 对模型隐藏牌面"的机制——DSH 的模型就是读者，没有理由对它隐藏牌。

---

## 5. Client 半区规格（`tool.call.toolview`）

文件：`src/client/index.ts`。核心注册形态（照抄 `ui-skill` 的模式）：

```ts
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'   // 拉 ctx.slots 的类型
import type {} from '@deepseek-ai/dsh-client-locale/client'        // 拉 ctx.locale 的类型
import { TarotCardRow } from './TarotCard.tsx'
import { en, zh, NS } from './locales.ts'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'tarot_draw', locale: NS },
    TarotCardRow,
  ))
}
```

**组件 props**：`ToolCallViewProps`（来自 `@deepseek-ai/dsh-client-ui-tool/client`）+ `PropsLocale<'tarot'>`。参考 [SkillRow.tsx](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-skill/src/client/SkillRow.tsx)。

`ToolCallOwnerProps`（每个 toolview 拿到的 owner 数据，见 [slots.ts](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-tool/src/client/contract/slots.ts)）精确包含：`useDisclosure`、`callId`、`toolName`、`block: ToolCallBlock`、`cwd`、`home`、`openFile`、`loadImage`、`inspect`。

组件从 `block` 派生一切（replay 稳定，禁止 I/O / 时钟 / 随机）：

- `block.call.argsRaw`（运行态 `block.argsRaw` / 落定态 `block.call.argsRaw`）→ 问题 / 牌阵。
- `block.meta`（=`presentationMeta` 持久化的**不透明 `unknown`**，需像 `web-card-model.ts` 那样本地校验后使用）→ `cards` 结构化数组。
- `block.content`（=`output.render` 文本）→ 模型解读文本。
- `block.error` / `block.isError` → 失败态。

**牌桌交互（纯客户端状态）**：

1. 初始：所有牌 **背面朝上**，按牌阵位置摆好（复用 `ground-truth.json` 里的 `layout.positions` 几何做绝对定位，或简化为 flex 布局）。
2. 用户点击一张牌 → CSS 3D `rotateY` 翻面 → 显示牌面图（`public/images/cards*/` 的 webp）+ 位置标签 + 正逆位。
3. hover → 关键词/含义 tooltip。
4. 全部翻开后 → 显示模型解读文本（从 `block.content` 读）。
5. 一个"换一副/重新解读"按钮 → 触发一条新的用户消息让 agent 再抽（可选，v2）。

**翻牌状态是本地 `useState`，不持久化**——刷新重置为全背面，符合"UI 是纯演示"的纪律。

---

## 6. 样式 / 动画 / 本地化约束（最容易踩坑）

来自 [packages/client/AGENTS.md](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/AGENTS.md)，逐条对照：

| DSH 要求 | 对 Frank Tarot 的影响 |
|---|---|
| **CSS Modules + `--dsw-*` 语义 token，无 Tailwind、无字面颜色** | 现有 `App.tsx`/`RitualCardStage` 里的 Tailwind class 和 `text-neutral-*` 全部重写为 `.module.css` |
| **组件看不到 `ctx`，只有五个 props shares** | 现有组件里 `useTranslation()`、`useTarotAudio` 等 hook 全部换成 props 传入的 `t` / 回调 |
| **所有产品文案进 locale 字典，经 `t` 输出** | 现有中英文案抽进 `locales.ts`（`zh`/`en` 两个 namespace） |
| **`execute` 的卡片展示必须是对 `args`+`result` 的纯函数** | 翻牌数据只能来自 `block`，不能现场 fetch / 读 session |
| **动画/三方库**：非 baseline 的三方实现只能进 `devDependencies`（打包进 bundle）| `motion/react`/`gsap`/`ogl` 要么私有打包，要么用纯 CSS 替代 |

**建议 v1 策略**：

- 翻牌 = 纯 CSS 3D transform（`perspective` + `rotateY(180deg)` + `transition`），零动画依赖。
- 背景 = 一个简化的 CSS 星场（或纯色 token 背景），**去掉 ogl 的 Galaxy WebGL**（最省事、replay 最稳）。
- `motion/react` 可选私有打包，作为 v2 的锦上添花。

---

## 7. 包接线、构建、加载

### 7.1 package.json 要点

```jsonc
{
  "name": "@frankie/dsh-tarot",
  "type": "module",
  "exports": {
    ".":            { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client":     { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-tool", "@deepseek-ai/dsh-client-locale"] },
    "bundle": { "patch": "./cordis.patch.yml" }
  },
  "peerDependencies": { "@deepseek-ai/cordis": "*" },
  "devDependencies": { "react": "*", "@deepseek-ai/dsh-tools": "*", "@deepseek-ai/dsh-client-ui-tool": "*", /* ... */ }
}
```

说明：

- `dsh.client.platform: "web"` + `./client` export → Client 半区被发现（[client-modules README](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/modules/README.md#declaring-a-client-plugin)）。
- `dsh.client.inject` 是**信息性**的包名依赖边（preflight/HMR diffing 用），不影响激活顺序；激活顺序只看 Cordis 服务 `inject`。
- `dsh.bundle.patch` → 让 `dsh plugin add` 把它当作可安装 bundle（[publish.md](file:///Users/songhaifan/Developer/deepseek-harness/docs/user/develop/basic/publish.md)）。
- baseline（React、Cordis、`ui-slots`/`ui-renderer`/`ui-tool` 等静态库）**不必写进 `dsh.client.external`**，会被 `PLATFORM_MODULES` 自动满足。只有非 baseline 的私有依赖（如 `motion/react`）才需要处理——普通三方实现直接私有打包即可。

### 7.2 cordis.patch.yml

```yaml
- insert:
    - id: frankie-tarot
      name: '@frankie/dsh-tarot'
      inject: [tools]
```

### 7.3 构建

- 用 DSH 的 `tsdown` 客户端预设产出 `lib/client.js`（懒加载 CJS factory + 对 `PLATFORM_MODULES` 的外部化）。**这一步是 DSH 特有格式，普通 esbuild/vite 产不出可被 `/plugins` 路由加载的 bundle**。
  - 单包模式：仿照 [ui-skill/tsdown.config.ts](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-skill/tsdown.config.ts) 的 `clientBundle('@frankie/dsh-tarot', ['lib/types/index.js'])`。
  - 若插件在 DSH 主仓外，需依赖 `@deepseek-ai/dsh-*` 的 tsdown 预设或复制其 `tsdown.client.ts` 逻辑（这是"出仓 bundle"最主要的隐藏成本，见 §9 风险）。

### 7.4 加载与验证

```sh
# 开发：--patch 挂本地插件（绝对路径）
cd /Users/songhaifan/Developer/deepseek-harness
pnpm --filter <你的包> bundle          # 先产出 lib/client.js
pnpm dsh web --patch /绝对路径/frankie-tarot/dsh-plugin/cordis.patch.yml
# 打开 http://127.0.0.1:3080，说「用 tarot_draw 给我抽一个三张牌阵」

# 发布：装进 profile
dsh plugin add <你的包>               # 或 github:you/frankie-tarot#<sha>
dsh --profile demo --dump-config      # 确认出现 # == @frankie/dsh-tarot 层
```

---

## 8. 与现有 Frank Tarot 代码的关系（复用 vs 重写）

| 资产 | 处理 |
|---|---|
| `src/features/tarot/data/ground-truth.json` | ✅ 经 `mcp/engine.ts` 读取，不再 vendor |
| `mcp/engine.ts`（抽牌 / 牌阵 / readingToken） | ✅ 直接复用（`dsh-plugin/src/engine.ts` re-export） |
| `src/core/promptBuilder.ts` 的解读指令 | ✅ 抄进 `tarot_draw.description` |
| `src/core/services.ts`（Gemini） | ❌ 删除（DSH 模型代劳） |
| `src/app/App.tsx` 状态机 / `RitualCardStage` 布局 | 🔁 重写为 slot 纪律下的纯 props 组件 + CSS Modules |
| `public/images/cards*/` 牌面 webp | ✅ 用引擎返回的 `imageUrl`（线上 `/assets/`），不随 bundle 发布 |
| `Galaxy.tsx`(ogl) / `motion/react` / `gsap` | ❌/🔁 v1 用 CSS 替代，v2 可选私有打包 |
| `src/i18n/*` | 🔁 换用 DSH 的 `ctx.locale.register(NS, {zh, en})` |
| ChatGPT 插件 `plugins/chatgpt/*`（sessionToken/隐藏牌） | ❌ 不适用（DSH 无 widget 隐藏牌语义） |

---

## 9. 里程碑与验收

1. **M0 — 数据 + 纯逻辑**：复用 `mcp/engine.ts`（抽牌规则由 `mcp/engine.test.ts` 覆盖）；`dsh-plugin/tests` 只锁定 DSH 依赖的契约（牌阵列表、自包含的结果、`readingToken` 回放）。
   - ✅ `pnpm --filter <包> test` 绿。
2. **M1 — Host 工具跑通**：`tarot_draw` / `tarot_spreads` 可被 agent 调用，`output.render` 文本正确，`presentationMeta` 持久化结构化结果。
   - ✅ 在 `dsh web` 里问「用 tarot_draw 抽三张牌」，模型能抽牌 + 给出一段解读。
3. **M2 — Client 牌桌**：注册 `tool.call.toolview`，`tarot_draw` 调用显示自定义牌桌；翻牌、含义 tooltip、解读文本均从 `block` 派生。
   - ✅ `DSH_SNAPSHOT=replay pnpm run test:web` 过（replay 稳定）。
4. **M3 — 打包发布**：`bundle` 产出 `lib/client.js`；`dsh plugin add` 后能 dump-config 看到本包并启动。
   - ✅ 另一台干净 profile 里 `dsh --profile demo` 可用。
5. **M4 — 打磨**：动画、中英文案、失败态、空态、`tarot_spreads` 视图（可选）。

---

## 10. 风险与开放问题

1. **出仓 bundle 的构建链**（最大风险）：`lib/client.js` 的懒加载 factory 格式依赖 DSH 的 `tsdown` 预设。若插件在 DSH 主仓外，需要它作为 build 依赖或复制预设——这决定"第三方可安装插件"的可行性。**建议先在 DSH 主仓内以 in-tree 包跑通，再谈抽取为独立 bundle。**
2. **`ToolCallBlock` 的 `meta` 读取方式（已核实）**：`presentationMeta` 持久化到 `result.meta`，Client 侧从 `block.meta` 读取（`unknown` 类型，需本地校验）。已由 [web-card-model.ts](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-tool/src/client/tool/models/web-card-model.ts)（`block.meta`）与 [slots.ts](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-tool/src/client/contract/slots.ts)（`ToolCallOwnerProps.block: ToolCallBlock`）确认。
3. **牌面图资源**：已改为引用线上 `https://tarot.songhai.site/assets/`（引擎的 `publicBaseUrl`），不随 bundle 发布；代价是离线不可用、依赖该站点在线。
4. **出仓时的引擎依赖**：`dsh-plugin/src/engine.ts` 以相对路径引用 `../../mcp/engine`。在本仓内没问题；若迁入 DSH 主仓，需要让打包器把 `mcp/engine.ts` 与 `ground-truth.json` 内联进 Host 产物（或把引擎发布成独立包），不要再复制一份。
5. **翻牌"仪式感"的边界**：DSH 里 agent 是抽牌方，用户只翻牌。若你坚持要"用户自己抽牌决定结果"，那需要一条不同的产品路径（工具改为两段式 + 客户端回写），超出本方案范围，需单独讨论。

---

## 11. 参考文档索引

- 工具：[Build a tool](file:///Users/songhaifan/Developer/deepseek-harness/docs/user/develop/basic/tool.md) · [tool 编写参考](file:///Users/songhaifan/Developer/deepseek-harness/docs/cookbook/adding-a-tool.md) · [cordis-tutorial 07](file:///Users/songhaifan/Developer/deepseek-harness/docs/cordis-tutorial/07-into-the-harness.md)
- 客户端：[client-modules](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/modules/README.md) · [ui-tool](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-tool/README.md) · [ui-slots](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-slots/README.md) · [ui-skill 参考实现](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/ui-skill/src/client/index.ts)
- 纪律：[packages/client/AGENTS.md](file:///Users/songhaifan/Developer/deepseek-harness/packages/client/AGENTS.md)
- 发布：[Package and install a plugin](file:///Users/songhaifan/Developer/deepseek-harness/docs/user/develop/basic/publish.md)
- MCP 备选（零代码但体验割裂）：[mcp-client](file:///Users/songhaifan/Developer/deepseek-harness/packages/mcp/mcp-client/README.md)
