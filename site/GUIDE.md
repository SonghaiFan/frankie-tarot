# Introduction page maintenance / 介绍页维护

[English README](../README.md) · [中文 README](../README.zh-CN.md)

## Two destinations / 两个入口

- Introduction / 介绍页: https://songhaifan.github.io/frankie-tarot/
- App / 应用: https://tarot.songhai.site
- The introduction is a standalone static site. It never builds the app or reads environment files. / 介绍页独立构建，不构建应用，也不读取环境变量文件。
- English is the default; `zh/` is the Chinese version. / 英文默认，中文位于 `zh/`。

## Files to update / 更新哪些文件

| Source / 来源 | What it shows / 内容 |
| --- | --- |
| `site/assets/aura-home.png` | The current Aura homepage. |
| `site/assets/library.png` | The card library with Dreamy Aura, Modern Arcana and Historic packs. |
| `site/assets/spreads.png` | Question and spread selection before the manual draw. |
| `docs/readme/assets/fool.webp` | Current Dreamy Aura Fool and Star artwork alongside a live capture of the updated app aura. |
| `docs/readme/assets/aura.png` | Current Dreamy Aura Fool and Star artwork alongside a live capture of the updated app aura. |
| `docs/readme/assets/star.webp` | Current Dreamy Aura Fool and Star artwork alongside a live capture of the updated app aura. |
| `site/assets/demo.gif` | Recorded Aura homepage animation. |

- `../README.md` and `../README.zh-CN.md`: product introduction, features, setup, limitations and developer commands. Update both languages together. / 同步维护双语介绍、功能、运行步骤与限制。
- `project.json`: app URL, repository, category, colors, three user steps and the ordered media list. / 应用链接、仓库、分类、颜色、使用步骤与有序素材列表。
- `style.css`: this app's visual treatment within the shared layout. / 统一结构下的项目视觉风格。
- `build.py`: portable standard-library renderer. / 可独立使用的 Python 标准库构建器。

## Replacing screenshots and GIFs / 替换截图和动图

1. Run the current app and capture real, settled UI. Use synthetic or guest data; hide credentials and private content. For GIFs, record a real interaction from start to finish, rather than animating a static screenshot. / 运行当前版本，使用访客或示例数据采集稳定画面；GIF 应录制真实操作，不把静态图伪装成操作录像。
2. Replace the corresponding source file above when its screen changes. These banner assets are shared with the README; replacing them may update both the banner and this page. Keep `docs/readme/source-version.json` and banner provenance accurate. / 界面变化后替换对应文件；共享素材会同时影响 banner，需同步更新来源记录。
3. For a new screen or GIF, add it under `site/assets/` and add an entry to `project.json` → `media` with `src`, bilingual `caption`, and optionally `captured_on` / `source_revision`. The first item is the hero; the full list is the gallery. Use a GIF's first frame as an informative resting frame, keep files small, and provide a still alternative. / 新素材放到 `site/assets/`，登记双语说明、采集时间和版本；第一项为主图，其余进入画廊。GIF 应有可读首帧并保留静态替代图。
4. If app behavior changes, update both READMEs and both `steps` arrays. Native screenshots and shared family artwork must be labelled honestly. / 行为变化时同步更新双语 README 和使用步骤；区分原生截图与系列共享素材。
5. Build and inspect desktop and mobile, in both languages. Check the app link and every image. / 构建后检查桌面、手机和两种语言，验证链接与所有图片。

```sh
python3 site/build.py
python3 -m http.server 8080 --directory _site --bind 127.0.0.1
```

Open http://127.0.0.1:8080/ and http://127.0.0.1:8080/zh/.

## Publishing / 发布

Push the reviewed page changes to `main`. `.github/workflows/pages.yml` publishes only `_site/` to GitHub Pages. App deployment remains separate on Vercel for browser apps; API services and native/local apps retain their own runtime. Never include `.env` files or unrelated work in a page commit. / 推送审核后的页面改动到 `main`，工作流只发布 `_site/`；应用与 API 的部署分别管理，勿提交环境变量文件或其他未完成代码。

If the branch or repository owner changes, update `project.json`, the workflow branch and README introduction links. / 分支或仓库所有者变化时，同步修改配置、工作流与介绍页链接。

## App signature / 应用签名

The app already has its own Frankie signature; preserve its existing component and placement. / 应用已有 Frankie 签名，保留现有组件与位置。
