---
name: req-dev
description: AI 任务统一入口；实现类任务由主会话分发到独立 worktree，经编码、自审和独立审查后交付。
version: 1.7.0
---

# 目标

统一所有任务的入口编排，确保每次先加载 Memory，并通过 Router 选中且加载目标 Agent。

# 何时使用

- 任意需求、设计、实现、评审、记录类任务。

# 强制执行流程（必须按顺序）

```
User Task
  -> Load Memory(ai-workflow/memory/INDEX.md -> indexed files)
  -> Route & Load Agent(ai-workflow/agent/phase-router.md -> ai-workflow/agent/*.md)
  -> Follow Agent Workflow
```

## Step 0. Load Memory（必做）

1. 读取 `ai-workflow/memory/INDEX.md`。
2. 按索引读取列出的 memory 文件；标记为可选的文件不存在时跳过。
3. 提取团队偏好、个人偏好与阶段性执行约定。
4. Memory 是唯一自定义偏好入口；业务、技术或 SDD 内容仍按 Agent 需要下钻。

## Step 1. Route & Load Agent（必做）

1. 读取 `ai-workflow/agent/phase-router.md`。
2. 根据 Router 判断：意图、复杂度、目标 Agent。
3. 读取目标 Agent 文件（如 `ai-workflow/agent/requirement-manager.md`）。
4. 动手前阅读适用的根/子项目 `AGENTS.md` 及其指向的必读规则；不能把仓库规范复制进 Memory 作为另一份真源。

# 实现交付门禁

- 当任务真的进入实现、缺陷修复或重构阶段（包括只有一个任务），必须加载 `ai-workflow/skills/common/task-delivery/SKILL.md`。主会话只编排，一个任务、一个分支、一个 worktree；编码子 agent 数量不限，按需要分工；每个 worktree 单独配一个未参与该任务编码的审查兼交付 agent，负责本 worktree 的审查、复审、提交和合并，不跨 worktree 共享，不另开验收或合并 agent。只做原始验收所需的改动，不自行扩范围。
- 先精简和作者自审，再送固定快照独立审查。结果未通过、基线/快照变化、子 agent 或必要上下文不可用时，不提交也不绕过门禁。
- 审过后按用户范围提交；未配置链接则在原工作区快进合并到发起时的分支，不推送。已链接项目只在授权后创建 GitHub PR 或腾讯工蜂 MR，不执行远端合并。需求、设计和只读评审本身不建 worktree、不提交或发布。
- 验收（含异步子 agent 回传）通过后，主会话必须继续 `task-delivery` 的提交与交付，不等用户催促。本地逐任务确认 `merged-local` 才算交付；随后由同一个专属审查 agent 按 `task-delivery` 清理该任务的源 worktree，报告已清理或保留原因。不能继续交付时，明确报告未完成步骤、具体阻塞和下一步。

# 并行任务入口门禁

当语义判断用户目标是让同一并行组内的多个子任务同时推进时，才判定为并行执行意图。

- 普通执行意图下，即使父需求 `INDEX.md` 中某组标为可并行，也不自动并发多个编码任务；单个任务仍使用 `task-delivery` 的独立编码与审查。
- 判定为并行执行意图后，必须交给 `ai-workflow/skills/common/parallel-execute/SKILL.md` 执行具体并行校验、worktree 准备、worker 提示词与调度。
- 若 `parallel-execute` 未命中、缺失或不可读，禁止启动正式业务并行，只能说明 fallback 与影响。
- `parallel-execute` 管理并行组资格、共享基线与依赖；每个子任务的 worktree、精简、自审、审查和提交仍使用 `task-delivery`。
- 并行执行应使用当前会话中的 AI 编程工具（Codex、Cursor、Claude 等只是可选实现，不是唯一门禁）。

# 执行门禁（Gate）

- Gate 1：未完成 Step 0~1，禁止进入具体任务执行。
- Gate 2：进入 `Follow Agent Workflow` 后，必须遵循已加载 Agent 的上下文、技能、工作流、输出与自检要求。
- Gate 3：最终回复必须包含实际使用的 Agent；若 Agent 工作流实际使用 skill，也必须列出 skill；若未使用 skill，说明未使用或未命中。
- Gate 4：已判定为并行执行意图但未执行 `parallel-execute`，禁止启动正式业务并行。
- Gate 5：`parallel-execute` 的并行门禁失败时，禁止绕过该 skill 直接并行执行。

# 最小输出模板

```markdown
## 意图分析
- 输入：
- 意图：
- 复杂度：

## 上下文事实
- 已加载 Memory：
- 已加载 Agent：
- Agent 工作流下钻的索引/文档/代码事实：
```

# 目录指引

下列路径是常见示例，不是唯一仓库布局。只在目录真实存在时作为导航，不得把 `app/`、`web/`、`server/` 写成固定必选结构。

| 目录 | 用途 |
| --- | --- |
| `ai-workflow/agent/` | 代理角色定义 |
| `ai-workflow/memory/` | 团队偏好、个人偏好与阶段性执行约定 |
| `ai-workflow/skills/` | 可复用工作流技能 |
| `ai-workflow/wiki/` | 项目知识库 |
| `ai-workflow/sdd/` | 统一需求管理 |
| `ai-workflow/mcp/` | 外部工具配置（若项目使用） |
| 前端/移动端/后端代码目录 | 以仓库实际目录为准；例如可能是 `web/`、`app/`、`server/`，也可能是其他名称或单仓库根目录 |
| `ai-workflow/reference/` | 参考实现（若存在） |
