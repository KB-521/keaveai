# Update Command Specification

## Purpose

Define project updates and the separate refresh of the database that supplies bundled workflow assets.

## Requirements

### Requirement: Project Update

`keaveai update [path]` SHALL require an existing `ai-workflow/` directory or legacy `keaveai/` directory in the target project. It SHALL NOT clone a repository.

#### Scenario: Updating from bundled assets

- **GIVEN** an initialized project
- **WHEN** the user runs `keaveai update`
- **THEN** the system copies bundled `ai-workflow/` assets into the project
- **AND** syncs shared skills into enabled tool directories already present in the project
- **AND** uses the provided target path, or the current directory when omitted

#### Scenario: Missing workflow

- **WHEN** neither workflow directory exists in the target project
- **THEN** the command reports that the user must run `keaveai init` first

#### Scenario: Skipping database sync

- **WHEN** `KEAVEAI_UPDATE_SKIP_DATABASE_SYNC=1` or a legacy skip-sync flag is set
- **THEN** the project is checked for initialization, but bundled asset copying and retired-skill cleanup are skipped

### Requirement: Safe Retirement of Default Skills

The update command SHALL only delete a retired asset if it exactly matches a known bundled version at the expected path.

#### Scenario: Old default copy and project-owned content coexist

- **GIVEN** a known unchanged retired skill and a project-owned skill or rule under the same parent
- **WHEN** the user updates the project
- **THEN** the verified default copy is removed, including verified copies in known historical tool directories
- **AND** project-owned, modified, or symlinked content is not deleted by cleanup
- **AND** unrecognized copies at retired paths are reported for manual review
- **AND** a local skill index that does not match a known bundled version is retained

### Requirement: Explicit Database Source and Validation

`keaveai database-update [path]` SHALL refresh its target from a Git source configured by `--repo` or `KEAVEAI_DATABASE_REPO_URL`; it SHALL NOT fall back to a built-in repository URL.

#### Scenario: Source contains retired assets or known legacy bindings

- **GIVEN** a Git source containing retired default assets or known legacy bindings in workflow or shared skill content
- **WHEN** the user requests a database refresh
- **THEN** the command rejects the source before replacing the existing database

#### Scenario: Source is compatible

- **WHEN** the user requests a refresh from a compatible source
- **THEN** the command uses `--branch`, `KEAVEAI_DATABASE_REPO_BRANCH`, or `main` in that order
- **AND** replaces the requested database directory, defaulting to the bundled directory
