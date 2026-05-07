import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  HiViewGrid, HiChartBar, HiMap, HiVideoCamera, 
  HiLightningBolt, HiDocumentReport, HiLogout 
} from 'react-icons/hi';
import { useTranslation } from 'react-i18next';

const navItems = [
  {
    path: '/dashboard',
    translationKey: 'common.dashboard',
    exact: true,
    icon: <HiViewGrid className="w-5 h-5" />,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    path: '/dashboard/analytics',
    translationKey: 'common.analytics',
    exact: true,
    icon: <HiChartBar className="w-5 h-5" />,
    roles: ['admin', 'operator'],
  },
  {
    path: '/map-parking',
    translationKey: 'common.parking_map',
    exact: true,
    icon: <HiMap className="w-5 h-5" />,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    path: '/live-camera',
    translationKey: 'common.live_camera',
    exact: true,
    icon: <HiVideoCamera className="w-5 h-5" />,
    roles: ['admin', 'operator'],
  },
  {
    path: '/simulator',
    translationKey: 'common.simulator',
    exact: true,
    icon: <HiLightningBolt className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    path: '/executive-summary',
    translationKey: 'common.executive_summary',
    exact: true,
    icon: <HiDocumentReport className="w-5 h-5" />,
    roles: ['admin'],
  },
];

/**
 * Exact-match active checker.
 * Prevents /dashboard from matching when path is /dashboard/analytics etc.
 */
function isActiveRoute(currentPath, targetPath, exact = false) {
  if (exact) return currentPath === targetPath;
  return currentPath === targetPath || currentPath.startsWith(targetPath + '/');
}

export default function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const filteredNavItems = navItems.filter(item => 
    !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col z-30">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
          <span className="text-lg font-bold">P</span>
        </div>
        <span className="text-lg font-semibold">Smart Parking</span>
      </div>

      {/* Navigation — scrollable */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          // Use exact match to prevent double-highlight bugs
          const active = isActiveRoute(location.pathname, item.path, item.exact);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${
                active ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium text-sm">{t(item.translationKey)}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all active:scale-95 group font-bold"
        >
          <HiLogout className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          <span className="text-sm">{t('common.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
