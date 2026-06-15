# 架构规划

XXT DL 未来会从单体下载工具演进为多入口题库系统。桌面端负责用户主流程，云端负责移动训练入口，本地和云端通过清晰的数据模型连接。

## 目标形态

```text
学习通页面
  -> collector 采集课程、任务和页面
  -> parser 提取题目、选项、答案和来源
  -> library 写入本地题库
  -> practice 生成练习、判题和记录结果
  -> desktop 提供 GUI 操作入口
  -> cloud / integrations 提供 Telegram Bot 等移动训练入口
```

## 模块边界

| 模块 | 职责 | 不负责 |
| --- | --- | --- |
| `collector` | 登录态复用、课程发现、任务发现、页面抓取、调试快照 | 题目判定、练习记录、云端同步 |
| `parser` | 从 HTML / JSON 中提取结构化题目、答案和来源信息 | 浏览器自动化、数据库写入 |
| `library` | SQLite schema、题目去重、来源追踪、标签、导入导出索引 | Playwright 抓取、UI 展示 |
| `practice` | 抽题策略、答题判定、错题、收藏、掌握度 | 页面解析、云端鉴权 |
| `desktop` | Electron 主进程、preload、任务调度、GUI 状态 | 具体题目解析规则 |
| `cloud` | API、用户绑定、队列、云端题库同步、审计与删除 | 学习通登录态托管 |
| `integrations` | Telegram Bot、后续 Webhook / 邮件 / 其他聊天入口 | 直接访问学习通页面 |
| `exporters` | Markdown、HTML、JSON、CSV、Anki 等导出 | 主状态存储 |

## 数据主线

第一阶段以本地 SQLite 为主状态：

- `courses`：课程信息。
- `tasks`：作业、测验、考试等来源任务。
- `questions`：标准化题目。
- `question_options`：选项。
- `answers`：答案和解析。
- `question_sources`：题目与课程、任务、页面的多来源关系。
- `practice_sessions`：一次练习。
- `practice_answers`：单题作答记录。
- `tags` / `question_tags`：人工或 AI 生成的标签。

云端阶段不直接托管学习通登录态。桌面端负责采集和本地入库，用户明确开启云同步后，再把题库、练习记录或必要索引同步到云端。

## 云托管 Telegram Bot

云托管路线的目标是让用户在手机上直接刷题：

```text
Telegram 用户
  -> Telegram Bot
  -> Cloud API
  -> 题库 / 练习服务
  -> 返回题目、答案反馈、错题提醒
```

关键约束：

- 用户需要显式绑定 Telegram 账号。
- 云端只处理用户授权同步的数据。
- 云端不保存学习通 Cookie、浏览器 profile 或验证码状态。
- 题库同步、删除和导出必须有清晰入口。
- Bot 只做练习和复习，不做平台作业自动提交。

## 迁移策略

1. 保持现有 CLI、Electron 和导出能力可运行。
2. 先新增模块目录和文档，再迁移实现。
3. 每次迁移只移动一个边界，例如先移动题目清洗，再移动采集逻辑。
4. 每次迁移后运行 `npm run check`、`npm test` 和必要构建。
5. 等 GUI 覆盖核心流程后，再把 CLI 标记为开发者入口。
