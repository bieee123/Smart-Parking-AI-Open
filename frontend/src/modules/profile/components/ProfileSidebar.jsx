import { Link, useLocation } from 'react-router-dom';
import { 
  HiUser, HiUsers, HiShieldCheck, 
  HiAdjustments, HiClock, HiArrowLeft 
} from 'react-icons/hi';
import { useTranslation } from 'react-i18next';

const MENU_ITEMS = [
  { id: 'account', translationKey: 'account_info.title', icon: <HiUser className="w-5 h-5" />, path: '/profile/account' },
  { id: 'users', translationKey: 'user_management.title', icon: <HiUsers className="w-5 h-5" />, path: '/profile/users', adminOnly: true },
  { id: 'security', translationKey: 'security.title', icon: <HiShieldCheck className="w-5 h-5" />, path: '/profile/security' },
  { id: 'personalization', translationKey: 'personalization.title', icon: <HiAdjustments className="w-5 h-5" />, path: '/profile/personalization' },
  { id: 'sessions', translationKey: 'sessions.title', icon: <HiClock className="w-5 h-5" />, path: '/profile/sessions', allowedRoles: ['admin', 'operator', 'viewer'] },
];

export default function ProfileSidebar({ isOpen, onClose }) {
  const { t } = useTranslation();
  const location = useLocation();

  const user = (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const userRole = user?.role || 'viewer';
  const isViewer = userRole === 'viewer';
  const dashboardPath = isViewer ? '/parking' : '/dashboard';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand / Back Link */}
        <div className="flex flex-col px-6 py-6 border-b border-slate-700 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/20">
                <HiAdjustments className="text-white text-xl" />
              </div>
              <span className="text-xl font-bold tracking-tight">{t('personalization.settings')}</span>
            </div>
            {/* Close button for mobile */}
            <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors">
              <HiArrowLeft />
            </button>
          </div>
          <Link 
            to={dashboardPath} 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest group"
          >
            <HiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            {isViewer ? t('common.back_to_slots') : t('common.back_to_dashboard')}
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            if (item.adminOnly && userRole !== 'admin') return null;
            if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return null;
            
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                {t(item.translationKey)}
              </Link>
            );
          })}
        </nav>

        {/* User Mini Profile */}
        <div className="px-3 py-4 border-t border-slate-700 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
              {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : user?.username?.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.full_name || user?.username || 'Guest'}</p>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">{user?.role || 'User'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
