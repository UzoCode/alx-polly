import { execSync } from 'child_process';

/**
 * Return a git diff of staged changes (cached).
 */
export function getStagedDiff(): string {
  try {
    return execSync('git diff --cached --no-color', { encoding: 'utf-8' });
  } catch (err) {
    return '';
  }
}

/**
 * Return a git diff between current branch and base branch.
 */
export function getBranchDiff(base = 'main'): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return execSync(`git diff --no-color ${base}..${branch}`, { encoding: 'utf-8' });
  } catch (err) {
    return '';
  }
}