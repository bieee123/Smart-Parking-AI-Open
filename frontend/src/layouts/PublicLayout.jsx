import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { HiMenuAlt3, HiX, HiArrowRight, HiShieldCheck, HiLogout } from 'react-icons/hi';
import useAuth from '../hooks/useAuth';

export default function PublicLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const isAuth = isAuthenticated();
  const role = user?.role;

  // Handle navbar transparency on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePortal = () => {
    if (isAuth && role && role !== 'viewer') navigate('/dashboard');
    else if (isAuth) navigate('/parking');
    else navigate('/login');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200 py-3 shadow-sm' : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              SmartPark<span className="text-indigo-600">.</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">How it Works</a>
            <a href="#zones" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Availability</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuth ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePortal} 
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-200"
                >
                  {role === 'viewer' ? 'View Slots' : 'Dashboard'}
                  <HiArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 rounded-full bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                  title="Logout"
                >
                  <HiLogout className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Sign In</Link>
                <Link 
                  to="/register" 
                  className="px-6 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200"
                >
                  Join Now
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-slate-600 hover:text-indigo-600 transition-colors">
            {menuOpen ? <HiX className="w-6 h-6" /> : <HiMenuAlt3 className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-slate-100 px-6 py-6 flex flex-col gap-5 shadow-xl">
            <a href="#features" className="text-base font-semibold text-slate-700">Fitur</a>
            <a href="#how-it-works" className="text-base font-semibold text-slate-700">Cara Kerja</a>
            <a href="#zones" className="text-base font-semibold text-slate-700">Cek Ketersediaan</a>
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
              <Link to="/login" className="w-full py-3 text-center text-sm font-bold text-slate-700 border border-slate-200 rounded-xl">Masuk</Link>
              <Link to="/register" className="w-full py-3 text-center text-sm font-bold bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">Daftar Gratis</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base">S</div>
                <span className="text-xl font-bold text-white tracking-tight">SmartPark<span className="text-indigo-400">.</span></span>
              </Link>
              <p className="max-w-sm text-sm leading-relaxed mb-6 text-slate-400">
                Future parking management solution powered by AI and IoT. We help optimize parking spaces and provide the best experience for users.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Product</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Key Features</a></li>
                <li><a href="#zones" className="hover:text-white transition-colors">Real-time Slots</a></li>
                <li><Link to="/parking" className="hover:text-white transition-colors">Online Reservation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Support</h4>
              <ul className="space-y-4 text-sm">
                <li><Link to="/register" className="hover:text-white transition-colors">Create Account</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Help Center</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-xs">© {new Date().getFullYear()} SmartPark AI. All rights reserved.</p>
            <div className="flex items-center gap-8 text-xs font-medium">
              <Link to="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="#" className="hover:text-white transition-colors">Terms & Conditions</Link>
              <Link to="/admin/login" className="text-slate-800 hover:text-slate-700 transition-colors p-1" title="Staff Portal">
                <HiShieldCheck className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
