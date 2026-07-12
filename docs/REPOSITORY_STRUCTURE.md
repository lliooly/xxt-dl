# 仓库结构规划

当前仓库仍然是早期单体结构。为了支撑 GUI 完全化、本地题库、云托管 Telegram Bot、AI 和 RAG，后续会逐步向模块化结构迁移。

## 当前结构

```text
.
├── app/                  # Next.js 本地 Web 界面和 API
├── components/           # React UI 组件
├── src/
│   ├── browser.ts        # Playwright 页面读取与保存逻辑
│   ├── clean.ts          # 题目清洗与复习材料生成
│   ├── cli.ts            # CLI 入口
│   ├── core.ts           # 链接识别、课程匹配等通用逻辑
│   └── web/              # 本地 Web 任务服务和 API 边界
├── test/                 # Node 测试
├── docs/                 # 架构、路线和迁移文档
└── TODO.md               # 产品路线图和版本计划
```

## 目标结构

```text
.
├── app/                         # Next.js 本地 Web 页面和 Route Handlers
├── components/                  # 可复用 UI 组件
├── docs/                        # 架构、路线、云端和数据模型文档
├── src/
│   ├── collector/               # 学习通采集、登录态复用、课程和任务发现
│   ├── parser/                  # HTML / JSON 题目解析
│   ├── library/                 # SQLite、本地题库、去重、索引和迁移
│   ├── practice/                # 抽题、判题、错题和掌握度
│   ├── web/                     # 本地任务服务和 API 边界
│   ├── cloud/                   # 云同步、API client、远端数据模型
│   ├── integrations/            # Telegram Bot 等外部入口
│   ├── exporters/               # Markdown、HTML、JSON、CSV、Anki 导出
│   └── shared/                  # 通用类型、错误、日志和工具函数
├── test/
│   ├── collector/
│   ├── parser/
│   ├── library/
│   ├── practice/
│   └── integration/
└── TODO.md
```

## 迁移顺序

1. `types.ts` 迁移到 `src/shared/`，建立统一类型出口。
2. `clean.ts` 迁移到 `src/parser/`，让题目提取与格式化分离。
3. `core.ts` 中的课程匹配、链接识别拆入 `src/collector/` 和 `src/shared/`。
4. `browser.ts` 迁移到 `src/collector/`，保留兼容出口。
5. 新增 `src/library/`，接入 SQLite schema 和导入流程。
6. 新增 `src/practice/`，实现随机抽题和答题记录。
7. Web 层只通过模块 API 调用业务逻辑，不直接解析页面或写散落文件。
8. 云端和 Bot 相关代码进入 `src/cloud/` 和 `src/integrations/`，不污染采集和题库核心逻辑。

## 迁移规则

- 每次迁移必须保持旧命令可运行。
- 移动文件时保留短期兼容出口，减少一次性改动。
- 业务模块之间通过显式类型和函数调用连接，不共享隐式全局状态。
- GUI、CLI 和 Bot 都调用同一套 `library` / `practice` 能力。
- 云端代码不能直接依赖 Playwright 或本地浏览器 profile。
