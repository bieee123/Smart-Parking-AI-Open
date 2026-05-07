import { useState, useEffect } from 'react';
import { HiShieldCheck, HiLockClosed, HiFingerPrint, HiDeviceMobile, HiDotsVertical, HiKey, HiCheckCircle, HiExclamation, HiRefresh } from 'react-icons/hi';
import { api } from '../../../services/api';

export default function Security() {
  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 5) {
      return "Just now";
    }

    if (seconds < 60) {
      return seconds + " seconds ago";
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours + (hours === 1 ? " hour ago" : " hours ago");
    }
    
    const days = Math.floor(hours / 24);
    if (days < 30) {
      return days + (days === 1 ? " day ago" : " days ago");
    }
    
    const months = Math.floor(days / 30);
    return months + (months === 1 ? " month ago" : " months ago");
  };

  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchLogs();
  }, []);

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

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setLoading(true);
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
    const confirmed = window.confirm("Are you ABSOLUTELY sure? This action cannot be undone and all your data will be permanently deleted.");
    if (!confirmed) return;

    const secondConfirm = window.confirm("Final confirmation: Click OK to delete your account permanently.");
    if (!secondConfirm) return;

    setLoading(true);
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600">
            <HiShieldCheck className="text-2xl" />
          </div>
          Security Settings
        </h1>
        <p className="text-gray-500 text-sm mt-2 ml-13">Manage your account protection, passwords, and authentication methods.</p>
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
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Change Password</h2>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Current Password</label>
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
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">New Password</label>
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
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Confirm New Password</label>
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
                  Update Password
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <HiFingerPrint className="text-indigo-500 text-xl" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Two-Factor Authentication</h2>
              </div>
              <div className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                Recommended
              </div>
            </div>

            <div className="flex items-start gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm text-indigo-600">
                <HiDeviceMobile className="text-2xl" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Authenticator App</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Protect your account with a secondary verification code generated by apps like Google Authenticator or Microsoft Authenticator.
                </p>
                <button className="mt-4 text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors flex items-center gap-1 group">
                  Setup Authenticator 
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Recent Activity
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
                  <p className="text-[10px] font-bold uppercase tracking-widest">No activity found</p>
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
              View All Logs
            </button>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-3xl p-6">
            <h3 className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">Danger Zone</h3>
            <p className="text-[10px] text-red-500/80 leading-relaxed mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button 
              onClick={handleDeleteAccount}
              disabled={loading}
              className="w-full py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Delete Account'}
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
    </div>
  );
}

// Sub-component for Logs Modal
function LogsModal({ isOpen, onClose, activities, getActionLabel, parseDevice, formatTimeAgo }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Full Activity History</h3>
            <p className="text-xs text-gray-500 mt-1">Detailed log of your recent account security events.</p>
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
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}
