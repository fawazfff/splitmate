import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Camera, Copy, Plus, Wallet, X,
} from 'lucide-react';
import Agent from './Agent';
import SiteNav, { SiteFooter } from './SiteNav';
import AgentProof from './pages/AgentProof';
import EnhancedCreate from './pages/EnhancedCreate';
import SettlementPage from './pages/SettlementPage';
import { money } from './settlement';
import type { Expense, Group, Person } from './types';
import { usePersistentGroup } from './usePersistentGroup';

function Avatar({ person, size = 48 }: { person: Person; size?: number }) {
  return <div className="avatar" style={{ width: size, height: size }}>
    {person.avatar ? <img src={person.avatar} alt=""/> : person.name?.[0]?.toUpperCase() || '?'}
  </div>;
}

export default function App() {
  const path = useLocation().pathname;
  const settlementMatch = path.match(/^\/group\/([^/]+)\/settlement\/?$/);
  const groupMatch = path.match(/^\/group\/([^/]+)\/?$/);
  let page: React.ReactNode = <Home/>;
  if (path === '/create') page = <EnhancedCreate/>;
  else if (path === '/how-it-works') page = <HowItWorks/>;
  else if (path === '/help') page = <Help/>;
  else if (path === '/about') page = <About/>;
  else if (path === '/proof') page = <AgentProof/>;
  else if (path === '/privacy') page = <Legal title="Privacy"/>;
  else if (path === '/terms') page = <Legal title="Terms of use"/>;
  else if (settlementMatch) page = <SettlementPage key={settlementMatch[1]} id={settlementMatch[1]}/>;
  else if (groupMatch) page = <GroupPage key={groupMatch[1]} id={groupMatch[1]}/>;
  return <><a className="skip-link" href="#main-content">Skip to content</a><SiteNav/>{page}<SiteFooter/></>;
}

function Home() {
  return <main id="main-content" className="home-page home-editorial">
    <section className="home-intro">
      <div className="home-intro-copy">
        <p className="eyebrow">SPLITMATE / SHARED EXPENSES</p>
        <h1>Shared money, made clear.</h1>
        <p>Make a group, record what happened, and see the cleanest way to settle. The Agent suggests changes. Your group confirms them.</p>
        <div className="actions"><Link className="btn" to="/create">Create a group <ArrowRight size={16}/></Link><Link className="ghost" to="/group/demo">Open working demo</Link></div>
        <p className="home-note">No account required. A wallet is only connected by the person making a settlement payment.</p>
      </div>
      <div className="home-live-preview" aria-label="Example of a Splitmate group">
        <div className="preview-bar"><span>LIVE EXAMPLE</span><Link to="/group/demo">View demo</Link></div>
        <div className="preview-title"><div><b>Abuja Weekend</b><small>4 people</small></div><span>•••</span></div>
        <p className="preview-total">$140.00</p>
        <div className="preview-person"><span className="preview-avatar f">F</span><div><b>Fawaz</b><small>paid $90</small></div><strong className="preview-positive">+$50</strong></div>
        <div className="preview-person"><span className="preview-avatar a">A</span><div><b>Ahmed</b><small>paid $10</small></div><strong className="preview-positive">+$10</strong></div>
        <div className="preview-person"><span className="preview-avatar j">J</span><div><b>John</b><small>paid $40</small></div><strong className="preview-negative">-$60</strong></div>
        <div className="preview-result"><span>Agent found the simplest settlement</span><b>2 payments</b></div>
      </div>
    </section>
    <section className="home-steps" aria-label="How Splitmate works">
      <article><span>01</span><h2>Capture expenses</h2><p>Add an expense yourself or say it naturally to the Agent.</p></article>
      <article><span>02</span><h2>Review the split</h2><p>Every Agent change waits for confirmation before it affects your group.</p></article>
      <article><span>03</span><h2>Settle with clarity</h2><p>See who pays whom. Payments use native USDC on Base only after wallet approval.</p></article>
    </section>
    <section className="home-agent-proof">
      <div><p className="eyebrow">THE SPLITMATE AGENT</p><h2>Say what happened in your own words.</h2><p>“Ahmed paid $60 for transport split with Fawaz and Musa.” Splitmate identifies the payer, the amount, and the people included, then shows the change for review.</p></div>
      <div className="agent-transcript"><p><span>You</span> Ahmed paid $60 for transport split with Fawaz and Musa.</p><p><span>Splitmate</span> I found a $60.00 transport expense paid by Ahmed, split between Ahmed, Fawaz, and Musa.</p><Link className="text-link" to="/group/demo">Try it in the live demo <ArrowRight size={15}/></Link><Link className="text-link proof-link" to="/proof">See evaluation proof <ArrowRight size={15}/></Link></div>
    </section>
    <section className="home-closing"><div><p className="eyebrow">READY WHEN THE GROUP IS</p><h2>Stop doing the math.</h2><p>Start a group and keep the focus on the people, not the spreadsheet.</p></div><Link className="btn" to="/create">Create a group <ArrowRight size={16}/></Link></section>
  </main>;
}

