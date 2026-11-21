# 术士之战 — Warlock Brawl

魔兽争霸 3 经典自定义 RPG《术士之战》的网页版：岩浆缩圈竞技场、击退弹射物理、六大经典法术、符文商店升级与多流派 AI 术士锦标赛。

**在线体验：** https://hana-ame.github.io/warlock-brawl/

## 两个版本，同一个仓库

| 路径 | 版本 | 说明 |
|---|---|---|
| `/` | 选择页 | 根路径放了一张选择页，两个版本各一张卡片 |
| `/app/` | 重制版（React 19 + Vite） | 源码在 `app/`，全量重制 UI、粒子特效、商店与 HUD |
| `/classic/` | War3 RPG 单文件版 | 源码是 `classic/index.html`，自包含、零外部依赖、打开即玩 |

两个版本的内核规则一致，只是呈现与体量不同。

## 本地开发

```bash
cd app
bun install      # 或 npm install
bun run dev      # http://localhost:3000
```

单文件版无需构建，浏览器直接打开 `classic/index.html` 即可。

`.env.example` 里的 `GEMINI_API_KEY` 是 AI Studio 模板文案，两个版本都没有调用任何 API，纯前端运行。

## 部署

由 GitHub Actions 自动发布，本地不需要构建（Pages 发布源为 **GitHub Actions**，不使用 `gh-pages` 分支）：

1. `app/` 里 `bun install` + `bun run build`
2. 组装站点：根 `index.html` + `app/dist` → `/app/` + `classic/index.html` → `/classic/`
3. 上传并发布

推送 `main` 或手动 `Run workflow` 即触发：

```bash
git add -A && git commit -m "your change" && git push origin main
```

> 原始压缩包里的 `bun.lock` 是 0 字节的空文件，会让 `--frozen-lockfile` 失败，已移除；CI 直接按 `package.json` 解析依赖。
