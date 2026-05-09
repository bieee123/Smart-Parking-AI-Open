import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useTranslation } from 'react-i18next';
import { 
  HiShieldCheck, HiExclamation, HiCheckCircle, HiLockClosed, 
  HiKey, HiFingerPrint, HiDeviceMobile, HiRefresh, HiMail
} from 'react-icons/hi';

export default function Security() {
  const { t } = useTranslation();

  const formatTimeAgo = (date) => {
    if (!date) return "Unknown time";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid date";
    const now = new Date();
    const seconds = Math.floor((now - d) / 1000);
    
    if (seconds < 60) return seconds < 5 ? "Just now" : `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    return Math.floor(days / 30) + " months ago";
  };

  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState('totp'); // 'totp' or 'email'
  const [qrCode, setQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [setupMethod, setSetupMethod] = useState('totp'); // used during setup modal

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
    fetchLogs();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.profile.get();
      if (response.success) {
        setTwoFactorEnabled(response.data.two_factor_enabled);
        setTwoFactorMethod(response.data.two_factor_method || 'totp');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleSetup2FA = async (method = 'totp') => {
    setLoading(true);
    setError('');
    setSetupMethod(method);
    try {
      const response = await api.auth.setup2FA(method);
      if (response.success) {
        if (method === 'totp') {
          setQrCode(response.data.qrCode);
          setMfaSecret(response.data.secret);
        }
        setIs2FAModalOpen(true);
      }
    } catch (err) {
      setError(err.message || `Failed to initiate ${method} setup`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationToken) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await api.auth.verify2FASetup(verificationToken, setupMethod);
      if (response.success) {
        setTwoFactorEnabled(true);
        setTwoFactorMethod(setupMethod);
        setIs2FAModalOpen(false);
        setSuccess(`2FA via ${setupMethod} enabled successfully!`);
        setVerificationToken('');
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchMethod = async (method) => {
    if (method === twoFactorMethod) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.auth.update2FAMethod(method);
      if (response.success) {
        setTwoFactorMethod(method);
        setSuccess(`Switched to 2FA via ${method}`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update 2FA method');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setFetchingLogs(true);
    try {
      const response = await api.profile.getActivities();
      if (response.success) {
        setActivities(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setFetchingLogs(false);
    }
  };

  const validatePasswordForm = (e) => {
    e.preventDefault();
    setError('');
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setIsPasswordModalOpen(true);
  };

  const handleUpdatePassword = async () => {
    setLoading(true);
    setIsPasswordModalOpen(false);
    try {
      const response = await api.profile.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });

      if (response.success) {
        setSuccess('Password updated successfully!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        fetchLogs();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setIsDeleteModalOpen(false);
    try {
      const response = await api.profile.deleteAccount();
      if (response.success) {
        localStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'login': return 'Login Success';
      case 'password_change': return 'Password Updated';
      case 'profile_update': return 'Profile Changed';
      default: return action;
    }
  };

  const parseDevice = (ua) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Windows')) return 'Chrome on Windows';
    if (ua.includes('iPhone')) return 'Safari on iPhone';
    if (ua.includes('Android')) return 'Mobile Android';
    if (ua.includes('Macintosh')) return 'Safari on macOS';
    return 'Web Browser';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center shadow-sm">
          <HiShieldCheck className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('security.title')}</h1>
          <p className="text-gray-500 text-sm">{t('security.desc')}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl animate-in slide-in-from-top-2">
          <HiExclamation className="text-xl shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-2xl animate-in slide-in-from-top-2">
          <HiCheckCircle className="text-xl shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center gap-3 mb-8">
              <HiLockClosed className="text-primary-500 text-xl" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{t('security.change_password')}</h2>
            </div>

            <form onSubmit={validatePasswordForm} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t('security.current_password')}</label>
                  <input 
                    type="password" 
                    required
                    className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3.5 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t('security.new_password')}</label>
                    <input 
                      type="password" 
                      required
                      minLength={8}
                      className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3.5 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t('security.confirm_new_password')}</label>
                    <input 
                      type="password" 
                      required
                      minLength={8}
                      className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3.5 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50 flex justify-end">
                <button 
                  type="submit"
                   disabled={loading}
                   className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center gap-2"
                 >
                   {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <HiKey />}
                   {t('security.update_password')}
                 </button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <HiFingerPrint className="text-indigo-500 text-xl" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{t('security.two_factor')}</h2>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${twoFactorEnabled ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                {twoFactorEnabled ? t('common.active') : t('security.recommended')}
              </div>
            </div>

            <div className="space-y-4">
              <div 
                className={`flex items-start gap-6 p-6 rounded-2xl border transition-all ${
                  twoFactorEnabled && twoFactorMethod === 'totp' 
                  ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' 
                  : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                  twoFactorEnabled && twoFactorMethod === 'totp' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600'
                }`}>
                  <HiDeviceMobile className="text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{t('security.auth_app')}</h3>
                    {twoFactorEnabled && twoFactorMethod !== 'totp' && (
                      <button 
                        onClick={() => handleSwitchMethod('totp')}
                        disabled={loading}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                        Switch to App
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Use Google Authenticator or similar apps to get secure codes.
                  </p>
                  {!twoFactorEnabled ? (
                    <button 
                      onClick={() => handleSetup2FA('totp')}
                      disabled={loading}
                      className="mt-4 text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors flex items-center gap-1 group"
                    >
                      {t('security.setup_auth')} 
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 w-fit px-3 py-1.5 rounded-lg border border-green-100">
                      <HiShieldCheck className="text-sm" />
                      2FA is active on your account
                    </div>
                  )}
                </div>
              </div>

              <div 
                className={`flex items-start gap-6 p-6 rounded-2xl border transition-all ${
                  twoFactorEnabled && twoFactorMethod === 'email' 
                  ? 'bg-primary-50 border-primary-200 ring-2 ring-primary-500/20' 
                  : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                  twoFactorEnabled && twoFactorMethod === 'email' ? 'bg-primary-600 text-white' : 'bg-white text-primary-600'
                }`}>
                  <HiMail className="text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Email Verification</h3>
                    {twoFactorEnabled && twoFactorMethod !== 'email' && (
                      <button 
                        onClick={() => handleSwitchMethod('email')}
                        disabled={loading}
                        className="text-[10px] font-black text-primary-600 uppercase tracking-widest hover:underline"
                      >
                        Switch to Email
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Receive a unique verification code in your email inbox every time you login.
                  </p>
                  {!twoFactorEnabled && (
                    <button 
                      onClick={() => handleSetup2FA('email')}
                      disabled={loading}
                      className="mt-4 text-xs font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest transition-colors flex items-center gap-1 group"
                    >
                      Setup Email 2FA
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t('security.recent_activity')}
              </h3>
              <button 
                onClick={fetchLogs}
                disabled={fetchingLogs}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <HiRefresh className={`${fetchingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              {activities.length === 0 && !fetchingLogs && (
                <div className="text-center py-8 opacity-40">
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t('security.no_activity')}</p>
                </div>
              )}
              
              {activities.map((log, i) => (
                <div key={i} className="group relative flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-help border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <HiShieldCheck className={log.action === 'login' ? 'text-green-400' : 'text-primary-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{getActionLabel(log.action)}</p>
                    <p className="text-[10px] text-slate-500 truncate">{parseDevice(log.device_info)}</p>
                    <p className="text-[10px] text-primary-400 mt-1">
                      {formatTimeAgo(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setIsLogsModalOpen(true)}
              className="w-full mt-4 py-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors border-t border-white/5 pt-4"
            >
              {t('security.view_all_logs')}
            </button>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-3xl p-6">
            <h3 className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">{t('security.danger_zone')}</h3>
            <p className="text-[10px] text-red-500/80 leading-relaxed mb-4">
              {t('security.delete_desc')}
            </p>
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={loading}
              className="w-full py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
            >
              {t('security.delete_account')}
            </button>
          </div>
        </div>
      </div>

      <LogsModal 
        isOpen={isLogsModalOpen} 
        onClose={() => setIsLogsModalOpen(false)} 
        activities={activities}
        getActionLabel={getActionLabel}
        parseDevice={parseDevice}
        formatTimeAgo={formatTimeAgo}
      />

      {/* Change Password Confirmation Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsPasswordModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
              <HiLockClosed />
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">{t('security.confirm_update_title')}</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-8">
              {t('security.confirm_update_desc')}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="flex-1 py-3 bg-gray-50 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleUpdatePassword}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-300 border-t-4 border-red-600">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8">
              <HiExclamation />
            </div>
            <h2 className="text-2xl font-black text-gray-900 text-center mb-4">{t('security.delete_confirm_title')}</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-8 font-medium">
              {t('security.delete_confirm_desc')}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteAccount}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200"
              >
                {t('security.delete_permanently')}
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-bold uppercase tracking-widest hover:bg-gray-100 transition-all"
              >
                {t('security.keep_account')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {is2FAModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIs2FAModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
            {/* Header - Full Width Guaranteed */}
            <div className={`w-full px-8 py-8 text-white text-center flex-shrink-0 ${setupMethod === 'email' ? 'bg-primary-600' : 'bg-indigo-600'}`}>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 backdrop-blur-md shadow-inner">
                {setupMethod === 'email' ? <HiMail /> : <HiDeviceMobile />}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {setupMethod === 'email' ? 'Email Verification' : 'App Authentication'}
              </h2>
              <p className="text-white/80 text-sm font-medium px-4">
                {setupMethod === 'email' ? 'Secure your account with email codes' : 'Scan the QR code with your app'}
              </p>
            </div>
            
            <div className="p-8 flex-1 flex flex-col">
              {setupMethod === 'totp' ? (
                <div className="flex flex-col items-center gap-6 mb-8">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl shadow-sm">
                    {qrCode ? (
                      <img src={qrCode} alt="2FA QR Code" className="w-40 h-40" />
                    ) : (
                      <div className="w-40 h-40 bg-slate-100 animate-pulse rounded-2xl" />
                    )}
                  </div>
                  <div className="w-full text-center">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Secret Key</p>
                    <code className="inline-block bg-slate-100 px-4 py-2 rounded-lg text-sm font-mono font-bold text-slate-700 border border-slate-200">
                      {mfaSecret}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="mb-8 p-5 bg-primary-50 rounded-2xl border border-primary-100">
                  <p className="text-sm text-primary-700 leading-relaxed text-center font-medium">
                    We'll send a 6-digit code to your email for every sign-in attempt.
                  </p>
                </div>
              )}

              <div className="mt-auto space-y-8">
                {/* Google Style Input Area */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center justify-center w-full max-w-[280px] mx-auto border-b-2 border-slate-200 focus-within:border-primary-500 transition-colors pb-2">
                    <span className="text-2xl font-bold text-slate-400 select-none mr-2">SMART-</span>
                    <input 
                      type="text" 
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      className="w-32 bg-transparent text-3xl font-bold tracking-widest text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-medium placeholder:tracking-normal"
                      value={verificationToken}
                      onChange={(e) => setVerificationToken(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Enter the 6-digit code to continue
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIs2FAModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleVerifySetup}
                    disabled={loading || (setupMethod === 'totp' && verificationToken.length !== 6)}
                    className={`flex-1 py-4 text-white rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                      setupMethod === 'email' ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                    } disabled:opacity-50 disabled:shadow-none`}
                  >
                    {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {setupMethod === 'email' ? 'Enable 2FA' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogsModal({ isOpen, onClose, activities, getActionLabel, parseDevice, formatTimeAgo }) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{t('security.full_history')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('security.history_desc')}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
          {activities.length === 0 && (
            <div className="text-center py-20 opacity-30 italic">No activity logs recorded yet.</div>
          )}
          {activities.map((log, i) => (
            <div key={i} className="flex items-start gap-6 pb-6 border-b border-gray-50 last:border-0 last:pb-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                log.action === 'login' ? 'bg-green-50 text-green-600' : 'bg-primary-50 text-primary-600'
              }`}>
                <HiShieldCheck />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold text-gray-900">{getActionLabel(log.action)}</p>
                  <p className="text-[10px] font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">
                    {formatTimeAgo(log.created_at)}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                    <HiDeviceMobile className="text-gray-400" />
                    {parseDevice(log.device_info)}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    IP: {log.ip_address}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-center shrink-0">
          <button 
            onClick={onClose}
            className="px-10 py-3 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
          >
            {t('security.close_history')}
          </button>
        </div>
      </div>
    </div>
  );
}
