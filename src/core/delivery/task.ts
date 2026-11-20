import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  branchRef, deliveryRemote, exists, fetchBase, git, gitValue, isWithin, pinRemote, remoteHeads, splitNul, status, worktreePaths,
} from './git.js';
import { commitWithReviewGuard, configuredHooks, mergeWithReviewGuard } from './hooks.js';
import { readProjectGit, hostedProject, validateProjectGit, type ProjectGitConfig } from '../project-git.js';
import { assertReview, type DeliveryTask, reviewDescription, parseReview, repoPath, taskBranch } from './model.js';
import { createdBranch, openReviewRequest, publicationToken } from './publication.js';
import { assertWorktree, commonDir, reserveTask, saveTask, stateDir, withTask } from './store.js';

export interface StartDeliveryOptions {
  allow: string[];
  context?: string[];
  worktreeRoot?: string;
  branchPrefix?: string;
}

const ROOT_RULES = ['AGENTS.md', 'AGENTS.override.md', 'AGENTS.MD', 'CLAUDE.md', 'CLAUDE.MD'];

function taskSummary(task: DeliveryTask) {
  const { id, worktree, branch, target, base, allowedPaths, contextPaths } = task;
  const destination = 'mode' in task ? { mode: task.mode, targetWorktree: task.targetWorktree }
    : { mode: 'remote' as const, provider: task.provider, remote: task.remote };
  return { id, worktree, branch, target, base, allowedPaths, contextPaths, ...destination };
}

function filePaths(files: string[]): string[] {
  return [...new Set(files.map(repoPath))];
}

async function readContext(root: string, relative: string): Promise<Buffer> {
  const file = path.join(root, relative);
  if (!await exists(file) || !(await fs.lstat(file)).isFile() || !isWithin(root, await fs.realpath(file))) {
    throw new Error(`Required context '${relative}' is not a readable, regular file in both worktrees.`);
  }
  return fs.readFile(file);
}

async function verifyContext(source: string, task: DeliveryTask): Promise<void> {
  // Directory entries, not lstat, preserve exact casing on case-insensitive filesystems.
  const names = new Set((await Promise.all([fs.readdir(source), fs.readdir(task.worktree)])).flat());
  for (const rule of ROOT_RULES) {
    if (names.has(rule) && !task.contextPaths.includes(rule)) task.contextPaths.push(rule);
  }
  for (const relative of task.contextPaths) {
    const [working, baseline] = await Promise.all([readContext(source, relative), readContext(task.worktree, relative)]);
    if (!working.equals(baseline)) {
      throw new Error(`Required context '${relative}' differs from the target branch. Use a shared, committed task baseline.`);
    }
    await requireContextAtBase(task, relative);
  }
}

async function requireContextAtBase(task: DeliveryTask, relative: string): Promise<void> {
  const type = await gitValue(task.worktree, 'cat-file', '-t', `${task.base}:${relative}`).catch(() => '');
  if (type !== 'blob') throw new Error(`Required context '${relative}' is missing at the task base.`);
}

async function snapshot(task: DeliveryTask, allowEmpty = false) {
  const { worktree, base } = task;
  if (await gitValue(worktree, 'rev-parse', 'HEAD') !== base) {
    throw new Error('Task HEAD is not at its recorded base. A commit or rebase cannot reuse the old review.');
  }
  await requireNoOperation(worktree);
  const entries = await status(worktree);
  if (entries.some(entry => entry[1] !== ' ')) {
    throw new Error('The worktree has unstaged or untracked changes. Stage only the explicit task files before review.');
  }
  const tree = await gitValue(worktree, 'write-tree');
  const files = splitNul(await gitValue(worktree, 'diff', '--name-only', '--no-renames', '--no-ext-diff',
    '--ignore-submodules=none', '-z', base, tree, '--'));
  if (!files.length && !allowEmpty) throw new Error('No staged code changes to review.');
  const outside = files.filter(file => !task.allowedPaths.some(allowed => file === allowed || file.startsWith(`${allowed}/`)));
  if (outside.length) throw new Error(`Staged changes outside the task boundary: ${outside.map(file => JSON.stringify(file)).join(', ')}.`);
  return { ...taskSummary(task), tree, files };
}

