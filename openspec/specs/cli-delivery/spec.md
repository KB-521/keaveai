# 任务交付规范

## Purpose

让 `$req-dev` 的代码实现从共享会话中分离；主会话编排，编码与审查由不同子 agent 完成。CLI 记录并验证 Git 快照，不替代独立审查身份、仓库规则或远端审批。

## Requirements

### Requirement: 隔离工作区和任务基线

系统 MUST 允许在 `init` 选择 GitHub 或腾讯工蜂、已配置远端和目标分支，把设置写入 `agent.config` 而不写入令牌，并在缺失时提供 `agent.config.example`。实现任务按项目设置登记任务分支与 worktree，保留其基线与允许修改范围。

#### Scenario: 从共享 clone 分发任务

- **WHEN** 主会话运行 `delivery start` 并提供任务 ID 与允许路径，且项目 `agent.config` 已配置交付仓库
- **THEN** 新 worktree 基于抓取的目标提交，必要上下文与共享 clone 一致
- **AND** 不更改共享 clone 的代码或当前分支；缺少上下文或已存在同任务时不启动编码

### Requirement: 可选链接与本地快进交付

`keaveai link` SHALL 独立设置或移除远端交付链接而不改变 Git 远端；`update` 不管理链接。

#### Scenario: 没有链接的项目

- **GIVEN** 项目未链接远端，且工作区在已有提交的分支上
- **WHEN** 主会话启动任务并通过独立审查后运行 `delivery merge --confirm`
- **THEN** 仅在原工作区仍处于原分支和登记的基线时快进到已审查的提交，不推送或覆盖用户改动

### Requirement: 审查绑定实际提交

主会话 MUST 等待编码 agent 完成精简、自审和验证记录，再交另一独立 agent 审查完整快照。CLI MUST 在提交前验证审批的任务、基线、tree 和验证状态，并在 Git 更新分支前验证实际 tree 与父提交。

#### Scenario: 变更超出范围或审批过期

- **WHEN** 暂存内容超出允许范围，或其 tree/基线与独立审批不一致
- **THEN** CLI 拒绝当前快照或提交，无可发布的批准记录

#### Scenario: 提交钩子改变候选 tree

- **WHEN** 正常运行的仓库钩子改变了实际候选 tree
- **THEN** Git 分支不更新，改动保留给编码 agent 复核，主会话必须重新送审

### Requirement: 只请求合并，不执行合并

CLI MUST 仅在任务头提交与审查记录匹配、明确授权且远端目标仍匹配时推出新的任务分支。只支持 GitHub PR 和腾讯工蜂 MR；推送新分支后调用对应平台创建接口，不修改目标分支，不请求自动合并。

#### Scenario: 服务器未确认 MR

- **GIVEN** Git 确认新分支已推送，但远端没有返回可归属到该项目的 MR 链接
- **THEN** CLI 保存 `requested-unconfirmed`，不声称已创建 MR，也不自动重推或覆盖分支
