import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliveryRemote, pinRemote } from '../../src/core/delivery/git.js';
import { type DeliveryReview } from '../../src/core/delivery/model.js';
import { DeliveryTaskCommand } from '../../src/core/delivery/task.js';

const ID = 'fix-example';
const REF = `refs/heads/keaveai/task/${ID}`;
const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function write(cwd: string, relative: string, content: string, mode?: number) {
  const file = path.join(cwd, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, { mode });
  return file;
}

async function fixture(provider: 'github' | 'gongfeng' = 'github') {
  const tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'keaveai-delivery-')));
  roots.push(tmp);
  const repo = path.join(tmp, process.platform === 'win32' ? 'shared clone' : 'shared clone ');
  const remote = path.join(tmp, 'remote.git');
  git(tmp, 'init', '--quiet', '--initial-branch=trunk', repo);
  git(tmp, 'init', '--quiet', '--bare', '--initial-branch=trunk', remote);
  git(remote, 'config', 'receive.advertisePushOptions', 'true');
  git(repo, 'config', 'user.name', 'KeaveAI Test');
  git(repo, 'config', 'user.email', 'keaveai@example.test');
  git(repo, 'config', 'commit.gpgsign', 'false');
  const hooks = path.join(tmp, 'hooks');
  await fs.mkdir(hooks);
  git(repo, 'config', 'core.hooksPath', hooks);
  await write(repo, 'AGENTS.md', 'Read docs/task.md before changes.\n');
  await write(repo, 'docs/task.md', 'Task acceptance conditions.\n');
  await write(repo, 'src/example.ts', 'export const value = 1;\n');
  await write(repo, 'outside.ts', 'export const safety = true;\n');
  git(repo, 'add', '--all');
  git(repo, 'commit', '--quiet', '-m', 'baseline');
  git(repo, 'remote', 'add', 'team', remote);
  git(repo, 'push', '--quiet', 'team', 'trunk');
  const endpoint = `git@${provider === 'github' ? 'github.com' : 'git.code.tencent.com'}:team/project.git`;
  await useLocalTransport(tmp, remote);
  git(repo, 'remote', 'set-url', 'team', endpoint);
  await write(repo, 'agent.config', `KEAVEAI_GIT_PROVIDER=${provider}\nKEAVEAI_GIT_REMOTE=team\nKEAVEAI_GIT_TARGET=trunk\n`);
  vi.stubEnv('GH_TOKEN', 'fixture-token');
  vi.stubEnv('GITHUB_TOKEN', undefined);
  vi.stubEnv('GONGFENG_TOKEN', 'fixture-token');
  const api = vi.fn().mockImplementation(async () => new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', api);
  const cmd = new DeliveryTaskCommand(repo);
  const options = { allow: ['src'], context: ['docs/task.md'] };
  const start = () => cmd.start(ID, options);
  return { tmp, repo, remote, endpoint, hooks, cmd, options, start, api };
}

async function changed(worktree: string, value = 2) {
  await write(worktree, 'src/example.ts', `export const value = ${value};\n`);
  git(worktree, 'add', '--', 'src/example.ts');
}

async function reviewRecord(f: Awaited<ReturnType<typeof fixture>>, overrides: Partial<DeliveryReview> = {}) {
  const snapshot = await f.cmd.snapshot(ID);
  git(snapshot.worktree, 'diff', '--check', snapshot.base, snapshot.tree);
  const review: DeliveryReview = {
    taskId: ID,
    base: snapshot.base,
    tree: snapshot.tree,
    implementer: 'worker-test',
    reviewer: 'reviewer-test',
    verdict: 'approved',
    authorReview: '只改动现有值，无额外抽象。',
    reviewSummary: '已核对任务及待审 tree。',
    checks: [
      { status: 'passed', command: 'git diff --check <base> <tree>', evidence: 'exit 0' },
      { status: 'not-run', command: 'remote CI', reason: 'Not authorized' },
    ],
    ...overrides,
  };
  return write(f.tmp, 'review.json', JSON.stringify(review));
}

async function approved(f: Awaited<ReturnType<typeof fixture>>) {
  const { worktree } = await f.start();
  await changed(worktree);
  const review = await reviewRecord(f);
  return f.cmd.commit(ID, { review, message: 'fix: update example' });
}

