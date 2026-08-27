import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ExternalLink, FlaskConical, ShieldCheck, Wallet } from 'lucide-react';
import type { SettlementNetwork } from '../types';

const testFundSources = [
  {
    name: 'Circle Faucet',
    detail: 'Test USDC · no account required',
    action: 'Get test USDC',
    href: 'https://faucet.circle.com/',
  },
  {
    name: 'Base faucet guide',
    detail: 'Test ETH for Base Sepolia gas',
    action: 'Get test ETH',
    href: 'https://docs.base.org/base-chain/network-information/network-faucets',
  },
  {
    name: 'Coinbase Developer Faucet',
    detail: 'Alternative test USDC and ETH source',
    action: 'Open faucet',
    href: 'https://www.coinbase.com/en-nl/developer-platform/products/faucet',
  },
];

export default function NetworkChoice() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<SettlementNetwork>('base-sepolia');
  const [liveAcknowledged, setLiveAcknowledged] = useState(false);
  const testMode = network === 'base-sepolia';

  const continueToGroup = () => {
    if (!testMode && !liveAcknowledged) return;
    navigate(`/create/group?network=${network}`);
  };

  return <main id="main-content" className="network-choice">
    <p className="eyebrow">CREATE A GROUP</p>
    <h1>Choose how this group will settle.</h1>
    <p className="network-choice-lead">Start safely with test USDC, or create a group for real Base payments. This choice belongs to the group and can’t be changed after expenses are added.</p>

    <section className="network-options" aria-label="Settlement network">
      <button type="button" className={`network-option ${testMode ? 'selected' : ''}`} aria-pressed={testMode} onClick={() => setNetwork('base-sepolia')}>
        <span className="network-option-icon test"><FlaskConical size={20}/></span>
        <span className="network-option-copy"><b>Try safely</b><strong>Base Sepolia · Test USDC</strong><small>Best for judges and practice. No real money is used.</small></span>
        <span className="network-option-check">{testMode && <Check size={16}/>}</span>
      </button>
      <button type="button" className={`network-option ${!testMode ? 'selected' : ''}`} aria-pressed={!testMode} onClick={() => setNetwork('base-mainnet')}>
        <span className="network-option-icon live"><Wallet size={20}/></span>
        <span className="network-option-copy"><b>Use real USDC</b><strong>Base Mainnet · Real USDC</strong><small>For live settlements. Every payment still needs the payer’s wallet approval.</small></span>
        <span className="network-option-check">{!testMode && <Check size={16}/>}</span>
      </button>
    </section>

    {testMode ? <section className="network-funding" aria-labelledby="test-funds-title">
      <div><p className="eyebrow">TEST MODE SETUP</p><h2 id="test-funds-title">Get test funds before you settle.</h2><p>Use test USDC for the transfer and a little test ETH to pay Base Sepolia gas. These tokens have no real-world value.</p></div>
      <div className="faucet-list">
        {testFundSources.map((source) => <a className="faucet-link" key={source.name} href={source.href} target="_blank" rel="noreferrer">
          <b>{source.name}</b><small>{source.detail}</small><span>{source.action} <ExternalLink size={13}/></span>
        </a>)}
      </div>
    </section> : <section className="network-live-warning">
      <ShieldCheck size={19}/><div><b>Live payments are intentional.</b><p>Splitmate only prepares a payment. The exact payer must connect their wallet and approve each real-USDC transfer.</p>
      <label><input type="checkbox" checked={liveAcknowledged} onChange={(event) => setLiveAcknowledged(event.target.checked)}/> I understand this group will use real USDC on Base Mainnet.</label></div>
    </section>}

    <div className="network-choice-footer">
      <small>{testMode ? 'You can create a test group without a wallet.' : 'You will add wallets only when the group is ready to settle.'}</small>
      <button className="btn" disabled={!testMode && !liveAcknowledged} onClick={continueToGroup}>Continue with {testMode ? 'Base Sepolia' : 'Base Mainnet'} <ArrowRight size={16}/></button>
    </div>
  </main>;
}
