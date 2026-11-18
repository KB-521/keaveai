| 命令 | 作用 | 常用示例 |
| --- | --- | --- |
| init [path] | 初始化项目 | keaveai init . --tools codex --force |
| update [path] | 用内置数据库更新项目内容 | keaveai update . |
| break-change [path] | 迁移到最新目录结构，保留 SDD 并同步 .codex/skills | keaveai break-change . |
| database-update [path] | 从 GitLab 刷新本地内置数据库 | keaveai database-update |
| issue | 将 init 生成内容提交为 GitLab MR | keaveai issue |
| help [command] | 查看帮助 | keaveai help init |

更新 keaveai-database: 执行 keaveai database-update 更新本地 keaveai-database
