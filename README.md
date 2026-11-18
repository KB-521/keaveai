| 命令 | 作用 | 常用示例 |
| --- | --- | --- |
| init [path] | 初始化项目 | weaveai init . --tools codex --force |
| update [path] | 用内置数据库更新项目内容 | weaveai update . |
| break-change [path] | 迁移到最新目录结构，保留 SDD 并同步 .codex/skills | weaveai break-change . |
| database-update [path] | 从 GitLab 刷新本地内置数据库 | weaveai database-update |
| issue | 将 init 生成内容提交为 GitLab MR | weaveai issue |
| help [command] | 查看帮助 | weaveai help init |

更新 weaveai-database: 执行 weaveai database-update 更新本地 weaveai-database
