import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseVersion, releasePackage } from '../../scripts/release-local.mjs';

const roots: string[] = [];
const name = 'release-test';
const original = `${JSON.stringify({ name, version: '1.2.6' })}\n`;

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture({ packVersion, fail }: { packVersion?: string; fail?: string } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'keaveai-release-test-'));
  roots.push(root);
  const files = ['package.json', 'package-lock.json'].map((name) => path.join(root, name));
  for (const file of files) fs.writeFileSync(file, original);
  let version = '';
  let tarball = '';
  const runNpm = vi.fn((_cwd: string, args: string[]) => {
    if (args[0] === fail) throw new Error(`failed: ${fail}`);
    if (args[0] === 'version') {
      version = args[1];
      for (const file of files) fs.writeFileSync(file, JSON.stringify({ name, version }));
    }
    if (args[0] === 'pack') {
      const filename = `${name}-${version}.tgz`;
      tarball = path.join(args[args.indexOf('--pack-destination') + 1], filename);
      fs.writeFileSync(tarball, 'packed content');
      return JSON.stringify([{ name, version: packVersion ?? version, filename }]);
    }
    if (args[0] === 'publish') {
      expect(args[1]).toBe(tarball);
      expect(fs.readFileSync(args[1], 'utf8')).toBe('packed content');
    }
  });
  return {
    root,
    runNpm,
    tarball: () => tarball,
    readManifests: () => files.map((file) => fs.readFileSync(file, 'utf8')),
  };
}

describe('local npm release', () => {
  it.each([['1.3.0', 'latest'], ['1.3.0-rc.1', 'next']])('publishes the exact packed %s to %s', (version, tag) => {
    const test = fixture();
    releasePackage({ ...test, version, dryRun: false });
    const args = test.runNpm.mock.calls.map(([, args]) => args);
    expect(args.map(([action]) => action)).toEqual(['version', 'run', 'pack', 'publish']);
    expect(args[0]).toContain('--no-git-tag-version');
    expect(args[1]).toEqual(['run', 'build']);
    expect(args[3]).toEqual(['publish', test.tarball(), '--registry', 'https://registry.npmjs.org/', '--access', 'public', '--tag', tag, '--ignore-scripts']);
    expect(test.readManifests()).toEqual(Array(2).fill(JSON.stringify({ name, version })));
    expect(fs.existsSync(test.tarball())).toBe(false);
  });

  it('dry run packs without publishing and restores both manifests', () => {
    const test = fixture();
    releasePackage({ ...test, version: '1.3.0', dryRun: true });
    expect(test.runNpm.mock.calls.map(([, args]) => args[0])).toEqual(['version', 'run', 'pack']);
    expect(test.readManifests()).toEqual([original, original]);
    expect(fs.existsSync(test.tarball())).toBe(false);
  });

  it('does not publish a tarball with a mismatched version', () => {
    const test = fixture({ packVersion: '1.2.6' });
    expect(() => releasePackage({ ...test, version: '1.3.0', dryRun: false })).toThrow('不一致');
    expect(test.runNpm.mock.calls.map(([, args]) => args[0])).toEqual(['version', 'run', 'pack']);
    expect(test.readManifests()).toEqual([original, original]);
    expect(fs.existsSync(test.tarball())).toBe(false);
  });

  it('restores manifests and advises checking the registry on a publish error', () => {
    const test = fixture({ fail: 'publish' });
    expect(() => releasePackage({ ...test, version: '1.3.0', dryRun: false })).toThrow('npm view');
    expect(test.readManifests()).toEqual([original, original]);
    expect(fs.existsSync(test.tarball())).toBe(false);
  });

  it.each(['v1.3.0', '1.03.0', '1.3.0-rc.01', '1.3.0\n', '--help'])('rejects invalid npm release version %j', (version) => {
    expect(() => parseVersion(version)).toThrow('有效的 npm 版本号');
  });
});