function GroupPage({ id }: { id: string }) {
  const { group, loading, error, updateGroup, isDemo } = usePersistentGroup(id);
  const [showExpense, setShowExpense] = useState(false);
  if (loading && !group) return <main id="main-content" className="loading-page" aria-busy="true"><p className="eyebrow">OPENING GROUP</p><div className="skeleton skeleton-title"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-panel"/></main>;
  if (!group) return <main className="empty"><h1>Group not found</h1><p>{error || 'This group is not available in this browser.'}</p><Link className="btn" to="/create">Create a group</Link></main>;

  const addExpense = async (expense: Expense) => {
    await updateGroup({ ...group, expenses: [...group.expenses, expense] });
    setShowExpense(false);
  };

  return <main id="main-content" className="group-page">
    <div className="trip-head">
      <div><p className="eyebrow">{isDemo ? 'DEMO GROUP' : 'GROUP'}</p><h1>{group.name}</h1><p>{group.people.length} people · {money(group.expenses.reduce((sum, expense) => sum + expense.amount, 0))} shared</p></div>
      <div className="trip-actions"><Link className="btn" to={`/group/${group.id}/settlement`}><Wallet size={16}/> Final settlement</Link><button className="ghost" onClick={() => setShowExpense(true)}><Plus size={16}/> Add expense</button></div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {isDemo && <p className="demo-notice compact-demo">This is a safe preview. Demo changes stay in this tab and no payment can be sent.</p>}
    <section className="trip-layout">
      <div className="panel">
        <h2>People</h2>
        {group.people.map((person) => <div className="person row" key={person.id}>
          <Avatar person={person}/><div><b>{person.name}</b><small>{person.wallet ? 'Wallet added' : 'Wallet can be added in settlement'}</small></div>
          {person.wallet && <button className="icon" aria-label={`Copy ${person.name}'s wallet`} onClick={() => navigator.clipboard.writeText(person.wallet || '')}><Copy size={14}/></button>}
        </div>)}
        <h2 className="expenses-heading">Expenses</h2>
        {group.expenses.length ? group.expenses.map((expense) => <div className="payment" key={expense.id}><div><b>{expense.title}</b><small>{money(expense.amount)} · paid by {group.people.find((person) => person.id === expense.paid)?.name}</small></div></div>) : <p>No expenses yet. Tell the Agent what happened.</p>}
      </div>
      <Agent key={group.id} trip={group} onTripChanged={updateGroup}/>
    </section>
    {showExpense && <ExpenseModal group={group} onAdd={addExpense} close={() => setShowExpense(false)}/>}
    <div className="settle-callout"><div><b>Ready to settle?</b><small>Review the suggested payments whenever the group is ready.</small></div><Link className="btn" to={`/group/${group.id}/settlement`}>Review settlement <ArrowRight size={16}/></Link></div>
  </main>;
}

