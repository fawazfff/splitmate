import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Plus, X, Wallet } from 'lucide-react';

type Person={id:string,name:string,wallet?:string,avatar?:string};
type Group={id:string,name:string,people:Person[],expenses:any[]};
const uid=()=>crypto.randomUUID();
const key='splitmate.groups';
const load=():Group[]=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const save=(g:Group)=>localStorage.setItem(key,JSON.stringify([g,...load().filter(x=>x.id!==g.id)]));

export default function EnhancedCreate(){
 const nav=useNavigate(); const[name,setName]=useState(''); const[err,setErr]=useState('');
 const[people,setPeople]=useState<Person[]>([{id:uid(),name:''},{id:uid(),name:''}]);
 const setImage=(id:string,file?:File)=>{if(!file)return;if(file.size>2e6){setErr('Profile pictures must be under 2MB.');return}const r=new FileReader();r.onload=()=>setPeople(ps=>ps.map(p=>p.id===id?{...p,avatar:String(r.result)}:p));r.readAsDataURL(file)};
 const setWallet=(id:string,value:string)=>setPeople(ps=>ps.map(p=>p.id===id?{...p,wallet:value}:p));
 const pasteWallet=async(id:string)=>{try{const value=await navigator.clipboard?.readText();if(value)setWallet(id,value.trim())}catch{setErr('Clipboard access was blocked. Paste the wallet address manually.')}};
 const create=()=>{setErr('');const ps=people.filter(p=>p.name.trim()).map(p=>({...p,name:p.name.trim(),wallet:p.wallet?.trim()||undefined}));if(!name.trim()||ps.length<2){setErr('Add a group name and at least two people.');return}const bad=ps.find(p=>p.wallet&&!/^0x[a-fA-F0-9]{40}$/.test(p.wallet));if(bad){setErr(`${bad.name}'s wallet address is not a valid EVM address.`);return}const g:Group={id:uid(),name:name.trim(),people:ps,expenses:[]};save(g);nav('/group/'+g.id)};
 return <main className="form"><p className="eyebrow">START A GROUP</p><h1>Create your group.</h1><p>Add your people, profile pictures, and optional wallet addresses now. You can always add or edit wallets later from Final Settlement.</p><div className="panel">
  <label>Group name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. ORION Hackathon Team"/></label><h3>People</h3>
  {people.map((p,i)=><div className="person" key={p.id}>
   <label className="avatar-upload"><div className="avatar" style={{position:'relative'}}>{p.avatar?<img src={p.avatar} alt={p.name||'Profile'}/>:<><Camera size={17}/><small style={{fontSize:9}}>Photo</small></>}</div><span className="camera"><Camera size={11}/></span><input type="file" accept="image/*" onChange={e=>setImage(p.id,e.target.files?.[0])}/></label>
   <div><input value={p.name} onChange={e=>setPeople(a=>a.map(x=>x.id===p.id?{...x,name:e.target.value}:x))} placeholder={i?'Friend '+i:'Your name'}/><div className="wallet-field"><Wallet size={14}/><input value={p.wallet||''} onChange={e=>setWallet(p.id,e.target.value)} placeholder="Wallet address (optional)" spellCheck={false}/><button type="button" onClick={()=>pasteWallet(p.id)}>Paste</button></div></div>
   {people.length>2&&<button className="icon" onClick={()=>setPeople(a=>a.filter(x=>x.id!==p.id))}><X/></button>}
  </div>)}
  <button className="add" onClick={()=>setPeople(p=>[...p,{id:uid(),name:''}])}><Plus size={15}/> Add another person</button>
  {err&&<p className="error">{err}</p>}<button className="btn full" onClick={create}>Create group <ArrowRight size={16}/></button>
 </div></main>;
}
