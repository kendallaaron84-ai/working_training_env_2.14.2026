import React from 'react';
import { LayoutDashboard, FileText, Settings, LogOut, Menu, X } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  setView: (view: string) => void;
  role: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, role }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const NavItem = ({ view, icon: Icon, label }: { view: string; icon: any; label: string }) => (
    <button
      onClick={() => { setView(view); setIsMobileMenuOpen(false); }}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
        activeView === view ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded font-bold">R</div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">RAMP <span className="text-blue-600">Accelerator</span></h1>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem view="forms" icon={FileText} label="Time & Expense" />
            {(role === 'ADMIN' || role === 'MANAGER' || role === 'MASTER_ADMIN') && (
              <NavItem view="admin" icon={Settings} label="Admin" />
            )}
          </nav>

          <div className="hidden md:flex items-center gap-4">
             <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-red-500"><LogOut size={20}/></button>
          </div>
          
          <button className="md:hidden p-2 text-gray-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};