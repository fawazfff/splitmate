import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export default function EnhancedHome(){
  return <main>
    <section className="hero">
      <div>
        <p className="eyebrow">SHARED MONEY, WITHOUT THE HEADACHE</p>
        <h1>Stop doing<br/><span>the math.</span></h1>
        <p>Tell Splitmate what happened in normal language. The Agent collects missing details, works with your saved group expenses, answers balance questions and helps prepare settlement.</p>
        <div className="actions"><Link className="btn" to="/create">Create a group <ArrowRight size={16}/></Link><Link className="ghost" to="/group/demo">Try live demo</Link></div>
        <small>● No account required · USDC on Base · You approve every payment</small>
      </div>
      <div className="visual"><div className="card"><Sparkles/><b>Agent working with your group</b><span>“Sadiq paid $99 for drinks.”</span><hr/><strong>1. Clarify</strong><span>Who shared the expense?</span><strong>2. Save</strong><span>Update the group's expense record</span></div></div>
    </section>
    <section className="steps"><p className="eyebrow">WHAT MAKES IT AN AGENT</p><h2>It does work, not just chat.</h2><div className="grid">
      <div className="step"><small>01</small><h3>Understand</h3><p>It interprets natural messages about shared expenses instead of forcing you through a complicated form.</p></div>
      <div className="step"><small>02</small><h3>Ask</h3><p>When a key detail is missing, it asks for that detail instead of confidently guessing.</p></div>
      <div className="step"><small>03</small><h3>Remember</h3><p>Confirmed expenses become part of the group's saved data, so later questions can use them.</p></div>
      <div className="step"><small>04</small><h3>Act</h3><p>It can help record expenses, explain balances and prepare settlement actions for you to review.</p></div>
    </div></section>
    <section className="panel" style={{maxWidth:900,margin:'0 auto 70px'}}><div style={{display:'flex',gap:10,alignItems:'center'}}><CheckCircle2 size={19}/><b>Human approval stays in the loop</b></div><p>The Agent can prepare a payment, but it never silently moves your funds. Your wallet is the final approval step.</p><Link className="ghost" to="/how-it-works">See exactly how it works <ArrowRight size={15}/></Link></section>
    <section className="usecases"><h2>Whatever you're splitting.</h2><div className="chips">{['🧑‍🤝‍🧑 Friends','🏠 Roommates','✈️ Trips','🎉 Events','💻 Teams','🌐 Crypto groups'].map(x=><span key={x}>{x}</span>)}</div></section>
  </main>;
}
