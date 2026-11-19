# KeaveAI

KeaveAI 为 AI 编程助手提供规范驱动开发（SDD）工作流，帮助团队在同一个项目中管理需求、设计、实现和归档。

## 安装

需要 **Node.js 20.19.0 或更高版本**。通过 npm 全局安装：

```bash
node --version
npm install -g keaveai@latest
keaveai --version
```

也可以使用 `pnpm add -g keaveai@latest` 安装。升级 CLI 时，重新执行对应的安装命令即可。

## 快速开始

在项目根目录执行，以下以 Codex 为例：

```bash
cd /path/to/your-project
keaveai init . --tools codex
```

`init` 会将安装包内置的工作流复制到 `ai-workflow/`，并将入口技能安装到 `.codex/skills/`。如果要在终端里交互式选择 AI 工具，运行 `keaveai init`；如果只需要工作流文件，不安装工具技能，运行 `keaveai init . --tools none`。用 `keaveai help init` 查看可选工具。

初始化后，重新打开项目的 Codex 会话。下面的示例应输入 **Codex 对话框**，不是终端：

| 输入示例 | 用途 |
| --- | --- |
| `$init 初始化项目` | 生成或更新 `AGENTS.md`、业务文档、规则文档和技能索引。 |
| `$req-dev 为订单列表增加状态筛选，先梳理需求和验收标准` | 进入需求工作流；也可用 `$req-dev` 继续设计、实现或评审。 |
| `$archive add-order-status-filter` | 归档已完成的 SDD 变更包。将示例中的 ID 换成项目里的实际变更 ID。 |

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `keaveai init [path]` | 初始化项目；省略路径时使用当前目录。 |
| `keaveai update [path]` | 用本地内置数据库更新已初始化项目的工作流和已检测到的工具技能，不会拉取远程数据库。 |
| `keaveai break-change [path]` | 迁移旧目录结构，保留已有 SDD 到 `ai-workflow/sdd/`，同步 `.codex/skills/`。迁移会重建部分目录，并移除旧的 `AGENTS.md`；请先提交或备份自定义内容。 |
| `keaveai database-update [path] --repo <url>` | 从指定 Git 仓库刷新本地数据库资源，不会直接更新项目。 |
| `keaveai issue` | 将初始化生成的内容提交为 GitLab 合并请求（MR）；先用 `keaveai issue --dry-run` 预览。 |
| `keaveai help [command]` | 查看帮助，例如 `keaveai help init`。 |

### 更新项目工作流

升级 CLI 后，在已初始化的项目根目录执行 `keaveai update .`，把新版内置资源同步到项目。若要改用团队维护的数据库，先确认本机已安装 Git、能访问该仓库，再执行：

```bash
keaveai database-update --repo https://gitlab.example.com/team/keaveai-database.git --branch main
keaveai update .
```

请将示例 URL 替换成实际仓库地址。`database-update` 会整体替换目标数据库目录；不传 `[path]` 时，默认刷新当前 CLI 安装内的 `keaveai-database/`。不要把项目根目录作为数据库更新目标。
