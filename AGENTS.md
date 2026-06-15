# AGENTS.md

本文件给在本仓库中工作的 AI agent 使用。请在改动前先阅读 README、TODO 和 docs 中的规划，再决定如何落地。

## 项目定位

XXT DL 正在从「学习通作业与测验页面整理工具」演进为「GUI 优先的题库归档、刷题训练与云端 Bot 练习系统」。

短期重点：

- 保持现有抓取、清洗、导出、CLI 和 Electron 桌面端可用。
- 建立本地 SQLite 题库，沉淀课程、任务、题目、答案、来源和练习记录。
- 完成 GUI 主流程，让普通用户不依赖终端。
- 后续扩展云托管 Telegram Bot、AI 知识点分析和 RAG 知识库索引。

## 重要文档

- `README.md`：当前功能、运行方式和用户说明。
- `TODO.md`：版本路线图和待办清单。
- `docs/ARCHITECTURE.md`：目标架构、模块边界和云端约束。
- `docs/REPOSITORY_STRUCTURE.md`：仓库结构规划和迁移顺序。

## 模块边界

后续源码按以下模块演进：

- `src/collector/`：学习通采集、登录态复用、课程和任务发现。
- `src/parser/`：题目、选项、答案和来源解析。
- `src/library/`：SQLite、本地题库、去重、索引和迁移。
- `src/practice/`：随机抽题、判题、错题和掌握度。
- `src/desktop/`：Electron 主进程、preload 和 GUI 任务调度。
- `src/cloud/`：云同步、API client 和远端数据模型。
- `src/integrations/`：Telegram Bot 等外部训练入口。
- `src/exporters/`：Markdown、HTML、JSON、CSV、Anki 等导出。
- `src/shared/`：通用类型、错误、日志、hash 和工具函数。

当前仍有早期文件留在 `src/browser.ts`、`src/clean.ts`、`src/core.ts` 和 `src/cli.ts`。迁移时应保持兼容出口，避免一次性重排导致 CLI、Electron 或测试失效。

## 工作规则

- GUI 是普通用户主入口；CLI / TUI 只作为开发、调试和自动化入口。
- 抓取结果未来应进入结构化题库；Markdown、HTML、JSON 是导出物，不应长期作为主状态。
- 云端和 Bot 代码不能直接依赖 Playwright、Electron 或本地浏览器 profile。
- 云端不得保存学习通 Cookie、验证码状态或浏览器登录态。
- 不实现自动提交学习通作业或考试答案。
- 不绕过验证码、权限控制或隐藏答案。
- 不在没有用户明确授权的情况下上传课程内容、题库或练习记录。

## 修改建议

- 文档和规划类改动优先更新 `TODO.md`、`docs/` 和 README 中的入口说明。
- 新业务能力优先放进目标模块目录；旧文件迁移要小步进行。
- 移动源码前先补或确认测试，移动后保留兼容导出，最后再清理旧入口。
- 桌面端应调用模块 API，不要把解析、题库或练习逻辑写死在 React 页面里。
- Telegram Bot 等集成层只调用 `library`、`practice` 和 `cloud`，不要直接抓取学习通页面。

## 常用命令

```bash
npm run check
npm test
npm run build
```

改动验证建议：

- 文档或配置改动：至少运行 `git diff --check` 和 `npm run check`。
- 业务逻辑改动：运行 `npm run check`、`npm test`，必要时运行 `npm run build`。
- Electron / Next.js / 打包相关改动：运行 `npm run build`，并尽量手动检查桌面端。
- 发布流程改动：检查 `.github/workflows/package.yml`、`.github/release-intro.md` 和 `.github/release.yml`。

## 提交规范

提交信息使用中文 Conventional Commits：

```text
docs(规划): 添加题库系统路线图
feat(题库): 添加 SQLite 题目入库流程
fix(采集): 修复课程链接识别失败的问题
ci(发布): 优化 GitHub Release 说明生成
```

提交前确认：

- `git status --short` 中没有意外文件。
- 没有提交 `.xxt-profile/`、`output/`、`release/` 或个人课程资料。
- 已运行与改动范围匹配的验证命令，并在最终回复中说明结果。
