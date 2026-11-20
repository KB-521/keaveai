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

`init` 会将安装包内置的工作流复制到 `ai-workflow/`，并将入口技能安装到 `.codex/skills/`。在已有 Git 远端的项目里，运行 `keaveai init` 可交互选择 AI 工具、Git 平台（GitHub 或腾讯工蜂）、远端和目标分支；Git 设置写入本地 `agent.config`，并预留 `GITHUB_TOKEN=` 和 `GONGFENG_TOKEN=`；不再生成示例文件。如果只需要工作流文件，不安装工具技能，运行 `keaveai init . --tools none`。用 `keaveai help init` 查看可选工具。

初始化后，重新打开项目的 Codex 会话。下面的示例应输入 **Codex 对话框**，不是终端：

| 输入示例 | 用途 |
| --- | --- |
| `$init 初始化项目` | 生成或更新 `AGENTS.md`、业务文档、规则文档和技能索引。 |
| `$req-dev 为订单列表增加状态筛选，先梳理需求和验收标准` | 进入需求工作流；实际进入实现时，主会话分发到独立 worktree，由编码与审查子 agent 交付。 |
| `$archive add-order-status-filter` | 归档已完成的 SDD 变更包。将示例中的 ID 换成项目里的实际变更 ID。 |

### 代码任务怎么交付？

进入实现阶段后，`$req-dev` 使用**一个任务、一个分支、一个 worktree**。编码 agent 先精简和自审，另一个 agent 审查固定快照；审过才提交。未链接远端的项目默认在本地快进合并到任务发起时的分支；已链接项目只在明确授权后推送任务分支并创建 GitHub PR 或腾讯工蜂 MR，不做远端合并。适用条件、示例和检查结果说明见 [隔离式任务交付](docs/task-delivery.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `keaveai init [path]` | 初始化项目；省略路径时使用当前目录。 |
| `keaveai update [path]` | 用本地内置数据库更新已初始化项目的工作流和已检测到的工具技能，不会拉取远程数据库。 |
| `keaveai break-change [path]` | 迁移旧目录结构，保留已有 SDD 到 `ai-workflow/sdd/`，同步 `.codex/skills/`。迁移会重建部分目录，并移除旧的 `AGENTS.md`；请先提交或备份自定义内容。 |
| `keaveai database-update [path] --repo <url>` | 从指定 Git 仓库刷新本地数据库资源，不会直接更新项目。 |
| `keaveai issue` | 将初始化生成的内容提交为 GitLab 合并请求（MR）；先用 `keaveai issue --dry-run` 预览。 |
| `keaveai link [path]` | 单独配置 GitHub 或腾讯工蜂远端；`--local` 清除链接，切换为本地交付。 |
| `keaveai delivery` | 登记任务 worktree、审查和提交，按配置走本地合并或远端 PR/MR。 |
| `keaveai help [command]` | 查看帮助，例如 `keaveai help init`。 |

## 已初始化的项目怎么升级？

升级 CLI 不会自动更新各个项目。项目已经有 `ai-workflow/` 时，不用重新 `init`；先提交或备份自定义文件，再在项目根目录运行：

```bash
keaveai update .
```

也可以在任意目录运行 `keaveai update /path/to/old-project`。更新会同步 CLI 内置的工作流和已检测到的工具技能，不拉取远程数据库。若你改过与默认资源同路径的文件，更新后用 `git diff` 检查。**如果还在用 `1.2.6`，请先升级到 `1.2.7` 或更新版本再执行 `update`**，以免旧版清理误删自建后端技能或团队规则。

如果待迁移的需求文档还在旧的 `keaveai/sdd/`，请先备份，再执行一次 `keaveai break-change .`。它会把 SDD 迁到 `ai-workflow/sdd/`，但会重建部分工具目录并移除旧的 `AGENTS.md`。已使用新目录结构的项目不需要这一步。

### 使用团队维护的数据库

若要改用团队维护的数据库，先确认本机已安装 Git、能访问该仓库，再执行：

```bash
keaveai database-update --repo https://gitlab.example.com/team/keaveai-database.git --branch main
keaveai update .
```

请将示例 URL 替换成实际仓库地址。`database-update` 会整体替换目标数据库目录；不传 `[path]` 时，默认刷新当前 CLI 安装内的 `keaveai-database/`。不要把项目根目录作为数据库更新目标。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
