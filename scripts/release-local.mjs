#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { confirm, input, select } from '@inquirer/prompts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const registry = 'https://registry.npmjs.org/';
const number = '(?:0|[1-9][0-9]*)';
const prereleaseId = `(?:${number}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const versionPattern = new RegExp(`^(${number})\\.(${number})\\.(${number})(?:-(${prereleaseId}(?:\\.${prereleaseId})*))?$`);
const usage = '用法：pnpm release:local [--version <版本>] [--dry-run]';

export function parseVersion(version) {
  const match = versionPattern.exec(version);
  if (!match || match[0] !== version || match.slice(1, 4).some((part) => Number(part) > Number.MAX_SAFE_INTEGER)) {
    throw new Error('请输入有效的 npm 版本号，例如 1.3.0 或 1.3.0-rc.1（不含 v 或构建元数据）。');
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: !!match[4] };
}

function npm(cwd, args, { capture = false } = {}) {
  const checkAuth = args[0] === 'whoami';
  const result = spawnSync('npm', args, {
    cwd,
    encoding: 'utf8',
    stdio: checkAuth ? ['ignore', 'inherit', 'pipe'] : capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`npm ${args[0]} 失败（${result.signal ?? `退出码 ${result.status}`}）。`);
    error.code = result.stderr?.match(/^npm (?:error|ERR!) code (E401|ENEEDAUTH)\s*$/m)?.[1];
    throw error;
  }
  return result.stdout;
}

export function releasePackage({ root, version, dryRun, runNpm = npm }) {
  const { prerelease } = parseVersion(version);
  const tag = prerelease ? 'next' : 'latest';
  if (!dryRun) {
    try {
      const whoami = ['whoami', '--registry', registry];
      try {
        runNpm(root, whoami);
      } catch (error) {
        if (error.code !== 'E401' && error.code !== 'ENEEDAUTH') throw error;
        console.log('npm 登录已失效或尚未登录，正在启动 npm 官方仓库登录…');
        runNpm(root, ['login', `--registry=${registry}`]);
        runNpm(root, whoami);
      }
    } catch (error) {
      throw new Error(`无法验证 npm 官方仓库的登录状态，未改版本或打包。${error.message} 如需手动登录，请运行 npm login --registry=${registry}，并确认该账号有发布权限。`, { cause: error });
    }
  }
  const manifests = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json']
    .map((name) => path.join(root, name))
    .filter((file) => existsSync(file))
    .map((file) => [file, readFileSync(file)]);
  const { name } = JSON.parse(manifests[0][1]);
  const work = mkdtempSync(path.join(tmpdir(), 'keaveai-release-'));
  let published = false;
  let publishAttempted = false;
  try {
    // Update npm's manifests without creating a commit/tag or running version lifecycle hooks.
    runNpm(root, ['version', version, '--allow-same-version', '--no-git-tag-version', '--ignore-scripts']);
    // Build once, then keep lifecycle output out of npm pack's JSON stream.
    runNpm(root, ['run', 'build']);
    const packed = JSON.parse(runNpm(root, ['pack', '--json', '--pack-destination', work, '--ignore-scripts'], { capture: true }));
    const [{ filename, version: packedVersion, name: packedName } = {}] = packed;
    if (packed.length !== 1 || packedName !== name || packedVersion !== version || !filename?.endsWith('.tgz') || path.basename(filename) !== filename) {
      throw new Error(`打包产物与预期的 ${name}@${version} 不一致，已停止。`);
    }
    const tarball = path.join(work, filename);
    if (!existsSync(tarball)) throw new Error('未找到 npm pack 生成的压缩包。');
    console.log(`打包成功：${filename}`);
    if (dryRun) {
      console.log('试运行结束：未发布到 npm。');
      return;
    }

    publishAttempted = true;
    runNpm(root, ['publish', tarball, '--registry', registry, '--access', 'public', '--tag', tag, '--ignore-scripts']);
    published = true;
    console.log(`已发布 ${name}@${version}（${tag}）。请提交版本文件；本命令不创建 Git 提交或标签。`);
  } catch (error) {
    if (publishAttempted) {
      throw new Error(`${error.message} 请用 npm view ${name}@${version} version --registry=${registry} 确认该版本是否已上传；若 npm 返回 401/403/404，也请确认账号或令牌有该包的发布权限。`, { cause: error });
    }
    throw error;
  } finally {
    try {
      if (!published) {
        for (const [file, content] of manifests) writeFileSync(file, content);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}

async function main() {
  const { values: options } = parseArgs({ options: {
    version: { type: 'string' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (options.help) {
    console.log(usage);
    return;
  }
  const dryRun = options['dry-run'];
  if ((!options.version || !dryRun) && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error(`请在交互式终端运行；非交互式试运行可用 --version <版本> --dry-run。\n${usage}`);
  }

  const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  let version = options.version;
  if (!version) {
    const { major, minor, patch, prerelease } = parseVersion(pkg.version);
    const patchVersion = `${major}.${minor}.${patch + (prerelease ? 0 : 1)}`;
    const minorVersion = `${major}.${minor + 1}.0`;
    const majorVersion = `${major + 1}.0.0`;
    version = await select({
      message: `当前版本 ${pkg.version}，请选择发布版本`,
      choices: [
        { name: `修订（patch） ${patchVersion}`, value: patchVersion },
        { name: `次版本（minor） ${minorVersion}`, value: minorVersion },
        { name: `主版本（major） ${majorVersion}`, value: majorVersion },
        { name: '自定义版本号', value: 'custom' },
      ],
    });
    if (version === 'custom') {
      version = (await input({
        message: '输入版本号',
        validate(value) {
          try { parseVersion(value.trim()); return true; } catch (error) { return error.message; }
        },
      })).trim();
    }
  }
  const { prerelease } = parseVersion(version);
  if (!dryRun && !await confirm({
    message: `确认公开发布 ${pkg.name}@${version} 到 npm（${prerelease ? 'next' : 'latest'}）？`,
    default: false,
  })) {
    console.log('已取消，未打包或发布。');
    return;
  }
  releasePackage({ root: projectRoot, version, dryRun });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error.name === 'ExitPromptError') {
      console.log('已取消。');
      return;
    }
    console.error(error.message);
    process.exitCode = 1;
  });
}
