---
name: task-delivery
description: 主会话分发编码至独立 worktree，先精简和作者自审，再由另一子 agent 审查固定快照，审过才提交，再按模式在本地合并或获授权创建 PR/MR。
version: 1.1.0
---

# 隔离式任务交付

进入代码实现、修复或重构阶段时使用；不影响只做需求、设计、解释或只读评审的请求。并行任务必须先通过 `common/parallel-execute` 的组别、依赖和范围门禁，每个子任务单独走本流程。单任务不需要构造并行组。

## 1. 主会话准备并分发

1. 主会话只做任务说明、路由、验收、Git 交付和状态记录，不直接编码。先读根和受影响子目录的 `AGENTS.md` 及对应的仓库规则（必须打开链接）；确认验收依据、改动边界及已完成的审批。先解决关键口径冲突。
2. 确认实际工具可启动至少两个独立子 agent，且能指定/访问任务 worktree（编码可写，审查只读）。例如 Codex 使用其原生子 agent 调度，等待工具返回该子 agent 的真实 ID 和结果。工具缺失、目录不可访问、CLI 不支持 `delivery` 或没有可用的 Git 分支及基线时，报告阻塞和计划，不由主会话代写、代审。
3. 以项目根目录 `agent.config` 的 `KEAVEAI_GIT_PROVIDER`、`KEAVEAI_GIT_REMOTE`、`KEAVEAI_GIT_TARGET` 为准。仅核对这三项，不读取或输出其他配置值；没有链接配置时默认本地交付，以发起任务时用户当前分支为目标；不猜远端，不擅自改配置。部分配置无效时请用户运行 `keaveai link` 修正或 `keaveai link --local` 清除。从用户发起任务的工作区调用：

   ```sh
   keaveai delivery start <task-id> \
     --allow <file-or-directory> --context <task-doc> <applicable-rule-doc>
   ```

   `--allow` 列出最小、字面量的仓库相对路径；`--context` 按实际存在的必读文件列出任务、契约和规则，可省略不存在的可选项。不要传本地私有 memory、密钥或整个目录。已初始化的流程文件和必需的仓库文档要对目标基线可见，不偷拷主工作区未提交内容。若仓库有指定的外部 worktree 目录或分支前缀，用 `--worktree-root` 或 `--branch-prefix`。任务 ID 需为小写 ASCII 字母、数字或连字符；重试复用返回的工作区和分支，不为同一任务另建。
4. 将 `start` 返回的工作区、分支、基线 SHA、上下文路径、原始验收条件、允许/禁止范围与测试权限发给 `implementation-executor` 子 agent。子 agent 首先核对工作区、分支和基线，按仓库要求准备依赖和必需钩子，仅在该 worktree 改代码，不提交、不推送、不另开分支。必需钩子未安装时报告阻塞，不自动扩大沙箱或权限。

## 2. 精简、自审、快照

1. 编码 agent 按 `ai-workflow/agent/implementation-executor.md` 实现、精简、作者自审，把证据和改动路径返回给主会话。主会话核对包括删除/重命名在内的范围，特别是 `--allow` 父目录中的禁止路径、敏感和无人授权的文件；**只暂存明确核对过的具体文件**（包括删除），不用无范围的 `git add -A`。
2. 执行 `keaveai delivery snapshot <task-id>`，取得 `base`、`tree`（Git tree 对象 ID）和文件清单。一旦送审，编码 agent 停止写入；有新改动必须重新暂存并取快照。
3. 启动另一个全新子 agent，加载 `ai-workflow/agent/review-executor.md`。交付固定快照和原始验收、规则、契约与验证记录；不能只转述作者结论。退回时把发现交给同一个编码 agent，在同一个 worktree 修复，再取新快照送审。

## 3. 审过才提交；按登记模式交付

1. 等到独立审查 agent 明确给出 `approved`，且回复中的 `taskId`、`base`、`tree` 与送审快照一致。主会话将**真实**工具返回的两个 agent ID、自审、验证和审查结论整理成 JSON（见 [review.json 模板](templates/review.json)），保存到任务 worktree 之外。不得自己补审批或捏造验证结果。失败项、缺失的必需验证或假设不清楚时先修复/确认。用户要求「不提交」则停在已审快照。
2. 运行 `keaveai delivery commit <task-id> --review <绝对路径> --message <提交说明>`。不绕过 Git 钩子，不直接用 `git commit` 绕过交付门禁。钩子改动或快照变化时停止，保留改动，重新自审和送审。目标变化不自动变基；需要按仓库规则更新基线并重新审查。
3. 若登记结果为 `mode: local`，默认在发起任务的工作区执行 `keaveai delivery merge <task-id> --confirm`，只快进到审过的提交、不推送；用户要求仅提交或不合并时停止。必须仍在原始目标分支，目标有未保存改动或已推进时报告阻塞，不自动暂存、变基或合并冲突。
4. 若登记结果为 `mode: remote`，用户**明确授权已登记的远端和目标对外发布**后才运行 `keaveai delivery publish <task-id> --title <标题> --confirm`。按任务登记时的设置创建 GitHub PR 或腾讯工蜂 MR。发布需已有 Git 凭据，以及进程环境中的 `GH_TOKEN`/`GITHUB_TOKEN` 或 `GONGFENG_TOKEN`；不读取或展示令牌值，只报告是否缺配置。不用 `keaveai issue`，不向目标分支推送，不执行合并或自动合并。
5. 区分 `merged-local`（已合并到本地目标分支）、`opened`（有 MR 链接）、`requested-unconfirmed`（分支已推、MR 未确认）和失败/未执行；未确认时查远端，不盲目重推或声称已开 MR。远端审批与 CI 由仓库处理。确认 MR 已合并或关闭后才按仓库规则清理，不删除其他任务或有未保存改动的 worktree。

## 最小报告

任务 ID／工作区／分支／基线；实际运行的两个 agent 与技能；验收对应实现/测试位置；自审与独立审查结论；检查命令及通过/失败/未运行；提交号和 MR 链接（没有就写原因和下一步）。
