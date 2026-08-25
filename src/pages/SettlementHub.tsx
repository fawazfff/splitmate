import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Wallet, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { base } from 'wagmi/chains';
import { useAccount, useConnect } from 'wagmi';

type Person={id:string,name:string,wallet?:string};
type Exp={title:string,amount:number,paid:string,split:string[]};
type Group={id:string,name:string,people:Person[],expenses:Exp[]};
const key='splitmate.groups';
const load=():Group[]=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const save=(g:Group)=>localStorage.setItem(key,JSON.stringify([g,...load().filter(x=>x.id!==g.id)]));
const money=(n:number)=>'$'+n.toFixed(2);

export default function SettlementHub({id}:{id:string}){
 const nav=useNavigate(); const {address}=useAccount(); const {connect,connectors}=useConnect();
 const [group,setGroup]=useState<Group|undefined>(()=>load().find(x=>x.id===id));
 const [editing,setEditing]=useState<Person|null>(null); const [wallet,setWallet]=useState(''); const [saved,setSaved]=useState(false);
 const rows=useMemo(()=>{if(!group)return[];const bal:Record<string,number>=Object.fromEntries(group.people.map(p=>[p.id,0]));group.expenses.forEach(e=>{if(bal[e.paid]!==undefined)bal[e.paid]+=Number(e.amount);const s=e.split||[];s.forEach(p=>{if(bal[p]!==undefined)bal[p]-=Number(e.amount)/s.length})});const debtors=group.people.filter(p=>bal[p.id]<-.005).map(p=>({p,n:-bal[p.id]}));const creditors=group.people.filter(p=>bal[p.id]>.005).map(p=>({p,n:bal[p.id]}));const out:{from:Person,to:Person,amount:number}[]=[];let i=0,j=0;while(i<debtors.length&&j<creditors.length){const amount=Math.min(debtors[i].n,creditors[j].n);out.push({from:debtors[i].p,to:creditors[j].p,amount});debtors[i].n-=amount;creditors[j].n-=amount;if(debtors[i].n<.005)i++;if(creditors[j].n<.005)j++}return out},[group]);
 if(!group)return <main className="empty"><h1>Group not found</h1><Link className="btn" to="/create">Create a group</Link></main>;
 const openWallet=(p:Person)=>{setEditing(p);setWallet(p.wallet||'');setSaved(false)};
 const saveWallet=()=>{const value=wallet.trim();if(!editing||!/^0x[a-fA-F0-9]{40}$/.test(value))return;const next={...group,people:group.people.map(p=>p.id===editing.id?{...p,wallet:value}:p)};save(next);setGroup(next);setSaved(true)};
 return <main className="form">
  <Link className="ghost" to={`/group/${id}`}><ArrowLeft size={15}/> Back to group</Link>
  <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-end',marginTop:28,flexWrap:'wrap'}}><div><p className="eyebrow">SETTLEMENT</p><h1>Settle {group.name}.</h1><p>Review the balances, add any missing wallets, then choose how to settle.</p></div><div className="panel" style={{padding:'12px 16px'}}><small>NETWORK</small><b style={{display:'block',marginTop:4}}>USDC on Base</b></div></div>
  <section className="panel" style={{marginTop:24}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><div><p className="eyebrow">PAYMENTS</p><h2>{rows.length} payment{rows.length===1?'':'s'} needed</h2></div>{rows.length===0&&<span className="success"><Check size={16}/> Settled</span>}</div>
   {rows.length?rows.map((r,i)=><div className="payment" key={r.from.id+r.to.id+i}><div><b>{r.from.name} → {r.to.name}</b><small>{money(r.amount)} USDC · Base</small></div><span className={r.from.wallet&&r.to.wallet?'success':'warning'}>{r.from.wallet&&r.to.wallet?'Ready':'Wallet needed'}</span></div>):<p>Everyone is settled up.</p>}
  </section>
  <section className="panel" style={{marginTop:18}}><div><p className="eyebrow">WALLET STATUS</p><h2>Everyone has a place to receive or pay.</h2><p>Add a wallet directly for the person who is missing one. No hunting through settings.</p></div>
   <div style={{marginTop:12}}>{group.people.map(p=><div className="person row" key={p.id}><div className="avatar">{p.name[0]?.toUpperCase()||'?'}</div><div style={{flex:1}}><b>{p.name}</b><small>{p.wallet?<span title={p.wallet}>{p.wallet.slice(0,8)+'…'+p.wallet.slice(-6)}</span>:'Wallet not added yet'}</small></div>{p.wallet?<button className="icon" aria-label={`Copy ${p.name}'s wallet`} onClick={()=>navigator.clipboard?.writeText(p.wallet||'')}><Copy size={14}/></button>:<button className="btn small" onClick={()=>openWallet(p)}><Wallet size={14}/> Add wallet</button>}</div>)}</div>
  </section>
  {address&&<p style={{marginTop:14,fontSize:13}}>Connected wallet: {address.slice(0,8)}…{address.slice(-6)}</p>}
  <div className="panel" style={{marginTop:18}}><h3>Next step</h3><p>Once every person involved in a payment has a wallet, you can review the suggested transfers and approve payments from the correct wallet.</p>{rows.length&&rows.every(r=>r.from.wallet&&r.to.wallet)?<button className="btn full" onClick={()=>alert('All wallets are ready. Review each payment before approving it in your wallet.')}>Review payments</button>:<button className="ghost" onClick={()=>rows.find(r=>!r.from.wallet||!r.to.wallet)&&openWallet((rows.find(r=>!r.from.wallet||!r.to.wallet)!.from.wallet?rows.find(r=>!r.from.wallet||!r.to.wallet)!.to:rows.find(r=>!r.from.wallet||!r.to.wallet)!.from))}>Add missing wallet</button>}</div>
  {editing&&<div className="backdrop" role="dialog" aria-modal="true"><div className="modal"><button className="icon close" onClick={()=>setEditing(null)}><X/></button><p className="eyebrow">WALLET SETUP</p><h2>Add {editing.name}'s wallet</h2><p>Enter the wallet address that belongs to <b>{editing.name}</b>. This is used for the settlement recipient or payer.</p><label>Base wallet address<input autoFocus value={wallet} onChange={e=>{setWallet(e.target.value);setSaved(false)}} placeholder="0x…" spellCheck={false}/></label>{wallet&& !/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())&&<p className="error">Enter a valid EVM wallet address starting with 0x.</p>}{saved&&<p className="success"><Check size={16}/> Wallet saved for {editing.name}.</p>}<div style={{display:'flex',gap:8,marginTop:16}}><button className="ghost" onClick={()=>setEditing(null)}>Cancel</button><button className="btn" disabled={!/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())} onClick={saveWallet}>Save wallet</button></div><small style={{display:'block',marginTop:14}}>Network: Base · USDC</small></div></div>}
 </main>;
}
