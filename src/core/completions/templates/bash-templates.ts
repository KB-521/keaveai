/**
 * Static template strings for Bash completion scripts.
 * These are Bash-specific helper functions that never change.
 */

export const BASH_DYNAMIC_HELPERS = `# Dynamic completion helpers

_keaveai_complete_changes() {
  local changes
  changes=$(keaveai __complete changes 2>/dev/null | cut -f1)
  COMPREPLY=($(compgen -W "$changes" -- "$cur"))
}

_keaveai_complete_specs() {
  local specs
  specs=$(keaveai __complete specs 2>/dev/null | cut -f1)
  COMPREPLY=($(compgen -W "$specs" -- "$cur"))
}

_keaveai_complete_items() {
  local items
  items=$(keaveai __complete changes 2>/dev/null | cut -f1; keaveai __complete specs 2>/dev/null | cut -f1)
  COMPREPLY=($(compgen -W "$items" -- "$cur"))
}`;