const publication = { title: '修复示例', confirm: true };

const remoteSource = (remote: string) => git(remote, 'for-each-ref', '--format=%(objectname)', REF);

async function useLocalTransport(tmp: string, remote: string) {
  const script = await write(tmp, 'ssh-mock', [
    '#!/bin/sh',
    'case "$2" in',
    '  git-upload-pack*) exec git-upload-pack "$KEAVEAI_TEST_REMOTE" ;;',
    '  git-receive-pack*) exec git-receive-pack "$KEAVEAI_TEST_REMOTE" ;;',
    '  *) exit 1 ;;',
    'esac',
    '',
  ].join('\n'), 0o755);
  vi.stubEnv('GIT_SSH_COMMAND', script);
  vi.stubEnv('GIT_SSH_VARIANT', 'simple');
  vi.stubEnv('KEAVEAI_TEST_REMOTE', remote);
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('isolated task delivery against real local Git repositories', () => {
  it('starts exactly one task worktree from the specified remote branch without editing the shared checkout', async () => {
    const f = await fixture();
    await write(f.repo, 'shared-untracked.txt', 'do not copy');
    const cli = fileURLToPath(new URL('../../bin/keaveai.js', import.meta.url));
    const result = execFileSync(process.execPath, [cli, 'delivery', 'start', ID, '--allow', 'src', '--context', 'docs/task.md'], { cwd: f.repo, encoding: 'utf8', env: { ...process.env, KEAVEAI_TELEMETRY: '0' } });
    const task = JSON.parse(result);
    expect(task.base).toBe(git(f.remote, 'rev-parse', 'trunk'));
    expect(task).toMatchObject({ provider: 'github', remote: 'team', target: 'trunk' });
    expect(task.branch).toBe(`keaveai/task/${ID}`);
    expect(task.worktree).toBe(path.join(`${f.repo}.keaveai-worktrees`, ID));
    expect(task.contextPaths).toEqual(['docs/task.md', 'AGENTS.md']);
    expect(git(task.worktree, 'status', '--porcelain')).toBe('');
    await expect(f.start()).rejects.toThrow(/already exists/);
    await expect(f.cmd.start('../outside', f.options)).rejects.toThrow(/task ID/);
    expect(git(f.repo, 'branch', '--show-current')).toBe('trunk');
    expect(git(f.repo, 'status', '--porcelain')).toBe('?? agent.config\n?? shared-untracked.txt');
  });

  it('unlinks without changing Git remotes and fast-forwards the original branch after review', async () => {
    const f = await fixture();
    const cli = fileURLToPath(new URL('../../bin/keaveai.js', import.meta.url));
    const link = (...args: string[]) => execFileSync(process.execPath, [cli, 'link', ...args], {
      cwd: f.repo, encoding: 'utf8', env: { ...process.env, KEAVEAI_TELEMETRY: '0' },
    });
    await fs.appendFile(path.join(f.repo, 'agent.config'), 'OTHER=keep\n');
    link('--local');
    await expect(fs.readFile(path.join(f.repo, 'agent.config'), 'utf8')).resolves.toBe('OTHER=keep\nGITHUB_TOKEN=\nGONGFENG_TOKEN=\n');
    expect(git(f.repo, 'remote', 'get-url', 'team')).toBe(f.endpoint);
    await expect(fs.stat(path.join(f.repo, 'agent.config.example'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(git(f.repo, 'check-ignore', 'agent.config')).toBe('agent.config');
    const { worktree, base } = await f.start();
    await expect(f.cmd.merge(ID, { confirm: true })).rejects.toThrow(/No approved commit/);
    await changed(worktree);
    const review = await reviewRecord(f);
    const { mode, commit } = await f.cmd.commit(ID, { review, message: 'fix: update example' });
    expect(mode).toBe('local');
    expect(git(f.repo, 'rev-parse', 'HEAD')).toBe(base);
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/use delivery merge/);
    await expect(f.cmd.merge(ID, {})).rejects.toThrow(/authorization/);
    await write(f.repo, 'src/example.ts', 'local edits\n');
    await expect(f.cmd.merge(ID, { confirm: true })).rejects.toThrow(/worktree has changes/);
    git(f.repo, 'restore', '--', 'src/example.ts');
    git(f.repo, 'checkout', '-b', 'other');
    await expect(f.cmd.merge(ID, { confirm: true })).rejects.toThrow(/original worktree/);
    git(f.repo, 'checkout', 'trunk');
    await expect(f.cmd.merge(ID, { confirm: true })).resolves.toEqual({ status: 'merged-local', branch: 'trunk', commit });
    expect(git(f.repo, 'rev-parse', 'HEAD')).toBe(commit);
    expect(git(f.repo, 'rev-parse', 'other')).toBe(base);
    expect(remoteSource(f.remote)).toBe('');
    expect(f.api).not.toHaveBeenCalled();
    link('--git-provider', 'github', '--git-remote', 'team', '--git-target', 'trunk');
    await expect(fs.readFile(path.join(f.repo, 'agent.config'), 'utf8')).resolves.toContain('KEAVEAI_GIT_PROVIDER=github');
  });

  it('stops local merge when the original target branch has moved', async () => {
    const f = await fixture();
    await fs.unlink(path.join(f.repo, 'agent.config'));
    git(f.repo, 'remote', 'remove', 'team');
    await approved(f);
    git(f.repo, 'commit', '--allow-empty', '-m', 'advance local target');
    const target = git(f.repo, 'rev-parse', 'HEAD');
    await expect(f.cmd.merge(ID, { confirm: true })).rejects.toThrow(/local target branch moved/);
    expect(git(f.repo, 'rev-parse', 'HEAD')).toBe(target);
    expect(remoteSource(f.remote)).toBe('');
  });

  it('rejects unshared context and leaves the caller changes intact', async () => {
    const f = await fixture();
    await write(f.repo, 'docs/task.md', 'not on trunk yet\n');
    await expect(f.start()).rejects.toThrow(/differs from the target/);
    expect(git(f.repo, 'status', '--porcelain')).toContain('M docs/task.md');
    expect(git(f.repo, 'worktree', 'list')).not.toContain(ID);
    expect(git(f.repo, 'branch', '--list', `keaveai/task/${ID}`)).toBe('');
  });

  it('cleans an empty failed checkout and supports a team worktree root and branch prefix', async () => {
    const f = await fixture();
    const parent = path.join(f.tmp, 'team-worktrees');
    await fs.mkdir(parent);
    const options = { ...f.options, worktreeRoot: parent, branchPrefix: 'dev/team-bot' };
    const hook = await write(f.hooks, 'post-checkout', '#!/bin/sh\nexit 1\n', 0o755);
    await expect(f.cmd.start(ID, options)).rejects.toThrow();
    await expect(fs.readdir(parent)).resolves.toEqual([]);
    await fs.unlink(hook);
    const task = await f.cmd.start(ID, options);
    expect(task).toMatchObject({ worktree: path.join(parent, ID), branch: `dev/team-bot/${ID}` });
    await changed(task.worktree);
    await expect(f.cmd.snapshot(ID)).resolves.toMatchObject({ branch: task.branch });
  });

  it('rejects Git fetch/push paths that only differ by a trailing space', async () => {
    const f = await fixture();
    git(f.repo, 'remote', 'set-url', 'team', f.remote);
    git(f.repo, 'remote', 'set-url', '--push', 'team', `${f.remote} `);
    await expect(f.start()).rejects.toThrow(/same fetch and push URL/);
    expect(git(f.repo, 'worktree', 'list')).not.toContain(ID);
  });

  it('pins the verified URL for network calls despite later edits to the named remote', async () => {
    const f = await fixture();
    const pinned = await pinRemote(f.repo, 'team', f.endpoint);
    git(f.repo, 'remote', 'set-url', 'team', 'git@github.com:unexpected/repository.git');
    git(f.repo, 'remote', 'set-url', '--push', 'team', 'git@github.com:unexpected/other.git');
    await expect(deliveryRemote(f.repo, 'team', pinned)).resolves.toMatchObject({ url: f.endpoint });
    git(f.repo, 'config', 'url.git@github.com:unexpected/rewrite.git.insteadOf', f.endpoint);
    await expect(pinRemote(f.repo, 'team', f.endpoint)).rejects.toThrow();
  });

  it('blocks unstaged and out-of-scope files, including renames into the allowed directory', async () => {
    const f = await fixture();
    const { worktree } = await f.start();
    await write(worktree, 'src/new.ts', 'export {};\n');
    await expect(f.cmd.snapshot(ID)).rejects.toThrow(/unstaged or untracked/);
    await fs.unlink(path.join(worktree, 'src/new.ts'));
    git(worktree, 'mv', 'outside.ts', 'src/moved.ts');
    await expect(f.cmd.snapshot(ID)).rejects.toThrow(/outside\.ts/);
  });

  it('does not let diff configuration hide out-of-scope submodule entries', async () => {
    const f = await fixture();
    const { worktree, base } = await f.start();
    await changed(worktree);
    git(worktree, 'config', 'diff.ignoreSubmodules', 'all');
    git(worktree, 'update-index', '--add', '--cacheinfo', `160000,${base},outside-submodule`);
    await fs.mkdir(path.join(worktree, 'outside-submodule'));
    await expect(f.cmd.snapshot(ID)).rejects.toThrow(/outside-submodule/);
  });

  it('does not commit a self-approved, failed, incomplete or stale review', async () => {
    const f = await fixture();
    const { worktree, base } = await f.start();
    await changed(worktree);
    const message = 'fix: update example';
    const self = await reviewRecord(f, { reviewer: 'worker-test' });
    await expect(f.cmd.commit(ID, { review: self, message })).rejects.toThrow(/separate review agent/);
    const rejected = await reviewRecord(f, { verdict: 'changes-requested' });
    await expect(f.cmd.commit(ID, { review: rejected, message })).rejects.toThrow(/separate review agent/);
    const failed = await reviewRecord(f, { checks: [{ status: 'failed', command: 'tests', evidence: 'exit 1' }] });
    await expect(f.cmd.commit(ID, { review: failed, message })).rejects.toThrow(/failed verification/);
    const incomplete = await reviewRecord(f, { checks: [] });
    await expect(f.cmd.commit(ID, { review: incomplete, message })).rejects.toThrow(/Invalid review record fields: checks/);
    const stale = await reviewRecord(f);
    await changed(worktree, 3);
    await expect(f.cmd.commit(ID, { review: stale, message })).rejects.toThrow(/staged tree/);
    expect(git(worktree, 'rev-parse', 'HEAD')).toBe(base);
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/No approved commit/);
    expect(remoteSource(f.remote)).toBe('');
  });

  it('runs normal hooks, preserves their edits and requires approval of the new tree', async () => {
    const f = await fixture();
    const { worktree, base } = await f.start();
    await changed(worktree);
    const review = await reviewRecord(f);
    const message = 'fix: update example';
    await write(f.hooks, 'pre-commit', '#!/bin/sh\nexit 1\n', 0o755);
    await expect(f.cmd.commit(ID, { review, message })).rejects.toThrow();
    expect(git(worktree, 'rev-parse', 'HEAD')).toBe(base);
    const post = path.join(f.tmp, 'post-commit-ran');
    const transaction = path.join(f.tmp, 'original-transaction-ran');
    await write(f.hooks, 'post-commit', `#!/bin/sh\ntouch '${post}'\n`, 0o755);
    await write(f.hooks, 'reference-transaction', `#!/bin/sh\nprintf '%s\\n' "$1" >> '${transaction}'\n`, 0o755);
    await write(f.hooks, 'pre-commit', [
      '#!/bin/sh',
      `test "$(git config --get core.hooksPath)" = '${f.hooks}' || exit 1`,
      'printf "export const value = 3;\\n" > src/example.ts',
      'git add -- src/example.ts',
      '',
    ].join('\n'));
    await expect(f.cmd.commit(ID, { review, message })).rejects.toThrow(/changed during hooks/);
    await expect(fs.stat(post)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(git(worktree, 'rev-parse', 'HEAD')).toBe(base);
    expect(git(worktree, 'show', ':src/example.ts')).toContain('value = 3');
    await expect(f.cmd.commit(ID, { review, message })).rejects.toThrow(/staged tree/);
    const freshReview = await reviewRecord(f);
    const committed = await f.cmd.commit(ID, { review: freshReview, message });
    await expect(fs.stat(post)).resolves.toBeDefined();
    await expect(fs.readFile(transaction, 'utf8')).resolves.toContain('prepared\ncommitted');
    expect(git(worktree, 'rev-parse', 'HEAD^{tree}')).toBe(committed.tree);
    expect(git(worktree, 'rev-parse', 'HEAD^')).toBe(base);
    expect(git(worktree, 'status', '--porcelain')).toBe('');
  });

  it('leaves all branch tips unchanged if the worktree switches branches during commit', async () => {
    const f = await fixture();
    const { worktree, base } = await f.start();
    await changed(worktree);
    const review = await reviewRecord(f);
    git(worktree, 'branch', 'other-task', base);
    await write(f.hooks, 'pre-commit', [
      '#!/bin/sh',
      'git symbolic-ref HEAD refs/heads/other-task',
      'printf "export const value = 3;\\n" > src/example.ts',
      'git add -- src/example.ts',
      '',
    ].join('\n'), 0o755);
    await expect(f.cmd.commit(ID, { review, message: 'fix: update example' })).rejects.toThrow(/branch changed|non-task ref/);
    expect(git(worktree, 'rev-parse', REF)).toBe(base);
    expect(git(worktree, 'rev-parse', 'refs/heads/other-task')).toBe(base);
    expect(git(worktree, 'show', ':src/example.ts')).toContain('value = 3');
  });

  it.each(['github', 'gongfeng'] as const)('pushes the reviewed commit and opens a %s request only when authorized', async provider => {
    const f = await fixture(provider);
    const { base, commit, branch } = await approved(f);
    const github = provider === 'github';
    const url = github ? 'https://github.com/team/project/pull/42' : 'https://git.code.tencent.com/team/project/merge_requests/42';
    const tokenKey = github ? 'GH_TOKEN' : 'GONGFENG_TOKEN';
    git(f.repo, 'config', 'push.pushOption', 'merge_request.merge_when_pipeline_succeeds');
    await write(f.remote, 'hooks/pre-receive', '#!/bin/sh\ntest "${GIT_PUSH_OPTION_COUNT:-0}" = 0\n', 0o755);
    await write(f.hooks, 'pre-push', `#!/bin/sh\ntouch '${path.join(f.tmp, 'pre-push-ran')}'\n`, 0o755);
    const data = github ? { html_url: url, head: { sha: commit, ref: branch }, base: { ref: 'trunk' } }
      : { iid: 42, source_branch: branch, target_branch: 'trunk' };
    f.api.mockImplementation(async () => {
      expect(remoteSource(f.remote)).toBe(commit);
      return Response.json(data, { status: 201 });
    });
    await expect(f.cmd.publish(ID, { ...publication, confirm: false })).rejects.toThrow(/explicit authorization/);
    vi.stubEnv(tokenKey, undefined);
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/TOKEN/);
    expect(remoteSource(f.remote)).toBe('');
    expect(f.api).not.toHaveBeenCalled();
    await expect(fs.stat(path.join(f.tmp, 'pre-push-ran'))).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.appendFile(path.join(f.repo, '.git/info/exclude'), '\n/agent.config\n');
    await fs.appendFile(path.join(f.repo, 'agent.config'), `${github ? 'GITHUB_TOKEN' : tokenKey}=fixture-token\n`);
    const result = await f.cmd.publish(ID, publication);
    expect(result).toEqual({ status: 'opened', url, commit });
    expect(await fs.stat(path.join(f.tmp, 'pre-push-ran'))).toBeDefined();
    const [endpoint, options] = f.api.mock.calls[0];
    expect(endpoint).toBe(github ? 'https://api.github.com/repos/team/project/pulls'
      : 'https://git.code.tencent.com/api/v3/projects/team%2Fproject/merge_requests');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: github
      ? { Authorization: 'Bearer fixture-token' } : { 'PRIVATE-TOKEN': 'fixture-token' } });
    expect(JSON.parse(options.body)).toEqual(github
      ? { head: branch, base: 'trunk', title: publication.title, body: expect.stringContaining('## 自审\n') }
      : { source_branch: branch, target_branch: 'trunk', title: publication.title, description: expect.stringContaining('## 自审\n') });
    expect(git(f.remote, 'rev-parse', 'trunk')).toBe(base);
    await expect(f.cmd.publish(ID, publication)).resolves.toEqual(result);
    expect(f.api).toHaveBeenCalledTimes(1);
  });

  it('refuses a token from a tracked or unignored agent.config before any push', async () => {
    const f = await fixture();
    await approved(f);
    await fs.appendFile(path.join(f.repo, 'agent.config'), 'GITHUB_TOKEN=fixture-token\n');
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/Ignore agent.config/);
    git(f.repo, 'add', '--', 'agent.config');
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/tracked agent.config/);
    expect(remoteSource(f.remote)).toBe('');
    expect(f.api).not.toHaveBeenCalled();
  });

  it('reports an unconfirmed request without claiming an MR or overwriting the remote branch', async () => {
    const f = await fixture();
    const { commit } = await approved(f);
    const pushed = await f.cmd.publish(ID, publication);
    expect(pushed).toMatchObject({ status: 'requested-unconfirmed', commit, reason: expect.stringContaining('503') });
    expect(remoteSource(f.remote)).toBe(commit);
    await expect(f.cmd.publish(ID, publication)).resolves.toEqual(pushed);
    expect(f.api).toHaveBeenCalledTimes(1);
  });

  it.each(['github', 'gongfeng'] as const)('does not confirm a %s API response that contradicts the approved source', async provider => {
    const f = await fixture(provider);
    const { base, branch, commit } = await approved(f);
    const invalid = provider === 'github'
      ? { number: 24, html_url: 'https://github.com/team/project/pull/42', head: { sha: commit, ref: branch }, base: { ref: 'trunk' } }
      : { iid: 42, source_branch: branch, target_branch: 'trunk', diff_refs: { head_sha: base } };
    f.api.mockImplementation(async () => Response.json(invalid, { status: 201 }));
    await expect(f.cmd.publish(ID, publication)).resolves.toMatchObject({ status: 'requested-unconfirmed', commit });
    expect(remoteSource(f.remote)).toBe(commit);
  });

  it('pushes the approved object, not a tag whose name is the approved commit hash', async () => {
    const f = await fixture();
    const { worktree, base, commit } = await approved(f);
    git(worktree, 'tag', commit, base);
    await expect(f.cmd.publish(ID, publication)).resolves.toMatchObject({ status: 'requested-unconfirmed', commit });
    expect(remoteSource(f.remote)).toBe(commit);
  });

  it('rejects a redirected remote and an amended commit', async () => {
    const f = await fixture();
    const { worktree, commit } = await approved(f);
    const different = path.join(f.tmp, 'different.git');
    git(f.tmp, 'init', '--quiet', '--bare', different);
    git(f.repo, 'remote', 'set-url', 'team', different);
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/no longer matches/);
    expect(remoteSource(different)).toBe('');
    git(f.repo, 'remote', 'set-url', 'team', f.endpoint);
    git(worktree, 'commit', '--amend', '-m', 'amended after approval');
    expect(git(worktree, 'rev-parse', 'HEAD')).not.toBe(commit);
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/recorded commit or worktree has changed/);
    expect(remoteSource(f.remote)).toBe('');
  });

  it('blocks a moved target and requires a new base and review in the same worktree', async () => {
    const f = await fixture();
    const first = await approved(f);
    const oldReview = path.join(f.tmp, 'review.json');
    await write(f.repo, 'outside.ts', 'export const safety = false;\n');
    git(f.repo, 'add', '--', 'outside.ts');
    git(f.repo, 'commit', '-m', 'advance target');
    git(f.repo, 'push', 'team', 'trunk');
    const newBase = git(f.repo, 'rev-parse', 'HEAD');
    await expect(f.cmd.publish(ID, publication)).rejects.toThrow(/remote target moved/);
    expect(remoteSource(f.remote)).toBe('');
    git(first.worktree, 'rebase', newBase);
    git(first.worktree, 'reset', '--soft', newBase);
    const snapshot = await f.cmd.snapshot(ID, { refreshBase: true });
    expect(snapshot).toMatchObject({ base: newBase, worktree: first.worktree, branch: first.branch });
    await expect(f.cmd.commit(ID, { review: oldReview, message: 'fix: update example' })).rejects.toThrow(/staged tree/);
    const review = await reviewRecord(f);
    const second = await f.cmd.commit(ID, { review, message: 'fix: update example' });
    expect(git(first.worktree, 'rev-parse', 'HEAD^')).toBe(newBase);
    expect(second.commit).not.toBe(first.commit);
  });
});
