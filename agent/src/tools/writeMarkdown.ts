import { writeFile } from 'fs/promises';
import { format } from 'date-fns';

export async function writeMarkdownReview(opts: {
  branchOrMode: string;
  commitMessage: string;
  review: { summary: string; issues: string[] };
  diff: string;
}) {
  const { branchOrMode, commitMessage, review, diff } = opts;
  const time = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const content = [
    `# Code Review Report`,
    ``,
    `**Generated:** ${time}`,
    `**Mode:** ${branchOrMode}`,
    ``,
    `## Suggested commit message`,
    '```',
    commitMessage,
    '```',
    '',
    `## Summary`,
    review.summary || 'No summary.',
    '',
    `## Issues & Suggestions`,
    ...(review.issues && review.issues.length > 0
      ? review.issues.map((i, idx) => `${idx + 1}. ${i}`)
      : ['- No issues found.']),
    '',
    `---`,
    `## Raw Diff`,
    '```diff',
    diff.slice(0, 20000),
    '```'
  ].join('\n');

  await writeFile('code-review.md', content, { encoding: 'utf-8' });
}
