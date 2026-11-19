# CLI Reference

The public KeaveAI CLI currently exposes only the project setup and sync commands below. Legacy workflow commands remain hidden from top-level help and shell completion while the CLI surface is being narrowed.

## Commands

| Command | Purpose |
|---------|---------|
| `keaveai init [path]` | Initialize KeaveAI content in a project |
| `keaveai update [path]` | Refresh initialized project assets from the bundled database |
| `keaveai break-change [path]` | Migrate initialized content to the bundled breaking layout |
| `keaveai database-update [path]` | Refresh the bundled `keaveai-database/` directory from an explicitly configured Git source |
| `keaveai issue` | Push initialized KeaveAI content as a GitLab merge request |
| `keaveai help [command]` | Show CLI help |

## Global Options

| Option | Description |
|--------|-------------|
| `--version`, `-V` | Show version number |
| `--no-color` | Disable color output |
| `--help`, `-h` | Display help for a command |

## `keaveai init`

Initialize KeaveAI in your project.

```bash
keaveai init [path] [options]
```

| Option | Description |
|--------|-------------|
| `--tools <tools>` | Configure AI tools non-interactively. Use `all`, `none`, or comma-separated tool IDs |
| `--force` | Auto-cleanup legacy files without prompting |
| `--profile <profile>` | Override global config profile (`core` or `custom`) |

Current supported tool ID:

```text
codex
```

Examples:

```bash
keaveai init
keaveai init . --tools codex
keaveai init . --tools none
keaveai init . --force
```

The command also ensures the project root has an `agent.config` file.
It installs content from the bundled `keaveai-database/` directory and does not pull from GitLab during normal initialization.

## `keaveai update`

Refresh KeaveAI database assets for an initialized project from the bundled `keaveai-database/` directory.

```bash
keaveai update [path]
```

Example:

```bash
keaveai update .
```

The command also ensures the project root has an `agent.config` file.
It does not fetch from Git. Use `keaveai database-update --repo <url>` when the bundled database itself needs a refresh.

For retired skills, `update` removes only copies that exactly match a known old bundled asset. Modified or unrecognized copies are kept and reported for manual review. Project-specific rules, skills, and custom skill indexes are preserved by the retirement cleanup; use `init-skills` to regenerate a custom index if needed.

## `keaveai break-change`

Migrate an initialized project to the bundled database layout while preserving existing SDD content.

```bash
keaveai break-change [path]
```

The command:

1. Copies `keaveai/sdd` or existing `ai-workflow/sdd` to a temporary root-level `sdd` directory.
2. Removes root-level `.codex`, `.cursor`, `.agents`, `keaveai`, `.claude`, `AGENTS.md`, and stale `global`.
3. Copies bundled `keaveai-database/` contents into the project root. Bundled `.codex/skills/*` stays under `.codex/skills/*`.
4. Copies legacy bundled `global/*` content into `.codex/skills/*` when a legacy database layout is used.
5. Moves the preserved SDD content to `ai-workflow/sdd`.
6. Ensures `.gitignore` contains `ai-workflow/memory/LOCAL.md`.
7. Ensures the project root has an `agent.config` file.

Example:

```bash
keaveai break-change .
```

## `keaveai database-update`

Refresh the local bundled `keaveai-database/` directory from a KeaveAI database Git repository. There is no built-in repository URL. The source is checked for retired default assets and known legacy bindings before the target is replaced.

```bash
keaveai database-update [path] [options]
```

| Option | Description |
|--------|-------------|
| `--repo <url>` | Database Git source; required unless `KEAVEAI_DATABASE_REPO_URL` is set |
| `--branch <branch>` | Source branch; defaults to `KEAVEAI_DATABASE_REPO_BRANCH` or `main` |

When `path` is omitted, the command updates the package's bundled `keaveai-database/` directory.

Examples:

```bash
keaveai database-update --repo https://example.org/team/keaveai-database.git
keaveai database-update ./keaveai-database --repo /path/to/database-repo --branch main
```

## `keaveai issue`

Push initialized KeaveAI content as a GitLab merge request.

```bash
keaveai issue [options]
```

| Option | Description |
|--------|-------------|
| `--remote <repo>` | GitLab repository URL or remote name to push to |
| `--target <branch>` | Merge request target branch |
| `--branch <name>` | Source branch to create |
| `--title <title>` | Merge request title |
| `--message <text>` | Commit message |
| `--description <text>` | Merge request description |
| `--include <paths>` | Comma-separated initialized source paths to include |
| `--dry-run` | Show the planned commit and push without changing git state |

Default behavior sends a single extracted commit containing `ai-workflow/` and `.codex/skills/` to the database repository. It excludes project-local `ai-workflow/sdd`, `ai-workflow/wiki`, and `ai-workflow/memory` content.

```text
http://gitlab.metac-inc.com/front/weaveai-database.git
```

Examples:

```bash
keaveai issue --dry-run
keaveai issue
```

## `keaveai help`

Show help for the CLI or a specific public command.

```bash
keaveai help
keaveai help init
keaveai help update
keaveai help database-update
keaveai help issue
```
