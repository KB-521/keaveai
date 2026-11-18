---
name: init-rules-convention
description: 初始化或刷新各项目域的 ai-workflow/wiki/<project-domain>/rules/INDEX.md。按仓库实际 domain 工作，不绑定某一技术栈，也不再把 server 域或 Java 规则包作为默认发布源。
version: 1.13.0
---

# 初始化规则同步

## 作用

- 初始化或刷新 `ai-workflow/wiki/<project-domain>/rules/INDEX.md`。
- 未指定 domain 时，扫描 `ai-workflow/wiki/*` 下除 `experience` 外的一级目录。
- 所有项目域一视同仁；`server` 只是可能存在的域名称之一，不再享有特殊发布或冻结规则。
- 保留发布区已有用户规则，只刷新索引。
- 不默认保留 `internal/`、平台 SDK 清单、项目专项清单等非通用规则。
- 本 skill 不再附带或发布某一语言/框架的默认规则包。

## 真源

- 各项目域规则真源：对应 `ai-workflow/wiki/<project-domain>/rules/` 中的手写规则。
- 若用户或仓库另有 skill-local 规则，仅在该 skill 自身目录维护，不由本 skill 复制或发布。

## 同步规则

- 确保 `ai-workflow/wiki/<project-domain>/rules/INDEX.md` 存在，并按当前目录下 Markdown 刷新索引。
- 发布区中非当前主规则映射的通用用户规则默认保留并纳入索引。
- `internal/`、platform、SDK 清单、项目专项清单不属于通用规则；除非用户明确指定保留，否则必须清理。
- 禁止从发布区反推真源。

## 规则修改同步门禁

- 修改某项目域规则时，只改对应 `ai-workflow/wiki/<project-domain>/rules/`，并刷新该 domain 的 `INDEX.md`。
- 禁止把某个技术栈的默认规则重新发布到 wiki。

## clear 模式

- 普通模式：创建缺失目录，刷新目标 domain 的 `INDEX.md`。
- clear 模式：重建目标 domain 的 `INDEX.md`。
- clear 不删除发布区非当前主规则映射的通用用户规则。
- clear 必须清理 `internal/`、platform、SDK 清单、项目专项清单等非通用规则，除非用户明确指定保留。

## 规则结构要求

- 规则建议保留：
  - `## 适用场景`
  - `## 命中条件`
  - 规则正文或检查清单

## INDEX 要求

- 只保留标题、`读取流程` 和一个 `规则列表` 表格。
- 表格覆盖目标 rules 目录下除 `INDEX.md` 外的全部 Markdown。
- 不按内置、用户、专项分组；统一按路径列入同一张表。
- 索引说明优先取 `## 适用场景` 首段，其次取首段正文，最后退化到“按规则正文下钻”。
- 没有规则正文的 domain，表格中写明“当前暂无规则正文”。

## 完成标准

- 目标 domain 的 `rules/INDEX.md` 存在且路径可读。
- 通用用户规则没有被删除或覆盖。
- `internal/`、platform、SDK 清单、项目专项清单等非通用规则不再出现在通用发布区索引中。
- 重复执行保持幂等，不产生重复文件。
- 未把某一语言、框架或原公司规则包重新写入默认发布区。
