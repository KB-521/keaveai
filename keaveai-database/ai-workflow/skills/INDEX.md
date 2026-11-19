# Skills 索引

本目录存放可复用的技能（skill）。每个 skill 以子目录管理，入口文件为 `SKILL.md`；索引递归收录 `ai-workflow/skills` 下所有包含 `SKILL.md` 的有效 skill 目录，路径相对于 `ai-workflow/skills`。

## 使用建议

1. 先在文档“Skill 清单”中定位目标 skill。
2. 再打开对应目录下的 `SKILL.md` 获取详细内容。

## Skill 清单

| 目录 | `name` | version | owners | 作用说明 | 典型使用时机 | 主要产出/关注点 |
| --- | --- | --- | --- | --- | --- | --- |
| `common/code-commit` | `code-commit` | 1.0.0 | - | 按 Conventional Commits 提交代码变更并使用结构化信息。 | 实现或修复完成后，需要按规范提交代码时。 | 结构化 commit message、提交类型约束与提交步骤。 |
| `common/init-agent` | `init-agent` | 1.6.0 | - | 生成或更新根目录与代码子项目级 AGENTS.md，并承接项目技术导航；按仓库实际技术栈识别，不预设单一布局。 | 仓库首次建立项目指南、AGENTS.md 过期，或执行 `$init init agent clear` 时。 | 根/子项目 AGENTS.md、子项目路由、技术导航与 memory 入口。 |
| `common/init-business` | `init-business` | 1.5.0 | - | 按仓库项目域生成“索引 + 摘要层”业务知识文档；支持 clear 模式覆盖重建目标业务文档。 | 需要初始化、刷新或 clear 重建项目域业务知识文档时。 | ai-workflow/wiki/<project-domain>/business/INDEX.md 与摘要层业务文档。 |
| `common/init-rules` | `init-rules-convention` | 1.13.0 | - | 初始化或刷新各项目域的 rules/INDEX.md，不绑定某一技术栈，也不再发布 Java/server 默认规则包。 | 需要初始化或刷新项目域规则目录，或纳入用户自定义规则时。 | 各项目域 rules 索引；保留已有通用用户规则。 |
| `common/init-skills` | `init-skills` | 1.2.0 | - | 递归扫描指定 skills 目录下的 skill 子目录，生成可维护的 skill 索引。 | 新增 skill、调整目录分组、skills 索引过期或需要 clear 重建时。 | 覆盖更新的 skills/INDEX.md 与缺失 metadata 提示。 |
| `common/parallel-execute` | `parallel-execute` | 1.7.0 | - | 基于父需求 INDEX.md 的 Ready 并行组校验边界，并编排当前 AI 编程工具的 worker/subagent 并行执行。 | 用户明确要求并行执行任务组，且父需求索引存在 Ready 并行组时。 | 并行门禁结果、worktree/worker 编排、启动顺序、设计基线可见性与集成建议。 |
| `common/prd-archive` | `prd-archive` | 1.1.0 | - | 从可插拔文档源拉取最新 PRD 并覆盖落库到 ai-workflow/sdd/changes/<change-id>/prd。 | PRD 审核完成后，需要从本地文件、通用文档 URL 或用户指定的可选平台适配器归档时。 | 归档后的 PRD 文档与落库路径。 |
| `common/prd-review` | `prd-review` | 1.1.0 | - | 检查 PRD 是否结构化、功能点是否清晰且可实现。 | 进入技术方案或代码实现前需要审查 PRD，或 PRD 更新后需要复核历史问题时。 | 问题清单、业务对照证据、历史问题复核与修订建议。 |
| `common/req-create` | `req-create` | 1.1.0 | - | 从用户想法创建结构化需求文档。 | 需要把新想法落成当前变更包里的结构化需求时。 | 需求索引条目、in-progress 需求文档与执行摘要。 |
| `common/skill-creator` | `skill-creator` | 1.1.0 | - | 创建或更新扩展当前 AI 编程工具能力的技能。 | 需要新增 skill 或改造现有 skill 时。 | skill 结构规范、SKILL.md 设计要点与配套资源建议。 |
| `common/backend-tech-solution-design` | `backend-tech-solution-design` | 1.0.0 | - | 将后端需求转化为可评审的技术方案。 | 接口变更、服务能力、数据迁移或跨系统协作进入实现前。 | 接口契约、数据与状态、风险取舍、验收场景与待确认项。 |
| `common/task-split` | `task-split` | 1.11.0 | - | 将技术方案按复杂度和任务类型拆分为可开发、可验收、可并行执行的实现子任务。 | 技术方案评审后、进入实现前需要拆任务时。 | 通用任务结构、模板公共块、短码子任务命名、自适应粒度、子任务复杂度预算、SQL 目录命名空间、前端页面拆分与并行边界。 |
| `common/tech-design-review-template` | `tech-design-review-template` | 1.0.0 | - | 基于技术方案文档生成 Review 模版。 | 技术方案完成后、正式评审前需要建立 review 文档时。 | 技术方案 review 模版与问题追踪结构。 |
| `web/api-impl` | `api-impl` | 1.2.0 | - | 基于可插拔 API 文档来源（如 OpenAPI）按项目规范实现前端 API 接口。 | 前端已有接口定义，需要落地请求文件时。 | 前端 API 请求文件、类型命名、导出约定与代码示例。 |
| `web/api-mock` | `api-mock` | 1.0.0 | - | 为接口提供本地 mock/假数据联调能力。 | 需要本地 mock、假数据联调或 stub 后端时。 | mock 路由、假数据文件与请求层分发逻辑。 |
| `web/code-review` | `code-review` | 1.0.0 | - | 评审前端代码质量、正确性、状态一致性与交互边界。 | 用户明确要求前端 code review、PR/CI 流程需要评审或问题定位时。 | 按优先级分组的前端问题清单、修复建议与剩余风险。 |
| `web/d2c` | `d2c` | 1.0.0 | - | 基于 Figma 链接高保真还原 React + Tailwind 页面并输出可追溯实现清单。 | 需要把 Figma 设计稿高保真还原成 Web 页面时。 | 可追溯的节点实现清单、节点映射与计算依据。 |
| `web/frontend-tech-solution-design` | `frontend-tech-solution-design` | 1.1.0 | - | 基于 PRD、原型和评审结论设计前端技术方案。 | 前端开发前，需要先冻结页面、状态和接口映射口径时。 | 前端技术方案文档、设计包索引与可选拆分设计文档。 |
| `web/rn-d2c` | `rn-d2c` | 1.0.0 | - | 基于 Figma 链接还原 React Native Expo 页面。 | 需要把 Figma 设计稿高保真还原成 React Native 页面时。 | RN 节点实现清单、节点映射与视觉计算依据。 |
| `web/task-impl` | `task-impl` | 1.2.0 | - | 执行前端任务实现，默认只做实现自检与建议验证记录。 | 需要按固定顺序落地前端功能实现时。 | 接口、mock、页面实现、自检记录与建议验证方式。 |
