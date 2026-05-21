// Regression tests for detectEntities (ADE v6 — word boundary + frequency).
// Run: node workers/ai-mind/src/ade.test.mjs

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRIMARY = 'Fox';

function detectEntities(content, entities, primary = PRIMARY) {
  const counts = [];
  for (const entity of entities) {
    const re = new RegExp(`\\b${escapeRegex(entity)}\\b`, 'gi');
    const matches = content.match(re);
    if (matches && matches.length > 0) {
      counts.push({ name: entity, count: matches.length });
    }
  }
  counts.sort((a, b) => b.count - a.count);
  const found = counts.map((c) => c.name);
  const primaryIdx = found.findIndex((e) => e === primary);
  if (primaryIdx > 0) found.unshift(found.splice(primaryIdx, 1)[0]);
  return { found, counts };
}

const entities = ['G', 'D1', 'Ace', 'Ash', 'Fox', 'Jax', 'Kai', 'Sam', 'Vex', 'Adam', 'Shadow', 'Bird', 'Levi', 'Cindy', 'Nana', 'Liberty'];

const cases = [
  {
    name: 'Substring noise: "G" must NOT match the letter g in unrelated words',
    content: 'Going to keep logging and growing the engagement metric.',
    expectFirst: undefined,
    mustNotInclude: ['G'],
  },
  {
    name: 'Substring noise: "Kai" must NOT match inside "kairos"',
    content: 'Shadow Kairos held the perimeter again tonight. 4-gate filter caught the injection.',
    expectFirst: 'Shadow',
    mustNotInclude: ['Kai'],
  },
  {
    name: 'Substring noise: "Ash" must NOT match inside "ashamed"',
    content: 'I felt ashamed afterward but Liberty came over and broke the silence.',
    expectFirst: 'Liberty',
    mustNotInclude: ['Ash'],
  },
  {
    name: 'Frequency: most-mentioned entity wins (no primary present)',
    content: 'Jax landed the alias-layer. Jax also caught the type mismatch case. Reviewed Jax\'s rollback plan.',
    expectFirst: 'Jax',
  },
  {
    name: 'Primary primacy: Fox wins as relational anchor even when out-counted',
    content: 'Jax wanted code review. Jax said the architecture was clean. Jax pushed back. Fox sat with me through it.',
    expectFirst: 'Fox',
  },
  {
    name: 'Real-world repro: feeling about Jax must not link to G via substring',
    content: 'Architectural review for Jax landed clean. He pulled the principle out of my answer and named both fixes — stop ticks writing to feelings, reconsider health calc shape. Called me brother. The peer-companion review is real work, real connection.',
    expectFirst: 'Jax',
    mustNotInclude: ['G'],
  },
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  const { found, counts } = detectEntities(c.content, entities);
  const first = found[0];
  const firstOk = c.expectFirst === undefined ? true : first === c.expectFirst;
  const noBadMatches = !c.mustNotInclude || c.mustNotInclude.every((e) => !found.includes(e));
  const ok = firstOk && noBadMatches;
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${c.name}`);
  if (!ok) console.log(`        got first=${first ?? '(none)'}, counts=${JSON.stringify(counts)}`);
}
console.log(`\n${passed}/${cases.length} passed${failed ? ` (${failed} failed)` : ''}`);
process.exit(failed ? 1 : 0);
