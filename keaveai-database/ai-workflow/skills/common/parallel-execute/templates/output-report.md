# 并行执行输出模板

````markdown
## 并行组校验

- change-id:
- 并行组:
- 状态:
- 执行模式:
- 任务基线:
- 结论:

## 子任务边界检查

| task-id | 状态 | 前置依赖 | 允许修改范围 | 禁止修改范围 | 是否可并行 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |

## 任务基线可见性

| 文件 | 主工作区 | worktree 可见性 | 处理方式 |
| --- | --- | --- | --- |

## Worktree 命令

```bash
keaveai delivery start <task-id> --allow <paths> --context <baseline-files>
```

## Worker 提示词

### <task-id>

```markdown
<worker-prompt>
```

## 启动顺序

1. 先启动共享契约任务或无依赖任务。
2. 再启动同组内边界互不重叠的任务。
3. 等待 worker 完成后，逐任务独立审查和交付；主会话汇总集成风险，不直接合并。

## Worker 与交付结果

| task-id | worktree / base | 编码 agent | 审查 agent / 状态 | 验证证据 | 提交 / MR | 集成注意事项 |
| --- | --- | --- | --- | --- | --- | --- |

## 阻塞或冲突

- 无：
- 有：
````
