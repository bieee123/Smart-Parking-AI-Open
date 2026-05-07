import ProfileSidebar from '../modules/profile/components/ProfileSidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function ProfileLayout({ children }) {
  const user = (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile-Specific Sidebar */}
      <ProfileSidebar isAdmin={isAdmin} />

      {/* Main Column — offset by sidebar width */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <Navbar />

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
