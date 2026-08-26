import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

const links = [
  ['/', 'Home'],
  ['/create', 'Create group'],
  ['/how-it-works', 'How it works'],
  ['/help', 'Help & FAQ'],
  ['/about', 'About'],
] as const;

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  return <header>
    <Link className="brand" to="/" onClick={() => setOpen(false)}>split<span>mate</span></Link>
    <nav>{links.slice(0, 1).concat(links.slice(2)).map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>
    <Link className="btn small" to="/create">Start a group <ArrowRight size={14}/></Link>
    <button className="icon mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((current) => !current)}>{open ? <X size={19}/> : <Menu size={19}/>}</button>
    {open && <div className="mobile-nav">{links.map(([to, label]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{label}</Link>)}</div>}
  </header>;
}

export function SiteFooter() {
  return <footer>
    <div><b>splitmate</b><span> · Shared expenses, settled simply on Base</span></div>
    <div><Link to="/how-it-works">How it works</Link> · <Link to="/help">FAQ</Link> · <Link to="/about">About</Link> · <span>ORION Agent Hackathon</span></div>
  </footer>;
}
