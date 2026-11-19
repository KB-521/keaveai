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

### `init` 后面的 `[path]` 怎么填？

`[path]` 是要初始化的**本地目录**，方括号不用输入。可以省略，也可以指定相对路径或绝对路径。目标目录不存在时会创建；已有文件不能作为目标。不支持从 Git 仓库 URL 初始化，请先克隆，再传本地目录。

| 写法 | 初始化位置 |
| --- | --- |
| `keaveai init` 或 `keaveai init .` | 当前目录。 |
| `keaveai init ./my-project` | 当前目录下的 `my-project`。 |
| `keaveai init ../my-project` | 当前目录上一级里的 `my-project`。 |
| `keaveai init /Users/me/projects/my-project` | 指定的绝对路径。 |
| `keaveai init "$HOME/projects/My Project"` | 用户主目录下的项目；路径里有空格时加引号。 |

路径后可跟选项，例如 `keaveai init ./my-project --tools codex`。`--tools codex` 安装 Codex 入口技能，`--tools none` 只安装工作流，`--tools all` 安装所有当前支持的工具（目前只有 Codex）。省略路径也可以直接写 `keaveai init --tools codex`。其他选项见 `keaveai help init`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `keaveai init [path]` | 初始化项目；省略路径时使用当前目录。 |
| `keaveai update [path]` | 用本地内置数据库更新已初始化项目的工作流和已检测到的工具技能，不会拉取远程数据库。 |
| `keaveai break-change [path]` | 迁移旧目录结构，保留已有 SDD 到 `ai-workflow/sdd/`，同步 `.codex/skills/`。迁移会重建部分目录，并移除旧的 `AGENTS.md`；请先提交或备份自定义内容。 |
| `keaveai database-update [path] --repo <url>` | 从指定 Git 仓库刷新本地数据库资源，不会直接更新项目。 |
| `keaveai issue` | 将初始化生成的内容提交为 GitLab 合并请求（MR）；先用 `keaveai issue --dry-run` 预览。 |
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

## 维护者：本地发布 npm

在源码仓库运行 `pnpm release:local`，选择或输入版本号，确认后自动构建、打包并发布。只验证打包可运行 `pnpm release:local --dry-run`。登录和发布说明见 [scripts/README.md](scripts/README.md)。
