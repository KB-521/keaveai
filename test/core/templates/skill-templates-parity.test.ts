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
  getExploreSkillTemplate: '560b60e4c90872a63f703988b11e1cad7d498baec90401943868a31217cb7788',
  getNewChangeSkillTemplate: 'ea4f67dbf49a4cc56df8677347e9a101d50ad38478eb116097884bd5cfa1bec4',
  getContinueChangeSkillTemplate: 'ad70a05b7f80fcfe559d980c4841e988b54cacc54da2dec1c31d4cd0305a1d04',
  getApplyChangeSkillTemplate: '1e1a86ba8f86b8feae91ef865c5765f1e4a4df4135912f4d363a4bf287ea0e76',
  getFfChangeSkillTemplate: 'a9853c31d5fd2b847eaaeff18e5ea6808de57af1ed31092506c31f7507066c02',
  getSyncSpecsSkillTemplate: '8f674f757bd40a2d91903806d964e30e9da91fe8acf066bd1e0e6a1f79f2bc88',
  getOnboardSkillTemplate: 'b9053e2aaa1fd334d9f8ef4965925419d2d9c9c999cc3687dc6e72b6d4083258',
  getOpsxExploreCommandTemplate: '898d08cd2c37804d569d2586cd73c982b58c8097bd4e28dd2d3542a567af9820',
  getOpsxNewCommandTemplate: '79a8c5febcdecb93ff10bba7c45e2da5066eba3932207eaedb9cb56addc0a72a',
  getOpsxContinueCommandTemplate: '27b1d69ecd69c82185c83ebf32c7f1b892c4de7622c292f73b300b90c6d3344d',
  getOpsxApplyCommandTemplate: '186eadb55ee157aca752c81aa1de705a78df06bbf9b49e20378f6e74f81e9ea0',
  getOpsxFfCommandTemplate: 'a987c6a9d8d6604b4f09190a45f24f29b8af96d0503707098c14cadaef889d17',
  getArchiveChangeSkillTemplate: 'a054edc5effe3e7102e8f08c1d5489eae7a5ccf9169cd2798f2b8a234fad26d0',
  getBulkArchiveChangeSkillTemplate: '57a3c2a2fdb349778f3c4f5de4cd87fec631b58b8378df177cd9b0c4fec72e44',
  getOpsxSyncCommandTemplate: '208c60c330ab9e7d2b1253cc0a3c44004a5b0dfcfd90f409dd66a06fe7e40fec',
  getVerifyChangeSkillTemplate: 'c3a8f889c44519b67f42e47c044333d7a200c2123e1719d397a1fbf77cfa879b',
  getOpsxArchiveCommandTemplate: '377d044f2985b06d9a302bdd3352ccc1ccdbf98a295b7ed07a008d6053b6816c',
  getOpsxOnboardCommandTemplate: '6e7ec60ad8f404b048d4e27ae34c11c1212e0c5527989d5e900791030f6dd99c',
  getOpsxBulkArchiveCommandTemplate: '992cb697ca0b0e74175fe9289d8f3dfb811c0226575e94670d88b594b38c4bee',
  getOpsxVerifyCommandTemplate: '4a79ee182069d4ff8263df47350c4179dafb2ae09769765e50d82550544565ac',
  getOpsxProposeSkillTemplate: '6ad1d2864559f84eaf546c1009d5f3f11b9c306f3e4362426028ce77d67dcfe1',
  getOpsxProposeCommandTemplate: '6345dfc957c95c95ae4546f0c120361941d18edab61cc53bc3f6d3f21a36f924',
  getFeedbackSkillTemplate: '035562936ced7ddc3c30572d682fb1fd288600ef3603b3735b12a92815294d51',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': 'b482644297209145ba952610587b0413cf57f6405898c90916ed719dc90921c1',
  'openspec-new-change': '1407b7b834a5dfa1662ea04d4d54d7bd0a6f9f87ac3f9c3b0e043aee97a0933c',
  'openspec-continue-change': '583aa323dc0cd432e492492929804eba89fe7ac2f63b0b386cf076553d1b6785',
  'openspec-apply-change': '63d60804548c76bf750fedecdd91aa6be3a53a42be404732ab80b4adf39e89cf',
  'openspec-ff-change': '7bea7ad10c9eba22ed9bee8c9d7a4780858cadcea4580f4cab858e6ee9b827c0',
  'openspec-sync-specs': 'e530a012b7a8a6e11aa1678d995f66635f7f6112128a4a97db8479b90d0d1e15',
  'openspec-archive-change': '8fcc50ec09003883adaa34a2ec44d7b4a3308d8d689157cdf79d3659ab9c8d2e',
  'openspec-bulk-archive-change': '43ce01f7aa8e8e2ba4f6ba7c5746b589dc8cd32d69629d070b578f3f2711d102',
  'openspec-verify-change': '5022b4bfa77d69053242549033e4a9b0d73df935346383778c94ce6bc72e850d',
  'openspec-onboard': '75207c98ed5723e3bb852b0260f67cb4cd314df6ba86897d5e1208817e9c8110',
  'openspec-propose': '2a9e6193f945af99f96f647207631a55a0429af5dc2f5be90d2288f7717b49b8',
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
