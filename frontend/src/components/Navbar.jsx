import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiUser, HiLogout, HiChevronDown } from 'react-icons/hi';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const user = (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-600/20 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Smart Parking</span>
            </Link>
          </div>

          {user && (
            <div className="flex items-center relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-900 leading-tight">{user.full_name || user.username}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user.role}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:shadow-lg transition-all">
                  {user.username?.charAt(0).toUpperCase()}
                </div>
                <HiChevronDown className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu — Slate-900 Theme (Matching Sidebar) */}
              {isOpen && (
                <div className="absolute right-0 top-full mt-3 w-64 bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-700 py-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-4 border-b border-slate-700 mb-2 bg-slate-800/50 rounded-t-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Authenticated As</p>
                    <p className="text-sm font-bold text-white truncate">{user.full_name || user.username}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.role} Session</span>
                    </div>
                  </div>
                  
                  <div className="px-2 space-y-1">
                    <Link 
                      to="/profile/account" 
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-primary-600 hover:text-white transition-all duration-200 rounded-xl group"
                    >
                      <HiUser className="text-lg text-slate-400 group-hover:text-white" />
                      Your Profile
                    </Link>
                    
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-600 hover:text-white transition-all duration-200 rounded-xl group"
                    >
                      <HiLogout className="text-lg text-red-400 group-hover:text-white" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
