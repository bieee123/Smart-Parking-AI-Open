import { useState, useEffect } from 'react';
import { HiDeviceMobile, HiDesktopComputer, HiClock, HiCheckCircle, HiExclamation, HiRefresh } from 'react-icons/hi';
import { api } from '../../../services/api';

export default function Sessions() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await api.profile.getActivities();
      if (response.success) {
        console.log('All activities fetched:', response.data);
        // Filter only login activities
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
    const confirmed = window.confirm("Are you sure you want to sign out of ALL devices? You will need to log in again on all your devices, including this one.");
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await api.profile.revokeSessions();
      if (response.success) {
        localStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Failed to revoke sessions:', err);
      alert(err.message || 'Failed to sign out all devices');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
          <p className="text-sm text-gray-500 mt-1">Review and manage your active login sessions across all devices.</p>
        </div>
        <button 
          onClick={fetchSessions}
          className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
          disabled={loading}
        >
          <HiRefresh className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Info Card - ONLY FOR ADMIN */}
        {userRole === 'admin' && (
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
              <HiClock />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold">Secure Your Account</h3>
              <p className="text-indigo-100 text-xs mt-1">If you see any suspicious activity, sign out of all other sessions immediately.</p>
            </div>
            <button 
              onClick={handleSignOutAll}
              disabled={loading}
              className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-sm font-bold hover:bg-indigo-50 transition-all active:scale-95 shadow-lg disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Sign Out All Devices'}
            </button>
          </div>
        )}

        {/* Sessions List */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active & Recent Sessions</h2>
          </div>
          
          <div className="divide-y divide-gray-50">
            {activities.length === 0 && !loading && (
              <div className="p-20 text-center text-gray-400 italic">No session history found.</div>
            )}
            
            {activities.map((session, index) => (
              <div key={session.id} className="p-8 hover:bg-gray-50 transition-colors flex items-start gap-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                  index === 0 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {session.device_info?.includes('iPhone') || session.device_info?.includes('Android') ? <HiDeviceMobile /> : <HiDesktopComputer />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-bold text-gray-900">{parseDevice(session.device_info)}</h3>
                    {index === 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                        <HiCheckCircle /> Current Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Unknown Location • {session.ip_address}</p>
                  <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">{formatTimeAgo(session.created_at)}</p>
                </div>

                {userRole === 'admin' && index !== 0 && (
                  <button 
                    onClick={handleSignOutAll}
                    className="text-xs font-black text-gray-400 hover:text-red-600 uppercase tracking-widest transition-colors py-2 px-4 rounded-xl hover:bg-red-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security Tip */}
        <div className="flex items-start gap-4 p-6 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800">
          <HiExclamation className="text-xl shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Security Recommendation</h4>
            <p className="text-xs mt-1 leading-relaxed opacity-90">
              We recommend changing your password every 3-6 months and enabling 2FA to keep your account safe from unauthorized access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
