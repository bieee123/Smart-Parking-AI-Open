import { HiDeviceMobile, HiDesktopComputer, HiClock, HiCheckCircle, HiExclamation } from 'react-icons/hi';

export default function Sessions() {
  const sessions = [
    { id: 1, device: 'Chrome on Windows', ip: '192.168.1.42', location: 'Jakarta, ID', current: true, time: 'Active now' },
    { id: 2, device: 'Safari on iPhone 13', ip: '110.12.4.15', location: 'Bandung, ID', current: false, time: '2 hours ago' },
    { id: 3, device: 'Edge on macOS', ip: '172.16.0.5', location: 'Jakarta, ID', current: false, time: 'Yesterday at 14:20' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
        <p className="text-sm text-gray-500 mt-1">Review and manage your active login sessions across all devices.</p>
      </div>

      <div className="space-y-6">
        {/* Info Card */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
            <HiClock />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-bold">Secure Your Account</h3>
            <p className="text-indigo-100 text-xs mt-1">If you see any suspicious activity, sign out of all other sessions immediately.</p>
          </div>
          <button className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-sm font-bold hover:bg-indigo-50 transition-all active:scale-95 shadow-lg">
            Sign Out All Devices
          </button>
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active & Recent Sessions</h2>
          </div>
          
          <div className="divide-y divide-gray-50">
            {sessions.map((session) => (
              <div key={session.id} className="p-8 hover:bg-gray-50 transition-colors flex items-start gap-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                  session.current ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {session.device.includes('iPhone') ? <HiDeviceMobile /> : <HiDesktopComputer />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-bold text-gray-900">{session.device}</h3>
                    {session.current && (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                        <HiCheckCircle /> Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{session.location} • {session.ip}</p>
                  <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">{session.time}</p>
                </div>

                {!session.current && (
                  <button className="text-xs font-black text-gray-400 hover:text-red-600 uppercase tracking-widest transition-colors py-2 px-4 rounded-xl hover:bg-red-50">
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
