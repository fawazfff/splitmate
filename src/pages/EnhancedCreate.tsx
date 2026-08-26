import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Loader2, Plus, Wallet, X } from 'lucide-react';
import { persistGroup } from '../groupStore';
import type { Group, Person } from '../types';

const newPerson = (): Person => ({ id: crypto.randomUUID(), name: '' });

export default function EnhancedCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<Person[]>([newPerson(), newPerson()]);

  const updatePerson = (id: string, changes: Partial<Person>) => {
    setPeople((current) => current.map((person) => person.id === id ? { ...person, ...changes } : person));
  };

  const setImage = (id: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the profile picture.');
      return;
    }
    if (file.size > 650_000) {
      setError('Profile pictures must be under 650 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updatePerson(id, { avatar: String(reader.result) });
    reader.onerror = () => setError('That profile picture could not be read.');
    reader.readAsDataURL(file);
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
    const cleanPeople = people
      .filter((person) => person.name.trim())
      .map((person) => ({ ...person, name: person.name.trim(), wallet: person.wallet?.trim() || undefined }));
    if (!name.trim() || cleanPeople.length < 2) {
      setError('Add a group name and at least two people.');
      return;
    }
    const invalidWallet = cleanPeople.find((person) => person.wallet && !/^0x[a-fA-F0-9]{40}$/.test(person.wallet));
    if (invalidWallet) {
      setError(`${invalidWallet.name}'s wallet address is not a valid EVM address.`);
      return;
    }
    const group: Group = {
      id: crypto.randomUUID(),
      name: name.trim(),
      people: cleanPeople,
      expenses: [],
      settlements: [],
    };
    setSaving(true);
    try {
      const saved = await persistGroup(group);
      navigate(`/group/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The group could not be created.');
    } finally {
      setSaving(false);
    }
  };

  return <main className="form">
    <p className="eyebrow">START A GROUP</p>
    <h1>Create your group.</h1>
    <p>Add your people, profile pictures, and optional wallet addresses. You can edit wallets later from Final Settlement.</p>
    <div className="panel">
      <label>Group name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. ORION Hackathon Team" maxLength={100}/></label>
      <h3>People</h3>
      {people.map((person, index) => <div className="person create-person" key={person.id}>
        <label className="avatar-upload" aria-label={`Add a photo for ${person.name || `person ${index + 1}`}`}>
          <div className="avatar">
            {person.avatar ? <img src={person.avatar} alt=""/> : <><Camera size={17}/><small>Photo</small></>}
          </div>
          <span className="camera"><Camera size={11}/></span>
          <input type="file" accept="image/*" onChange={(event) => setImage(person.id, event.target.files?.[0])}/>
        </label>
        <div>
          <input value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} placeholder={index ? `Friend ${index}` : 'Your name'} maxLength={80}/>
          <div className="wallet-field">
            <Wallet size={14}/>
            <input value={person.wallet || ''} onChange={(event) => updatePerson(person.id, { wallet: event.target.value })} placeholder="Wallet address (optional)" spellCheck={false}/>
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
