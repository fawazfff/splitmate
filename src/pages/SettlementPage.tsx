import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { type Address, parseUnits } from 'viem';
import { ArrowLeft, Check, ExternalLink, Loader2, QrCode, ShieldCheck, Smartphone, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BASE_CHAIN_ID, BASESCAN_URL, calculateSettlementRows, money,
  USDC_ABI, USDC_ADDRESS, USDC_DECIMALS,
} from '../settlement';
import type { Group, Person, SettlementRecord, SettlementRow } from '../types';
import { usePersistentGroup } from '../usePersistentGroup';

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const shortAddress = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
  return <div className="avatar" style={{ width: size, height: size }}>
    {person.avatar ? <img src={person.avatar} alt="" width={size} height={size}/> : person.name[0]?.toUpperCase()}
  </div>;
}

export default function SettlementPage({ id }: { id: string }) {
  const { group, loading, error: syncError, updateGroup, isDemo } = usePersistentGroup(id);
  const [editing, setEditing] = useState<Person | null>(null);
  const [walletInput, setWalletInput] = useState('');
  const [activePayment, setActivePayment] = useState<SettlementRow | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [savingWallet, setSavingWallet] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<SettlementRecord | null>(null);
  const [phoneHandoff, setPhoneHandoff] = useState(false);
  const handledHashes = useRef(new Set<string>());

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();
  const { writeContractAsync, isPending: walletPending, reset: resetWrite } = useWriteContract();

  const rows = useMemo(() => group ? calculateSettlementRows(group) : [], [group]);
  const involvedIds = useMemo(() => new Set(rows.flatMap((row) => [row.from.id, row.to.id])), [rows]);
  const watchedRecord = pendingRecord || group?.settlements.find((record) => record.status === 'submitted') || null;
  const receipt = useWaitForTransactionReceipt({
    hash: watchedRecord?.txHash,
    query: { enabled: Boolean(watchedRecord?.txHash) },
  });

  useEffect(() => {
    if (!group || !watchedRecord || handledHashes.current.has(watchedRecord.txHash)) return;
    if (!receipt.data) return;
    handledHashes.current.add(watchedRecord.txHash);
    const confirmed = receipt.data.status === 'success';
    const status = confirmed ? 'confirmed' : 'failed';
    const existing = group.settlements.some((record) => record.id === watchedRecord.id);
    const savedRecord: SettlementRecord = {
      ...watchedRecord,
      status,
      confirmedAt: confirmed ? new Date().toISOString() : undefined,
      error: confirmed ? undefined : 'The USDC transfer reverted on Base.',
    };
    const settlements = existing
      ? group.settlements.map((record) => record.id === watchedRecord.id ? savedRecord : record)
      : [...group.settlements, savedRecord];
    updateGroup({ ...group, settlements })
      .then(() => {
        setFeedback(confirmed ? 'Payment confirmed on Base.' : 'Payment reverted on Base. No balance was marked as settled.');
        if (pendingRecord?.txHash === watchedRecord.txHash) setPendingRecord(null);
      })
      .catch(() => {
        handledHashes.current.delete(watchedRecord.txHash);
        setPaymentError('The receipt was found, but its status could not be saved. Reload to retry.');
      });
  }, [group, pendingRecord?.txHash, receipt.data, updateGroup, watchedRecord]);

  useEffect(() => {
    if (receipt.error) setPaymentError('Splitmate could not check the Base receipt just now. The transaction remains submitted.');
  }, [receipt.error]);

  if (loading && !group) return <main className="empty"><Loader2 className="spin"/><p>Loading settlement…</p></main>;
  if (!group) return <main className="empty"><h1>Group not found</h1><p>{syncError || 'This link is not available in this browser.'}</p><Link className="btn" to="/create">Create a group</Link></main>;

  const involvedPeople = group.people.filter((person) => involvedIds.has(person.id));
  const missingWalletPeople = involvedPeople.filter((person) => !person.wallet || !EVM_ADDRESS.test(person.wallet));
  const readyToSettle = rows.length > 0 && missingWalletPeople.length === 0;
  const expectedPayer = activePayment?.from.wallet?.toLowerCase();
  const connectedWallet = address?.toLowerCase();
  const walletMatches = Boolean(expectedPayer && connectedWallet === expectedPayer);

  const editWallet = (person: Person) => {
    setEditing(person);
    setWalletInput(person.wallet || '');
    setPaymentError('');
  };

  const saveWallet = async () => {
    const wallet = walletInput.trim();
    if (!editing || !EVM_ADDRESS.test(wallet)) return;
    setSavingWallet(true);
    try {
      await updateGroup({
        ...group,
        people: group.people.map((person) => person.id === editing.id ? { ...person, wallet } : person),
      });
      setEditing(null);
      setFeedback(`${editing.name}'s wallet was saved.`);
    } catch (reason) {
      setPaymentError(reason instanceof Error ? reason.message : 'The wallet could not be saved.');
    } finally {
      setSavingWallet(false);
    }
  };

  const reviewPayment = (row: SettlementRow) => {
    if (!readyToSettle) {
      setPaymentError('Add a valid wallet for everyone involved before reviewing payments.');
      return;
    }
    setActivePayment(row);
    setPaymentError('');
    setFeedback('');
    setPhoneHandoff(false);
    resetWrite();
  };

  const sendPayment = async () => {
    if (!readyToSettle) {
      setActivePayment(null);
      setPaymentError('Settlement was locked because a required wallet is missing or invalid.');
      return;
    }
    if (!activePayment?.from.wallet || !activePayment.to.wallet) return;
    if (!isConnected || !walletMatches) {
      setPaymentError(`Connect the exact wallet saved for ${activePayment.from.name}.`);
      return;
    }
    setPaymentError('');
    let txHash: `0x${string}`;
    try {
      if (chainId !== BASE_CHAIN_ID) await switchChainAsync({ chainId: BASE_CHAIN_ID });
      txHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [activePayment.to.wallet as Address, parseUnits(activePayment.amount.toFixed(USDC_DECIMALS), USDC_DECIMALS)],
        chainId: BASE_CHAIN_ID,
      });
    } catch (reason) {
      setPaymentError(reason instanceof Error ? reason.message : 'The wallet did not submit the payment.');
      return;
    }
    const record: SettlementRecord = {
        id: crypto.randomUUID(),
        from: activePayment.from.id,
        to: activePayment.to.id,
        amount: activePayment.amount,
        txHash,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
    };
    setPendingRecord(record);
    try {
      await updateGroup({ ...group, settlements: [...group.settlements, record] });
      setFeedback('Payment submitted. Splitmate is waiting for the Base confirmation.');
      setActivePayment(null);
    } catch {
      setPaymentError(`The payment was submitted, but Splitmate could not save it yet. Track it on BaseScan: ${txHash}`);
    }
  };

  const submittedFor = (row: SettlementRow) => group.settlements.some((record) =>
    record.status === 'submitted' && record.from === row.from.id && record.to === row.to.id && Math.abs(record.amount - row.amount) < 0.005,
  );

  return <main className="form settlement-page">
    <Link className="ghost" to={`/group/${id}`}><ArrowLeft size={15}/> Back to group</Link>
    <p className="eyebrow settlement-eyebrow">FINAL SETTLEMENT</p>
    <h1>Settle {group.name}.</h1>
    <p>Review each payment, then connect the exact wallet saved for the person paying. Every USDC transfer requires approval in that wallet.</p>
    {isDemo && <div className="demo-notice"><ShieldCheck size={18}/><div><b>Safe demo preview</b><small>This shows the settlement plan only. Demo payments and wallet edits are disabled.</small></div></div>}
    {(syncError || paymentError) && <p className="error" role="alert">{paymentError || syncError}</p>}
    {feedback && <p className="success notice" role="status"><Check size={16}/>{feedback}</p>}

    <section className="panel">
      <div className="settlement-summary">
        <div><p className="eyebrow">SETTLEMENT STATUS</p><h2>{rows.length ? `${rows.length} payment${rows.length === 1 ? '' : 's'} needed` : 'Everyone is settled'}</h2></div>
        {rows.length > 0 && !isDemo && <span className={readyToSettle ? 'success compact' : 'warning'}>{readyToSettle ? 'Ready to settle' : `${missingWalletPeople.length} wallet${missingWalletPeople.length === 1 ? '' : 's'} needed`}</span>}
      </div>
      {rows.length > 0 && !isDemo && <div className={`settlement-readiness ${readyToSettle ? 'ready' : 'blocked'}`} role="status">
        {readyToSettle ? <Check size={18}/> : <ShieldCheck size={18}/>}
        <div>
          <b>{readyToSettle ? 'Ready to settle' : 'Payments are locked'}</b>
          <small>{readyToSettle ? 'Every person involved has a valid wallet. You can review each payment.' : `Add a valid wallet for ${missingWalletPeople.map((person) => person.name).join(', ')} before any payment can begin.`}</small>
        </div>
      </div>}
      {rows.map((row) => {
        const submitted = submittedFor(row);
        return <div className="payment settlement-row" key={`${row.from.id}-${row.to.id}-${row.amount}`}>
          <div className="payment-route">
            <Avatar person={row.from} size={38}/><b>{row.from.name}</b><span>pays</span><Avatar person={row.to} size={38}/><b>{row.to.name}</b>
          </div>
          <div className="payment-amount">
            <b>{money(row.amount)} USDC</b>
            <small>{isDemo ? 'Preview only' : submitted ? 'Waiting for Base confirmation' : readyToSettle ? 'Base mainnet transfer' : 'Waiting for wallet setup'}</small>
            {!isDemo && <button className="btn small" disabled={!readyToSettle || submitted} onClick={() => reviewPayment(row)}>
              {submitted ? <><Loader2 className="spin" size={14}/> Submitted</> : !readyToSettle ? <><ShieldCheck size={14}/> Locked</> : <><Wallet size={14}/> Review payment</>}
            </button>}
          </div>
        </div>;
      })}
      {!rows.length && <p className="settled-copy"><Check size={18}/> There is nothing left to pay.</p>}
    </section>

    {rows.length > 0 && !isDemo && <section className="panel wallet-panel">
      <p className="eyebrow">PAYMENT WALLETS</p><h2>Saved wallet identities</h2>
      <p>These addresses identify each payer and recipient. Saving an address never gives Splitmate permission to spend from it.</p>
      {involvedPeople.map((person) => {
        const validWallet = Boolean(person.wallet && EVM_ADDRESS.test(person.wallet));
        return <button key={person.id} className="person row wallet-person" onClick={() => editWallet(person)}>
          <Avatar person={person}/><div><b>{person.name}</b><small>{validWallet ? shortAddress(person.wallet || '') : person.wallet ? 'Invalid wallet · Tap to fix' : 'Wallet required to settle · Tap to add'}</small></div>
          {validWallet ? <Check size={17}/> : <Wallet size={17}/>}
        </button>;
      })}
    </section>}

    {group.settlements.length > 0 && <section className="panel settlement-history">
      <p className="eyebrow">PAYMENT HISTORY</p><h2>Base transactions</h2>
      {[...group.settlements].reverse().map((record) => <div className="payment" key={record.id}>
        <div><b>{group.people.find((person) => person.id === record.from)?.name} → {group.people.find((person) => person.id === record.to)?.name}</b><small>{money(record.amount)} USDC · {record.status}</small></div>
        <a className="ghost compact-link" href={`${BASESCAN_URL}/tx/${record.txHash}`} target="_blank" rel="noreferrer">BaseScan <ExternalLink size={13}/></a>
      </div>)}
    </section>}

    {isDemo && <div className="demo-cta"><p>Ready to use real wallets and Base USDC?</p><Link className="btn" to="/create">Create your own group</Link></div>}

    {editing && <div className="backdrop"><div className="modal">
      <button className="icon close" aria-label="Close wallet form" onClick={() => setEditing(null)}><X/></button>
      <p className="eyebrow">WALLET SETUP</p><h2>{editing.wallet ? 'Change' : 'Add'} {editing.name}'s wallet</h2>
      <p>Use the Base wallet this person will receive from or approve payments with.</p>
      <label>Base / EVM wallet address<input name="walletAddress" autoComplete="off" inputMode="text" value={walletInput} onChange={(event) => setWalletInput(event.target.value)} placeholder="0x…" spellCheck={false}/></label>
      {walletInput && !EVM_ADDRESS.test(walletInput.trim()) && <p className="error">Enter a valid EVM wallet address.</p>}
      <div className="modal-actions"><button className="ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn" disabled={!EVM_ADDRESS.test(walletInput.trim()) || savingWallet} onClick={saveWallet}>{savingWallet ? 'Saving…' : 'Save wallet'}</button></div>
    </div></div>}

    {activePayment && <div className="backdrop"><div className="modal payment-review">
      <button className="icon close" aria-label="Close payment review" onClick={() => setActivePayment(null)}><X/></button>
      <p className="eyebrow">PAYMENT REVIEW</p><h2>{activePayment.from.name} pays {activePayment.to.name}</h2>
      <div className="review-amount">{money(activePayment.amount)} <small>USDC on Base</small></div>
      <p>Recipient: <b>{shortAddress(activePayment.to.wallet || '')}</b></p>
      {!isConnected && <div className="payer-handoff">
        <div className="payer-handoff-head"><Avatar person={activePayment.from} size={34}/><div><b>{activePayment.from.name} must approve this payment</b><small>Only the wallet saved for {activePayment.from.name} can continue.</small></div></div>
        <div className="wallet-connect-options">
          <button className="ghost" onClick={() => openConnectModal?.()}><Wallet size={16}/> Connect on this device</button>
          <button className="btn" onClick={() => { setPhoneHandoff(true); openConnectModal?.(); }}><Smartphone size={16}/> Use {activePayment.from.name}'s phone</button>
        </div>
        <div className="phone-wallet-guide"><QrCode size={17}/><div><b>Phone wallet option</b><small>In the wallet picker, select WalletConnect. A QR code appears on this screen for {activePayment.from.name} to scan with MetaMask, Coinbase Wallet, Trust Wallet, or another phone wallet.</small></div></div>
        {phoneHandoff && <p className="phone-handoff-status">Wallet picker opened. Select WalletConnect to show the QR code, then wait for {activePayment.from.name} to approve on their phone.</p>}
      </div>}
      {isConnected && !walletMatches && <div className="wallet-mismatch">
        <b>Wrong wallet connected</b><p>Connected: {address && shortAddress(address)}<br/>Required: {shortAddress(activePayment.from.wallet || '')}</p>
        <button className="ghost" onClick={() => openAccountModal?.()}>Change connected wallet</button>
      </div>}
      {isConnected && walletMatches && chainId !== BASE_CHAIN_ID && <button className="btn full" disabled={switchingChain} onClick={() => switchChainAsync({ chainId: BASE_CHAIN_ID })}>{switchingChain ? 'Switching…' : 'Switch to Base mainnet'}</button>}
      {isConnected && walletMatches && chainId === BASE_CHAIN_ID && <button className="btn full" disabled={walletPending} onClick={sendPayment}>
        {walletPending ? <><Loader2 className="spin" size={16}/> Check your wallet…</> : <><ShieldCheck size={16}/> Approve USDC transfer</>}
      </button>}
      <small className="approval-note">Splitmate cannot move funds by itself. The connected payer must approve this exact transfer in their wallet.</small>
    </div></div>}
  </main>;
}
