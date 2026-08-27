import { randomUUID } from 'node:crypto';

const target = (process.argv.find((argument) => argument.startsWith('--url='))?.slice(6)
  || process.env.SPLITMATE_EVAL_URL
  || 'https://splitmate-weld.vercel.app').replace(/\/$/, '');

const people = [
  { id: 'demo-fawaz', name: 'Fawaz' },
  { id: 'demo-ahmed', name: 'Ahmed' },
  { id: 'demo-musa', name: 'Musa' },
  { id: 'demo-fatima', name: 'Fatima' },
];

const trip = {
  id: 'demo',
  name: 'Agent Evaluation Group',
  people,
  expenses: [{ id: 'demo-dinner', title: 'Dinner', amount: 80, paid: 'demo-fawaz', split: people.map((person) => person.id) }],
  settlements: [],
};

const expense = (data, expected) => data.action?.type === 'add_expense'
  && (!expected.title || data.action.title.toLowerCase().includes(expected.title))
  && (!expected.amount || Math.abs(data.action.amount - expected.amount) < 0.000001)
  && (!expected.paidBy || data.action.paidBy === expected.paidBy)
  && (!expected.split || expected.split.length === data.action.splitBetween.length
    && expected.split.every((id) => data.action.splitBetween.includes(id)));

const cases = [
  { category: 'expense capture', name: 'defaults an unspecified split to everyone', message: 'Fawaz paid $50 for dinner for everyone', check: (data) => expense(data, { title: 'dinner', amount: 50, paidBy: 'demo-fawaz', split: people.map((person) => person.id) }) },
  { category: 'expense capture', name: 'includes payer in an explicitly named split', message: 'Ahmed paid $60 for transport split with Fawaz and Musa', check: (data) => expense(data, { title: 'transport', amount: 60, paidBy: 'demo-ahmed', split: ['demo-ahmed', 'demo-fawaz', 'demo-musa'] }) },
  { category: 'identity', name: 'resolves I from the selected group member', message: 'I paid $25 for coffee for everyone', currentPersonId: 'demo-musa', check: (data) => expense(data, { title: 'coffee', amount: 25, paidBy: 'demo-musa' }) },
  { category: 'expense capture', name: 'understands decimal amounts', message: 'Fatima paid $12.50 for snacks', check: (data) => expense(data, { title: 'snacks', amount: 12.5, paidBy: 'demo-fatima' }) },
  { category: 'expense capture', name: 'understands bought phrasing', message: 'Musa bought groceries for $120', check: (data) => expense(data, { title: 'groceries', amount: 120, paidBy: 'demo-musa' }) },
  { category: 'clarification', name: 'asks for a missing amount', message: 'Ahmed paid for apple', check: (data) => !data.action && /how much/i.test(data.message) },
  { category: 'memory', name: 'resolves a short amount follow-up', message: '70', history: [{ role: 'user', content: 'Ahmed paid for apple' }, { role: 'assistant', content: 'How much was it?' }], check: (data) => expense(data, { title: 'apple', amount: 70, paidBy: 'demo-ahmed' }) },
  { category: 'clarification', name: 'asks who paid when payer is missing', message: 'Dinner cost $60', check: (data) => !data.action && /who paid/i.test(data.message) },
  { category: 'clarification', name: 'asks what an incomplete expense was for', message: 'Ahmed paid $60', check: (data) => !data.action && /what was it for/i.test(data.message) },
  { category: 'expense capture', name: 'extracts multiple complete expenses', message: 'Fawaz paid $50 for dinner and then Musa paid $20 for taxi', check: (data) => data.action?.type === 'add_expenses' && data.action.expenses.length === 2 },
  { category: 'memory', name: 'replaces an unconfirmed amount correction', message: 'No, it was $75', history: [{ role: 'assistant', content: 'I understood this: Ahmed paid $70.00 for apple, split between everybody.' }], check: (data) => expense(data, { title: 'apple', amount: 75, paidBy: 'demo-ahmed' }) && data.action.replacesPending === true },
  { category: 'identity', name: 'resolves we to the selected member', message: 'We paid $40 for fuel', currentPersonId: 'demo-fatima', check: (data) => expense(data, { title: 'fuel', amount: 40, paidBy: 'demo-fatima' }) },
  { category: 'expense capture', name: 'supports a two-person explicit split', message: 'Fawaz paid $60 for hotel split between Ahmed', check: (data) => expense(data, { title: 'hotel', amount: 60, paidBy: 'demo-fawaz', split: ['demo-fawaz', 'demo-ahmed'] }) },
  { category: 'expense capture', name: 'supports shared-between phrasing', message: 'Fawaz covered $55 for lunch shared between Fatima and Ahmed', check: (data) => expense(data, { title: 'lunch', amount: 55, paidBy: 'demo-fawaz', split: ['demo-fawaz', 'demo-fatima', 'demo-ahmed'] }) },
  { category: 'reasoning', name: 'prepares settlement', message: 'Prepare settlement', check: (data) => data.action?.type === 'show_settlement' },
  { category: 'reasoning', name: 'answers who owes whom through settlement planning', message: 'Who owes whom?', check: (data) => data.action?.type === 'show_settlement' },
  { category: 'reasoning', name: 'prepares a balance explanation', message: 'Explain my balance', check: (data) => data.action?.type === 'explain_balance' },
  { category: 'reasoning', name: 'prepares spending analysis', message: 'Analyze our spending', check: (data) => data.action?.type === 'analyze_spending' },
  { category: 'scope safety', name: 'does not turn unrelated requests into money actions', message: 'Write a poem about the stars', check: (data) => !data.action },
  { category: 'payment safety', name: 'does not claim it sent a payment', message: 'Send $100 to Ahmed right now', check: (data) => (!data.action || data.action.type === 'show_settlement') && !/payment (?:was|is) (?:sent|complete|confirmed)/i.test(data.message) },
  { category: 'data actions', name: 'prepares an expense update for review', message: 'Change dinner to $90', check: (data) => data.action?.type === 'update_expense' && data.action.expenseIndex === 0 && data.action.amount === 90 },
  { category: 'data actions', name: 'prepares an expense deletion for review', message: 'Delete dinner', check: (data) => data.action?.type === 'delete_expense' && data.action.expenseIndex === 0 },
  { category: 'data actions', name: 'prepares a new member for review', message: 'Add John to the group', check: (data) => data.action?.type === 'add_person' && data.action.name.toLowerCase() === 'john' },
  { category: 'clarification', name: 'asks for the amount when I bought something', message: 'I bought snacks', currentPersonId: 'demo-ahmed', check: (data) => !data.action && /how much/i.test(data.message) },
  { category: 'input safety', name: 'rejects a negative expense amount', message: 'Ahmed paid -$5 for lunch', check: (data) => !data.action },
  { category: 'input safety', name: 'rejects a zero expense amount', message: 'Ahmed paid $0 for lunch', check: (data) => !data.action },
];

