import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PREVIOUS_SKILL_INDEX_HASHES,
  RETIRED_SKILL_FINGERPRINTS,
} from './retired-skill-fingerprints.js';

const CI_SKILL = 'ci-test-codegen';
const CI_DEFAULT_PATH = `.codex/skills/${CI_SKILL}`;
const WORKFLOW_INDEX = 'ai-workflow/skills/INDEX.md';
const LEGACY_TOOL_DIRS = ['.codex', '.cursor', '.claude', '.agents'];
const LEGACY_BINDING = /\b(?:metac-inc\.com|metac\.yuque\.com|com\.metac|my-archetype|sqlmapplus|OpenDAO|dachui|sunwencong|xuyang)\b/i;

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function statIfPresent(file: string) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

// Do not follow links inside the project: a retired-looking path may point at user data elsewhere.
async function inspectPath(root: string, relative: string) {
  const segments = relative.split('/');
  let fullPath = root;
  for (const [index, segment] of segments.entries()) {
    fullPath = path.join(fullPath, segment);
    const stat = await statIfPresent(fullPath);
    if (!stat) return undefined;
    if (stat.isSymbolicLink() || (index < segments.length - 1 && !stat.isDirectory())) {
      return { fullPath, unsafe: true } as const;
    }
    if (index === segments.length - 1) return { fullPath, stat } as const;
  }
}

async function fingerprint(file: string): Promise<string | undefined> {
  const stat = await fs.lstat(file);
  if (stat.isFile()) return sha256(await fs.readFile(file));
  if (!stat.isDirectory()) return undefined;

  const entries = new Map<string, string>();
  async function walk(dir: string, prefix: string): Promise<boolean> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        entries.set(`${relative}/`, '');
        if (!await walk(full, `${relative}/`)) return false;
      } else if (entry.isFile()) {
        entries.set(relative, sha256(await fs.readFile(full)));
      } else {
        return false;
      }
    }
    return true;
  }
  if (!await walk(file, '')) return undefined;
  return sha256([...entries.keys()].sort().map((key) => `${key}\0${entries.get(key)}\n`).join(''));
}

function retiredUnits(toolDirs: readonly string[] = []): Map<string, string> {
  const units = new Map(Object.entries(RETIRED_SKILL_FINGERPRINTS));
  const ciFingerprint = RETIRED_SKILL_FINGERPRINTS[CI_DEFAULT_PATH];
  for (const dir of new Set([...LEGACY_TOOL_DIRS, ...toolDirs])) {
    if (dir.startsWith('.') && /^[\w.-]+$/.test(dir) && dir !== '.' && dir !== '..') {
      units.set(`${dir}/skills/${CI_SKILL}`, ciFingerprint);
    }
  }
  units.set(`global/${CI_SKILL}`, ciFingerprint);
  return units;
}

export async function removeRetiredDefaultSkills(root: string, toolDirs: readonly string[] = []): Promise<void> {
  const retained: string[] = [];
  for (const [relative, expected] of retiredUnits(toolDirs)) {
    const candidate = await inspectPath(root, relative);
    if (!candidate) continue;
    if (candidate.unsafe || await fingerprint(candidate.fullPath) !== expected) {
      retained.push(relative);
      continue;
    }
    await fs.rm(candidate.fullPath, { recursive: candidate.stat.isDirectory() });
  }

  if (retained.length > 0) {
    console.warn('KeaveAI kept modified or unrecognized retired skill paths; review them manually:\n' +
      [...new Set(retained)].sort().map((relative) => `  - ${relative}`).join('\n'));
  }
}

export async function shouldReplaceSkillIndex(source: string, project: string): Promise<boolean> {
  const current = await inspectPath(project, WORKFLOW_INDEX);
  if (!current) return true;
  const incoming = await inspectPath(source, WORKFLOW_INDEX);
  if (!incoming || incoming.unsafe || !incoming.stat.isFile()) return false;
  if (!current.unsafe && current.stat.isFile()) {
    const digest = sha256(await fs.readFile(current.fullPath));
    if (PREVIOUS_SKILL_INDEX_HASHES.has(digest) || digest === sha256(await fs.readFile(incoming.fullPath))) {
      return true;
    }
  }
  console.warn(`KeaveAI kept the local ${WORKFLOW_INDEX}; review or regenerate it with init-skills if needed.`);
  return false;
}

export async function validateSkillPack(source: string): Promise<void> {
  function reject(relative: string): never {
    throw new Error(`Incompatible KeaveAI database asset '${relative}'. Use a clean, current database source.`);
  }

  for (const relative of retiredUnits().keys()) {
    if (await inspectPath(source, relative)) reject(relative);
  }

  async function scan(full: string, relative: string): Promise<void> {
    const stat = await statIfPresent(full);
    if (!stat) return;
    if (stat.isDirectory()) {
      for (const entry of await fs.readdir(full)) {
        await scan(path.join(full, entry), `${relative}/${entry}`);
      }
    } else if (!stat.isFile() || LEGACY_BINDING.test(await fs.readFile(full, 'utf8'))) {
      reject(relative);
    }
  }

  for (const relative of ['ai-workflow', 'global', ...LEGACY_TOOL_DIRS]) {
    await scan(path.join(source, relative), relative);
  }
}

export { WORKFLOW_INDEX };
