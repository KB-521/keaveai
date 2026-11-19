// SHA-256 fingerprints of the unmodified bundled assets immediately before ab88f2b.
// Paths group a skill and its supporting files into a single retirement unit.
export const RETIRED_SKILL_FINGERPRINTS: Readonly<Record<string, string>> = {
  '.codex/skills/ci-test-codegen': '165ebfa2dee87ad1e002d9783666d59b433a1305bdb5cd9efe8f878c77b89ed2',
  'ai-workflow/skills/common/codex-parallel-execute': '008f6ab84d16ce5d2fba5ba43769f81ca1d7c2a2275db57c3e1d2486ff53ff8f',
  'ai-workflow/skills/common/init-rules/rules/00-规则总览.md': '9d828174b6d55e8475b00a7fcd8c1b54d00a06ac4fbc2064e35761ce8f94db33',
  'ai-workflow/skills/common/init-rules/rules/01-架构与模块.md': '2010f86a7c0a2ec52a2abf22b5a9a42cb81953c17cda0def92a3498cbb9d4171',
  'ai-workflow/skills/common/init-rules/rules/02-命名与模型.md': '208af91018ab3451fedbdb6d6a5f51ef329c16dea387c841314a3ca8a5837df3',
  'ai-workflow/skills/common/init-rules/rules/03-API接口与响应.md': 'ce79d8df8baabe8b9b7e2cf42c6a8d53c295b8a1e8f5e2c8a113c288285aa598',
  'ai-workflow/skills/common/init-rules/rules/04-校验错误与状态.md': '115c5386d939aab3a7f7e4f87b8170f067f20e3c9bb6a515598e012621cfe6d1',
  'ai-workflow/skills/common/init-rules/rules/05-Service事务与一致性.md': '68f448ea8b643e9ae6a39d8610fb91432ce8d37c0bd301dcf73450b22d5bd34c',
  'ai-workflow/skills/common/init-rules/rules/06-DAO与SQL.md': '89d6b649cec5ade42080bf7a05fdfd5f4cfcc6a8ad08f19a5cf35e7cabdf01ef',
  'ai-workflow/skills/common/init-rules/rules/07-上下文租户与open链路.md': 'aa5ef1ac40bf1450e9e2afb4939d50b0d437521dcad07a0a5b77c4deba43ee96',
  'ai-workflow/skills/common/init-rules/rules/08-日志规范.md': '44ca0edaa4248c1925c60f67fb07dec40c35bacfa2f6999ef06d6e48af2c3047',
  'ai-workflow/skills/common/init-rules/rules/09-注释文档与TODO.md': '6b5365cbc8bb4c3855b1cfa2f505073a2093a424c4b28332f3991d17986f87b5',
  'ai-workflow/skills/common/init-rules/rules/10-配置常量枚举.md': 'b8af2cc52b4bb57335850f52ec553bf0e7593bade1e20f26e80126c57ad66104',
  'ai-workflow/skills/common/init-rules/rules/11-异步任务锁与幂等.md': '6a68f9c00ca1de956b0bdcf82229e69e57e1e0840bb89e200530373f2ea5e40a',
  'ai-workflow/skills/common/init-rules/rules/12-外部集成文件与计费.md': '27c28e824ce1ede711c941bc119e3d81ff8ae24f77d91d6ff9f536d6b559d299',
  'ai-workflow/skills/common/init-rules/rules/13-测试质量与交付门禁.md': '1aca1316157418ca2f6776c1893c59d15e2be69eb132f00a55e0caaa68a8fd2a',
  'ai-workflow/skills/server/INDEX.md': 'd14466c5a34a3ba1c173a1be7f05efc182dc45a98cd7aff3c8d0511f8594ab24',
  'ai-workflow/skills/server/backend-design': '1c98d4b7497baf333a6fd14613442f43a3b7b8d0ce6f6e721050a3fc1cb70eff',
  'ai-workflow/skills/server/code-review': '82638df15c84113a5e93094223d58fcf65c1ee842d87fba1ca58e851d16fcb98',
  'ai-workflow/skills/server/data-model-design': 'd6faddfd9463b9863b0b3428e083d8543cbe58ba030ea05350cc7f6e9311317e',
  'ai-workflow/skills/server/entry-impl': 'e61ef7ebc0653b63a0f3dcfebff4230107641b9caea4975c77e68623fabc9cf6',
  'ai-workflow/skills/server/init-business': '1cd888204a43720ab588e51496bd922acabfa5897e636be3c277dd27de813fbb',
  'ai-workflow/skills/server/pay-starter-impl': '94c5f0245df321b675e641585720d4ac6d9fcb6572c807543a874f75d246da65',
  'ai-workflow/skills/server/persistence-impl': 'f78010bb16d86ae4c5031be6dedda52bbdcc929b0dba8a0f8363b3a376d18493',
  'ai-workflow/skills/server/req-impl': 'f6926159cd91a1f754410ef12cdc8edbda9481ca74c7caae8f10c1fbf78851c5',
  'ai-workflow/skills/server/scripts/check_rules.py': '28090dc9532414abbecea4eb0c57eeba44cae0d62090b51174dcf32b7ea5c7f1',
  'ai-workflow/skills/server/skeleton-codegen': 'a575c0b108c50d57c2c75b1094725b1a8352864029e19bc5ca0ffa198bdacde6',
  'ai-workflow/skills/server/test-codegen': '36303d68df65670fc8f3af266af0e6d4b48bdebf78e545328f2b3650bbd39872',
  'ai-workflow/skills/server/yapi-mcp-sync': '2597059c33f599cdb76528a5d09b937e444d1182524bb31eeb3b0db08a7e511f',
};

// These indexes can be replaced with the current bundled index without losing local entries.
export const PREVIOUS_SKILL_INDEX_HASHES = new Set([
  '022d047759197332644604f182b77b24d79e87d3a421b573c17fa89cf8ab9069',
  'fdf03d4cac68d8d172badc8ffb47efc6f191aa09490752712086af6d041f4a21',
]);
