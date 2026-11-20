# KeaveAI Scripts

Utility scripts for KeaveAI maintenance and development.

## update-flake.sh

Updates `flake.nix` pnpm dependency hash automatically.

**When to use**: After updating dependencies (`pnpm install`, `pnpm update`).

**Usage**:
```bash
./scripts/update-flake.sh
```

**What it does**:
1. Reads version from `package.json` (dynamically used by `flake.nix`)
2. Automatically determines the correct pnpm dependency hash
3. Updates the hash in `flake.nix`
4. Verifies the build succeeds

**Example workflow**:
```bash
# After dependency updates
pnpm install
./scripts/update-flake.sh
git add flake.nix
git commit -m "chore: update flake.nix dependency hash"
```

## postinstall.js

Post-installation script that runs after package installation.

## pack-version-check.mjs

Validates package version consistency before publishing.

## 本地发布 npm：`pnpm release:local`

在源码仓库里安装依赖后，运行以下命令。确认发布后，如果 npm 官方仓库报告未登录或登录失效，脚本会自动运行 `npm login --registry=https://registry.npmjs.org/`。请用有发布权限的账号完成登录；脚本复查通过后才会继续。

```bash
pnpm release:local
```

选择 patch、minor、major 或输入自定义版本。确认后，脚本先检查官方仓库的登录状态，再更新本地版本、构建并打包，然后将同一个 `.tgz` 公开发布到 `registry.npmjs.org`。正式版本使用 `latest`，预发布版本（例如 `1.3.0-rc.1`）使用 `next`。如果 npm 要求双重认证，请按终端提示操作。

仅验证构建和打包，不发布：

```bash
pnpm release:local --dry-run
pnpm release:local --version 1.3.0-rc.1 --dry-run
```

试运行或失败会恢复源版本文件，临时 tarball 会自动清理。成功发布后请自行提交版本文件；脚本不创建 Git 提交或标签。现有 Changesets CI 发布命令 `pnpm release:ci` 不变。
