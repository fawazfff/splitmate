import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function SiteNav() {
  return (
    <>
      <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,.94)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--line)', padding:'10px 20px' }}>
        <div style={{ maxWidth:1180, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <Link className="brand" to="/">split<span>mate</span></Link>
          <nav style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <Link to="/">Home</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/help">Help & FAQ</Link>
            <Link to="/about">About</Link>
            <Link className="btn small" to="/create">Start a group <ArrowRight size={14}/></Link>
          </nav>
        </div>
      </div>
    </>
  );
}
