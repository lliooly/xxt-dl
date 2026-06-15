# Library

负责本地题库主状态：SQLite schema、数据迁移、题目去重、来源追踪、标签和索引。

后续 GUI、CLI、练习系统和云同步都应通过这里读写题库，而不是直接读取散落的 Markdown 或 JSON 文件。
