import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { login } from '../services/api';
import { loginError } from '../services/course-auth';
export default function LoginDialog({ onClose }) {
  const dialog = useRef(null);
  const [identifier,setIdentifier] = useState(''), [password,setPassword] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(identifier,password); setPassword(''); onClose(); }
    catch(error) { setError(loginError(error)); setPassword(''); }
    finally { setBusy(false); }
  }
  return <dialog className="login-dialog" ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} aria-labelledby="login-title">
    <button className="login-close" aria-label="Close sign in" onClick={onClose} disabled={busy}><X size={18}/></button>
    <p className="eyebrow">ID40018 DDASD</p><h2 id="login-title">Sign in</h2>
    <p>Use the same student ID or email and password as the course website.</p>
    <form onSubmit={submit}><label htmlFor="login-identifier">Student ID or email</label><input id="login-identifier" autoFocus required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} disabled={busy}/>
    <label htmlFor="login-password">Password</label><input id="login-password" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
    {error && <p className="login-error" role="alert">{error}</p>}<button type="submit" className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>
    <p className="login-help">Need an account or forgot your password? <a href="https://id40018.web.app/" target="_blank" rel="noreferrer">Visit the course website ↗</a></p>
  </dialog>;
}
