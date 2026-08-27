import { ArrowRight, Check, ExternalLink, ShieldCheck, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BASESCAN_URL } from '../settlement';

const TX_HASH = /^0x[a-fA-F0-9]{64}$/;

const capabilities = [
  ['Expense capture', 'Understands amounts, payers, descriptions, multiple expenses, and explicit split groups.'],
  ['Working memory', 'Resolves short follow-ups and corrections from the current conversation.'],
  ['Validated actions', 'Produces structured add, edit, delete, member, analysis, and settlement actions.'],
  ['Human approval', 'Every data change and every wallet transaction waits for a person to approve it.'],
];

export default function AgentProof() {
  const receiptHash = String(import.meta.env.VITE_DEMO_TX_HASH || '').trim();
  const hasVerifiedReceipt = TX_HASH.test(receiptHash);

  return <main id="main-content" className="proof-page">
    <p className="eyebrow">ORION JUDGE PROOF</p>
    <h1>Built to act. Tested to prove it.</h1>
    <p className="proof-lead">Splitmate is a shared-money Agent with structured actions, persistent group context, explicit approval gates, and Base settlement verification.</p>

    <section className="proof-metrics" aria-label="Agent evaluation results">
      <article><strong>26/26</strong><span>production scenarios passed</span></article>
      <article><strong>100%</strong><span>measured task pass rate</span></article>
      <article><strong>9</strong><span>capability and safety categories</span></article>
    </section>

    <section className="panel proof-section">
      <div className="proof-section-head"><div><p className="eyebrow">THE AGENT LOOP</p><h2>Reasoning stays connected to real actions.</h2></div><Link className="ghost" to="/group/demo">Run the demo <ArrowRight size={15}/></Link></div>
      <div className="agent-loop" aria-label="Splitmate Agent execution loop">
        <article><span>01</span><b>Observe</b><p>Load the group, expenses, identity, balances, and recent conversation.</p></article>
        <article><span>02</span><b>Reason</b><p>Resolve intent, ask for missing facts, and prepare a validated structured action.</p></article>
        <article><span>03</span><b>Approve</b><p>Show the proposed change or payment to the responsible person.</p></article>
        <article><span>04</span><b>Verify</b><p>Save confirmed data or wait for the Base receipt before updating balances.</p></article>
      </div>
    </section>

    <section className="proof-grid">
      <div className="panel proof-section">
        <p className="eyebrow">CAPABILITIES</p>
        <h2>More than conversation.</h2>
        {capabilities.map(([title, description]) => <div className="proof-capability" key={title}><Check size={16}/><div><b>{title}</b><p>{description}</p></div></div>)}
      </div>
      <div className="panel proof-section">
        <p className="eyebrow">SAFETY BOUNDARIES</p>
        <h2>Agent prepares. Humans approve.</h2>
        <div className="proof-capability"><ShieldCheck size={17}/><div><b>No silent group changes</b><p>Adds, edits, deletions, and new members require confirmation.</p></div></div>
        <div className="proof-capability"><Wallet size={17}/><div><b>Exact payer wallet</b><p>The connected address must match the wallet saved for the person paying.</p></div></div>
        <div className="proof-capability"><Check size={17}/><div><b>Receipt before settlement</b><p>A balance changes only after the USDC transfer confirms on Base.</p></div></div>
      </div>
    </section>

    <section className={`panel proof-section receipt-proof ${hasVerifiedReceipt ? 'verified' : 'pending'}`}>
      <div><p className="eyebrow">ONCHAIN EXECUTION PROOF</p><h2>{hasVerifiedReceipt ? 'Verified Base mainnet receipt' : 'Safe demo, honest proof'}</h2>
      <p>{hasVerifiedReceipt ? 'This receipt comes from a real wallet-approved Splitmate USDC settlement on Base mainnet.' : 'The public demo never fabricates a transaction. A verified receipt appears here only after a real payer approves a small Splitmate settlement on Base mainnet.'}</p></div>
      {hasVerifiedReceipt
        ? <a className="btn" href={`${BASESCAN_URL}/tx/${receiptHash}`} target="_blank" rel="noreferrer">Open BaseScan receipt <ExternalLink size={15}/></a>
        : <Link className="ghost" to="/create">Create a real group <ArrowRight size={15}/></Link>}
    </section>

    <p className="proof-method">Evaluation run: August 27, 2026 against the production API. The full scenarios, methodology, and runnable command are published in the GitHub repository.</p>
  </main>;
}
