import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Column — offset by sidebar width (64 = 256px) */}
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
