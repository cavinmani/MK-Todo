import React, { useState, useRef, useEffect } from 'react';
import loginBg from '../../assets/login.png';
import { registerUser, checkUsernameAvailable } from '../../services/api';

export default function Signup({ onSignupSuccess, onGoToLogin }) {
  const [step, setStep] = useState('info'); // 'info' | 'password'

  // Step 1 fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken'
  const [shake, setShake] = useState(false);

  const nameRef = useRef(null);
  const usernameCheckTimer = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Real-time username availability check
  const handleUsernameChange = (val) => {
    setUsername(val);
    setFieldErrors(p => ({ ...p, username: '' }));
    setError('');

    clearTimeout(usernameCheckTimer.current);
    const cleaned = val.trim().toLowerCase();
    if (!cleaned || cleaned.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(cleaned);
        // result: true = available, false = taken, null = API error
        if (result === true)  setUsernameStatus('available');
        else if (result === false) setUsernameStatus('taken');
        else setUsernameStatus('idle'); // null = couldn't reach server, don't block user
      } catch {
        setUsernameStatus('idle'); // on exception, default to idle
      }
    }, 600);
  };

  const validateStep1 = () => {
    const errors = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!username.trim()) errors.username = 'Username is required.';
    else if (username.trim().length < 3) errors.username = 'Username must be at least 3 characters.';
    else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) errors.username = 'Only letters, numbers, underscores.';
    else if (usernameStatus === 'checking') errors.username = 'Still checking availability, please wait…';
    else if (usernameStatus === 'taken') errors.username = 'Username is already taken. Choose another.';
    // 'idle' or 'available' → allowed to proceed
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    return errors;
  };

  const handleStep1Next = (e) => {
    e.preventDefault();
    setError('');
    const errors = validateStep1();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      triggerShake();
      return;
    }
    setFieldErrors({});
    setStep('password');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = {};
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 4) errors.password = 'Password must be at least 4 characters.';
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({ name: name.trim(), username: username.trim().toLowerCase(), email: email.trim().toLowerCase(), password });
      if (res && res.success) {
        onSignupSuccess(res.user);
        return;
      }
      setError(res?.message || 'Registration failed. Please try again.');
      triggerShake();
      if (res?.message?.toLowerCase().includes('email')) setStep('info');
      if (res?.message?.toLowerCase().includes('username')) setStep('info');
    } catch {
      setError('Unable to connect. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const usernameHint = () => {
    if (usernameStatus === 'checking') return { color: '#6b7280', text: '⏳ Checking availability…' };
    if (usernameStatus === 'available') return { color: '#16a34a', text: '✓ Username available' };
    if (usernameStatus === 'taken') return { color: '#dc2626', text: '✕ Username already taken' };
    return null; // idle — no hint shown
  };
  const hint = usernameHint();

  return (
    <div
      className="sp-page"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 18, 30, 0.45), rgba(10, 18, 30, 0.45)), url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        .sp-page {
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
          min-height: 100vh; width: 100%;
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .sp-page *, .sp-page *::before, .sp-page *::after { box-sizing: border-box; }

        /* ---------- Card ---------- */
        .sp-card {
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.16);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1.5px solid rgba(255,255,255,0.32);
          border-radius: 24px; padding: 40px 36px 32px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.28), inset 0 1px 2px rgba(255,255,255,0.4);
          margin: 24px;
          animation: sp-fadeup 0.4s cubic-bezier(.22,1,.36,1);
        }
        .sp-card.sp-shake { animation: sp-shake 0.45s ease; }

        /* ---------- Header ---------- */
        .sp-header { text-align: center; margin-bottom: 26px; }
        .sp-logo {
          width: 52px; height: 52px;
          background: linear-gradient(135deg, #1a2c3d, #2d4a63);
          border-radius: 14px; margin: 0 auto 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        }
        .sp-logo svg { width: 26px; height: 26px; }
        .sp-title { font-size: 24px; font-weight: 700; color: #0f1c2a; margin: 0 0 4px; letter-spacing: -0.3px; }
        .sp-subtitle { font-size: 12.5px; color: #2c3e50; margin: 0; opacity: 0.7; }

        /* ---------- Step Indicator ---------- */
        .sp-steps {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-bottom: 24px;
        }
        .sp-step-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(22,36,51,0.2); transition: all 0.3s;
        }
        .sp-step-dot.active { background: #1a2c3d; width: 24px; border-radius: 4px; }
        .sp-step-dot.done { background: #16a34a; }

        /* ---------- Form ---------- */
        .sp-form { display: flex; flex-direction: column; gap: 15px; }

        .sp-field { display: flex; flex-direction: column; gap: 5px; }
        .sp-label {
          font-size: 11px; font-weight: 600; color: #162433;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .sp-input-wrap { position: relative; }
        .sp-input {
          width: 100%; padding: 11px 40px 11px 14px;
          background: rgba(255,255,255,0.55);
          border: 1.5px solid rgba(22,36,51,0.2);
          border-radius: 10px;
          color: #0f1c2a; font-size: 14px; font-family: inherit;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .sp-input::placeholder { color: #4a6174; opacity: 0.7; }
        .sp-input:focus {
          border-color: #1a2c3d; background: rgba(255,255,255,0.78);
          box-shadow: 0 0 0 3px rgba(26,44,61,0.14);
        }
        .sp-input.sp-field-error { border-color: #dc2626; background: rgba(254,226,226,0.55); }
        .sp-input.sp-field-ok { border-color: #16a34a; }

        .sp-field-icon {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: #2c4155; display: flex; pointer-events: none;
        }
        .sp-toggle-btn {
          background: none; border: none; cursor: pointer; padding: 0;
          color: #1a2c3d; font-size: 12px; font-weight: 600; font-family: inherit;
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          opacity: 0.75; transition: opacity 0.15s;
        }
        .sp-toggle-btn:hover { opacity: 1; }

        .sp-field-hint {
          font-size: 11.5px; font-weight: 500; margin-top: 2px;
        }
        .sp-field-error-msg { color: #dc2626; font-size: 11.5px; margin-top: 2px; }

        /* ---------- Error Banner ---------- */
        .sp-error-msg {
          background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3);
          border-radius: 8px; padding: 9px 12px;
          color: #b91c1c; font-size: 12.5px; font-weight: 500; text-align: center;
        }

        /* ---------- Buttons ---------- */
        .sp-btn {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #1a2c3d, #0f1c2a);
          color: #fff; border: none; border-radius: 10px;
          font-size: 15px; font-weight: 600; font-family: inherit;
          cursor: pointer; margin-top: 4px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.2);
          transition: transform 0.18s, box-shadow 0.18s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .sp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.3); }
        .sp-btn:active:not(:disabled) { transform: translateY(0); }
        .sp-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .sp-back-btn {
          background: none; border: 1.5px solid rgba(22,36,51,0.3);
          color: #1a2c3d; border-radius: 10px; padding: 11px;
          font-size: 14px; font-weight: 500; font-family: inherit;
          cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .sp-back-btn:hover { background: rgba(255,255,255,0.35); }

        .sp-btn-row { display: flex; gap: 10px; margin-top: 4px; }
        .sp-btn-row .sp-back-btn { flex: 0 0 auto; width: 44px; }
        .sp-btn-row .sp-btn { flex: 1; }

        /* ---------- Spinner ---------- */
        .sp-spinner {
          width: 16px; height: 16px;
          border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #fff;
          border-radius: 50%; animation: sp-spin 0.7s linear infinite;
        }

        /* ---------- Footer ---------- */
        .sp-footer { margin-top: 18px; text-align: center; font-size: 13px; color: #1a2c3d; opacity: 0.8; }
        .sp-link {
          background: none; border: none; cursor: pointer; padding: 0;
          color: #0f1c2a; font-size: 13px; font-weight: 700; font-family: inherit;
          text-decoration: underline; transition: opacity 0.15s;
        }
        .sp-link:hover { opacity: 0.7; }

        /* ---------- Password Strength ---------- */
        .sp-strength-bar { display: flex; gap: 4px; margin-top: 6px; }
        .sp-strength-seg {
          flex: 1; height: 3px; border-radius: 2px;
          background: rgba(22,36,51,0.15); transition: background 0.3s;
        }
        .sp-strength-seg.weak { background: #dc2626; }
        .sp-strength-seg.fair { background: #f59e0b; }
        .sp-strength-seg.good { background: #16a34a; }

        /* ---------- Animations ---------- */
        @keyframes sp-fadeup {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sp-shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-7px); }
          40%     { transform: translateX(7px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes sp-spin { to { transform: rotate(360deg); } }

        /* ---------- Responsive ---------- */
        @media (max-width: 480px) {
          .sp-card { padding: 30px 20px 26px; margin: 0; border-radius: 24px 24px 0 0; }
          .sp-page { align-items: flex-end; }
        }
      `}</style>

      <main className={`sp-card${shake ? ' sp-shake' : ''}`} role="main">
        {/* Header */}
        <div className="sp-header">
          <div className="sp-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <h1 className="sp-title">Create Account</h1>
          <p className="sp-subtitle">
            {step === 'info' ? 'Tell us about yourself' : 'Set your password'}
          </p>
        </div>

        {/* Step dots */}
        <div className="sp-steps">
          <div className={`sp-step-dot ${step === 'info' ? 'active' : 'done'}`} />
          <div className={`sp-step-dot ${step === 'password' ? 'active' : ''}`} />
        </div>

        {/* ── STEP 1: Info ── */}
        {step === 'info' && (
          <form onSubmit={handleStep1Next} className="sp-form" noValidate>
            {/* Name */}
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-name">Full Name</label>
              <div className="sp-input-wrap">
                <input
                  id="sp-name"
                  ref={nameRef}
                  type="text"
                  className={`sp-input${fieldErrors.name ? ' sp-field-error' : name.trim() ? ' sp-field-ok' : ''}`}
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFieldErrors(p => ({...p, name: ''})); setError(''); }}
                  autoComplete="name"
                />
                <span className="sp-field-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                </span>
              </div>
              {fieldErrors.name && <span className="sp-field-error-msg">{fieldErrors.name}</span>}
            </div>

            {/* Username */}
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-username">Username</label>
              <div className="sp-input-wrap">
                <input
                  id="sp-username"
                  type="text"
                  className={`sp-input${fieldErrors.username || usernameStatus === 'taken' ? ' sp-field-error' : usernameStatus === 'available' ? ' sp-field-ok' : ''}`}
                  placeholder="Choose a unique username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                />
                <span className="sp-field-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                  </svg>
                </span>
              </div>
              {fieldErrors.username && <span className="sp-field-error-msg">{fieldErrors.username}</span>}
              {!fieldErrors.username && hint && (
                <span className="sp-field-hint" style={{ color: hint.color }}>{hint.text}</span>
              )}
            </div>

            {/* Email */}
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-email">Email Address</label>
              <div className="sp-input-wrap">
                <input
                  id="sp-email"
                  type="email"
                  className={`sp-input${fieldErrors.email ? ' sp-field-error' : email.trim() ? ' sp-field-ok' : ''}`}
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({...p, email: ''})); setError(''); }}
                  autoComplete="email"
                />
                <span className="sp-field-icon">
                  <svg width="15" height="12" viewBox="0 0 20 16" fill="currentColor">
                    <path d="M18 0H2C0.9 0 0 0.9 0 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V2l8 5 8-5v2z"/>
                  </svg>
                </span>
              </div>
              {fieldErrors.email && <span className="sp-field-error-msg">{fieldErrors.email}</span>}
            </div>

            {error && <div className="sp-error-msg" role="alert">{error}</div>}

            <button type="submit" className="sp-btn" id="sp-next-btn">
              Continue →
            </button>
          </form>
        )}

        {/* ── STEP 2: Password ── */}
        {step === 'password' && (
          <form onSubmit={handleSubmit} className="sp-form" noValidate>
            {/* Password */}
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-password">Password</label>
              <div className="sp-input-wrap">
                <input
                  id="sp-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`sp-input${fieldErrors.password ? ' sp-field-error' : ''}`}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({...p, password: ''})); setError(''); }}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className="sp-toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password && <span className="sp-field-error-msg">{fieldErrors.password}</span>}
              {/* Strength bar */}
              {password && (() => {
                const len = password.length;
                const segs = len < 4 ? 1 : len < 8 ? 2 : 3;
                const cls = len < 4 ? 'weak' : len < 8 ? 'fair' : 'good';
                return (
                  <div className="sp-strength-bar">
                    {[0,1,2].map(i => (
                      <div key={i} className={`sp-strength-seg ${i < segs ? cls : ''}`} />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Confirm Password */}
            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-confirm">Confirm Password</label>
              <div className="sp-input-wrap">
                <input
                  id="sp-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className={`sp-input${fieldErrors.confirmPassword ? ' sp-field-error' : confirmPassword && confirmPassword === password ? ' sp-field-ok' : ''}`}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({...p, confirmPassword: ''})); setError(''); }}
                  autoComplete="new-password"
                />
                <button type="button" className="sp-toggle-btn" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.confirmPassword && <span className="sp-field-error-msg">{fieldErrors.confirmPassword}</span>}
              {confirmPassword && confirmPassword === password && !fieldErrors.confirmPassword && (
                <span className="sp-field-hint" style={{ color: '#16a34a' }}>✓ Passwords match</span>
              )}
            </div>

            {error && <div className="sp-error-msg" role="alert">{error}</div>}

            {/* Summary of entered info */}
            <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#1a2c3d', lineHeight: 1.7 }}>
              <strong>Name:</strong> {name}<br/>
              <strong>Username:</strong> @{username.toLowerCase()}<br/>
              <strong>Email:</strong> {email}
            </div>

            <div className="sp-btn-row">
              <button type="button" className="sp-back-btn" onClick={() => { setStep('info'); setFieldErrors({}); setError(''); }} title="Go back">
                ←
              </button>
              <button type="submit" className="sp-btn" id="sp-confirm-btn" disabled={loading}>
                {loading ? <><span className="sp-spinner" />Creating…</> : 'Confirm & Create Account'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="sp-footer" style={{ marginTop: 18 }}>
          Already have an account?{' '}
          <button className="sp-link" id="sp-goto-login" onClick={onGoToLogin}>Sign in</button>
        </div>
      </main>
    </div>
  );
}
