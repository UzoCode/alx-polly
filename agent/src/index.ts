import 'dotenv/config';
import { argv } from 'process';
import { getStagedDiff, getBranchDiff } from './utils/git.js';
import { generateCommitMessage } from './tools/generateCommitMessage.js';
import { generateReviewSummary } from './tools/generateReviewSummary.ts';
import { writeMarkdownReview } from './tools/writeMarkdown.js';

type Mode = 'staged' | 'branch';

async function main() {
  const args = process.argv.slice(2);
  const modeArgIndex = args.findIndex(a => a === '--mode');
  const mode: Mode = modeArgIndex >= 0 ? (args[modeArgIndex + 1] as Mode) : 'staged';
  const baseArgIndex = args.findIndex(a => a === '--base');
  const baseBranch = baseArgIndex >= 0 ? args[baseArgIndex + 1] : 'main';

  let diffText = '';
  if (mode === 'staged') {
    console.log('[agent] Collecting staged diff...');
    diffText = getStagedDiff();
  } else {
    console.log(`[agent] Collecting diff against base branch: ${baseBranch}...`);
    diffText = getBranchDiff(baseBranch);
  }

  if (!diffText.trim()) {
    console.log('[agent] No diff detected. Exiting.');
    process.exit(0);
  }

  console.log('[agent] Asking AI for a recommended commit message (or fallback)...');
  const commitMessage = await generateCommitMessage(diffText);

  console.log('\n=== Suggested Commit Message ===\n');
  console.log(commitMessage);
  console.log('\n===============================\n');

  console.log('[agent] Generating review summary and inline guidance...');
  const review = await generateReviewSummary(diffText);

  console.log('[agent] Writing review markdown file: code-review.md');
  await writeMarkdownReview({
    branchOrMode: mode,
    commitMessage,
    review,
    diff: diffText
  });

  console.log('[agent] Done. Review written to code-review.md.');
  console.log('[agent] Tip: Inspect the suggested commit message above and use `git commit -m "<message>"` when ready.');
}

main().catch(err => {
  console.error('[agent] Fatal error:', err);
  process.exit(1);
});
