import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

const links = [
  ['/', 'Home'],
  ['/create', 'Create group'],
  ['/how-it-works', 'How it works'],
  ['/proof', 'Agent proof'],
  ['/help', 'Help & FAQ'],
  ['/about', 'About'],
] as const;

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  return <header>
    <Link className="brand" to="/" onClick={() => setOpen(false)}>split<span>mate</span></Link>
    <nav aria-label="Primary navigation">{links.slice(0, 1).concat(links.slice(2)).map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : undefined}>{label}</NavLink>)}</nav>
    <Link className="btn small" to="/create">Start a group <ArrowRight size={14}/></Link>
    <button className="icon mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((current) => !current)}>{open ? <X size={19}/> : <Menu size={19}/>}</button>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'is-active' : undefined}>{label}</NavLink>)}</nav>}
  </header>;
}

export function SiteFooter() {
  return <footer>
    <div><b>splitmate</b><span> · Shared expenses, settled simply on Base</span><small className="orion-badge">Built for the Orion Agent Hackathon</small></div>
    <div><Link to="/how-it-works">How it works</Link> · <Link to="/proof">Agent proof</Link> · <Link to="/help">FAQ</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/about">About</Link></div>
  </footer>;
}
