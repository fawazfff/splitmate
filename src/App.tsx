import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Camera, Check, Copy, MessageCircle, Plus, Sparkles, Wallet, X,
} from 'lucide-react';
import Agent from './Agent';
import SiteNav, { SiteFooter } from './SiteNav';
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
  else if (settlementMatch) page = <SettlementPage key={settlementMatch[1]} id={settlementMatch[1]}/>;
  else if (groupMatch) page = <GroupPage key={groupMatch[1]} id={groupMatch[1]}/>;
  return <><SiteNav/>{page}<SiteFooter/></>;
}

function Home() {
  return <main className="home-page">
    <section className="hero hero-reference">
      <div className="hero-copy">
        <p className="eyebrow">GROUP EXPENSES, WITHOUT THE HEADACHE</p>
        <h1>Split the bill.<br/><span>Not the friendship.</span></h1>
        <p>Create a shared group, add expenses, and let the Agent work out who owes whom. When everyone is ready, settle with native USDC on Base mainnet.</p>
        <div className="actions"><Link className="btn" to="/create">Create a group <ArrowRight size={16}/></Link><Link className="ghost" to="/group/demo">See live demo</Link></div>
        <small className="trust-line"><span>●</span> No account required · Every payment needs wallet approval</small>
      </div>
      <div className="hero-visual reference-visual">
        <div className="floating-agent-pill"><Sparkles size={14}/><div><b>Agent sees it</b><small>3 payments found</small></div></div>
        <div className="settlement-hero-card">
          <div className="settlement-card-top"><div><b>Abuja Weekend</b><small>4 people</small></div><span className="card-menu">•••</span></div>
          <div className="hero-total">$140.00</div>
          <div className="hero-people">
            <div className="hero-person"><span className="mini-avatar blue">F</span><div><b>Fawaz</b><small>paid $90</small></div><strong className="positive">+$50</strong></div>
            <div className="hero-person"><span className="mini-avatar gold">A</span><div><b>Ahmed</b><small>paid $10</small></div><strong className="positive">+$10</strong></div>
            <div className="hero-person"><span className="mini-avatar purple">J</span><div><b>John</b><small>paid $40</small></div><strong className="negative">-$60</strong></div>
          </div>
          <div className="hero-card-footer"><Sparkles size={13}/> Agent found the simplest settlement</div>
        </div>
        <div className="base-pill"><Wallet size={14}/><div><b>USDC on Base</b><small>Mainnet payment</small></div></div>
      </div>
    </section>
    <section className="home-proof">
      <div><span className="proof-number">01</span><div><b>Talk naturally</b><p>“Fawaz paid $50 for dinner for everyone.”</p></div></div>
      <div><span className="proof-number">02</span><div><b>Agent works it out</b><p>Balances update without spreadsheets or commands.</p></div></div>
      <div><span className="proof-number">03</span><div><b>Settle when ready</b><p>Review each payment and connect the exact wallet saved for the payer.</p></div></div>
    </section>
    <section className="home-agent-section">
      <div><p className="eyebrow">THE AGENT</p><h2>Just tell Splitmate what happened.</h2><p>No special format. Say it naturally, choose who “I” means, and confirm every change before it is saved.</p><div className="home-quote">“I paid $80 for dinner.”<span>→</span>“Who should split the $80?”</div></div>
      <div className="home-flow-card">
        <div className="flow-row"><span className="flow-icon"><MessageCircle size={15}/></span><div><b>Expense</b><small>Natural language</small></div><Check size={16}/></div><div className="flow-line"/>
        <div className="flow-row"><span className="flow-icon dark"><Sparkles size={15}/></span><div><b>Balance</b><small>Who owes whom</small></div><Check size={16}/></div><div className="flow-line"/>
        <div className="flow-row"><span className="flow-icon"><Wallet size={15}/></span><div><b>Settlement</b><small>Payer-approved Base USDC</small></div><Check size={16}/></div>
      </div>
    </section>
    <section className="home-final-cta"><p className="eyebrow">ORION AGENT HACKATHON</p><h2>Split the money.<br/>Keep the friendship.</h2><p>Build the group in seconds and let Splitmate handle the math.</p><Link className="btn" to="/create">Create a group <ArrowRight size={16}/></Link></section>
  </main>;
}

function GroupPage({ id }: { id: string }) {
  const { group, loading, error, updateGroup, isDemo } = usePersistentGroup(id);
  const [showExpense, setShowExpense] = useState(false);
  if (loading && !group) return <main className="empty"><p>Loading group…</p></main>;
  if (!group) return <main className="empty"><h1>Group not found</h1><p>{error || 'This group is not available in this browser.'}</p><Link className="btn" to="/create">Create a group</Link></main>;

  const addExpense = async (expense: Expense) => {
    await updateGroup({ ...group, expenses: [...group.expenses, expense] });
    setShowExpense(false);
  };

  return <main className="group-page">
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
    <div className="settle-callout"><div><b>Done adding expenses?</b><small>Final Settlement is always here when you are ready.</small></div><Link className="btn" to={`/group/${group.id}/settlement`}>Final settlement <ArrowRight size={16}/></Link></div>
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
  return <main className="about"><p className="eyebrow">ORION AGENT HACKATHON</p><h1>Agent prepares. Humans approve.</h1><p>Splitmate turns everyday shared expenses into a clear group balance and a simple Base settlement flow. The Agent coordinates the work while users stay in control of every saved change and payment.</p><div className="panel"><Sparkles/><h2>Built for shared money</h2><p>Friends, roommates, teams, trips, events, families, and communities.</p></div></main>;
}
