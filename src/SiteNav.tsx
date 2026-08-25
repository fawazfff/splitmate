import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

export default function SiteNav(){
 const[open,setOpen]=useState(false);
 const close=()=>setOpen(false);
 return <>
  <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(255,255,255,.94)',backdropFilter:'blur(12px)',borderBottom:'1px solid var(--line)',padding:'10px 20px'}}>
   <div style={{maxWidth:1180,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
    <Link className="brand" to="/" onClick={close}>split<span>mate</span></Link>
    <nav className="site-desktop-nav" style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}><Link to="/">Home</Link><Link to="/how-it-works">How it works</Link><Link to="/help">Help & FAQ</Link><Link to="/about">About</Link><Link className="btn small" to="/create">Start a group <ArrowRight size={14}/></Link></nav>
    <button className="icon site-mobile-menu" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(!open)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
   </div>
   {open&&<div style={{maxWidth:1180,margin:'10px auto 0',padding:'8px 0',display:'grid',gap:3}}><Link style={{padding:12}} to="/" onClick={close}>Home</Link><Link style={{padding:12}} to="/how-it-works" onClick={close}>How it works</Link><Link style={{padding:12}} to="/help" onClick={close}>Help & FAQ</Link><Link style={{padding:12}} to="/about" onClick={close}>About</Link><Link className="btn" style={{marginTop:5,justifyContent:'center'}} to="/create" onClick={close}>Start a group <ArrowRight size={14}/></Link></div>}
  </div>
  <style>{`@media(max-width:760px){.site-desktop-nav{display:none!important}.site-mobile-menu{display:inline-flex!important}}@media(min-width:761px){.site-mobile-menu{display:none!important}}`}</style>
  <footer style={{borderTop:'1px solid var(--line)',marginTop:50,padding:'24px 20px'}}><div style={{maxWidth:1180,margin:'0 auto',display:'flex',justifyContent:'space-between',gap:18,flexWrap:'wrap',fontSize:13}}><div><b>splitmate</b><span style={{marginLeft:10}}>Shared expenses, settled simply · Base</span></div><div style={{display:'flex',gap:14,flexWrap:'wrap'}}><Link to="/how-it-works">How it works</Link><Link to="/help">FAQ</Link><Link to="/about">About</Link><span>Built for the ORION Agent Hackathon</span></div></div></footer>
 </>;
}
