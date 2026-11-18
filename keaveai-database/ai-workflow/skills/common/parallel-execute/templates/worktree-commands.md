# Worktree 命令模板

## 创建或确认 worktree

优先使用仓库或当前 AI 编程工具提供的 worktree 管理脚本（若存在）。若没有专用脚本，使用标准 git 命令：

```bash
# 可选：项目或当前工具提供的 worktree 管理脚本
# <worktree-manager> create task-<task-id> <base-branch>

# 标准 fallback
git worktree add -b task-<task-id> .worktrees/task-<task-id> <base-branch>
```

不要把某一工具的私有脚本路径（例如 `~/.codex/skills/...`）写成唯一可用方式。

## 命名约定

- `<task-id>` 使用子任务编号，保持和任务文档一致。
- 分支名和 worktree 目录名使用 `task-<task-id>`，避免在 `.worktrees/` 下生成嵌套目录。
- `<base-branch>` 使用已经包含任务基线的分支或快照点。

## 基线可见性校验

```bash
test -f <worktree-path>/ai-workflow/sdd/changes/<change-id>/tasks/INDEX.md
test -f <worktree-path>/ai-workflow/sdd/changes/<change-id>/tasks/<parent-req>/INDEX.md
test -f <worktree-path>/<task-doc-path>
```

缺少任一任务基线文件时，禁止启动正式 worker。