async function requireNoOperation(worktree: string) {
  const gitDir = await gitValue(worktree, 'rev-parse', '--absolute-git-dir');
  for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
    if (await exists(path.join(gitDir, marker))) throw new Error('Finish or abort the in-progress Git operation first.');
  }
}

async function requireSameRemote(task: Extract<DeliveryTask, { remote: string }>): Promise<string> {
  const { url, identity } = await deliveryRemote(task.worktree, task.remote);
  if (identity !== task.remoteIdentity) {
    throw new Error('The task remote URL no longer matches the original destination. Nothing was published.');
  }
  return url;
}

async function branchTip(worktree: string) {
  const [commit, tree, ...parents] = (await gitValue(worktree, 'log', '-1', '--no-show-signature', '--format=%H %T %P', 'HEAD', '--')).trim().split(' ');
  return { commit, tree, parents };
}

async function remoteDestination(source: string, config: ProjectGitConfig) {
  const { url, identity } = await validateProjectGit(source, config);
  const pinned = await pinRemote(source, config.remote, url);
  const base = await fetchBase(source, config.remote, config.target, pinned);
  return { provider: config.provider, remote: config.remote, remoteIdentity: identity, base };
}

export class DeliveryTaskCommand {
  constructor(private readonly cwd = process.cwd()) {}

  async start(id: string, options: StartDeliveryOptions) {
    const branch = taskBranch(id, options.branchPrefix);
    const allowedPaths = filePaths(options.allow);
    if (!allowedPaths.length) throw new Error('Specify at least one allowed path.');
    const contextPaths = filePaths(options.context ?? []);
    const source = await fs.realpath(await gitValue(this.cwd, 'rev-parse', '--show-toplevel'));
    const config = await readProjectGit(source);
    const target = config?.target ?? await gitValue(source, 'symbolic-ref', '--quiet', 'HEAD').then(ref => ref.slice('refs/heads/'.length))
      .catch(() => { throw new Error('Local delivery requires a checked-out branch, not detached HEAD.'); });
    if (branch === target) throw new Error('The source and target branches must be different.');
    if (!config) await requireNoOperation(source);
    const common = await commonDir(source);
    await git(source, ['check-ref-format', branchRef(branch)]);
    const sourcePaths = (await worktreePaths(source)).map(file => path.resolve(file));
    const primary = sourcePaths[0] ?? source;
    const requestedRoot = options.worktreeRoot
      ? path.resolve(this.cwd, options.worktreeRoot)
      : `${primary}.keaveai-worktrees`;
    const requireOutside = (root: string) => {
      if ([...sourcePaths, source, common].some(file => isWithin(file, root))) {
        throw new Error('The worktree root must be outside the shared clone and existing worktrees.');
      }
    };
    requireOutside(requestedRoot);
    if (!options.worktreeRoot) await fs.mkdir(requestedRoot, { recursive: true });
    const root = await fs.realpath(requestedRoot);
    requireOutside(root);
    const worktree = path.join(root, id);
    if (sourcePaths.some(file => isWithin(worktree, file)) || await exists(worktree)) {
      throw new Error(`Worktree path already exists: ${worktree}`);
    }

    const dir = stateDir(common, id);
    await reserveTask(dir, id);
    let task: DeliveryTask | undefined;
    try {
      const destination = config ? await remoteDestination(source, config) : { mode: 'local' as const, targetWorktree: source,
        base: await gitValue(source, 'rev-parse', '--verify', `${branchRef(target)}^{commit}`)
          .catch(() => { throw new Error('Local delivery requires an initial commit on the current branch.'); }) };
      const { base } = destination;
      task = { id, worktree, branch, branchPrefix: options.branchPrefix, target, allowedPaths, contextPaths, ...destination };
      await git(source, ['worktree', 'add', '-b', branch, '--', worktree, base]);
      await assertWorktree(task, common);
      if ((await status(worktree)).length) throw new Error('A new task worktree must start clean.');
      await verifyContext(source, task);
      await saveTask(dir, task);
      return taskSummary(task);
    } catch (error) {
      try {
        // post-checkout can fail after Git has already created the linked worktree and branch.
        if (task && (await worktreePaths(source)).includes(worktree)) {
          await assertWorktree(task, common);
          if (await gitValue(worktree, 'rev-parse', 'HEAD') !== task.base) throw new Error('Unexpected branch tip.');
          await git(source, ['worktree', 'remove', '--', worktree]);
          await git(source, ['update-ref', '-d', branchRef(branch), task.base]);
        } else if (task && await exists(worktree)) {
          throw new Error('Unexpected worktree path.');
        }
      } catch {
        throw new Error(`${(error as Error).message} Setup was incomplete; inspect ${worktree} and '${branch}' before retrying.`);
      } finally {
        await fs.rmdir(dir);
      }
      throw error;
    }
  }

