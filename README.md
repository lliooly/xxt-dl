# xxt-dl

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/lliooly/xxt-dl?display_name=tag)](https://github.com/lliooly/xxt-dl/releases)

学习通（超星）作业与测验页面整理工具。项目使用 TypeScript、Playwright 和 Next.js，把当前账号可见的课程作业内容保存为 Markdown、HTML 和结构化 JSON，便于个人复习、搜索和归档。

> 本项目只读取当前登录账号在浏览器中已经有权限查看的页面，不绕过验证码、权限控制或平台限制。

## 功能特性

- **扫码登录：** 自动识别学习通二维码登录页，并把二维码保存到本地输出目录。
- **课程选择：** 支持从个人空间课程列表中选择课程序号或按关键词匹配课程。
- **作业整理：** 抓取作业、测验、考试等任务详情页，保存原始 HTML 和 Markdown。
- **题库清洗：** 从页面中提取题目、选项和正确答案，生成清洗后的复习材料。
- **本地 Web：** 提供扫码登录、课程选择、下载进度、运行日志和刷题练习界面。
- **本地优先：** 登录态、二维码和课程内容默认只保存在本机目录，不上传到远端服务。

## 项目状态

项目仍处于早期版本，主要面向个人学习资料整理场景。学习通页面结构可能调整，若出现无法识别课程或作业入口的情况，可以参考 [故障排查](#故障排查) 保存调试文件并提交 Issue。

## 发展路线

项目计划从「学习通作业与测验页面整理工具」逐步演进为 GUI 优先的题库归档、刷题训练与云端 Bot 练习系统。抓取能力会保留，但未来的核心会转向结构化题库、随机练习、错题复盘、AI 知识点分析和 RAG 知识库索引。

近期路线见 [TODO.md](./TODO.md)。架构和仓库结构规划见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 与 [docs/REPOSITORY_STRUCTURE.md](./docs/REPOSITORY_STRUCTURE.md)。

v1.0.0 前的重点：

- GUI 完整覆盖登录、同步、题库管理、随机刷题、错题和设置。
- CLI / TUI 锁定为开发者和自动化入口，不再承担普通用户主流程。
- 本地 SQLite 题库成为主状态，Markdown、HTML 和 JSON 作为导出产物。
- 支持云托管 Telegram Bot，让用户在手机端完成练习、答题反馈和错题提醒。
- AI 与 RAG 能力在题库和练习闭环稳定后逐步接入，并提供明确的隐私开关。

## 环境要求

- Node.js 20 或更高版本
- npm
- 可访问学习通的账号

源码模式首次安装依赖后，需要安装 Playwright 使用的 Chromium：

```bash
npm install
npx playwright install chromium
```

## CLI 使用

```bash
npm start
```

运行后会打开 Chromium，请按以下步骤操作：

1. 手动登录学习通。
2. 如果停留在二维码登录页，工具会把二维码保存为 `output/login-qr.png`，可使用学习通 App 扫码。
3. 登录后可以停留在个人空间课程列表页，也可以进入具体课程的作业、测验或任务列表页。
4. 如果当前页是课程列表，工具会列出课程，并提示输入课程序号或关键词。
5. 等待工具保存页面并生成汇总题库。

登录态默认保存在 `.xxt-profile/`，下次运行通常不需要重新登录。

### 常用参数

```bash
npm start -- --out review-notes
npm start -- --limit 3
npm start -- --course xxx
npm start -- --url https://i.chaoxing.com/
npm start -- --profile .xxt-profile
```

参数说明：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--out` | `output` | 输出目录 |
| `--limit` | 不限制 | 最多保存的作业 / 测验数量 |
| `--course` | 运行时选择 | 课程序号或课程关键词 |
| `--url` | `https://i.chaoxing.com/` | 启动后打开的页面 |
| `--profile` | `.xxt-profile` | Playwright 浏览器用户目录 |

如果已经抓取过 HTML，只想重新生成清洗版题库：

```bash
npm run clean
```

## 本地 Web 界面

普通用户和本地开发建议使用 Web 界面：

```bash
npm run web
```

然后在浏览器打开 <http://localhost:8263>。Web 界面保留完整的扫码登录、课程选择、作业整理和刷题练习流程。Playwright、登录态 `.xxt-profile/` 和题库输出 `output/` 都只保存在运行服务的本机。

同一时间只支持一个整理任务。关闭网页不会立即终止后台任务，重新打开页面可以恢复当前进度；需要停止时请点击页面中的「停止」。

生产模式可以使用：

```bash
npm run build
npm run web:start
```

## 输出文件

默认输出目录为 `output/`：

| 文件 | 说明 |
| --- | --- |
| `login-qr.png` | 学习通扫码登录二维码，仅在检测到二维码登录页时生成 |
| `login-qr.json` | 二维码 URL、uuid、失效状态等调试信息 |
| `assignment-links.json` | 本次发现的疑似作业 / 测验链接 |
| `course-links.raw.json` | 从当前页发现的原始课程入口 |
| `course-links.json` | 读取过标题的课程入口列表 |
| `manifest.json` | 已保存页面清单 |
| `*.html` | 原始页面正文 HTML |
| `*.md` | 便于复习和搜索的 Markdown |
| `*.clean.md` | 清洗后的题目和正确答案 |
| `*.questions.json` | 结构化题目数据 |
| `题库整理.md` | 所有作业合并后的复习版题库 |

## 本地开发

常用脚本：

```bash
npm run check
npm test
npm run build
```

脚本说明：

| 脚本 | 说明 |
| --- | --- |
| `npm run check` | 运行 TypeScript 类型检查 |
| `npm test` | 构建 Node 代码后运行测试 |
| `npm run build` | 构建 Node 代码和 Next.js Web 应用 |
| `npm run web` | 启动本地 Web 开发服务 |
| `npm run web:start` | 启动已构建的本地 Web 服务 |
| `npm start` | 构建 CLI 并启动命令行模式 |
| `npm run clean` | 重新生成清洗后的输出内容 |

## 项目结构

```text
.
├── app/                  # Next.js 本地 Web 界面和 API
├── components/           # UI 组件
├── docs/                 # 架构、路线和仓库结构规划
├── src/
│   ├── collector/        # 未来采集模块边界
│   ├── parser/           # 未来题目解析模块边界
│   ├── library/          # 未来本地题库模块边界
│   ├── practice/         # 未来刷题练习模块边界
│   ├── cloud/            # 未来云同步模块边界
│   ├── integrations/     # 未来 Telegram Bot 等集成入口
│   ├── exporters/        # 未来导出模块边界
│   ├── shared/           # 未来共享类型与工具边界
│   ├── web/              # 本地 Web 任务服务和 API 边界
│   ├── browser.ts        # Playwright 页面读取与保存逻辑
│   ├── clean.ts          # 题目清洗与复习材料生成
│   ├── cli.ts            # 命令行入口
│   └── core.ts           # 链接识别、课程匹配等核心逻辑
├── test/                 # Node 测试
└── TODO.md               # 版本路线图和待办清单
```

后续源码会逐步迁移到 `collector`、`parser`、`library`、`practice`、`cloud`、`integrations`、`exporters` 和 `shared` 等模块，迁移计划见 [docs/REPOSITORY_STRUCTURE.md](./docs/REPOSITORY_STRUCTURE.md)。

## 隐私与安全

请不要提交以下本地目录：

- `.xxt-profile/`：Playwright/Chromium 的本地浏览器用户目录，可能包含 cookies、登录态和浏览记录。
- `output/`：下载后的课程、作业和题库内容，可能包含课程资料、题目、答案或个人学习内容。

这些目录已经写入 `.gitignore`。推送到 GitHub 或其他远端前，建议运行：

```bash
git status --ignored
```

## 使用边界

- 请只保存自己账号有权限查看的课程内容。
- 请遵守学校、课程平台和课程教师对资料使用、传播和版权的要求。
- 本工具不绕过验证码、权限控制或隐藏答案。
- 输出内容仅建议用于个人复习和归档，不建议公开传播课程资料或题目答案。

## 故障排查

如果终端提示「没有在当前页面发现疑似作业链接」，工具会在输出目录生成以下调试文件：

- `debug-page.json`：当前页面、iframe、候选链接和被过滤原因线索。
- `debug-page.html`：当前页面 HTML。
- `debug-page.png`：当前页面截图。
- `course-links.raw.json`：当前页发现的原始课程入口。
- `course-links.json`：读取过标题的课程入口列表。

常见原因：

- 当前页面不是作业、考试或测验列表页。
- 课程入口位于学习通特殊脚本或 iframe 中，当前规则没有识别。
- 学习通调整了页面结构。

可以先手动进入某一个具体作业 / 测验详情页，再重新运行。如果仍然失败，提交 Issue 时请附上 `debug-page.json` 和 `course-links.json`，并注意先移除个人信息、课程隐私内容和登录态信息。

## 贡献

欢迎提交 Issue 和 Pull Request。建议在提交前完成以下检查：

```bash
npm run check
npm test
npm run build
```

如果修改了页面识别、题目清洗或课程匹配逻辑，请尽量补充对应测试，并在 PR 中说明使用的页面场景。

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。
