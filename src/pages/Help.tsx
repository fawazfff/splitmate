import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const faqs = [
  ['What is Splitmate?', 'Splitmate is a shared-expense app where a conversational Agent helps groups record expenses, understand balances and prepare settlements.'],
  ['Is Splitmate only for trips?', 'No. It can be used by friends, roommates, teams, event groups, communities and any group that shares costs.'],
  ['How should I talk to the Agent?', 'Just describe what happened naturally. For example: “Daddy paid 80 dollars for dinner for everyone.” If something important is missing, the Agent should ask you.'],
  ['Will the Agent guess missing information?', 'It should not. The amount, payer, expense description and people sharing the cost should be confirmed before an expense is saved.'],
  ['Can I add profile pictures?', 'Yes. Profile pictures are optional when creating a group and can help you recognize people quickly.'],
  ['Can I ask who owes who?', 'Yes. The Agent can use the saved expenses to calculate balances and explain who owes whom.'],
  ['Does Splitmate automatically send money?', 'No. Settlement is prepared for you to review. The final onchain payment requires your wallet approval.'],
  ['What is used for settlement?', 'The current settlement flow uses USDC on Base.'],
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const filtered = faqs.filter(([q, a]) => `${q} ${a}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <main className="about">
      <p className="eyebrow">HELP CENTER</p>
      <h1>Questions, answered.</h1>
      <p>Everything you need to understand Splitmate and its Agent.</p>
      <div style={{ maxWidth: 820, marginTop: 28, position: 'relative' }}>
        <Search size={17} style={{ position: 'absolute', left: 13, top: 13, color: '#777' }}/>
        <input name="helpSearch" autoComplete="off" aria-label="Search help" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the help center…" style={{ width: '100%', padding: '12px 14px 12px 40px', border: '1px solid #ddd', borderRadius: 12, boxSizing: 'border-box' }}/>
      </div>
      <div style={{ maxWidth: 820, marginTop: 18 }}>
        {filtered.map(([q, a], i) => (
          <div key={q} style={{ borderBottom: '1px solid var(--line)', padding: '3px 0' }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', border: 0, background: 'transparent', padding: '17px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', fontWeight: 800, cursor: 'pointer' }}>
              {q}<ChevronDown size={17} style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: '.2s', flexShrink: 0 }}/>
            </button>
            {open === i && <p style={{ padding: '0 35px 17px 4px', margin: 0 }}>{a}</p>}
          </div>
        ))}
        {!filtered.length && <p>No matching questions. Try another search.</p>}
      </div>
    </main>
  );
}