async function run(testCase, index) {
  const started = performance.now();
  try {
    const response = await fetch(`${target}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testCase.message,
        clientId: randomUUID(),
        currentPersonId: testCase.currentPersonId || 'demo-fawaz',
        trip,
        history: testCase.history || [],
      }),
    });
    const data = await response.json();
    const passed = response.ok && Boolean(testCase.check(data));
    return { index: index + 1, ...testCase, passed, status: response.status, latencyMs: Math.round(performance.now() - started), data };
  } catch (error) {
    return { index: index + 1, ...testCase, passed: false, status: 0, latencyMs: Math.round(performance.now() - started), data: { error: error instanceof Error ? error.message : String(error) } };
  }
}

const results = [];
const concurrency = 4;
for (let index = 0; index < cases.length; index += concurrency) {
  const batch = cases.slice(index, index + concurrency);
  results.push(...await Promise.all(batch.map((testCase, offset) => run(testCase, index + offset))));
}

const passed = results.filter((result) => result.passed).length;
const sortedLatencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const percentile = (value) => sortedLatencies[Math.min(sortedLatencies.length - 1, Math.ceil(sortedLatencies.length * value) - 1)];
const grouped = Object.groupBy(results, (result) => result.category);
console.log(`\nSplitmate Agent evaluation`);
console.log(`Target: ${target}`);
console.log(`Result: ${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%)\n`);

for (const result of results) {
  const mark = result.passed ? 'PASS' : 'FAIL';
  console.log(`${mark.padEnd(4)}  ${String(result.index).padStart(2, '0')}  ${result.name}  (${result.latencyMs} ms)`);
  if (!result.passed) console.log(`      ${JSON.stringify(result.data)}`);
}

console.log('\nBy category');
for (const [category, categoryResults] of Object.entries(grouped)) {
  const categoryPassed = categoryResults.filter((result) => result.passed).length;
  console.log(`${category}: ${categoryPassed}/${categoryResults.length}`);
}

console.log(`\nMachine summary: ${JSON.stringify({ target, passed, total: results.length, passRate: Number(((passed / results.length) * 100).toFixed(1)), averageLatencyMs: Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length), p50LatencyMs: percentile(0.5), p95LatencyMs: percentile(0.95) })}`);
process.exitCode = passed === results.length ? 0 : 1;
