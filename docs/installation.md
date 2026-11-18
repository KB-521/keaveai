# Installation

## Prerequisites

- **Node.js 20.19.0 or higher** — Check your version: `node --version`

## Package Managers

Install the `keaveai` package. It provides the `keaveai` command.

### npm

```bash
npm install -g keaveai@latest
```

### pnpm

```bash
pnpm add -g keaveai@latest
```

### yarn

```bash
yarn global add keaveai@latest
```

### bun

```bash
bun add -g keaveai@latest
```

## Nix

Run KeaveAI directly without installation:

```bash
nix run github:KB-521/keaveai -- init
```

Or install to your profile:

```bash
nix profile install github:KB-521/keaveai
```

Or add to your development environment in `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    openspec.url = "github:KB-521/keaveai";
  };

  outputs = { nixpkgs, openspec, ... }: {
    devShells.x86_64-linux.default = nixpkgs.legacyPackages.x86_64-linux.mkShell {
      buildInputs = [ openspec.packages.x86_64-linux.default ];
    };
  };
}
```

## Verify Installation

```bash
keaveai --version
```

## Next Steps

After installing, initialize KeaveAI in your project:

```bash
cd your-project
keaveai init
```

See [Getting Started](getting-started.md) for a full walkthrough.
