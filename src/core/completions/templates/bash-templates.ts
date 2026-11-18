/**
 * Static template strings for Bash completion scripts.
 * These are Bash-specific helper functions that never change.
 */

export const BASH_DYNAMIC_HELPERS = `# Dynamic completion helpers

_weaveai_complete_changes() {
  local changes
  changes=$(weaveai __complete changes 2>/dev/null | cut -f1)
  COMPREPLY=($(compgen -W "$changes" -- "$cur"))
}

_weaveai_complete_specs() {
  local specs
  specs=$(weaveai __complete specs 2>/dev/null | cut -f1)
  COMPREPLY=($(compgen -W "$specs" -- "$cur"))
}

_weaveai_complete_items() {
  local items
  items=$(weaveai __complete changes 2>/dev/null | cut -f1; weaveai __complete specs 2>/dev/null | cut -f1)
  COMPREPLY=($(compgen -W "$items" -- "$cur"))
}`;
