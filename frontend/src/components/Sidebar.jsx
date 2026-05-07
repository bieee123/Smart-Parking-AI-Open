import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  HiViewGrid, HiChartBar, HiMap, HiVideoCamera, 
  HiLightningBolt, HiDocumentReport, HiLogout 
} from 'react-icons/hi';

const navItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    exact: true,
    icon: <HiViewGrid className="w-5 h-5" />,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    path: '/dashboard/analytics',
    label: 'Analytics',
    exact: true,
    icon: <HiChartBar className="w-5 h-5" />,
    roles: ['admin', 'operator'],
  },
  {
    path: '/map-parking',
    label: 'Parking Map',
    exact: true,
    icon: <HiMap className="w-5 h-5" />,
    roles: ['admin', 'operator', 'viewer'],
  },
  {
    path: '/live-camera',
    label: 'Live Camera',
    exact: true,
    icon: <HiVideoCamera className="w-5 h-5" />,
    roles: ['admin', 'operator'],
  },
  {
    path: '/simulator',
    label: 'Simulator',
    exact: true,
    icon: <HiLightningBolt className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    path: '/executive-summary',
    label: 'Exec Summary',
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
              end={item.exact}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-700 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <HiLogout className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
