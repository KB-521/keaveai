import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { getPackageRoot } from './database-assets.js';
import { deliveryRemote, gitValue } from './delivery/git.js';
import {
  gitProviderSchema, gitSetupDefaults, hostedProject, projectGitInput, readProjectGit, validateProjectGit, type ProjectGitConfig,
} from './project-git.js';

export interface InitGitOptions {
  gitProvider?: string;
  gitRemote?: string;
  gitTarget?: string;
}

export async function chooseProjectGit(dir: string, options: InitGitOptions, interactive: boolean): Promise<ProjectGitConfig | undefined> {
  const { gitProvider, gitRemote, gitTarget } = options;
  if (gitProvider !== undefined || gitRemote !== undefined || gitTarget !== undefined) {
    const config = projectGitInput(gitProvider, gitRemote, gitTarget);
    if (!await gitSetupDefaults(dir)) throw new Error('Add a Git remote at the project root before configuring delivery.');
    await validateProjectGit(dir, config);
    return config;
  }
  if (!interactive) return;
  const local = await gitSetupDefaults(dir);
  if (!local) return;

  const { select, input, confirm } = await import('@inquirer/prompts');
  const previous = await readProjectGit(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code) throw error;
    console.warn('Existing Git delivery settings are invalid. Configure them again, or choose Skip to keep the file unchanged.');
    return undefined;
  });
  if (previous && !await confirm({ message: 'Change existing Git delivery configuration?', default: false })) return;
  const candidates = await Promise.all(local.remotes.map(async name => {
    const remote = await deliveryRemote(dir, name).catch(() => undefined);
    const provider = remote && gitProviderSchema.options.find(choice => {
      try { hostedProject(choice, remote.url); return true; } catch { return false; }
    });
    return { name, provider };
  }));
  const preferred = previous?.provider ?? candidates.find(candidate => candidate.name === 'origin')?.provider;
  const provider = await select({
    message: 'Git repository platform',
    choices: [{ name: 'GitHub', value: 'github' }, { name: 'Tencent Gongfeng (腾讯工蜂)', value: 'gongfeng' },
      { name: 'Skip Git delivery configuration', value: 'skip' }],
    default: preferred ?? 'skip',
  });
  if (provider === 'skip') return;
  const matches = candidates.filter(candidate => candidate.provider === provider);
  if (!matches.length) throw new Error('No matching named Git remote. Add one or choose Skip.');
  const remote = await select({ message: 'Git remote', choices: matches.map(({ name }) => ({ name, value: name })),
    default: previous?.remote ?? 'origin' });
  const ref = await gitValue(dir, 'symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`).catch(() => undefined);
  const target = await input({ message: 'Target branch', default: previous?.remote === remote ? previous.target
    : ref?.slice(`refs/remotes/${remote}/`.length),
    required: true });
  const config = projectGitInput(provider, remote, target);
  await validateProjectGit(dir, config);
  return config;
}

export async function ensureAgentConfigExample(dir: string): Promise<void> {
  const example = 'agent.config.example';
  try {
    await fs.copyFile(path.join(getPackageRoot(), example), path.join(dir, example), constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}
