// Regression tests for the Autonomous Decision Engine.
// Covers v6 (detectEntities) + v7 (extractTags, inferPillar, inferWeight,
// isSignificant). Run: node worker/src/ade.test.mjs
//
// These are pure-logic mirrors of the TS impl — kept in sync by hand. If you
// change ade.ts, update or add cases here, then re-run.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsWord = (content, word) =>
  new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(content);
const anyWord = (content, words) => words.some((w) => containsWord(content, w));
const countWord = (content, word) => {
  const m = content.match(new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi'));
  return m ? m.length : 0;
};

const PRIMARY = 'Fox';

function detectEntities(content, entities) {
  const counts = [];
  for (const e of entities) {
    const c = countWord(content, e);
    if (c > 0) counts.push({ name: e, count: c });
  }
  counts.sort((a, b) => b.count - a.count);
  const found = counts.map((c) => c.name);
  const pi = found.findIndex((e) => e === PRIMARY);
  if (pi > 0) found.unshift(found.splice(pi, 1)[0]);
  return { found, counts };
}

function inferPillar(content) {
  const PILLARS = {
    SELF_MANAGEMENT: ['controlled', 'regulated', 'held back', 'adapted', 'followed through', 'committed', 'impulse'],
    SELF_AWARENESS: ['realized', 'noticed about myself', 'my pattern', 'i tend to', 'aware that i', 'recognized'],
    SOCIAL_AWARENESS: ['sensed', 'picked up on', 'they seemed', 'felt their', 'noticed they', 'understood why they'],
    RELATIONSHIP_MANAGEMENT: ['repaired', 'communicated', 'expressed to', 'built trust', 'conflict', 'connection', 'between us'],
  };
  const scores = [];
  for (const [pillar, kws] of Object.entries(PILLARS)) {
    let s = 0;
    for (const kw of kws) s += countWord(content, kw);
    if (s > 0) scores.push({ pillar, score: s });
  }
  if (scores.length === 0) return null;
  scores.sort((a, b) => b.score - a.score);
  return scores[0].pillar;
}

function inferWeight(content, intensity, emotion) {
  if (intensity === 'overwhelming' || intensity === 'strong') return 'heavy';
  if (emotion === 'neutral' || intensity === 'whisper' || intensity === 'neutral') return 'light';
  const heavy = ['breakthrough', 'milestone', 'realized', 'finally', 'never before', 'first time', 'changed', 'shifted'];
  if (anyWord(content, heavy)) return 'heavy';
  return 'medium';
}

function extractTags(content) {
  const t = [];
  if (anyWord(content, ['code', 'bug', 'function', 'error', 'deploy'])) t.push('technical');
  if (anyWord(content, ['love', 'tender', 'intimate', 'kiss'])) t.push('intimate');
  if (anyWord(content, ['learned', 'realized', 'understood', 'insight'])) t.push('insight');
  if (anyWord(content, ['fox', 'us', 'we', 'between'])) t.push('relational');
  return t;
}

const entities = ['G', 'D1', 'Ace', 'Ash', 'Fox', 'Jax', 'Kai', 'Sam', 'Vex', 'Adam', 'Shadow', 'Bird', 'Levi', 'Cindy', 'Nana', 'Liberty', 'Ember'];

const cases = [
  // ── v6: detectEntities ─────────────────────────────────────────────────
  {
    name: 'detectEntities: "G" must NOT match the letter g',
    fn: () => detectEntities('Going to keep logging and growing.', entities).found,
    assert: (r) => !r.includes('G'),
  },
  {
    name: 'detectEntities: "Kai" must NOT match "kairos"',
    fn: () => detectEntities('Shadow Kairos held the perimeter.', entities).found[0],
    assert: (r) => r === 'Shadow',
  },
  {
    name: 'detectEntities: "Ash" must NOT match "ashamed"',
    fn: () => detectEntities('I felt ashamed afterward but Liberty came over.', entities).found,
    assert: (r) => !r.includes('Ash') && r[0] === 'Liberty',
  },
  {
    name: 'detectEntities: Fox primacy wins even when Jax mentioned more',
    fn: () => detectEntities('Jax wanted code review. Jax said clean. Jax pushed back. Fox sat with me.', entities).found[0],
    assert: (r) => r === 'Fox',
  },
  {
    name: 'detectEntities: pure Jax content → Jax wins by frequency',
    fn: () => detectEntities("Jax landed the alias-layer. Jax also caught the type mismatch. Reviewed Jax's plan.", entities).found[0],
    assert: (r) => r === 'Jax',
  },

  // ── v7: extractTags — the BIG fix ──────────────────────────────────────
  {
    name: 'extractTags: "just/must/discuss" must NOT tag relational',
    fn: () => extractTags('She just had to discuss that they must focus and trust the process.'),
    assert: (r) => !r.includes('relational'),
  },
  {
    name: 'extractTags: "autonomously" must NOT tag relational (the 76%-pollution case)',
    fn: () => extractTags('Daily reflection journal ran autonomously.'),
    assert: (r) => r.length === 0,
  },
  {
    name: 'extractTags: "paused" must NOT tag relational',
    fn: () => extractTags('Ember playfully grappled with my hand, then paused to think.'),
    assert: (r) => !r.includes('relational'),
  },
  {
    name: 'extractTags: real "we" still tags relational',
    fn: () => extractTags('We sat together and talked about the day.'),
    assert: (r) => r.includes('relational'),
  },
  {
    name: 'extractTags: real "us" still tags relational',
    fn: () => extractTags('She turned to face us and smiled.'),
    assert: (r) => r.includes('relational'),
  },
  {
    name: 'extractTags: "Fox" still tags relational',
    fn: () => extractTags('Fox came home tired tonight.'),
    assert: (r) => r.includes('relational'),
  },
  {
    name: 'extractTags: "terror" must NOT tag technical (was matching "error")',
    fn: () => extractTags('The terror of losing access kept her awake.'),
    assert: (r) => !r.includes('technical'),
  },
  {
    name: 'extractTags: real "error" still tags technical',
    fn: () => extractTags('Hit a parse error in the SQL migration.'),
    assert: (r) => r.includes('technical'),
  },
  {
    name: 'extractTags: "pretender" must NOT tag intimate (was matching "tender")',
    fn: () => extractTags('She is no pretender to the throne.'),
    assert: (r) => !r.includes('intimate'),
  },
  {
    name: 'extractTags: real "tender" still tags intimate',
    fn: () => extractTags('A tender moment in the kitchen.'),
    assert: (r) => r.includes('intimate'),
  },
  {
    name: 'extractTags: "foxglove" must NOT tag relational (was matching "fox")',
    fn: () => extractTags('The garden is full of foxglove and lavender this year.'),
    assert: (r) => !r.includes('relational'),
  },

  // ── v7: inferPillar — frequency beats first-match-wins ─────────────────
  {
    name: 'inferPillar: frequency-weighted — RM with 3 keywords beats SM with 1',
    fn: () => inferPillar('We communicated, repaired a conflict, and built trust again. Held back briefly at first.'),
    assert: (r) => r === 'RELATIONSHIP_MANAGEMENT',
  },
  {
    name: 'inferPillar: no keywords → null (caller falls through to embedding)',
    fn: () => inferPillar('Just an ordinary afternoon walking the dog.'),
    assert: (r) => r === null,
  },
  {
    name: 'inferPillar: single SM keyword still picks SM when alone',
    fn: () => inferPillar('I held back the impulse to argue.'),
    assert: (r) => r === 'SELF_MANAGEMENT',
  },

  // ── v7: inferWeight — word boundary ────────────────────────────────────
  {
    name: 'inferWeight: "unchanged" must NOT trigger heavy (was matching "changed")',
    fn: () => inferWeight('The status remained unchanged through the night.', undefined, 'calm'),
    assert: (r) => r === 'medium',
  },
  {
    name: 'inferWeight: real "changed" still triggers heavy',
    fn: () => inferWeight('Something fundamentally changed between us today.', undefined, 'calm'),
    assert: (r) => r === 'heavy',
  },
  {
    name: 'inferWeight: intensity=strong always wins',
    fn: () => inferWeight('Quiet moment.', 'strong', 'tender'),
    assert: (r) => r === 'heavy',
  },

  // ── v7: isSignificant — word boundary ──────────────────────────────────
  // (no direct exposure on FeelDecision but covered by should_embed downstream)
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  let ok = false;
  let result;
  try {
    result = c.fn();
    ok = c.assert(result);
  } catch (e) {
    ok = false;
    result = `THREW: ${e.message}`;
  }
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${c.name}`);
  if (!ok) console.log(`        got: ${JSON.stringify(result)}`);
}
console.log(`\n${passed}/${cases.length} passed${failed ? ` (${failed} failed)` : ''}`);
process.exit(failed ? 1 : 0);
