import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Plus, X } from 'lucide-react';

type Person={id:string,name:string,wallet?:string,image?:string};
type Group={id:string,name:string,people:Person[],expenses:any[]};
const uid=()=>crypto.randomUUID();
const key='splitmate.groups';
const load=():Group[]=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const save=(g:Group)=>localStorage.setItem(key,JSON.stringify([g,...load().filter(x=>x.id!==g.id)]));

export default function EnhancedCreate(){
 const nav=useNavigate(); const[name,setName]=useState(''); const[err,setErr]=useState('');
 const[people,setPeople]=useState<Person[]>([{id:uid(),name:''},{id:uid(),name:''}]);
 const setImage=(id:string,file?:File)=>{if(!file)return;const r=new FileReader();r.onload=()=>setPeople(ps=>ps.map(p=>p.id===id?{...p,image:String(r.result)}:p));r.readAsDataURL(file)};
 const create=()=>{const ps=people.filter(p=>p.name.trim()).map(p=>({...p,name:p.name.trim()}));if(!name.trim()||ps.length<2){setErr('Add a group name and at least two people.');return}const g:Group={id:uid(),name:name.trim(),people:ps,expenses:[]};save(g);nav('/group/'+g.id)};
 return <main className="form"><p className="eyebrow">START SOMETHING</p><h1>Create a group</h1><p>Add the people involved. Photos are optional and wallet addresses can be added now or later.</p><div className="panel">
  <label>Group name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Hackathon Team"/></label><h3>People</h3>
  {people.map((p,i)=><div className="person" key={p.id}>
   <label className="avatar" style={{position:'relative',overflow:'hidden',cursor:'pointer'}} title="Add profile picture">
    {p.image?<img src={p.image} alt={p.name||'Profile'} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<><Camera size={17}/><small style={{fontSize:9}}>Photo</small></>}
    <input type="file" accept="image/*" onChange={e=>setImage(p.id,e.target.files?.[0])} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}}/>
   </label>
   <div><input value={p.name} onChange={e=>setPeople(a=>a.map(x=>x.id===p.id?{...x,name:e.target.value}:x))} placeholder={i?'Friend '+i:'Your name'}/><input value={p.wallet||''} onChange={e=>setPeople(a=>a.map(x=>x.id===p.id?{...x,wallet:e.target.value}:x))} placeholder="Wallet address (optional)"/></div>
   {people.length>2&&<button className="icon" onClick={()=>setPeople(a=>a.filter(x=>x.id!==p.id))}><X/></button>}
  </div>)}
  <button className="add" onClick={()=>setPeople(p=>[...p,{id:uid(),name:''}])}><Plus size={15}/> Add another person</button>
  {err&&<p className="error">{err}</p>}<button className="btn full" onClick={create}>Create group <ArrowRight size={16}/></button>
 </div></main>;
}
