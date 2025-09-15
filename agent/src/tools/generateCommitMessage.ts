import fetch from 'node-fetch';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

function shortHeuristic(diff: string) {
  // fallback if no AI key -- a small heuristic
  const files = (diff.match(/^diff --git a\/(.+?) b\//gm) || []).map(m => m.replace(/^diff --git a\//, '').replace(/ b\/.+$/, ''));
  const added = (diff.match(/^\+[^+]/gm) || []).length;
  const removed = (diff.match(/^\-[^-]/gm) || []).length;
  const topFile = files[0] ?? 'files';
  const type = added > 0 && removed === 0 ? 'feat' : removed > 0 && added === 0 ? 'fix' : 'chore';
  return `${type}: update ${topFile} (+${added} -${removed})`;
}

export async function generateCommitMessage(diff: string): Promise<string> {
  if (!OPENAI_KEY) {
    return shortHeuristic(diff);
  }

  const system = `You are an assistant that writes concise conventional git commit messages (type(scope): subject).  Keep subject under 50 characters. Provide only the commit message body (subject + optional body).`;
  const user = `Here is a git diff. Produce a single, concise conventional commit message (type optional scope): short subject, optionally a longer body explaining motivation. Diff:\n\n${truncate(diff, 15000)}`;

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.15,
    max_tokens: 300
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const msg = data?.choices?.[0]?.message?.content;
    return (msg || shortHeuristic(diff)).trim();
  } catch (err) {
    console.warn('[agent] AI commit generation failed, falling back.');
    return shortHeuristic(diff);
  }
}

function truncate(s: string, max = 15000) {
  return s.length <= max ? s : s.slice(0, max);
}
