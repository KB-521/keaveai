# 隔离式任务交付

实现前先判断风险和仓库规则。验收明确、局部、易回退且可针对性验证的低风险单项任务，允许时由主会话直接执行、自审和验证，不需要查找守门员，也不使用 `keaveai delivery`。提交和合并另看用户授权及仓库规则；若只在合并时要求守门员，不阻塞前面的实现与验证。

其余实现走下文的标准路径。KeaveAI 把标准路径的实现类任务交给独立的编码 agent；主会话负责分发、验收和编排交付。编码子 agent 数量不限，按原始验收范围分工。每个 worktree 单独配一个未参与该任务编码的审查兼交付 agent，只负责自己的审查、复审、提交和合并；不跨 worktree 共享，不另开验收或合并 agent。一个任务对应一个分支和一个 worktree，编码 agent 完成精简与自审后，由另一个 agent 审查固定的 Git 快照。只做需求、设计或只读评审时，不创建分支或 worktree。

## 在 Codex 中使用

先升级 KeaveAI。在已配置 Git 远端的项目根目录运行 `keaveai init`，选择 **GitHub** 或 **腾讯工蜂**、已存在的远端名称和目标分支，也可以跳过。老项目用 `keaveai git` 单独配置；`update` 只更新工作流资产。跳过链接也能用，默认只做本地合并。非交互示例：

```sh
keaveai init . --tools codex --git-provider github --git-remote origin --git-target main
keaveai git . --git-provider gongfeng --git-remote origin --git-target main
keaveai git --local  # 清除链接，保留已有 Git 远端和其他设置
```

设置保存在项目根目录的 `agent.config`；`init` 和 `link` 会补齐缺失的 `GITHUB_TOKEN=`、`GONGFENG_TOKEN=`，不生成示例文件。`init` 不会修改 Git 远端或访问托管服务。配置更新对新登记的任务生效，不改变已登记任务的发布目标。

初始化后重开 Codex。项目需具备可访问指定目录的原生子 agent 能力，以及目标分支上可用的工作流、`AGENTS.md` 和适用规则。若项目刚初始化，先按团队流程把这些基线文件纳入目标分支；交付流程不会把共享 clone 的未提交文件拷到 worktree。

在 **Codex 对话框**输入，例如：

```text
$req-dev 修复订单列表切换筛选后页码没有重置的问题；验收：切换后从第一页加载。
使用 agent.config 中的交付仓库。允许执行该模块的本地测试，只做本地交付，不推送。
```

如果要自动开 PR/MR，明确补充：`允许把通过审查的任务分支推送到 agent.config 指定的远端，并向配置的目标分支创建 PR/MR，不合并。` 发布前准备 Git 本身的凭据，再在本地且被 Git 忽略的 `agent.config` 填 `GITHUB_TOKEN` 或 `GONGFENG_TOKEN`，只填所用平台。配置文件未填值时回退到环境变量（GitHub 也支持 `GH_TOKEN`）。`init` 和 `link` 会把未跟踪的文件加入仓库本地忽略规则；文件已经被 Git 跟踪时，请保持令牌为空并改用环境变量。不要把令牌提交到仓库、写到命令参数或贴到对话中。仓库要求其他分支命名或 worktree 目录时，交给主会话使用 `--branch-prefix`、`--worktree-root`；不会默认套用某家公司的目录或审批角色。

| 角色 | 职责 |
| --- | --- |
| 主会话 | 读仓库规则，确认目标和边界，登记 worktree；核对改动范围，暂存并冻结候选快照；等待独立批准和验收，调度同一审查 agent 交付。 |
| 编码 agent | 仅在分配的 worktree 写代码；基于需求和真实契约实现，先找复用、去重和精简，再作者自审；返回实际验证证据。 |
| 审查 agent | 只读检查指定快照，独立比对原始需求、契约、代码和测试；有阻塞时退回给原编码 agent，不替作者修复；验收后由同一个 agent 用 CLI 提交并本地合并，或获授权发布。 |

标准路径如果环境不支持两个独立子 agent 或指定 worktree，流程停止在编排/说明阶段，不由主会话假扮两个角色。并行需求仍须先通过 `parallel-execute` 的 Ready、依赖和边界校验；每个子任务独立交付。合入同一条本地目标分支时，编码可并行，最终审查到合并串行：等前序合入，按仓库规则更新自己的基线并重新验证后再送审。审查 agent 从任务工作区提交，从登记的 `targetWorktree` 合并；重复执行合并时，CLI 会确认目标分支仍然包含已审批的提交。

## CLI 和验证记录

