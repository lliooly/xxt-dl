# Source Layout

`src/` 当前仍保留早期实现文件。后续会按 `docs/REPOSITORY_STRUCTURE.md` 逐步迁移为模块化结构。

## 迁移目标

- `collector/`：学习通采集、登录态复用、课程和任务发现。
- `parser/`：题目、选项、答案和来源解析。
- `library/`：SQLite、本地题库、去重、索引和迁移。
- `practice/`：随机抽题、判题、错题和掌握度。
- `web/`：本地 Web 任务服务和 API 边界。
- `cloud/`：云同步、API client 和远端数据模型。
- `integrations/`：Telegram Bot 等外部训练入口。
- `exporters/`：Markdown、HTML、JSON、CSV、Anki 等导出。
- `shared/`：通用类型、错误、日志和工具函数。

新增功能应优先放进对应模块；旧文件会在测试覆盖下逐步迁移。
