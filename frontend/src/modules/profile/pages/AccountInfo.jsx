import { useState, useEffect } from 'react';
import { HiUser, HiMail, HiBriefcase, HiPhone, HiSave, HiCheckCircle, HiExclamation } from 'react-icons/hi';
import { api } from '../../../services/api';

export default function AccountInfo() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState({
    full_name: '',
    email: '',
    job_title: '',
    phone: '',
    bio: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.profile.get();
        if (response.success) {
          setUser(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(`Failed to load profile data: ${err.message}`);
      } finally {
        setFetching(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.profile.update({
        full_name: user.full_name,
        job_title: user.job_title,
        phone: user.phone,
        bio: user.bio,
      });
      if (response.success) {
        setSuccess('Profile updated successfully!');
        
        // Update localStorage to keep UI in sync
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = { ...storedUser, ...response.data };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Notifications */}
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

      {/* Header Card */}
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-primary-600 to-indigo-700" />
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12">
            <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg">
              <div className="w-full h-full rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : user.username?.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <HiSave className="text-lg" />}
              Save Changes
            </button>
          </div>
          
          <div className="mt-6">
            <h1 className="text-2xl font-bold text-gray-900">{user.full_name || user.username}</h1>
            <p className="text-gray-500 text-sm">{user.job_title || 'No Job Title'} • {user.email}</p>
          </div>
        </div>
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <HiUser className="text-primary-500 text-lg" /> Basic Information
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 ml-1">Full Name</label>
                <div className="relative group">
                  <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors"><HiUser /></span>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border-gray-200 rounded-2xl pl-11 py-3 text-sm font-medium text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    placeholder="Enter your full name"
                    value={user.full_name || ''}
                    onChange={(e) => setUser({...user, full_name: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 ml-1">Job Title</label>
                <div className="relative group">
                  <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors"><HiBriefcase /></span>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border-gray-200 rounded-2xl pl-11 py-3 text-sm font-medium text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    placeholder="e.g. Operations Manager"
                    value={user.job_title || ''}
                    onChange={(e) => setUser({...user, job_title: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <HiMail className="text-indigo-500 text-lg" /> Contact Details
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 ml-1">Email Address</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400"><HiMail /></span>
                  <input 
                    type="email" 
                    disabled
                    className="w-full bg-gray-100 border-gray-200 rounded-2xl pl-11 py-3 text-sm font-medium text-gray-400 cursor-not-allowed shadow-sm"
                    value={user.email}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 ml-1">Phone Number</label>
                <div className="relative group">
                  <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors"><HiPhone /></span>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border-gray-200 rounded-2xl pl-11 py-3 text-sm font-medium text-gray-900 focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    placeholder="+62 812-..."
                    value={user.phone || ''}
                    onChange={(e) => setUser({...user, phone: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200">
            <h3 className="text-lg font-bold mb-2">Profile Completeness</h3>
            <div className="flex items-end gap-3 mb-4">
              <span className="text-5xl font-black">{user.full_name && user.phone && user.job_title ? '100%' : '85%'}</span>
              <span className="text-indigo-200 text-sm mb-1">{user.full_name && user.phone && user.job_title ? 'Complete' : 'Excellent'}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 mb-6">
              <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: user.full_name && user.phone && user.job_title ? '100%' : '85%' }} />
            </div>
            <p className="text-indigo-100 text-xs leading-relaxed">
              {user.full_name && user.phone && user.job_title 
                ? "Your profile is fully complete! You're ready to manage the system at full capacity."
                : "Your profile is almost complete. Fill in all details to reach 100% and build more trust with your team."}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Account Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Role</p>
                <p className="text-lg font-bold text-gray-900 capitalize">{user.role}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Status</p>
                <p className="text-lg font-bold text-green-600">Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
