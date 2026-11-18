import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  type SkillTemplate,
  getApplyChangeSkillTemplate,
  getArchiveChangeSkillTemplate,
  getBulkArchiveChangeSkillTemplate,
  getContinueChangeSkillTemplate,
  getExploreSkillTemplate,
  getFeedbackSkillTemplate,
  getFfChangeSkillTemplate,
  getNewChangeSkillTemplate,
  getOnboardSkillTemplate,
  getOpsxApplyCommandTemplate,
  getOpsxArchiveCommandTemplate,
  getOpsxBulkArchiveCommandTemplate,
  getOpsxContinueCommandTemplate,
  getOpsxExploreCommandTemplate,
  getOpsxFfCommandTemplate,
  getOpsxNewCommandTemplate,
  getOpsxOnboardCommandTemplate,
  getOpsxSyncCommandTemplate,
  getOpsxProposeCommandTemplate,
  getOpsxProposeSkillTemplate,
  getOpsxVerifyCommandTemplate,
  getSyncSpecsSkillTemplate,
  getVerifyChangeSkillTemplate,
} from '../../../src/core/templates/skill-templates.js';
import { generateSkillContent } from '../../../src/core/shared/skill-generation.js';

const EXPECTED_FUNCTION_HASHES: Record<string, string> = {
  getExploreSkillTemplate: 'e55c9d23fe0dc0ef0aad73bf68341f2b83d41726243d345c134ea8e9d2dc572b',
  getNewChangeSkillTemplate: '3b28c8f604973c80144d3bc6380350fba2a1606f6cc7e2ee75372451e1d6f6bf',
  getContinueChangeSkillTemplate: 'd512f75a59fca98f9add2cf48bee9039095f3086c7ad6ce41f6fe76818f823b0',
  getApplyChangeSkillTemplate: '97ba1db1042597247fd1a9145b357364b740d52f3c896d2612e8a086feb8edbb',
  getFfChangeSkillTemplate: 'e5a27baf2d0464753a67acaa79cc028bde0495eb2dcc2699dc1a90ccb9f1031d',
  getSyncSpecsSkillTemplate: '0fc4f2284e95ee179b3104dc1991348c0c56d784cef131bba9eda55d2f0fee2c',
  getOnboardSkillTemplate: 'ef429cac53aca98c0a35a45b1dbfc8fd6417d4cce728b669e76a248dd1624ffe',
  getOpsxExploreCommandTemplate: 'b9d692cec70a42d7da340ae39a5678a776356bed5a94b0abf05de7fe41287398',
  getOpsxNewCommandTemplate: 'f30c181680997f85c128904597ee6368d3ce28e39c041b627296e1670363c1b5',
  getOpsxContinueCommandTemplate: '6a92bfea1f1f3f9a6a13c91f5b5288f13ba84f07aa7efc10d5c7ff5e95655b6e',
  getOpsxApplyCommandTemplate: 'd28180cdbd97554df412819f89020b13d0d4b397c73ff725b52ce9b32fc47f83',
  getOpsxFfCommandTemplate: 'e65659b3deaa5fa71236f29cd0a57202a33794be8d79e38aa51c792d2b30683e',
  getArchiveChangeSkillTemplate: '7b02d4306034ca20ca8173b4fc91e6e0d2f90b505162c7f6767cd65e0299dc80',
  getBulkArchiveChangeSkillTemplate: '5076af9a39a9e786180a8f51e8336dc7157f2cee5c616cf062b82793827bcd89',
  getOpsxSyncCommandTemplate: 'faf363cac59926d569d312e414aac472c315c60f3443ec58e07aae1b3bd34452',
  getVerifyChangeSkillTemplate: '78731297e84bcb51a836715a2855ac6f072683300fbddded468457318cbc634c',
  getOpsxArchiveCommandTemplate: 'bd6f283f37beb9caed0d145eda7c5c34885e7e050cfc1620ed514fdd990030be',
  getOpsxOnboardCommandTemplate: 'fe2ba4bb675dd749f2aea0875c07a45500beb47a7e062efbc1a86cb7e36ab620',
  getOpsxBulkArchiveCommandTemplate: '5c45a13e7155eb72062078e353b07f7ada3424ee325588a3b5abdc9c8968cfd6',
  getOpsxVerifyCommandTemplate: '1ba4f1fc813676a08b41100fa80905045b9a3e36a790ff5b49cacf66b1b12e52',
  getOpsxProposeSkillTemplate: 'e9751422044b48a82bcc5d1b72902bbf0216f4cfc4a5a650f71c7690769614c3',
  getOpsxProposeCommandTemplate: '580559baf4f2ddb2a65e02e97042703c6c359bb64feec1a4fdef57765d785d73',
  getFeedbackSkillTemplate: '5e4ee114e46510a859e1a82f626a435a1cf8aa403ae98cc854897e28361e32e6',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': 'd5c0370845e096f701e010192e9d2d1ce0932f80d167310210cbdea398240c9e',
  'openspec-new-change': '2f845a0675b3daaa9ea1887e551499f38cd2d31203e3a26d2cb0f9eb2e59aed6',
  'openspec-continue-change': '5548920bf1bdbd57dd1ecd00a2da0a4bae03b7d21730665e175831b90799c07d',
  'openspec-apply-change': '6a61d8e75ed4430dc34e3fc0d9531013b44941454eaac20932ac3c464181eef0',
  'openspec-ff-change': '841de6199433877fedd2f482f863eb23b944dd13751549276cb74701711c99ae',
  'openspec-sync-specs': '3bb2f2a56791cc75db40cd3f0a0ea7c9ac3ff2eac4a4784fc7fa1adebe702ec2',
  'openspec-archive-change': '4e540746d5d649a5cfc6075ba46fca95c6439dc6923705ec793121e73ac42935',
  'openspec-bulk-archive-change': '80df69441c451b0b64064af44745f89e9564afdb8128f659328050c531ff76d3',
  'openspec-verify-change': 'ad2382cedeec1e6ebf17438f519b0bca9b6a5d395704f35e2822b1e17bd152cb',
  'openspec-onboard': '71af2cc607c09a6b9d500bfcbaad55be3afa83c71dc252c4c78a48f9c06c3060',
  'openspec-propose': '60ffe44d5cbe66fa6564f57e1b6706f78290044fc2a782a91c08493fb65af5fe',
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('skill templates split parity', () => {
  it('preserves all template function payloads exactly', () => {
    const functionFactories: Record<string, () => unknown> = {
      getExploreSkillTemplate,
      getNewChangeSkillTemplate,
      getContinueChangeSkillTemplate,
      getApplyChangeSkillTemplate,
      getFfChangeSkillTemplate,
      getSyncSpecsSkillTemplate,
      getOnboardSkillTemplate,
      getOpsxExploreCommandTemplate,
      getOpsxNewCommandTemplate,
      getOpsxContinueCommandTemplate,
      getOpsxApplyCommandTemplate,
      getOpsxFfCommandTemplate,
      getArchiveChangeSkillTemplate,
      getBulkArchiveChangeSkillTemplate,
      getOpsxSyncCommandTemplate,
      getVerifyChangeSkillTemplate,
      getOpsxArchiveCommandTemplate,
      getOpsxOnboardCommandTemplate,
      getOpsxBulkArchiveCommandTemplate,
      getOpsxVerifyCommandTemplate,
      getOpsxProposeSkillTemplate,
      getOpsxProposeCommandTemplate,
      getFeedbackSkillTemplate,
    };

    const actualHashes = Object.fromEntries(
      Object.entries(functionFactories).map(([name, fn]) => [name, hash(stableStringify(fn()))])
    );

    expect(actualHashes).toEqual(EXPECTED_FUNCTION_HASHES);
  });

  it('preserves generated skill file content exactly', () => {
    // Intentionally excludes getFeedbackSkillTemplate: skillFactories only models templates
    // deployed via generateSkillContent, while feedback is covered in function payload parity.
    const skillFactories: Array<[string, () => SkillTemplate]> = [
      ['openspec-explore', getExploreSkillTemplate],
      ['openspec-new-change', getNewChangeSkillTemplate],
      ['openspec-continue-change', getContinueChangeSkillTemplate],
      ['openspec-apply-change', getApplyChangeSkillTemplate],
      ['openspec-ff-change', getFfChangeSkillTemplate],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate],
      ['openspec-archive-change', getArchiveChangeSkillTemplate],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate],
      ['openspec-verify-change', getVerifyChangeSkillTemplate],
      ['openspec-onboard', getOnboardSkillTemplate],
      ['openspec-propose', getOpsxProposeSkillTemplate],
    ];

    const actualHashes = Object.fromEntries(
      skillFactories.map(([dirName, createTemplate]) => [
        dirName,
        hash(generateSkillContent(createTemplate(), 'PARITY-BASELINE')),
      ])
    );

    expect(actualHashes).toEqual(EXPECTED_GENERATED_SKILL_CONTENT_HASHES);
  });
});