  async snapshot(id: string, options: { refreshBase?: boolean } = {}) {
    return withTask(this.cwd, id, async (task, dir) => {
      if (!options.refreshBase) return snapshot(task);
      let base: string;
      if ('mode' in task) {
        if (task.merged) throw new Error('An already merged task cannot change its review base.');
        base = await gitValue(task.worktree, 'rev-parse', '--verify', `${branchRef(task.target)}^{commit}`);
      } else {
        if (task.publication) throw new Error('An already published task cannot change its review base.');
        const pinned = await pinRemote(task.worktree, task.remote, await requireSameRemote(task));
        const heads = await remoteHeads(task.worktree, task.remote, [task.branch], pinned);
        if (heads.has(branchRef(task.branch))) throw new Error('An already pushed task cannot change its review base.');
        base = await fetchBase(task.worktree, task.remote, task.target, pinned);
      }
      const refreshed = { ...task, base, approval: undefined };
      for (const relative of task.contextPaths) await requireContextAtBase(refreshed, relative);
      const result = await snapshot(refreshed, true);
      await saveTask(dir, refreshed);
      return result;
    });
  }

  async commit(id: string, options: { review: string; message: string }) {
    if (!options.message.trim()) throw new Error('A non-empty commit message is required.');
    const review = parseReview(await fs.readFile(path.resolve(this.cwd, options.review), 'utf8'));
    return withTask(this.cwd, id, async (task, dir) => {
      if (task.approval) throw new Error('This task already has a recorded commit.');
      const { worktree, branch, base } = task;
      const approved = await snapshot(task);
      assertReview(review, task, approved.tree);

      const guarded = await commitWithReviewGuard(task, dir, approved.tree, options.message);
      await assertWorktree(task, await commonDir(this.cwd));
      const actual = await branchTip(worktree);
      if (actual.parents.length !== 1 || actual.parents[0] !== base) {
        throw new Error('Commit parent changed during commit. Inspect the task branch; nothing was approved for publication.');
      }
      if (!guarded || actual.tree !== approved.tree || (await status(worktree)).length) {
        // Withdraw only the just-created task commit, leaving index and working files intact for a new review.
        await git(worktree, ['update-ref', '-m', 'KeaveAI: commit differs from reviewed snapshot', branchRef(branch), base, actual.commit]);
        throw new Error('Commit or worktree changed during hooks. Edits are preserved; stage and review the new snapshot.');
      }
      await saveTask(dir, { ...task, approval: { commit: actual.commit, review } });
      return { ...approved, commit: actual.commit };
    });
  }

  async merge(id: string, options: { confirm?: boolean }) {
    if (!options.confirm) throw new Error('Local merge requires explicit authorization with --confirm.');
    return withTask(this.cwd, id, async (task, dir) => {
      if (!('mode' in task)) throw new Error('This task is linked to a remote; use delivery publish.');
      if (!task.approval) throw new Error('No approved commit to merge.');
      const root = await fs.realpath(await gitValue(this.cwd, 'rev-parse', '--show-toplevel'));
      if (root !== task.targetWorktree || await gitValue(root, 'symbolic-ref', '--quiet', 'HEAD') !== branchRef(task.target)) {
        throw new Error(`Run the merge from the original worktree with '${task.target}' checked out.`);
      }
      await requireNoOperation(root);
      const actual = await branchTip(task.worktree);
      if (actual.commit !== task.approval.commit || actual.parents.length !== 1 || actual.parents[0] !== task.base ||
          (await status(task.worktree)).length) {
        throw new Error('The reviewed task commit or worktree has changed. Re-review before merging.');
      }
      assertReview(task.approval.review, task, actual.tree);
      const result = { status: 'merged-local', branch: task.target, commit: actual.commit } as const;
      if (task.merged === actual.commit) return result;
      if (await gitValue(root, 'rev-parse', 'HEAD') !== task.base) {
        throw new Error('The local target branch moved. Update the task base and review again before merging.');
      }
      if ((await status(root)).some(entry => entry !== '?? agent.config' && entry !== '?? agent.config.example')) {
        throw new Error('The target worktree has changes. Save them before local merge; KeaveAI will not stash or overwrite them.');
      }
      if (!await mergeWithReviewGuard(root, task, dir, actual.tree, actual.commit) ||
          await gitValue(root, 'rev-parse', 'HEAD') !== actual.commit) {
        throw new Error('Could not verify the local merge. Inspect the target before retrying.');
      }
      await saveTask(dir, { ...task, merged: actual.commit });
      return result;
    });
  }

