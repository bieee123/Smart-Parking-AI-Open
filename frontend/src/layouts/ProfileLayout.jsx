import { useState } from 'react';
import ProfileSidebar from '../modules/profile/components/ProfileSidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { HiMenuAlt2 } from 'react-icons/hi';

export default function ProfileLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Profile-Specific Sidebar */}
      <ProfileSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 transition-all duration-300">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:text-primary-600 transition-colors"
          >
            <HiMenuAlt2 className="w-6 h-6" />
          </button>
          <div className="font-bold text-gray-900">Settings</div>
          <div className="w-10"></div> {/* Spacer for symmetry */}
        </div>

        {/* Topbar (Hidden on mobile as we have mobile header, or integrated) */}
        <div className="hidden lg:block">
          <Navbar />
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
