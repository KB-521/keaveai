# CLI Reference

The public WeaveAI CLI currently exposes only the project setup and sync commands below. Legacy workflow commands remain hidden from top-level help and shell completion while the CLI surface is being narrowed.

## Commands

| Command | Purpose |
|---------|---------|
| `weaveai init [path]` | Initialize WeaveAI content in a project |
| `weaveai update [path]` | Refresh initialized project assets from the bundled database |
| `weaveai break-change [path]` | Migrate initialized content to the bundled breaking layout |
| `weaveai database-update [path]` | Refresh the bundled `weaveai-database/` directory from GitLab |
| `weaveai issue` | Push initialized WeaveAI content as a GitLab merge request |
| `weaveai help [command]` | Show CLI help |

## Global Options

| Option | Description |
|--------|-------------|
| `--version`, `-V` | Show version number |
| `--no-color` | Disable color output |
| `--help`, `-h` | Display help for a command |

## `weaveai init`

Initialize WeaveAI in your project.

```bash
weaveai init [path] [options]
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
weaveai init
weaveai init . --tools codex
weaveai init . --tools none
weaveai init . --force
```

The command also ensures the project root has an `agent.config` file.
It installs content from the bundled `weaveai-database/` directory and does not pull from GitLab during normal initialization.

## `weaveai update`

Refresh WeaveAI database assets for an initialized project from the bundled `weaveai-database/` directory.

```bash
weaveai update [path]
```

Example:

```bash
weaveai update .
```

The command also ensures the project root has an `agent.config` file.
It does not pull from GitLab; run `weaveai database-update` first when the bundled database itself needs to be refreshed.

## `weaveai break-change`

Migrate an initialized project to the bundled database layout while preserving existing SDD content.

```bash
weaveai break-change [path]
```

The command:

1. Copies `weaveai/sdd` or existing `ai-workflow/sdd` to a temporary root-level `sdd` directory.
2. Removes root-level `.codex`, `.cursor`, `.agents`, `weaveai`, `.claude`, `AGENTS.md`, and stale `global`.
3. Copies bundled `weaveai-database/` contents into the project root. Bundled `.codex/skills/*` stays under `.codex/skills/*`.
4. Copies legacy bundled `global/*` content into `.codex/skills/*` when a legacy database layout is used.
5. Moves the preserved SDD content to `ai-workflow/sdd`.
6. Ensures `.gitignore` contains `ai-workflow/memory/LOCAL.md`.
7. Ensures the project root has an `agent.config` file.

Example:

```bash
weaveai break-change .
```

## `weaveai database-update`

Refresh the local bundled `weaveai-database/` directory from the GitLab database repository.

```bash
weaveai database-update [path] [options]
```

| Option | Description |
|--------|-------------|
| `--repo <url>` | WeaveAI database repository URL |
| `--branch <branch>` | WeaveAI database repository branch |

When `path` is omitted, the command updates the package's bundled `weaveai-database/` directory.

Examples:

```bash
weaveai database-update
weaveai database-update ./weaveai-database --branch main
```

## `weaveai issue`

Push initialized WeaveAI content as a GitLab merge request.

```bash
weaveai issue [options]
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
weaveai issue --dry-run
weaveai issue
```

## `weaveai help`

Show help for the CLI or a specific public command.

```bash
weaveai help
weaveai help init
weaveai help update
weaveai help database-update
weaveai help issue
```
