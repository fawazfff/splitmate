import { Link } from 'react-router-dom';
import { ArrowRight, Check, MessageCircle, Wallet } from 'lucide-react';

export default function HowItWorks() {
  return (
    <main className="about">
      <p className="eyebrow">HOW SPLITMATE WORKS</p>
      <h1>From a message to a clear settlement.</h1>
      <p>Splitmate combines a conversational Agent with saved group data. You describe what happened, the Agent collects anything missing, and the app handles the bookkeeping.</p>

      <div className="grid" style={{ marginTop: 32 }}>
        <div className="step"><small>01</small><h3>Create your group</h3><p>Add the people involved. Profile pictures are optional, and wallet addresses can be added when you are ready to settle.</p></div>
        <div className="step"><small>02</small><h3>Tell the Agent</h3><p>Say something natural like “Sadiq paid 99 dollars for drinks.” You do not need to learn commands.</p></div>
        <div className="step"><small>03</small><h3>Agent asks, not guesses</h3><p>If the amount, payer, purpose or people sharing the expense is unclear, the Agent asks for the missing detail.</p></div>
        <div className="step"><small>04</small><h3>Save the expense</h3><p>Once you confirm the details, the expense becomes part of the group's saved data so future questions can use it.</p></div>
        <div className="step"><small>05</small><h3>Understand the balance</h3><p>Ask who owes who or how much someone owes. Splitmate calculates from the recorded expenses instead of inventing numbers.</p></div>
        <div className="step"><small>06</small><h3>Review and settle</h3><p>The app prepares the payments needed to clear the balances. You remain in control of the final wallet transaction.</p></div>
      </div>

      <section className="panel" style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><MessageCircle size={20}/><b>You stay in control</b></div>
        <p style={{ marginBottom: 10 }}>The Agent can interpret requests and prepare actions, but it does not silently move your money.</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><Check size={15}/> Agent prepares</span>
          <span><Check size={15}/> You review</span>
          <span><Wallet size={15}/> You approve in your wallet</span>
        </div>
      </section>

      <Link className="btn" style={{ display: 'inline-flex', marginTop: 24, gap: 8 }} to="/create">Create a group <ArrowRight size={16}/></Link>
    </main>
  );
}
