import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Check, Lightbulb, Loader2, MessageCircle,
  RefreshCw, RotateCcw, Send, Sparkles, Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getClientId } from './groupStore';
import { calculateBalances, calculateSettlementRows } from './settlement';
import type { AgentAction, AgentMessage, Expense, Group, Person } from './types';

type AgentProps = {
  trip: Group;
  onTripChanged: (trip: Group) => Promise<Group> | Group;
};

const greeting = (): AgentMessage => ({
  role: 'agent',
  text: "Hey! I'm your Splitmate Agent. Tell me what happened and I'll turn it into an expense, explain your balance, or prepare your settlement.",
});

const CONFIRMABLE_ACTIONS = new Set<AgentAction['type']>([
  'add_expense', 'add_expenses', 'update_expense', 'delete_expense', 'add_person',
]);

export default function Agent({ trip, onTripChanged }: AgentProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([greeting()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(trip.id !== 'demo');
  const [confirming, setConfirming] = useState<AgentAction | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activity, setActivity] = useState('Ready to help');
  const [lastFailed, setLastFailed] = useState('');
  const [currentPersonId, setCurrentPersonId] = useState(trip.people[0]?.id || '');

  useEffect(() => {
    if (!trip.people.some((person) => person.id === currentPersonId)) {
      setCurrentPersonId(trip.people[0]?.id || '');
    }
  }, [currentPersonId, trip.people]);

  useEffect(() => {
    if (trip.id === 'demo') {
      setRestoring(false);
      return;
    }
    setRestoring(true);
    let active = true;
    const params = new URLSearchParams({ groupId: trip.id, clientId: getClientId() });
    fetch(`/api/conversation?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Conversation could not be restored.');
        if (!active) return;
        setConversationId(data.conversationId || null);
        const restored: AgentMessage[] = Array.isArray(data.messages)
          ? data.messages.flatMap((item: { role?: string; content?: string }) =>
              typeof item.content === 'string'
                ? [{ role: item.role === 'assistant' ? 'agent' : 'user', text: item.content } as AgentMessage]
                : [],
            )
          : [];
        setMessages(restored.length ? restored : [greeting()]);
      })
      .catch(() => {
        if (active) setActivity('Saved conversation could not be restored');
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => { active = false; };
  }, [trip.id]);

  const total = trip.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const balances = useMemo(() => {
    const values = calculateBalances(trip);
    return trip.people.map((person) => ({ ...person, balance: Number((values[person.id] || 0).toFixed(2)) }));
  }, [trip]);
  const settlementRows = useMemo(() => calculateSettlementRows(trip), [trip]);
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.text;
  const latestAction = [...messages].reverse().find((message) => message.role === 'agent' && message.action)?.action || null;
  const pendingAction = latestAction && CONFIRMABLE_ACTIONS.has(latestAction.type)
    && !('confirmed' in latestAction && latestAction.confirmed) ? latestAction : null;
  const missingWallets = settlementRows.filter((row) => !row.from.wallet || !row.to.wallet).length;
  const runNumber = messages.filter((message) => message.role === 'user').length;
  const currentPerson = balances.find((person) => person.id === currentPersonId);
  const biggest = trip.expenses.reduce<Expense | null>(
    (largest, expense) => (!largest || expense.amount > largest.amount ? expense : largest),
    null,
  );
  const exampleName = currentPerson?.name || trip.people[0]?.name || 'I';
  const suggestions = trip.expenses.length
    ? [`${exampleName} paid $50 for dinner for everyone`, 'Explain my balance', 'Prepare settlement']
    : [`${exampleName} paid $50 for dinner for everyone`, 'How much do I owe?', 'Prepare settlement'];
  const personName = (id: string) => trip.people.find((person) => person.id === id)?.name || 'Unknown';

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading || restoring) return;
    const history = messages.map((message) => ({
      role: message.role === 'agent' ? 'assistant' : 'user',
      content: message.text,
    }));
    setInput('');
    setLastFailed('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setLoading(true);
    setActivity('Understanding what you said…');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          trip,
          conversationId,
          currentPersonId,
          clientId: getClientId(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Agent request failed.');
      if (data.conversationId) setConversationId(data.conversationId);
      const action = (data.action || null) as AgentAction | null;
      setMessages((current) => {
        const nextMessage = { role: 'agent' as const, text: data.message || 'Done.', action };
        if (action?.type === 'add_expense' && action.replacesPending) {
          let pendingIndex = -1;
          for (let index = current.length - 1; index >= 0; index -= 1) {
            const message = current[index];
            if (message.role === 'agent' && message.action?.type === 'add_expense' && !message.action.confirmed) {
              pendingIndex = index;
              break;
            }
          }
          if (pendingIndex >= 0) {
            const next = [...current];
            next[pendingIndex] = nextMessage;
            return next;
          }
        }
        return [...current, nextMessage];
      });
      setActivity(
        action?.type === 'add_expense' || action?.type === 'add_expenses' ? 'Expense ready to review'
          : action?.type === 'update_expense' || action?.type === 'delete_expense' || action?.type === 'add_person' ? 'Change ready to review'
            : action?.type === 'show_settlement' ? 'Settlement ready'
              : action?.type === 'analyze_spending' ? 'Spending analysis ready'
                : action?.type === 'explain_balance' ? 'Balance explained' : 'Ready for the next message',
      );
    } catch (reason) {
      setInput(text);
      setLastFailed(text);
      setMessages((current) => [...current, {
        role: 'agent',
        text: `${reason instanceof Error ? reason.message : 'The Agent could not respond.'} Your message is still here, so you can retry it.`,
      }]);
      setActivity('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (action: AgentAction) => {
    if (!['add_expense', 'add_expenses', 'update_expense', 'delete_expense', 'add_person'].includes(action.type)) return;
    setConfirming(action);
    try {
      let next = trip;
      if (action.type === 'add_expense') {
        next = { ...trip, expenses: [...trip.expenses, {
          id: crypto.randomUUID(), title: action.title, amount: Number(action.amount),
          paid: action.paidBy, split: action.splitBetween,
        }] };
      } else if (action.type === 'add_expenses') {
        next = { ...trip, expenses: [...trip.expenses, ...action.expenses.map((expense) => ({
          id: crypto.randomUUID(), title: expense.title, amount: Number(expense.amount),
          paid: expense.paidBy, split: expense.splitBetween,
        }))] };
      } else if (action.type === 'update_expense') {
        next = { ...trip, expenses: trip.expenses.map((expense, index) =>
          index === action.expenseIndex ? {
            ...expense,
            title: action.title ?? expense.title,
            amount: action.amount ?? expense.amount,
            paid: action.paidBy ?? expense.paid,
            split: action.splitBetween ?? expense.split,
          } : expense,
        ) };
      } else if (action.type === 'delete_expense') {
        next = { ...trip, expenses: trip.expenses.filter((_, index) => index !== action.expenseIndex) };
      } else if (action.type === 'add_person') {
        const person: Person = { id: crypto.randomUUID(), name: action.name, wallet: action.wallet };
        next = { ...trip, people: [...trip.people, person] };
      }
      await onTripChanged(next);
      setMessages((current) => current.map((message) =>
        message.action === action ? { ...message, action: { ...action, confirmed: true } } : message,
      ));
      setActivity('Group updated and synced');
    } catch {
      setActivity('The change could not be saved');
    } finally {
      setConfirming(null);
    }
  };

  const reset = async () => {
    setLoading(true);
    try {
      if (trip.id !== 'demo') {
        const requestReset = () => fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset', groupId: trip.id, clientId: getClientId() }),
        });
        let response = await requestReset();
        // Repair an interrupted first cloud save, then retry the reset once.
        if (response.status === 404) {
          await onTripChanged(trip);
          response = await requestReset();
        }
        if (!response.ok) throw new Error('Reset failed.');
      }
      setMessages([{ role: 'agent', text: `Conversation reset. I still know this group has ${trip.people.length} people and ${trip.expenses.length} expenses. What happened?` }]);
      setLastFailed('');
      setInput('');
      setActivity('Ready to help');
    } catch {
      setActivity('Conversation reset could not be saved');
    } finally {
      setLoading(false);
    }
  };

  const confirmationCopy = (action: AgentAction) => {
    if (action.type === 'add_expense') {
      return `${action.title} · $${action.amount.toFixed(2)} · paid by ${personName(action.paidBy)} · split between ${action.splitBetween.map(personName).join(', ')}`;
    }
    if (action.type === 'add_expenses') {
      return action.expenses.map((expense) =>
        `${expense.title} · $${expense.amount.toFixed(2)} · paid by ${personName(expense.paidBy)} · split between everybody`,
      ).join('\n');
    }
    if (action.type === 'update_expense') return `Update ${trip.expenses[action.expenseIndex]?.title || `expense ${action.expenseIndex + 1}`}.`;
    if (action.type === 'delete_expense') return `Delete ${trip.expenses[action.expenseIndex]?.title || `expense ${action.expenseIndex + 1}`}.`;
    if (action.type === 'add_person') return `Add ${action.name} to this group.`;
    return '';
  };

  const runEvidence = () => {
    const steps: Array<{ label: string; detail: string; state: 'done' | 'pending' }> = [{
      label: 'Group state loaded',
      detail: `${trip.people.length} people · ${trip.expenses.length} expenses · $${total.toFixed(2)} recorded`,
      state: 'done',
    }];
    if (latestUserMessage) steps.push({ label: 'Instruction received', detail: latestUserMessage, state: 'done' });
    if (latestAction?.type === 'add_expense') {
      steps.push({ label: 'Expense resolved', detail: `${personName(latestAction.paidBy)} paid $${latestAction.amount.toFixed(2)} for ${latestAction.title}`, state: 'done' });
      steps.push({ label: pendingAction ? 'Waiting for group review' : 'Ledger updated', detail: pendingAction ? `Split between ${latestAction.splitBetween.map(personName).join(', ')}` : 'Confirmed expense saved to the group', state: pendingAction ? 'pending' : 'done' });
    } else if (latestAction?.type === 'add_expenses') {
      steps.push({ label: 'Expenses resolved', detail: `${latestAction.expenses.length} expenses prepared from the instruction`, state: 'done' });
      steps.push({ label: pendingAction ? 'Waiting for group review' : 'Ledger updated', detail: pendingAction ? 'Review the proposed group changes' : 'Confirmed expenses saved to the group', state: pendingAction ? 'pending' : 'done' });
    } else if (latestAction?.type === 'update_expense' || latestAction?.type === 'delete_expense' || latestAction?.type === 'add_person') {
      steps.push({ label: pendingAction ? 'Change prepared' : 'Group updated', detail: confirmationCopy(latestAction), state: pendingAction ? 'pending' : 'done' });
    } else if (latestAction?.type === 'show_settlement') {
      steps.push({ label: 'Settlement calculated', detail: settlementRows.length ? `${settlementRows.length} payment${settlementRows.length === 1 ? '' : 's'} minimize the group’s outstanding balances` : 'The group is already settled', state: 'done' });
      steps.push({ label: missingWallets ? 'Wallet details needed' : 'Waiting for payer approval', detail: missingWallets ? `${missingWallets} payment route${missingWallets === 1 ? ' is' : 's are'} missing a saved wallet address` : 'Each payer must connect and approve their own USDC transfer', state: 'pending' });
    } else if (latestAction?.type === 'analyze_spending') {
      steps.push({ label: 'Spending analysed', detail: `${trip.expenses.length} expenses total $${total.toFixed(2)}`, state: 'done' });
    } else if (latestAction?.type === 'explain_balance') {
      steps.push({ label: 'Balances calculated', detail: settlementRows.length ? `${settlementRows.length} payment${settlementRows.length === 1 ? '' : 's'} still needed` : 'Everyone is settled', state: 'done' });
    } else if (!latestUserMessage) {
      steps.push({ label: 'Waiting for an instruction', detail: 'Tell the Agent about an expense, a correction, or ask it to prepare settlement.', state: 'pending' });
    }
    return steps;
  };

  return <div className="agent-card">
    <div className="agent-head">
      <div className="agent-mark"><Sparkles size={17}/></div>
      <div className="agent-title"><b>Splitmate Agent</b><small>Group money coordinator</small></div>
      <span className="online">● Online</span>
    </div>
    <section className="agent-mission" aria-label="Agent objective">
      <span>AGENT OBJECTIVE</span>
      <b>Get {trip.name} ready to settle.</b>
      <p>Read the group, prepare the next useful action, and leave every saved change and payment for people to approve.</p>
    </section>
    <div className="agent-identity">
      <label htmlFor="agent-person">You are</label>
      <select id="agent-person" value={currentPersonId} onChange={(event) => setCurrentPersonId(event.target.value)}>
        {trip.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
    </div>
    <div className={`agent-status ${loading || restoring ? 'is-working' : lastFailed ? 'is-error' : ''}`} aria-live="polite">
      <span>{restoring ? 'Restoring saved conversation…' : loading ? 'Working through the group…' : activity}</span>
    </div>
    <div className="agent-context"><span>{trip.people.length} people</span><span>·</span><span>{trip.expenses.length} expenses</span><span>·</span><span>${total.toFixed(2)} shared</span></div>
    {trip.expenses.length > 0 && <div className="agent-balance-strip">
      <div><small>{currentPerson?.name || 'Your'} balance</small><b>{currentPerson
        ? currentPerson.balance > 0 ? `Owed $${currentPerson.balance.toFixed(2)}`
          : currentPerson.balance < 0 ? `Owes $${Math.abs(currentPerson.balance).toFixed(2)}` : 'Settled'
        : 'See balance'}</b></div>
      <button onClick={() => send('Explain my balance')} disabled={loading || restoring}><Lightbulb size={13}/> Explain</button>
    </div>}
    <section className="agent-run" aria-label="Agent activity trace">
      <div className="agent-run-head"><div><span>AGENT RUN {String(runNumber).padStart(2, '0')}</span><b>Evidence trail</b></div><span className={`run-state ${loading || restoring ? 'working' : pendingAction ? 'review' : 'ready'}`}>{loading || restoring ? 'Working' : pendingAction ? 'Review needed' : 'Live'}</span></div>
      <ol>{runEvidence().map((step, index) => <li key={`${step.label}-${index}`} className={step.state}><i>{step.state === 'done' ? '✓' : index + 1}</i><div><b>{step.label}</b><small>{step.detail}</small></div></li>)}</ol>
      {settlementRows.length > 0 && <div className="agent-settlement-preview"><span>Current settlement plan</span><b>{settlementRows.map((row) => `${row.from.name} → ${row.to.name}`).join(' · ')}</b></div>}
    </section>
    <div className="agent-messages" aria-live="polite">
      {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`bubble ${message.role === 'user' ? 'user' : ''}`}>
        <div>{message.text}</div>
        {message.action && ['add_expense', 'add_expenses', 'update_expense', 'delete_expense', 'add_person'].includes(message.action.type) && !('confirmed' in message.action && message.action.confirmed) && <div className="agent-confirm">
          <b>Change ready to review</b><p>{confirmationCopy(message.action)}</p>
          <button className="btn" onClick={() => confirm(message.action!)} disabled={confirming === message.action}>
            {confirming === message.action ? <Loader2 size={14}/> : <Check size={14}/>} Confirm change
          </button>
        </div>}
        {message.action?.type === 'show_settlement' && <Link className="btn agent-action" to={`/group/${trip.id}/settlement`}><Wallet size={14}/> Open Final Settlement <ArrowRight size={14}/></Link>}
        {message.action?.type === 'analyze_spending' && <div className="agent-analysis">
          <b><BarChart3 size={14}/> Spending snapshot</b><span>Total spent <strong>${total.toFixed(2)}</strong></span>
          <span>{trip.expenses.length} recorded expense{trip.expenses.length === 1 ? '' : 's'}</span>
          {biggest && <span>Largest <strong>{biggest.title} · ${biggest.amount.toFixed(2)}</strong></span>}
        </div>}
        {message.action?.type === 'explain_balance' && <div className="agent-analysis">
          <b><Lightbulb size={14}/> Balance explained</b>
          {balances.filter((person) => Math.abs(person.balance) > 0.005).map((person) => <span key={person.id}>
            <strong>{person.name}</strong> {person.balance > 0 ? `is owed $${person.balance.toFixed(2)}` : `owes $${Math.abs(person.balance).toFixed(2)}`}
          </span>)}
          {!balances.some((person) => Math.abs(person.balance) > 0.005) && <span>Everyone is settled.</span>}
        </div>}
        {message.action && 'confirmed' in message.action && message.action.confirmed && <small className="completed"><Check size={13}/> Saved to group</small>}
      </div>)}
      {(loading || restoring) && <div className="bubble loading-bubble"><Loader2 size={15}/> {restoring ? 'Restoring…' : 'Working…'}</div>}
    </div>
    <div className="agent-suggestions"><span><MessageCircle size={12}/> Give the Agent an instruction</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)} disabled={loading || restoring}>{suggestion}</button>)}</div>
    <div className="agent-reset">
      <button onClick={reset} disabled={loading || restoring}><RotateCcw size={12}/> Reset conversation</button>
      {lastFailed && <button onClick={() => send(lastFailed)} disabled={loading || restoring}><RefreshCw size={12}/> Retry</button>}
    </div>
    <div className="agent-input">
      <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} aria-label="Give the Splitmate Agent an instruction" placeholder="Give the Agent an instruction…"/>
      <button onClick={() => send()} disabled={!input.trim() || loading || restoring} aria-label="Send message"><Send size={17}/></button>
    </div>
  </div>;
}
