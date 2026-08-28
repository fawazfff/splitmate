import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, FlaskConical, Loader2, Plus, ShieldCheck, Wallet, X } from 'lucide-react';
import { cacheGroup, persistGroup } from '../groupStore';
import { getSettlementNetwork } from '../settlement';
import type { Group, Person, SettlementNetwork } from '../types';

const newPerson = (): Person => ({ id: crypto.randomUUID(), name: '' });

async function optimiseProfilePhoto(file: File): Promise<string> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error('unreadable image'));
      next.src = sourceUrl;
    });
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 720 / Math.max(longestSide, 1));
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    let quality = 0.84;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas unavailable');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const avatar = canvas.toDataURL('image/jpeg', quality);
      if (avatar.length <= 750_000 || attempt === 4) return avatar;
      quality = Math.max(0.58, quality - 0.08);
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    throw new Error('image could not be optimised');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function EnhancedCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedNetwork: SettlementNetwork = new URLSearchParams(location.search).get('network') === 'base-mainnet' ? 'base-mainnet' : 'base-sepolia';
  const network = getSettlementNetwork(selectedNetwork);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<Person[]>([newPerson(), newPerson()]);

  const updatePerson = (id: string, changes: Partial<Person>) => {
    setPeople((current) => current.map((person) => person.id === id ? { ...person, ...changes } : person));
  };

  const setImage = async (id: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the profile picture.');
      return;
    }
    if (file.size > 2_000_000) {
      setError('Profile pictures must be under 2 MB.');
      return;
    }
    setError('');
    try {
      updatePerson(id, { avatar: await optimiseProfilePhoto(file) });
    } catch {
      setError('That profile picture could not be read. Try a JPG, PNG, or WebP image.');
    }
  };

  const pasteWallet = async (id: string) => {
    try {
      const value = await navigator.clipboard.readText();
      if (value) updatePerson(id, { wallet: value.trim() });
    } catch {
      setError('Clipboard access was blocked. Paste the wallet address manually.');
    }
  };

  const create = async () => {
    setError('');
    if (!name.trim()) {
      setError('Add a group name.');
      return;
    }
    if (people.length < 2 || people.some((person) => !person.name.trim())) {
      setError('Add a name for every person in the group.');
      return;
    }
    const cleanPeople = people.map((person) => ({
      ...person,
      name: person.name.trim(),
      wallet: person.wallet?.trim() || undefined,
    }));
    const invalidWallet = cleanPeople.find((person) => person.wallet && !/^0x[a-fA-F0-9]{40}$/.test(person.wallet));
    if (invalidWallet) {
      setError(`${invalidWallet.name}'s wallet address is not a valid EVM address.`);
      return;
    }
    const group: Group = {
      id: crypto.randomUUID(),
      name: name.trim(),
      settlementNetwork: selectedNetwork,
      people: cleanPeople,
      expenses: [],
      settlements: [],
    };
    setSaving(true);
    try {
      // A new group is immediately usable in this browser. Do not trap the user
      // on this form while a cold serverless/database request is waking up.
      cacheGroup(group);
      navigate(`/group/${group.id}?created=1`);
      void persistGroup(group).catch((reason) => {
        console.warn('Splitmate could not immediately sync the new group.', reason);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The group could not be created.');
    }
  };

  return <main id="main-content" className="form">
    <Link className="ghost compact-link" to="/create"><ArrowLeft size={14}/> Change settlement mode</Link>
    <p className="eyebrow">START A GROUP</p>
    <h1>Create your group.</h1>
    <p>Add your people, profile pictures, and optional wallet addresses. You can edit wallets later from Final Settlement.</p>
    <div className={`create-network-banner ${network.isTestnet ? 'test' : 'live'}`}>
      {network.isTestnet ? <FlaskConical size={18}/> : <ShieldCheck size={18}/>}<div><b>{network.isTestnet ? 'Test mode · Base Sepolia' : 'Live mode · Base Mainnet'}</b><small>{network.isTestnet ? 'This group will settle with test USDC. No real money is used.' : 'This group will settle with real USDC after payer approval.'}</small></div>
    </div>
    <div className="panel">
      <label>Group name<input required name="groupName" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. ORION Hackathon Team" maxLength={100}/></label>
      <h3>People</h3>
      {people.map((person, index) => <div className="person create-person" key={person.id}>
        <label className="avatar-upload" aria-label={`Add a photo for ${person.name || `person ${index + 1}`}`}>
          <div className="avatar">
            {person.avatar ? <img src={person.avatar} alt="" width={48} height={48}/> : <><Camera size={17}/><small>Photo</small></>}
          </div>
          <span className="camera"><Camera size={11}/></span>
          <input name={`person-${index + 1}-photo`} type="file" accept="image/*" onChange={(event) => { void setImage(person.id, event.target.files?.[0]); }}/>
        </label>
        <div>
          <input required name={`person-${index + 1}-name`} autoComplete="name" aria-label={`Person ${index + 1} name`} value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} placeholder={index ? `Friend ${index}` : 'Your name'} maxLength={80}/>
          <div className="wallet-field">
            <Wallet size={14}/>
            <input name={`person-${index + 1}-wallet`} autoComplete="off" inputMode="text" aria-label={`${person.name || `Person ${index + 1}`} wallet address, optional`} value={person.wallet || ''} onChange={(event) => updatePerson(person.id, { wallet: event.target.value })} placeholder="Wallet address (optional)" spellCheck={false}/>
            <button type="button" onClick={() => pasteWallet(person.id)}>Paste</button>
          </div>
        </div>
        {people.length > 2 && <button className="icon" aria-label={`Remove ${person.name || `person ${index + 1}`}`} onClick={() => setPeople((current) => current.filter((item) => item.id !== person.id))}><X size={18}/></button>}
      </div>)}
      <button className="add" onClick={() => setPeople((current) => [...current, newPerson()])}><Plus size={15}/> Add another person</button>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn full" onClick={create} disabled={saving}>
        {saving ? <><Loader2 className="spin" size={16}/> Saving group…</> : <>Create group <ArrowRight size={16}/></>}
      </button>
    </div>
  </main>;
}