主会话负责编排以下步骤；正式提交、合并或发布由审查 agent 执行。`<worktree>`、`<base>`、`<tree>` 等来自上一阶段返回的真实值。

```sh
# 从共享 clone 登记任务；可重复列出允许的字面路径与必要上下文文件
keaveai delivery start fix-order-filter \
  --allow src/orders test/orders --context AGENTS.md docs/orders.md

# 编码完成后，按实际改动列出需要暂存的具体文件（不要无范围地暂存）
git -C <worktree> add -A -- src/orders/filter.ts test/orders/filter.test.ts
keaveai delivery snapshot fix-order-filter

# 只读审查 agent 从固定 tree 取证，而不是依赖会继续变化的工作区
git -C <worktree> --no-replace-objects diff --no-ext-diff --no-textconv --no-renames --ignore-submodules=none <base> <tree> --

# 独立审批结果与快照相符才提交；review JSON 放 worktree 外
keaveai delivery commit fix-order-filter --review <review.json> --message 'fix: reset order pagination'

# 本地任务：从发起任务的工作区、在原来的分支上运行
keaveai delivery merge fix-order-filter --confirm
# 工作流收尾：合并确认、源 worktree 不再使用后，移除该 worktree
keaveai delivery cleanup fix-order-filter --confirm

# 已链接的远端任务：仅在用户明确授权这个目标时
keaveai delivery publish fix-order-filter --title '修复订单筛选页码' --confirm
```

- 默认分支为 `keaveai/task/<task-id>`，worktree 放在共享 clone 的同级目录 `<clone>.keaveai-worktrees/<task-id>`；自定义 worktree 根目录必须已存在且在活跃 worktree 之外。
- [审查 JSON 模板](../keaveai-database/ai-workflow/skills/common/task-delivery/templates/review.json) 只用于记录真实的 agent 结果，不是自动审批凭证。CLI 校验任务、基线、tree、角色 ID 不同、审查结论和验证字段；独立身份与证据来自调度工具，不能由 CLI 单凭 JSON 认证。仓库钩子、受保护分支和远端审批仍是独立的约束。
- 通过/失败项附实际检查命令和结果证据；未运行附原因。当前快照有失败项时不能当作通过；缺少仓库强制验证时应该退回，不靠填「未运行」绕过。
- 按仓库规则在任务 worktree 安装依赖和必需钩子。提交和推送会运行仓库钩子；提交时 KeaveAI 在 Git 更新分支前校验实际提交的 tree 和父提交，不修改仓库的钩子配置。若钩子改了内容，分支不更新，改动保留用于重新暂存、验证与审查。旧审批不能用于别的 tree、基线或已改动的提交。
- 不需要配置链接或令牌就能做本地交付，但本地仓库需要有初始提交。`merge` 只把原工作区、原分支快进到审过的提交；有其他未保存的改动、切换了分支或目标已推进时不合并，不执行暂存、变基或推送。工作流默认由同一审查 agent 从原工作区运行 `cleanup --confirm`，移除已合并且不再使用的任务 worktree；用户要求保留或仓库规则要求额外授权时跳过；若目标不再包含已审批提交，或源 worktree 有改动、本地文件（包括 Git 忽略文件）或已锁定，则保留。不删除分支。
- `publish` 在推送前检查目标是否推进；发现推进就停止，不自动变基。该检查不锁远端目标，最终合并仍由远端审批与 CI 把关。按仓库规则，仅在**原任务 worktree、未推送、已保存改动**的条件下把任务改动放到核实后的新基线之上，且让 `HEAD` 指向该基线、任务改动留在暂存区。重读新基线的规则与任务文档，再用 `keaveai delivery snapshot <task-id> --refresh-base` 取得新的待审快照，重新验证、批准和提交。
- 代码交付支持 `github.com` 的 PR 和 `git.code.tencent.com` 的 MR，不支持独立 GitLab。确认新分支后调用对应的创建 API；只有返回可确认的请求链接或编号才标为 `opened`。`requested-unconfirmed`（退出码 `2`）表示分支已推，但 PR/MR 是否创建未确认；请到远端核对，不自动重推或重复创建。只在确认 MR 已关闭或合并后按仓库规则清理无未保存改动的任务 worktree。`keaveai issue` 仍用于同步初始化产物，与代码交付无关。
- 命令异常中断后如提示任务仍锁定，先确认锁记录的进程和 Git/钩子已停止，再核对本地分支、远端分支与 MR。只有确认是残留锁时，才手工移除 Git 公共目录下 `keaveai/delivery/<task-id>/lock`；不要重建或强推同一任务分支。
