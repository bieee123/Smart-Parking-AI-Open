import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useTranslation } from 'react-i18next';
import { HiClock, HiRefresh, HiDeviceMobile, HiDesktopComputer, HiCheckCircle, HiExclamation } from 'react-icons/hi';

export default function Sessions() {
  const { t } = useTranslation();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNukeModalOpen, setIsNukeModalOpen] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await api.profile.getActivities();
      if (response.success) {
        console.log('All activities fetched:', response.data);
        const logins = response.data.filter(a => a.action === 'login');
        console.log('Filtered logins:', logins);
        setActivities(logins);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutAll = async () => {
    setLoading(true);
    try {
      const response = await api.profile.revokeSessions(null, 'global');
      if (response.success) {
        localStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Failed to perform global reset:', err);
      alert(err.message || 'Failed to perform global reset');
      setIsNukeModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeUser = async (targetUserId, username) => {
    const confirmed = window.confirm(`Are you sure you want to sign out all sessions for @${username}? They will be forced to log in again.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await api.profile.revokeSessions(targetUserId);
      if (response.success) {
        alert(`User @${username} has been signed out successfully.`);
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to revoke user sessions:', err);
      alert(err.message || 'Failed to revoke user sessions');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return "Unknown time";
    
    // Parse date and ensure it's valid
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid date";

    const now = new Date();
    const seconds = Math.floor((now - d) / 1000);
    
    // Debug logging to see what's happening
    console.log(`Time Debug: raw=${date}, parsed=${d.toISOString()}, now=${now.toISOString()}, diff_sec=${seconds}`);

    if (seconds < 60) {
      return seconds < 5 ? "Just now" : `${seconds} seconds ago`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    
    const days = Math.floor(hours / 24);
    if (days < 30) {
      return days === 1 ? "1 day ago" : `${days} days ago`;
    }
    
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  };

  const parseDevice = (ua) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Windows')) return 'Chrome on Windows';
    if (ua.includes('iPhone')) return 'Safari on iPhone';
    if (ua.includes('Android')) return 'Mobile Android';
    if (ua.includes('Macintosh')) return 'Safari on macOS';
    return 'Web Browser';
  };

  const userRole = JSON.parse(localStorage.getItem('user'))?.role;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center shadow-sm">
            <HiClock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('sessions.title')}</h1>
            <p className="text-gray-500 text-sm">{t('sessions.desc')}</p>
          </div>
        </div>
        <button 
          onClick={fetchSessions}
          className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-primary-600 rounded-2xl transition-all active:scale-95 border border-gray-100 shadow-sm"
          disabled={loading}
        >
          <HiRefresh className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-6">
        {userRole === 'admin' && (
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
              <HiClock />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold">{t('sessions.secure_account')}</h3>
              <p className="text-indigo-100 text-xs mt-1">{t('sessions.secure_desc')}</p>
            </div>
            <button 
              onClick={() => setIsNukeModalOpen(true)}
              disabled={loading}
              className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-sm font-bold hover:bg-indigo-50 transition-all active:scale-95 shadow-lg disabled:opacity-50"
            >
              {t('sessions.sign_out_all')}
            </button>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('sessions.active_recent')}</h2>
          </div>
          
          <div className="divide-y divide-gray-50">
            {activities.length === 0 && !loading && (
              <div className="p-20 text-center text-gray-400 italic">{t('sessions.no_history')}</div>
            )}
            
            {activities.map((session) => {
              const currentUser = JSON.parse(localStorage.getItem('user'));
              const isOwnSession = session.user_id === currentUser?.id;
              const isLatestOwn = isOwnSession && activities.find(a => a.user_id === session.user_id)?.id === session.id;

              return (
                <div key={session.id} className="p-8 hover:bg-gray-50 transition-colors flex items-start gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                    isLatestOwn ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {session.device_info?.includes('iPhone') || session.device_info?.includes('Android') ? <HiDeviceMobile /> : <HiDesktopComputer />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{parseDevice(session.device_info)}</h3>
                      
                      {userRole === 'admin' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-300">•</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            @{session.username}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded-md">
                            {session.role}
                          </span>
                        </div>
                      )}

                      {isLatestOwn && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                          <HiCheckCircle /> {t('sessions.current_session')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">IP: {session.ip_address === '::1' ? '::1 (Localhost)' : session.ip_address}</p>
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">{formatTimeAgo(session.created_at)}</p>
                  </div>

                  {userRole === 'admin' && !isLatestOwn && (
                    <button 
                      onClick={() => handleRevokeUser(session.user_id, session.username)}
                      className="px-4 py-2 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50 transition-all active:scale-95 shadow-sm bg-white"
                    >
                      {t('sessions.revoke')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-4 p-6 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800">
          <HiExclamation className="text-xl shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">{t('sessions.recommendation')}</h4>
            <p className="text-xs mt-1 leading-relaxed opacity-90">
              {t('sessions.recommendation_desc')}
            </p>
          </div>
        </div>
      </div>

      {isNukeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !loading && setIsNukeModalOpen(false)} />
          
          <div className="relative bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8 animate-bounce">
              <HiExclamation />
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 text-center mb-4">{t('sessions.nuke_title')}</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-8">
              {t('sessions.nuke_desc')}
              <br/><br/>
              Only Viewers will remain active. You will also be signed out immediately.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSignOutAll}
                disabled={loading}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 disabled:opacity-50"
              >
                {loading ? t('sessions.nuke_executing') : t('sessions.nuke_confirm')}
              </button>
              <button 
                onClick={() => setIsNukeModalOpen(false)}
                disabled={loading}
                className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-bold uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95"
              >
                {t('common.cancel').toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
