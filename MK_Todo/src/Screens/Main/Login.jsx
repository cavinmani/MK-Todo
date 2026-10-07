import React, { useState, useRef, useEffect } from 'react';
import loginBg from '../../assets/login.png';
import { loginUser } from '../../services/api';

export default function Login({ onLoginSuccess, onGoToSignup }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const identifierRef = useRef(null);

  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your username or email.');
      triggerShake();
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser(identifier.trim(), password);
      if (res && res.success) {
        onLoginSuccess(res.user);
        return;
      }
      setError(res?.message || 'Invalid credentials. Please try again.');
      triggerShake();
    } catch {
      setError('Unable to connect. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="lp-page"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 18, 30, 0.45), rgba(10, 18, 30, 0.45)), url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

        .lp-page {
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .lp-page *, .lp-page *::before, .lp-page *::after { box-sizing: border-box; }

        /* ---------- Card ---------- */
        .lp-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,0.16);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1.5px solid rgba(255,255,255,0.32);
          border-radius: 24px;
          padding: 44px 38px 36px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.28), inset 0 1px 2px rgba(255,255,255,0.4);
          margin: 24px;
          animation: lp-fadeup 0.4s cubic-bezier(.22,1,.36,1);
        }
        .lp-card.lp-shake { animation: lp-shake 0.45s ease; }

        /* ---------- Header ---------- */
        .lp-header { text-align: center; margin-bottom: 32px; }
        .lp-logo {
          width: 52px; height: 52px;
          background: linear-gradient(135deg, #1a2c3d 0%, #2d4a63 100%);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        }
        .lp-logo svg { width: 26px; height: 26px; }
        .lp-title {
          font-size: 26px; font-weight: 700;
          color: #0f1c2a; margin: 0 0 4px;
          letter-spacing: -0.3px;
        }
        .lp-subtitle { font-size: 13px; color: #2c3e50; margin: 0; opacity: 0.75; }

        /* ---------- Form ---------- */
        .lp-form { display: flex; flex-direction: column; gap: 18px; }

        .lp-field { position: relative; }
        .lp-label {
          display: block; font-size: 11px; font-weight: 600;
          color: #162433; text-transform: uppercase; letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .lp-input-wrap { position: relative; }
        .lp-input {
          width: 100%; padding: 12px 40px 12px 14px;
          background: rgba(255,255,255,0.55);
          border: 1.5px solid rgba(22,36,51,0.2);
          border-radius: 10px;
          color: #0f1c2a; font-size: 14px; font-family: inherit;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .lp-input::placeholder { color: #4a6174; opacity: 0.7; }
        .lp-input:focus {
          border-color: #1a2c3d;
          background: rgba(255,255,255,0.75);
          box-shadow: 0 0 0 3px rgba(26,44,61,0.15);
        }
        .lp-input.lp-error { border-color: #dc2626; background: rgba(254,226,226,0.6); }
        .lp-field-icon {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: #2c4155; display: flex; align-items: center;
        }
        .lp-toggle-btn {
          background: none; border: none; cursor: pointer; padding: 0;
          color: #1a2c3d; font-size: 12px; font-weight: 600;
          font-family: inherit;
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          opacity: 0.75; transition: opacity 0.15s;
        }
        .lp-toggle-btn:hover { opacity: 1; }

        /* ---------- Error ---------- */
        .lp-error-msg {
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 8px; padding: 9px 12px;
          color: #b91c1c; font-size: 12.5px; font-weight: 500;
          text-align: center;
        }

        /* ---------- Submit Button ---------- */
        .lp-submit-btn {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #1a2c3d 0%, #0f1c2a 100%);
          color: #fff; border: none; border-radius: 10px;
          font-size: 15px; font-weight: 600; font-family: inherit;
          cursor: pointer; margin-top: 4px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.2);
          transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .lp-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.3);
          background: linear-gradient(135deg, #22384d 0%, #152130 100%);
        }
        .lp-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* ---------- Spinner ---------- */
        .lp-spinner {
          width: 16px; height: 16px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lp-spin 0.7s linear infinite;
        }

        /* ---------- Footer ---------- */
        .lp-footer {
          margin-top: 20px; text-align: center;
          font-size: 13px; color: #1a2c3d; opacity: 0.8;
        }
        .lp-link {
          background: none; border: none; cursor: pointer; padding: 0;
          color: #0f1c2a; font-size: 13px; font-weight: 700;
          font-family: inherit; text-decoration: underline;
          transition: opacity 0.15s;
        }
        .lp-link:hover { opacity: 0.7; }

        /* ---------- Divider ---------- */
        .lp-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 2px 0;
        }
        .lp-divider-line { flex: 1; height: 1px; background: rgba(22,36,51,0.2); }
        .lp-divider-text { font-size: 11px; color: #2c4155; opacity: 0.6; white-space: nowrap; }

        /* ---------- Animations ---------- */
        @keyframes lp-fadeup {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lp-shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-7px); }
          40%     { transform: translateX(7px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }

        /* ---------- Responsive ---------- */
        @media (max-width: 480px) {
          .lp-card { padding: 32px 22px 28px; margin: 0; border-radius: 24px 24px 0 0; align-self: flex-end; }
          .lp-page { align-items: flex-end; }
        }
      `}</style>

      <main className={`lp-card${shake ? ' lp-shake' : ''}`} role="main">
        {/* Header */}
        <div className="lp-header">
          <div className="lp-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <h1 className="lp-title">Welcome back</h1>
          <p className="lp-subtitle">Sign in to your MK Todo account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="lp-form" noValidate>
          {/* Username or Email */}
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-identifier">Username or Email</label>
            <div className="lp-input-wrap">
              <input
                id="lp-identifier"
                ref={identifierRef}
                type="text"
                className={`lp-input${error && !identifier.trim() ? ' lp-error' : ''}`}
                placeholder="Enter username or email"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                autoComplete="username"
                autoCapitalize="none"
              />
              <span className="lp-field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </span>
            </div>
          </div>

          {/* Password */}
          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-password">Password</label>
            <div className="lp-input-wrap">
              <input
                id="lp-password"
                type={showPassword ? 'text' : 'password'}
                className={`lp-input${error && !password ? ' lp-error' : ''}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="lp-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <div className="lp-error-msg" role="alert">{error}</div>}

          {/* Submit */}
          <button type="submit" className="lp-submit-btn" id="lp-login-btn" disabled={loading}>
            {loading ? <><span className="lp-spinner" />Signing in…</> : 'Login'}
          </button>
        </form>

        {/* Footer */}
        <div className="lp-divider" style={{ marginTop: 20 }}>
          <div className="lp-divider-line" />
          <span className="lp-divider-text">New here?</span>
          <div className="lp-divider-line" />
        </div>
        <div className="lp-footer">
          <button className="lp-link" id="lp-goto-signup" onClick={onGoToSignup}>
            Create an account
          </button>
        </div>
      </main>
    </div>
  );
}
