import { Camera } from 'lucide-react';
import { ChangeEvent } from 'react';

type Props = { src?: string; name: string; onChange?: (file: File) => void; size?: number };

export default function ProfileAvatar({ src, name, onChange, size = 52 }: Props) {
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChange) onChange(file);
  };
  return (
    <label title={onChange ? 'Add profile picture' : name} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center', background: '#f1f2f4', border: '1px solid #e2e4e8', position: 'relative', cursor: onChange ? 'pointer' : 'default', flexShrink: 0 }}>
      {src ? <img src={src} alt={`${name} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : onChange ? <Camera size={18} /> : <b>{name.trim().charAt(0).toUpperCase() || '?'}</b>}
      {onChange && <input type="file" accept="image/*" onChange={change} style={{ display: 'none' }} />}
    </label>
  );
}
