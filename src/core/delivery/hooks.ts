import { promises as fs } from 'node:fs';
import path from 'node:path';
import { branchRef, exists, git, gitValue } from './git.js';
import type { DeliveryTask } from './model.js';

const restoreConfig = `
if [ "$KEAVEAI_HOOKS_HAD_PARAMS" = 1 ]; then
  export GIT_CONFIG_PARAMETERS="$KEAVEAI_HOOKS_SAVED_PARAMS"
else
  unset GIT_CONFIG_PARAMETERS
fi
`;

const forward = `#!/bin/sh
${restoreConfig}
exec "$KEAVEAI_HOOKS_ORIGINAL/$(basename "$0")" "$@"
`;

// Git invokes this before installing any ref updates and passes the actual commit object,
// including edits made by pre-commit, prepare-commit-msg or commit-msg hooks.
const verifyTransaction = `#!/bin/sh
set -eu
${restoreConfig}
refs=$(mktemp "$KEAVEAI_HOOKS_OVERLAY/refs.XXXXXX")
trap 'rm -f "$refs"' EXIT
cat > "$refs"
if [ "$1" = prepared ] && [ -s "$refs" ]; then
  if [ "$(git symbolic-ref -q HEAD)" != "$KEAVEAI_HOOKS_REF" ]; then
    echo 'KeaveAI: worktree branch changed during commit; refusing the ref update.' >&2
    exit 1
  fi
  checked=0
  while IFS=' ' read -r old new ref; do
    case "$ref" in
      HEAD|"$KEAVEAI_HOOKS_REF") ;;
      AUTO_MERGE)
        # Normal Git cleanup after a commit, never a branch update.
        case "$new" in ''|*[!0]*) exit 1 ;; esac
        continue ;;
      *) echo 'KeaveAI: commit would update a non-task ref.' >&2; exit 1 ;;
    esac
    if [ "$old" != "$KEAVEAI_HOOKS_BASE" ] ||
       [ "$(git --no-replace-objects show -s --no-show-signature --format='%T %P' "$new^{commit}" --)" != "$KEAVEAI_HOOKS_TREE $KEAVEAI_HOOKS_BASE" ]; then
      echo 'KeaveAI: commit tree or base changed during hooks; edits preserved. Stage and review the new snapshot.' >&2
      exit 1
    fi
    checked=1
  done < "$refs"
  if [ "$checked" = 1 ]; then touch "$KEAVEAI_HOOKS_OVERLAY/verified"; fi
fi
if [ "$KEAVEAI_HOOKS_HAS_TRANSACTION" = 1 ]; then
  "$KEAVEAI_HOOKS_ORIGINAL/reference-transaction" "$@" < "$refs"
fi
`;

export async function configuredHooks(cwd: string): Promise<string> {
  const original = await gitValue(cwd, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks');
  const configured = await git(cwd, ['config', '--get', 'core.hooksPath'], { codes: [0, 1] });
  if (configured.code === 0 && (!await exists(original) || !(await fs.stat(original)).isDirectory())) {
    throw new Error('Configured Git hooks directory is unavailable in this worktree. Follow the repository hook setup before delivery.');
  }
  return original;
}

export async function commitWithReviewGuard(task: DeliveryTask, dir: string, tree: string, message: string): Promise<boolean> {
  const original = await configuredHooks(task.worktree);
  const overlay = await fs.mkdtemp(path.join(dir, 'hooks-'));
  let hasTransaction = false;
  try {
    for (const name of await exists(original) ? await fs.readdir(original) : []) {
      if (name.endsWith('.sample')) continue;
      const file = path.join(original, name);
      if (!await exists(file)) continue;
      const stat = await fs.stat(file);
      if (!stat.isFile() || (process.platform !== 'win32' && !(stat.mode & 0o111))) continue;
      if (name === 'reference-transaction') {
        hasTransaction = true;
      } else {
        await fs.writeFile(path.join(overlay, name), forward, { mode: 0o700 });
      }
    }
    await fs.writeFile(path.join(overlay, 'reference-transaction'), verifyTransaction, { mode: 0o700 });
    await git(task.worktree, ['-c', `core.hooksPath=${overlay}`, '-c', 'maintenance.auto=false', 'commit', '-m', message], { env: {
      KEAVEAI_HOOKS_ORIGINAL: original,
      KEAVEAI_HOOKS_OVERLAY: overlay,
      KEAVEAI_HOOKS_HAS_TRANSACTION: hasTransaction ? '1' : '0',
      KEAVEAI_HOOKS_REF: branchRef(task.branch),
      KEAVEAI_HOOKS_TREE: tree,
      KEAVEAI_HOOKS_BASE: task.base,
      KEAVEAI_HOOKS_HAD_PARAMS: process.env.GIT_CONFIG_PARAMETERS === undefined ? '0' : '1',
      KEAVEAI_HOOKS_SAVED_PARAMS: process.env.GIT_CONFIG_PARAMETERS ?? '',
    } });
    return await exists(path.join(overlay, 'verified'));
  } finally {
    await fs.rm(overlay, { recursive: true, force: true });
  }
}
