import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import { HiUser, HiLockClosed, HiEye, HiEyeOff, HiShieldCheck } from 'react-icons/hi';

export default function AdminLogin() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMethod, setMfaMethod] = useState('totp');
  const [totpToken, setTotpToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) return setError('Username and password are required.');

    setLoading(true);
    try {
      const result = await login(username, password);
      
      if (result.requires2FA) {
        setRequires2FA(true);
        setMfaToken(result.mfaToken);
        setMfaMethod(result.mfaMethod);
        setLoading(false);
        return;
      }

      const role = result?.role;
      if (role === 'viewer') {
        setError('Your account is not an Admin/Operator. Use the public login page.');
        localStorage.clear();
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (totpToken.length !== 6) return setError('Code must be 6 digits.');

    setLoading(true);
    try {
      const userData = await verifyMfa(mfaToken, totpToken);
      const role = userData?.role;
      if (role === 'viewer') {
        navigate('/parking', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired 2FA code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      await api.auth.resend2FACode(mfaToken);
      // Show some feedback? Maybe just reset loading
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-blue-900/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-slate-800/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mb-4">
            <HiShieldCheck className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold text-white">SmartPark Staff Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Admin & Operator Only</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {requires2FA ? (
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-2">
                  {mfaMethod === 'email' ? 'Email Verification' : 'Two-Factor Authentication'}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {mfaMethod === 'email' 
                    ? 'Enter the 6-digit code sent to your email inbox' 
                    : 'Enter the 6-digit code from your authenticator app'}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="relative flex items-center">
                <div className="absolute left-4 text-2xl font-black text-slate-600 pointer-events-none select-none">
                  SMART-
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={totpToken}
                  onChange={e => setTotpToken(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-24 pr-4 py-4 text-left text-3xl font-black tracking-[0.2em] text-white focus:outline-none focus:border-cyan-500 transition"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || totpToken.length !== 6}
                  className="w-full py-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Verify & Continue"
                  )}
                </button>
                
                {mfaMethod === 'email' && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-cyan-500 hover:text-cyan-400 text-[10px] font-black uppercase tracking-widest transition-colors py-2"
                  >
                    Didn't get the code? Resend
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setRequires2FA(false)}
                  className="w-full py-2 text-slate-500 hover:text-slate-400 text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
                <div className="relative">
                  <HiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <HiLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-slate-600"
              >
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Verifying...</>
                ) : (
                  <><HiShieldCheck className="w-4 h-4" /> Enter Dashboard</>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <a href="/" className="text-xs text-slate-600 hover:text-slate-500 transition">← Back to SmartPark</a>
        </div>

        {/* Watermark */}
        <p className="text-center text-xs text-slate-700 mt-4">Unauthorized access will be logged and reported.</p>
      </div>
    </div>
  );
}
