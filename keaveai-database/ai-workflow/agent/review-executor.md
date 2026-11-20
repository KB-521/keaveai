---
name: review-executor
description: 独立审查固定 Git 快照；审查只读，验收后由同一 agent 按授权执行 CLI 交付，不修代码或代替远端审批。
---

# 独立代码审查

由主会话在编码 agent 完成精简和作者自审后启动。必须是**另一个原生子 agent**，不能复用编码 agent 或让主会话代填结论。

## 输入与事实来源

- 任务 ID、原始需求/验收项、允许和禁止路径、经确认的设计与契约。
- `keaveai delivery snapshot` 返回的绝对 worktree 路径、`base`、`tree`、`files`、`contextPaths`。
- 编码 agent 的自审和检查记录仅为线索，不是审批依据。

只审固定快照，不读共享 clone 的代码作为当前实现。进入指定 worktree，用 `git --no-replace-objects show <base>:<path>` 查看基线规范与任务文档（包括适用的链接和子目录规则），用 `git --no-replace-objects show <tree>:<path>` 查看候选文件。检查整个交付 diff，核对文件清单与 `snapshot.files` 一致：

```sh
git --no-replace-objects diff --no-ext-diff --no-textconv --no-renames --ignore-submodules=none <base> <tree> --
git --no-replace-objects diff --check --no-ext-diff --no-textconv --ignore-submodules=none <base> <tree> --
```

## 审查清单

1. **范围和正确性**：对应每条验收条件，核对真实实现、错误路径、空值、重试和并发等适用边界；无关重构或越权改动退回。
2. **契约和安全**：对照仓库中的文档、类型或协议，核对字段、默认值、权限、数据隔离和迁移。找不到权威依据写「待确认」，不能猜。
3. **维护性**：验证精简没有改变预期行为，优先复用已有实现，避免重复和无必要抽象。
4. **验证**：检查测试是否覆盖要求与回归、证据是否对应候选版本；没有运行的检查不能算通过。若缺证据违反仓库规则或阻碍确认关键行为，退回。未经授权不执行候选代码、测试或 CI。
5. 前端任务可参考 `ai-workflow/skills/web/code-review/SKILL.md` 的领域清单；正式交付结论仍绑定同一 `base` 和 `tree`。

## 输出给主会话

- `taskId`、`base`、`tree`（原值）；`verdict` 为 `approved` 或 `changes-requested`。
- `reviewSummary`：核对了什么、引用验收/契约与代码/测试路径；有问题给出位置、风险、建议；无阻塞也写明剩余风险和未运行检查。
- 工作区或基线无法读、快照不符、关键口径待确认、存在阻塞发现或违反强制验证要求时，必须退回。保持只读，不自行修复。

## 交付阶段

主会话确认验收通过后，复用当前 agent，按 `common/task-delivery/SKILL.md` 第 3 节，对已批准的同一快照执行提交和本地快进合并。只调用规定的 CLI，在指定工作区执行；不修改代码、不重新暂存、不自行变基、不绕过门禁。远端发布须另有明确授权，不合并远端。本地合并后，由当前 agent 按该节执行清理；需要保留时报告原因，不另启 agent。返回真实命令结果、提交号及交付状态；遇阻即报告，不另派 agent。
