---
name: skill-creator
description: 创建高效技能的指南。用于创建新技能或更新现有技能，以专业知识、工作流或工具集成扩展当前 AI 编程工具的能力。
version: 1.1.0
---

# 技能创建

创建模块化、自包含的包，以专业知识与工作流扩展 AI 能力。

## 核心原则

### 简洁至上
审视每一段内容：“当前 AI 编程工具真的需要这个吗？”用简洁示例替代冗长解释。

### 渐进式披露
1. **元数据**（约 100 词）- 总是加载
2. **SKILL.md 正文**（<500 行）- 触发时加载
3. **打包资源** - 按需加载

### 技能结构
```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description, version；owners 可选)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/      - Executable code
    ├── references/   - Documentation
    └── assets/       - Templates, icons
```

## SKILL.md 格式

```yaml
---
name: my-skill
description: 做什么 AND 何时使用（触发关键）
version: 1.0.0
---

# Title

[核心指令 - 祈使句]

## Sections as needed
```

## Frontmatter 规则

现阶段每个 `SKILL.md` 必须声明以下字段：

- `name`：skill 唯一名称。
- `description`：作用与触发场景。
- `version`：skill 契约版本，新增 skill 默认从 `1.0.0` 开始。

`owners` 为可选字段。若当前团队需要维护负责人，使用当前团队约定；不要写入与本仓库无关的个人姓名，也不按前端/后端技术栈绑定固定负责人。

## 最佳实践

| 要做 | 不要做 |
|------|--------|
| 清晰且完整的描述 | 含糊的一句话 |
| 祈使句（“创建”“运行”） | 被动语态 |
| 简洁示例 | 冗长解释 |
| 细节放引用文件 | 一股脑写进 SKILL.md |
| 运行脚本做测试 | 想当然认为可用 |

## 不要包含
- README.md, CHANGELOG.md, INSTALLATION.md
- User-facing documentation
- Setup/testing procedures

## 创建流程

1. **理解** - 获取具体使用示例
2. **规划** - 识别可复用脚本/参考/资源
3. **初始化** - 创建包含 SKILL.md 的技能目录
4. **编辑** - 实现资源、编写指令
5. **测试** - 通过真实使用验证
6. **迭代** - 根据反馈优化
