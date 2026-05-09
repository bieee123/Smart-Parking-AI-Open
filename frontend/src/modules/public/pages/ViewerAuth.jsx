import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiArrowRight, HiUser, HiShieldCheck } from 'react-icons/hi';

export default function ViewerAuth() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPw, setShowPw] = useState(false);

  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMethod, setMfaMethod] = useState('totp');
  const [totpToken, setTotpToken] = useState('');

  const [formData, setFormData] = useState({
    identifier: '', // email or username for login
    username: '',   // for register
    email: '',      // for register
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        // Handle Login
        if (!formData.identifier || !formData.password) throw new Error('Required fields missing.');
        const result = await login(formData.identifier, formData.password);
        
        if (result.requires2FA) {
          setRequires2FA(true);
          setMfaToken(result.mfaToken);
          setMfaMethod(result.mfaMethod);
          setLoading(false);
          return;
        }

        const role = result?.role;
        if (role === 'admin' || role === 'operator') navigate('/dashboard', { replace: true });
        else navigate('/parking', { replace: true });
      } else {
        // Handle Register
        if (!formData.username || !formData.email || !formData.password) throw new Error('All fields are required.');
        if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match.');
        
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: formData.username, 
            email: formData.email, 
            password: formData.password, 
            role: 'viewer' 
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        setSuccessMsg('Registration successful! Please sign in with your new account.');
        setIsLogin(true);
        setFormData(p => ({ ...p, password: '', confirmPassword: '' }));
      }
    } catch (err) {
      setError(err.message);
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
      if (role === 'admin' || role === 'operator') navigate('/dashboard', { replace: true });
      else navigate('/parking', { replace: true });
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
      setSuccessMsg('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-40"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-cyan-100 rounded-full blur-[100px] opacity-40"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">S</div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">SmartPark<span className="text-indigo-600">.</span></span>
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            {requires2FA ? 'Identity Verification' : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h1>
          <p className="text-slate-500 font-medium">
            {requires2FA ? (mfaMethod === 'email' ? 'Confirm with your Email.' : 'Confirm with your App.') : (isLogin ? 'Sign in to manage your parking reservations.' : 'Join now for instant parking access.')}
          </p>
        </div>

        <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-2xl shadow-indigo-500/5">
          {requires2FA ? (
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="text-center mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 ${mfaMethod === 'email' ? 'bg-primary-50 text-primary-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {mfaMethod === 'email' ? <HiMail /> : <HiShieldCheck />}
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {mfaMethod === 'email' ? 'Email Auth' : 'App Auth'}
                </h3>
                <p className="text-slate-400 text-[11px] mt-1 font-medium">
                   {mfaMethod === 'email' ? 'Check your email for the code' : 'Enter the code from your app'}
                </p>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  {successMsg}
                </div>
              )}

              <div className="flex flex-col items-center gap-4 py-6">
                <div className={`flex items-center justify-center w-full max-w-[280px] mx-auto border-b-2 transition-colors pb-2 ${mfaMethod === 'email' ? 'border-primary-200 focus-within:border-primary-500' : 'border-slate-200 focus-within:border-indigo-500'}`}>
                  {/* Google-Style Clean Prefix */}
                  <span className="text-2xl font-bold text-slate-400 select-none mr-2">
                    SMART-
                  </span>
                  
                  {/* Simple Elegant Input */}
                  <input
                    type="text"
                    maxLength={6}
                    value={totpToken}
                    onChange={e => setTotpToken(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className={`w-32 bg-transparent text-3xl font-bold tracking-widest outline-none placeholder:text-slate-200 placeholder:font-medium placeholder:tracking-normal ${
                      mfaMethod === 'email' ? 'text-primary-700' : 'text-indigo-700'
                    }`}
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-400 text-center font-medium">
                  {mfaMethod === 'email' ? 'Check your email for the 6-digit code' : 'Enter the code from your authenticator app'}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || totpToken.length !== 6}
                  className={`w-full py-5 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:-translate-y-0.5 transition-all shadow-lg disabled:opacity-50 disabled:translate-y-0 ${
                    mfaMethod === 'email' ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                  }`}
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                {mfaMethod === 'email' && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-primary-600 hover:text-primary-700 text-[10px] font-black uppercase tracking-widest transition-colors py-2"
                  >
                    Resend Code
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setRequires2FA(false)}
                  className="w-full py-2 text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Toggle Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                <button 
                  onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold uppercase tracking-widest leading-relaxed">
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="p-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-xs font-bold uppercase tracking-widest leading-relaxed animate-in slide-in-from-top-2">
                    {successMsg}
                  </div>
                )}

                {!isLogin && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                    <div className="relative group">
                      <HiUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData(p => ({...p, username: e.target.value}))}
                        placeholder="johndoe"
                        className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {isLogin ? 'Email or Username' : 'Email Address'}
                  </label>
                  <div className="relative group">
                    <HiMail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type={isLogin ? "text" : "email"}
                      value={isLogin ? formData.identifier : formData.email}
                      onChange={(e) => setFormData(p => ({...p, [isLogin ? 'identifier' : 'email']: e.target.value}))}
                      placeholder={isLogin ? "johndoe@email.com" : "email@example.com"}
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative group">
                    <HiLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData(p => ({...p, password: e.target.value}))}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPw(!showPw)} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                    >
                      {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                    <div className="relative group">
                      <HiLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData(p => ({...p, confirmPassword: e.target.value}))}
                        placeholder="Repeat password"
                        className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-base shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (
                    <>
                      {isLogin ? 'Sign In Now' : 'Sign Up Now'}
                      <HiArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm font-medium text-slate-500">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    onClick={() => setIsLogin(!isLogin)} 
                    className="ml-2 text-indigo-600 font-black hover:text-indigo-700 transition-colors"
                  >
                    {isLogin ? 'Sign Up Free' : 'Sign In Here'}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
