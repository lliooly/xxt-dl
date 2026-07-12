# Electron 完全移除设计

## 目标

从 XXT DL 中彻底移除 Electron 运行时、源码、依赖、构建、打包、自动更新、发布流程、测试和文档，只保留本地 Web、CLI 与 Playwright 采集能力，为后续 Rust + Tauri 重构建立干净基线。

## 保留能力

- Next.js 本地 Web 界面与 API。
- Playwright 登录、课程发现、作业采集、题目清洗和导出。
- CLI 与清洗命令。
- 本地题库刷题能力。
- 与 Web、CLI、Playwright 直接相关的测试和发布无关脚本。

## 迁移边界

当前 Web 任务服务仍依赖 `src/desktop/downloader.ts`。该文件本身不调用 Electron，只是名称和位置属于旧桌面边界。本次将其迁移为 `src/collector/download-job.ts`，并把 `Desktop*` 类型重命名为中性的 `Download*` 类型。

迁移后的调用关系：

```text
Web UI -> Next.js API -> collector/download-job -> Playwright
CLI -> 现有 CLI / collector -> Playwright
```

迁移完成后删除 `src/desktop/` 的其余文件以及 `app/window.d.ts`。

## 删除范围

- `electron`、`electron-builder`、`electron-updater` 依赖。
- Electron main、preload、IPC、自动更新、release markdown 和桌面更新状态源码。
- Electron 构建、启动、打包和跨平台安装包脚本。
- `electron-builder.yml`。
- 仅服务桌面安装包、自动更新或 Electron release 的 GitHub Actions、release 配置、脚本和测试。
- Electron 专属图标派生物与打包资源；若 Web 不使用则删除。
- 所有 Markdown 中把 Electron 描述为当前入口、模块、约束或发布目标的内容。

## 文档处理

逐个扫描仓库中的 `*.md`：

- README 改为 Web/CLI/Playwright 使用说明。
- TODO、架构和仓库结构规划改为 Web 优先，并将未来桌面壳描述为 Rust + Tauri 方向；不添加实现占位代码。
- 删除 Electron 自动更新测试说明或改写为不再适用的迁移记录；优先删除无当前价值的专属文档。
- 更新模块 README 和此前 Web 迁移规格/计划中的兼容措辞。
- 最终现行 Markdown 不保留 Electron 运行、打包、依赖或模块说明。

## 验收标准

- `rg -i electron` 在现行源码、配置、脚本、测试和 Markdown 中无匹配。
- `package.json` 与 `package-lock.json` 不包含 Electron 生态依赖。
- `src/desktop/`、`app/window.d.ts`、`electron-builder.yml` 和专属发布资产不存在。
- `npm run check`、`npm test`、`npm run build` 全部通过。
- `npm run web`、`npm run web:start`、`npm start` 仍保留。
- Web 下载任务测试继续覆盖单任务、选课、停止和错误状态。
- 不引入 Rust、Tauri 或新的桌面占位实现。
