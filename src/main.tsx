import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import './styles.css';
import { config } from './wagmi';
import App from './App';
import HowItWorks from './pages/HowItWorks';
import Help from './pages/Help';
import EnhancedHome from './pages/EnhancedHome';
import EnhancedCreate from './pages/EnhancedCreate';
import SettlementHub from './pages/SettlementHub';

const queryClient = new QueryClient();

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <>
    <header>
      <Link className="brand" to="/" onClick={() => setOpen(false)}>split<span>mate</span></Link>
      <nav>
        <Link to="/" onClick={() => setOpen(false)}>Home</Link>
        <Link to="/create" onClick={() => setOpen(false)}>Create group</Link>
        <Link to="/how-it-works" onClick={() => setOpen(false)}>How it works</Link>
        <Link to="/help" onClick={() => setOpen(false)}>Help & FAQ</Link>
        <Link to="/about" onClick={() => setOpen(false)}>About</Link>
      </nav>
      <Link className="btn small" to="/create">Start a group</Link>
      <button className="icon mobile-menu" aria-label="Open menu" onClick={() => setOpen(!open)}>☰</button>
      {open && <div style={{position:'absolute',top:'calc(100% + 8px)',left:12,right:12,background:'#fff',border:'1px solid var(--line)',borderRadius:14,padding:10,boxShadow:'0 15px 35px rgba(0,0,0,.12)',zIndex:100}}>{['/','/create','/how-it-works','/help','/about'].map(path=><Link key={path} style={{display:'block',padding:12}} to={path} onClick={()=>setOpen(false)}>{path==='/'?'Home':path==='/create'?'Create group':path==='/how-it-works'?'How it works':path==='/help'?'Help & FAQ':'About'}</Link>)}</div>}
    </header>
    {children}
    <footer><div><b>splitmate</b><span style={{marginLeft:10}}>Shared expenses, settled simply · USDC on Base</span></div><div style={{display:'flex',gap:14,flexWrap:'wrap'}}><Link to="/how-it-works">How it works</Link><Link to="/help">FAQ</Link><Link to="/about">About</Link><span>Built for the ORION Agent Hackathon</span></div></footer>
  </>;
}

function GroupWithSettlement(){const path=useLocation().pathname;const match=path.match(/^\/group\/([^/]+)\/?$/);const id=match?.[1];return <><App/><Link className="btn" to={`/group/${id}/settlement`} style={{position:'fixed',right:22,bottom:22,zIndex:60,boxShadow:'0 10px 28px rgba(0,0,0,.18)'}}>Settlement →</Link></>}

function Site(){const path=useLocation().pathname;if(path==='/')return <Shell><EnhancedHome/></Shell>;if(path==='/create')return <Shell><EnhancedCreate/></Shell>;if(path==='/how-it-works')return <Shell><HowItWorks/></Shell>;if(path==='/help')return <Shell><Help/></Shell>;if(path==='/about')return <Shell><About/></Shell>;const settlement=path.match(/^\/group\/([^/]+)\/settlement\/?$/);if(settlement)return <Shell><SettlementHub id={settlement[1]}/></Shell>;if(/^\/group\/[^/]+\/?$/.test(path))return <GroupWithSettlement/>;return <App/>;}

function About(){return <main className="about"><p className="eyebrow">ABOUT SPLITMATE</p><h1>Shared money, made simple.</h1><p>Splitmate helps friends, roommates, teams, events, communities and trips track shared expenses, calculate balances and prepare settlements.</p><div className="panel"><h2>Your group's money coordinator.</h2><p>The Agent understands expenses, asks for missing details, works with saved group context and prepares useful actions. You approve every payment.</p></div><div className="panel" style={{marginTop:18}}><p className="eyebrow">ORION AGENT HACKATHON</p><h2>Built around an Agent doing useful work.</h2><p>Splitmate is designed to turn natural language into real expense and settlement actions while keeping the human in control.</p></div></main>}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><WagmiProvider config={config}><QueryClientProvider client={queryClient}><RainbowKitProvider><BrowserRouter><Site/></BrowserRouter></RainbowKitProvider></QueryClientProvider></WagmiProvider></React.StrictMode>);
