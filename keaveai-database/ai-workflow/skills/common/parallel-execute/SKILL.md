---
name: parallel-execute
description: 基于父需求 INDEX.md 的 Ready 并行组，校验并行边界、任务基线可见性和 worktree 隔离，并编排当前 AI 编程工具的 worker/subagent 并行执行。用户要求并行执行任务组时使用。Codex 只是可选实现之一，不是唯一门禁。
version: 1.8.0
---

# 并行执行编排

## 目标

- 将 `ai-workflow/sdd/changes/<change-id>/tasks/<parent-req>/INDEX.md` 中的 Ready 并行组转换为可执行的隔离 worker 队列。
- 主会话只负责编排、校验、启动、等待和汇总交付，不直接实现业务代码。
- 每个正式子任务必须通过 `ai-workflow/skills/common/task-delivery/SKILL.md` 使用独立分支、worktree 和审查闭环；临时 fork 不能代替正式 worktree。
- 使用当前会话中的 AI 编程工具启动 worker/subagent；Codex、Cursor、Claude 等都可以作为实现，不得把单一工具写成唯一入口。

## 适用场景

- 用户明确要求并行执行某个任务组。
- 父需求 `INDEX.md` 中存在 `Ready` 状态的并行组。
- 每个子任务已有任务文档，并写明 `并行执行边界`、`改动边界`、依赖、允许修改范围和禁止修改范围。

## 输入

- `change-id`。
- 并行组 ID，例如 `G1`、`G2`。
- 根任务索引：`ai-workflow/sdd/changes/<change-id>/tasks/INDEX.md`，用于定位父需求入口。
- 父需求索引：`ai-workflow/sdd/changes/<change-id>/tasks/<parent-req>/INDEX.md`，用于读取并行组、子任务状态和边界。
- 并行组内每个子任务文档。
- 任务基线：根任务索引、父需求索引、子任务文档、依赖设计文档、共享契约文档或拆分说明。
- 设计基线若采用分包目录，必须包含根 `design/INDEX.md`、命中的 `design/<design-package>/INDEX.md` 和具体设计文档。

## 执行模式

- 正式并行执行：默认模式。每个 worker 绑定独立 worktree，并只修改自己的允许范围。
- 编排计划：用户只要计划、环境不支持 subagents，或门禁失败时使用；只输出命令、worker prompt 和阻塞说明。
- 流程测试 fallback：仅用于验证流程或用户明确接受临时验证；必须说明这不是正式业务并行模式。

## 执行流程

1. 读取根 `tasks/INDEX.md` 定位父需求入口，再读取父需求 `INDEX.md` 定位用户指定并行组。
2. 确认并行组状态为 `Ready`，否则停止。
3. 读取组内子任务文档，提取依赖、允许修改范围和禁止修改范围。
4. 校验每个子任务是否包含 `并行执行边界` 与 `改动边界`。
5. 检查允许修改范围是否重叠：
   - 无重叠：允许并行。
   - 有重叠但存在共享契约任务：先执行共享契约任务，再并行下游任务。
   - 有重叠且没有共享契约任务：禁止并行，要求重新拆分或收窄边界。
6. 汇总根/父/子任务、适用规则和设计/契约文件，作为每个子任务的 `--context`。
7. 依 `task-delivery` 为本轮无未满足依赖的子任务登记各自的 `keaveai delivery start`，传入 `--allow`，沿用已链接的共同远端目标，或未链接时从同一个原工作区登记到共同的本地分支；有共享契约依赖的下一轮，等契约进入目标后再登记。全部基线 SHA 一致、上下文匹配后再开始并行。基线漂移时停止，不混用版本；可按仓库规则在原 worktree 更新干净的任务分支并用 `snapshot --refresh-base` 重新登记基线。
8. 按 `templates/worker-prompt.md` 分别调度编码子 agent；不得修改共享 clone 或其他 worker worktree。依赖共享契约的子任务等契约纳入共同基线并可读后再启动。
9. 每个 worktree 分别走精简、作者自审、独立审查、按授权提交和交付。多个本地任务不得直接把同基线的分支强行合入；前一个任务合并后，后续任务要按新的目标基线重新审查。主会话核对整个组的边界及集成风险，汇总交付状态，不把未审改动直接集成进共享分支。
10. 本地测试按 `task-delivery` 的权限边界；独立审查是交付门禁，不自动触发无关外部 CI 或额外正式评审。

## 硬门禁

- Gate 1：并行组不存在或不是 `Ready`，禁止启动。
- Gate 2：任一子任务缺少 `并行执行边界`，禁止启动。
- Gate 3：任一子任务缺少 `改动边界`，禁止启动。
- Gate 4：允许修改范围重叠且没有共享契约任务，禁止并行。
- Gate 5：主线程不得直接实现业务代码。
- Gate 6：不运行未获授权的测试或 CI；各子任务的独立审查不能跳过。
- Gate 7：已判定为并行执行意图且运行环境支持 subagents 时，禁止退化为主线程串行实现。
- Gate 8：每个 worker 必须声明“不是唯一执行者”，并严格遵守自己的 `改动边界`。
- Gate 9：任务基线未对每个目标 worktree 可见，禁止启动 worker。
- Gate 10：正式业务并行中，每个 worker 必须绑定独立 worktree；未绑定时只能作为流程测试 fallback。
- Gate 11：正式子任务须有 `keaveai delivery start` 注册的 worktree 和相同的可见基线；不得使用绕过登记/审查门禁的命令。

## 按需读取

- 准备 worktree 命令时读 `templates/worktree-commands.md`。
- 生成 worker 初始任务时读 `templates/worker-prompt.md`。
- 输出编排结果或计划时读 `templates/output-report.md`。

## 完成标准

- 并行组状态、依赖、边界和任务基线可见性已校验。
- 每个正式 worker 都有独立 worktree、明确允许范围和禁止范围。
- 已输出启动顺序、每个 worker 的验证/审查/提交/MR 状态、集成注意事项和阻塞说明。
- 若门禁失败，停止执行并给出需要用户或任务拆分阶段处理的具体原因。
