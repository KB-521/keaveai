import type { Command } from 'commander';
import path from 'node:path';
import { chooseProjectGit, ensureAgentConfigExample, type InitGitOptions } from '../core/init-project-git.js';
import { gitValue } from '../core/delivery/git.js';
import { writeProjectGit } from '../core/project-git.js';
import { isInteractive } from '../utils/interactive.js';

export function registerLinkCommand(program: Command): void {
  program.command('link [path]')
    .description('Link an existing Git remote for delivery, or switch to local delivery')
    .option('--git-provider <name>', 'GitHub (github) or Tencent Gongfeng (gongfeng)')
    .option('--git-remote <name>', 'Existing named Git remote')
    .option('--git-target <branch>', 'Target branch')
    .option('--local', 'Remove remote delivery settings, leaving other settings and Git remotes intact')
    .action(async (target: string | undefined, options: InitGitOptions & { local?: boolean }) => {
      try {
        const root = await gitValue(path.resolve(target ?? '.'), 'rev-parse', '--show-toplevel');
        const explicit = [options.gitProvider, options.gitRemote, options.gitTarget].some(value => value !== undefined);
        if (options.local && explicit) throw new Error('--local cannot be combined with --git-* options.');
        const interactive = isInteractive();
        if (!options.local && !explicit && !interactive) throw new Error('Pass all three --git-* options or --local outside an interactive terminal.');
        const config = options.local ? undefined : await chooseProjectGit(root, options, interactive);
        if (!config && !options.local) {
          console.log('Git link unchanged. Add a supported named remote if none is configured.');
          return;
        }
        await writeProjectGit(root, config);
        await ensureAgentConfigExample(root);
        console.log(config ? `Git delivery: ${config.provider}, ${config.remote} → ${config.target} (agent.config)`
          : 'Remote Git link removed. New tasks use local delivery.');
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exitCode = 1;
      }
    });
}
