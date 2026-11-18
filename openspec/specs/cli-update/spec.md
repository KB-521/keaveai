# Update Command Specification

## Purpose

Define `weaveai update` behavior for refreshing WeaveAI database assets and globally shared tool skills in an initialized project.

## Requirements

### Requirement: WeaveAI Database Refresh

The update command SHALL refresh projects initialized with the current `weaveai/` layout.

#### Scenario: Running update

- **GIVEN** a project contains `weaveai/`
- **WHEN** user runs `weaveai update`
- **THEN** the system clones the WeaveAI database repository
- **AND** copies repository `weaveai/` content over the project `weaveai/`
- **AND** copies repository `global/*` skill directories into detected tool skill roots such as `.codex/skills/*`
- **AND** does not require or inspect an `openspec/` directory

#### Scenario: Target project path

- **WHEN** user runs `weaveai update ./some-project`
- **THEN** the system updates that target project instead of the current working directory

### Requirement: Prerequisites

The update command SHALL require an existing `weaveai/` directory before allowing updates.

#### Scenario: Missing WeaveAI directory

- **GIVEN** the target project does not contain `weaveai/`
- **WHEN** user runs `weaveai update`
- **THEN** display error: "No WeaveAI directory found. Run 'weaveai init' first."
- **AND** do not fall back to legacy `openspec/` update behavior

### Requirement: Repository Configuration

The update command SHALL use the configured WeaveAI database source.

#### Scenario: Default repository

- **WHEN** user runs `weaveai update`
- **THEN** the system reads from `http://gitlab.metac-inc.com/front/weaveai-database.git`
- **AND** uses branch `main`

#### Scenario: Environment overrides

- **WHEN** `WEAVEAI_UPDATE_REPO_URL` or `WEAVEAI_UPDATE_REPO_BRANCH` is set
- **THEN** the system uses those values for the update clone

### Requirement: Tool Skill Sync

The update command SHALL refresh skills only for tools already present in the target project.

#### Scenario: Codex tool present

- **GIVEN** the target project contains `.codex/`
- **AND** the WeaveAI database repository contains `global/init/SKILL.md`
- **WHEN** user runs `weaveai update`
- **THEN** the system copies that skill to `.codex/skills/init/SKILL.md`

#### Scenario: No tools present

- **GIVEN** the target project contains `weaveai/`
- **AND** no known tool directories are present
- **WHEN** user runs `weaveai update`
- **THEN** the system refreshes `weaveai/`
- **AND** prints that global skills were skipped

### Requirement: Dry Test Escape Hatch

The update command SHALL support an environment flag for local tests and manual validation.

#### Scenario: Skip remote sync

- **WHEN** `WEAVEAI_UPDATE_SKIP_REMOTE_SYNC=1`
- **THEN** the command validates the target project and exits successfully without cloning or writing remote content
