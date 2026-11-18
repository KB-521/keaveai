import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { InitCommand } from '../../src/core/init.js';

describe('InitCommand agent.config', () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
  });

  it('creates an empty agent.config file in the project root when missing', async () => {
    const projectDir = path.join(os.tmpdir(), `weaveai-init-agent-config-${randomUUID()}`);
    createdDirs.push(projectDir);
    await fs.mkdir(projectDir, { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await new InitCommand({ tools: 'none' }).execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('');
  });

  it('does not overwrite an existing agent.config file', async () => {
    const projectDir = path.join(os.tmpdir(), `weaveai-init-agent-config-${randomUUID()}`);
    createdDirs.push(projectDir);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'agent.config'), 'existing config\n');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await new InitCommand({ tools: 'none' }).execute(projectDir);

    await expect(fs.readFile(path.join(projectDir, 'agent.config'), 'utf-8'))
      .resolves.toBe('existing config\n');
  });
});
