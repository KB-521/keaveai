import * as fs from 'fs';
import path from 'path';

export const AGENT_CONFIG_FILE = 'agent.config';

export async function ensureAgentConfigFile(projectPath: string): Promise<void> {
  await fs.promises.mkdir(projectPath, { recursive: true });

  try {
    await fs.promises.writeFile(path.join(projectPath, AGENT_CONFIG_FILE), '', { flag: 'wx' });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') {
      throw error;
    }
  }
}