  async publish(id: string, options: { confirm?: boolean; title: string }) {
    const title = options.title.trim();
    if (!options.confirm) throw new Error('Publishing requires explicit authorization with --confirm.');
    if (!title || title.length > 255 || title.includes('\n') || title.includes('\r') || title.includes('\0')) {
      throw new Error('Use a single-line merge request title of at most 255 characters.');
    }
    return withTask(this.cwd, id, async (task, dir) => {
      if ('mode' in task) throw new Error('This task uses local delivery; use delivery merge.');
      const { worktree, branch, base, provider, remote, target, approval } = task;
      if (!approval) throw new Error('No approved commit to publish.');
      const actual = await branchTip(worktree);
      if (actual.commit !== approval.commit || actual.parents.length !== 1 || actual.parents[0] !== base ||
          (await status(worktree)).length) {
        throw new Error('The recorded commit or worktree has changed. Re-review before publication.');
      }
      assertReview(approval.review, task, actual.tree);
      const url = await requireSameRemote(task);
      if (task.publication) return task.publication;
      const token = publicationToken(provider);
      const { repository } = hostedProject(provider, url);
      const pinned = await pinRemote(worktree, remote, url);

      const heads = await remoteHeads(worktree, remote, [target, branch], pinned);
      const destination = branchRef(branch);
      if (branch === target || heads.get(branchRef(target)) !== base) {
        throw new Error('The remote target moved or no longer exists. Refresh the base and review again before publishing.');
      }
      if (heads.has(destination)) {
        throw new Error('The task branch already exists on the remote. Verify the MR there; KeaveAI will not overwrite it.');
      }
      await configuredHooks(worktree);
      // Disambiguate the approved object and ignore configured push options (including auto-merge).
      const refspec = `${actual.commit}^{commit}:${destination}`;
      const pushed = await git(worktree, [...pinned, '-c', 'push.pushOption=', 'push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no',
        `--force-with-lease=${destination}:`, remote, refspec], {
        network: true,
        failure: 'Git push did not complete. Check the pre-push hook, remote permissions and whether the task branch already exists.',
      });
      if (!createdBranch(pushed.stdout, refspec)) {
        throw new Error('Git did not confirm a new task branch. Check the remote branch before retrying.');
      }
      const pending = { status: 'requested-unconfirmed', commit: actual.commit, branch,
        reason: 'The task branch was pushed, but creation of a PR/MR has not been confirmed.' } as const;
      await saveTask(dir, { ...task, publication: pending });
      const result = await openReviewRequest({ provider, repository, branch, target, commit: actual.commit,
        title, description: reviewDescription(actual.commit, approval.review) }, token);
      let publication: NonNullable<Extract<DeliveryTask, { remote: string }>['publication']>;
      if ('reason' in result) {
        publication = { ...pending, reason: result.reason };
      } else {
        const verified = !result.verifySource || await remoteHeads(worktree, remote, [branch], pinned)
          .then(refs => refs.get(destination) === actual.commit).catch(() => false);
        publication = verified ? { status: 'opened', commit: actual.commit, url: result.url }
          : { ...pending, reason: 'The API returned a request but its source commit could not be verified. Check the remote project.' };
      }
      await saveTask(dir, { ...task, publication });
      return publication;
    });
  }
}