function ExpenseModal({ group, onAdd, close }: { group: Group; onAdd: (expense: Expense) => Promise<void>; close: () => void }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(group.people[0].id);
  const [split, setSplit] = useState(group.people.map((person) => person.id));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const add = async () => {
    const value = Number(amount);
    if (!title.trim() || !Number.isFinite(value) || value <= 0 || !split.length) {
      setError('Add a description, a positive amount, and at least one person.');
      return;
    }
    setSaving(true);
    try {
      await onAdd({ id: crypto.randomUUID(), title: title.trim(), amount: value, paid: paidBy, split });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The expense could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return <div className="backdrop"><div className="modal">
    <button className="icon close" aria-label="Close expense form" onClick={close}><X/></button><p className="eyebrow">ADD EXPENSE</p><h2>What happened?</h2>
    <label>What was it?<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Dinner, transport, tickets…" maxLength={120}/></label>
    <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50"/></label>
    <label>Paid by<select value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>{group.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <p><b>Split between</b></p>
    {group.people.map((person) => <label className="check" key={person.id}><input type="checkbox" checked={split.includes(person.id)} onChange={(event) => setSplit((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))}/>{person.name}</label>)}
    {error && <p className="error" role="alert">{error}</p>}<button className="btn full" onClick={add} disabled={saving}>{saving ? 'Saving…' : 'Add expense'}</button>
  </div></div>;
}

function HowItWorks() {
  return <main className="form"><p className="eyebrow">HOW IT WORKS</p><h1>From a sentence to a settlement.</h1><div className="panel">
    <h2>1. Create a group</h2><p>Add people, optional profile pictures, and optional Base wallet addresses.</p>
    <h2>2. Talk naturally</h2><p>Choose which member you are, then tell the Agent what happened. It remembers the conversation and asks only for missing details.</p>
    <h2>3. Confirm every change</h2><p>Review Agent actions before expenses, edits, deletions, or people are saved to the group.</p>
    <h2>4. Settle on Base</h2><p>Review who pays whom, connect the exact saved payer wallet, and approve the native USDC transfer. A payment only counts after it confirms onchain.</p>
  </div></main>;
}

function Help() {
  return <main className="form"><p className="eyebrow">HELP & FAQ</p><h1>Questions, answered.</h1><div className="faq-grid">
    <details><summary>What is Splitmate?</summary><p>A shared-expense app that tracks group spending, calculates balances, and settles in native USDC on Base.</p></details>
    <details><summary>Does the Agent change my group automatically?</summary><p>No. Any add, edit, delete, or member change appears as a review card that you must confirm first.</p></details>
    <details><summary>What if someone has no wallet?</summary><p>Open Final Settlement and tap that person to add their Base wallet without leaving the settlement screen.</p></details>
    <details><summary>What is the difference between a saved wallet and Connect Wallet?</summary><p>A saved address identifies the payer or recipient. Connecting a wallet lets its owner approve one specific payment. Splitmate checks that the connected payer wallet matches the saved address.</p></details>
    <details><summary>When is a payment counted?</summary><p>Only after the USDC transfer confirms on Base. Submitted and failed transactions do not reduce the outstanding balance.</p></details>
    <details><summary>Do I have to use the Agent?</summary><p>No. You can add an expense manually and use Final Settlement directly.</p></details>
  </div></main>;
}

function About() {
  return <main id="main-content" className="about"><p className="eyebrow">ORION AGENT HACKATHON</p><h1>Agent prepares. Humans approve.</h1><p>Splitmate turns everyday shared expenses into a clear group balance and a simple Base settlement flow. The Agent coordinates the work while users stay in control of every saved change and payment.</p><div className="panel"><p className="eyebrow">BUILT FOR SHARED MONEY</p><h2>Friends, roommates, teams, trips, events, families, and communities.</h2><p>The same simple record for any group that shares costs.</p></div></main>;
}

function Legal({ title }: { title: 'Privacy' | 'Terms of use' }) {
  const privacy = title === 'Privacy';
  return <main id="main-content" className="legal form"><p className="eyebrow">SPLITMATE</p><h1>{title}</h1><div className="panel">
    {privacy ? <><h2>Your group data</h2><p>Splitmate stores the group details, expenses, and Agent conversation needed to provide the service. Wallet addresses are used only to identify settlement participants. Splitmate never stores wallet private keys.</p><h2>Payments</h2><p>Every USDC payment is approved in the payer’s own wallet. Onchain transactions are public and governed by the Base network.</p><h2>Questions</h2><p>For project questions, use the contact details supplied with the Splitmate project.</p></> : <><h2>Use of Splitmate</h2><p>Splitmate helps groups calculate shared expenses. You are responsible for checking all expenses, recipient addresses, and payment details before confirming a transaction.</p><h2>No financial advice</h2><p>Settlement suggestions are calculations, not financial advice. Blockchain transactions cannot be reversed once confirmed.</p><h2>Wallet responsibility</h2><p>Only connect a wallet you control. Splitmate does not have access to your private keys and cannot send a payment without your wallet approval.</p></>}
  </div></main>;
}
