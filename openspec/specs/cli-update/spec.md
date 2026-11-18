# Update Command Specification

## Purpose

Define `keaveai update` behavior for refreshing KeaveAI database assets and globally shared tool skills in an initialized project.

## Requirements

### Requirement: KeaveAI Database Refresh

The update command SHALL refresh projects initialized with the current `keaveai/` layout.

#### Scenario: Running update

- **GIVEN** a project contains `keaveai/`
- **WHEN** user runs `keaveai update`
- **THEN** the system clones the KeaveAI database repository
- **AND** copies repository `keaveai/` content over the project `keaveai/`
- **AND** copies repository `global/*` skill directories into detected tool skill roots such as `.codex/skills/*`
- **AND** does not require or inspect an `openspec/` directory

#### Scenario: Target project path

- **WHEN** user runs `keaveai update ./some-project`
- **THEN** the system updates that target project instead of the current working directory

### Requirement: Prerequisites

The update command SHALL require an existing `keaveai/` directory before allowing updates.

#### Scenario: Missing KeaveAI directory

- **GIVEN** the target project does not contain `keaveai/`
- **WHEN** user runs `keaveai update`
- **THEN** display error: "No KeaveAI directory found. Run 'keaveai init' first."
- **AND** do not fall back to legacy `openspec/` update behavior

### Requirement: Repository Configuration

The update command SHALL use the configured KeaveAI database source.

#### Scenario: Default repository

- **WHEN** user runs `keaveai update`
- **THEN** the system reads from `http://gitlab.metac-inc.com/front/weaveai-database.git`
- **AND** uses branch `main`

#### Scenario: Environment overrides

- **WHEN** `KEAVEAI_UPDATE_REPO_URL` or `KEAVEAI_UPDATE_REPO_BRANCH` is set
- **THEN** the system uses those values for the update clone

### Requirement: Tool Skill Sync

The update command SHALL refresh skills only for tools already present in the target project.

#### Scenario: Codex tool present

- **GIVEN** the target project contains `.codex/`
- **AND** the KeaveAI database repository contains `global/init/SKILL.md`
- **WHEN** user runs `keaveai update`
- **THEN** the system copies that skill to `.codex/skills/init/SKILL.md`

#### Scenario: No tools present

- **GIVEN** the target project contains `keaveai/`
- **AND** no known tool directories are present
- **WHEN** user runs `keaveai update`
- **THEN** the system refreshes `keaveai/`
- **AND** prints that global skills were skipped

### Requirement: Dry Test Escape Hatch

The update command SHALL support an environment flag for local tests and manual validation.

#### Scenario: Skip remote sync

- **WHEN** `KEAVEAI_UPDATE_SKIP_REMOTE_SYNC=1`
- **THEN** the command validates the target project and exits successfully without cloning or writing remote content
