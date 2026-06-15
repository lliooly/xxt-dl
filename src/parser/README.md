# Parser

负责从 HTML、页面片段或已导出的 JSON 中提取结构化题目、选项、答案和来源信息。

现有 `src/clean.ts` 中的题目提取逻辑会逐步迁移到这里；Markdown 格式化和导出逻辑后续应拆到 `src/exporters/`。
