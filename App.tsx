import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Forms } from './components/Forms';
import { Admin } from './components/Admin';
import { Login } from './components/Login';
import { WelcomeModal } from './components/WelcomeModal'; 
import { INITIAL_TOOLTIPS } from './constants';
import { AppState, UserRole, Employee, Shift, Cohort, TimeLog, TravelRequest } from './types';
import { Loader2, Moon, Sun, Layout, FileText } from 'lucide-react'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase'; 
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { DatabaseSeeder } from './components/DatabaseSeeder';

function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');

  const handleTimeLogSubmit = async (data: any) => {
  try {
    // This connects to the cloud Firestore instance defined in your firebase.ts
    await addDoc(collection(db, 'timeLogs'), {
      ...data,
      status: 'PENDING',
      createdAt: serverTimestamp()
    });
    console.log("Data saved to cloud successfully");
  } catch (error) {
    console.error("Data failed to reach Firestore:", error);
  }
};

const handleTravelSubmit = async (data: any) => {
  try {
    await addDoc(collection(db, 'travelRequests'), {
      ...data,
      status: 'PENDING',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Travel Error:", error);
  }
};
  
  // VIEW MODE: Allows Admins to switch between "Admin Portal" and "Employee Forms"
  const [viewMode, setViewMode] = useState<'ADMIN' | 'EMPLOYEE'>('ADMIN');

  // DARK MODE
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('ramp_theme') === 'dark';
  });

  const [state, setState] = useState<AppState>({
    shifts: [],
    employees: [],
    timeLogs: [],
    travelRequests: [],
    cohorts: [],
    tooltips: INITIAL_TOOLTIPS
  });

  // DATA FETCHING
  useEffect(() => {
    if (!user) return;

    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
       const emps = snap.docs.map(d => ({...d.data(), id: d.id})) as Employee[];
       setState(prev => ({ ...prev, employees: emps }));
       
       const myProfile = emps.find(e => e.email === user.email);
       if(myProfile) {
         setRole(myProfile.role);
         setFirstName(myProfile.firstName);
         // If they are regular employees, force employee view
         if (myProfile.role === 'EMPLOYEE') setViewMode('EMPLOYEE');
       } else {
         if(user.email.includes('kendall')) { 
             setRole('MASTER_ADMIN'); 
             setViewMode('ADMIN');
         }
       }
    });

    const unsubLogs = onSnapshot(query(collection(db, 'timeLogs'), orderBy('createdAt', 'desc')), (snap) => {
       const logs = snap.docs.map(d => ({...d.data(), id: d.id})) as TimeLog[];
       setState(prev => ({ ...prev, timeLogs: logs }));
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
       const shifts = snap.docs.map(d => ({...d.data(), id: d.id})) as any as Shift[];
       setState(prev => ({ ...prev, shifts }));
    });
    
    const unsubCohorts = onSnapshot(collection(db, 'cohorts'), (snap) => {
       const cohorts = snap.docs.map(d => ({...d.data(), id: d.id})) as Cohort[];
       setState(prev => ({ ...prev, cohorts }));
    });

    const unsubTravel = onSnapshot(collection(db, 'travelRequests'), (snap) => {
       const reqs = snap.docs.map(d => ({...d.data(), id: d.id})) as TravelRequest[];
       setState(prev => ({ ...prev, travelRequests: reqs }));
    });

    return () => { unsubEmp(); unsubLogs(); unsubShifts(); unsubCohorts(); unsubTravel(); };
  }, [user]);

  // DARK MODE EFFECT
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('ramp_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('ramp_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => { signOut(auth); setUser(null); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-12 h-12 text-ramp-gold" /></div>;
  if (!user) return <Login />;

  const isAdminOrManager = role === 'MASTER_ADMIN' || role === 'ADMIN' || role === 'MANAGER';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      {/* 1. FIXED: Added userEmail prop for Bible Verse Gatekeeper */}
      <WelcomeModal userName={firstName || 'User'} userEmail={user?.email} />
      
      {/* NAVIGATION BAR */}
      <nav className="bg-white dark:bg-ramp-surface border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
               <div className="w-8 h-8 bg-ramp-gold rounded-full flex items-center justify-center font-bold text-black shadow-lg shadow-ramp-gold/20">R</div>
               <span className="font-bold text-xl tracking-tight hidden md:block">RAMP Accelerator</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAdminOrManager && (
                <div className="hidden md:flex bg-gray-100 dark:bg-black rounded-lg p-1 mr-4 border border-gray-200 dark:border-gray-800">
                   <button 
                     onClick={() => setViewMode('ADMIN')}
                     className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'ADMIN' ? 'bg-white dark:bg-gray-800 shadow text-ramp-gold' : 'text-gray-500'}`}
                   >
                     <Layout size={14} /> Admin Portal
                   </button>
                   <button 
                     onClick={() => setViewMode('EMPLOYEE')}
                     className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'EMPLOYEE' ? 'bg-white dark:bg-gray-800 shadow text-ramp-gold' : 'text-gray-500'}`}
                   >
                     <FileText size={14} /> Time & Travel Portal
                   </button>
                </div>
              )}

              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                {isDarkMode ? <Sun className="w-5 h-5 text-ramp-gold" /> : <Moon className="w-5 h-5 text-gray-500" />}
              </button>
              
              <div className="text-right hidden sm:block border-l border-gray-300 dark:border-gray-700 pl-4">
                 <p className="text-sm font-bold">{firstName}</p>
                 <p className="text-[10px] text-gray-500 uppercase tracking-wider">{role.replace('_', ' ')}</p>
              </div>
              <button onClick={handleLogout} className="text-sm font-bold hover:text-ramp-gold ml-2">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
  {isAdminOrManager && viewMode === 'ADMIN' ? (
    <div className="space-y-12 animate-fade-in">
      
      {/* 1. Dashboard: ONLY for Admins */}
      {(role === 'MASTER_ADMIN' || role === 'ADMIN') && (
        <Dashboard 
          shifts={state.shifts} 
          employees={state.employees} 
          timeLogs={state.timeLogs} 
          travelRequests={state.travelRequests} 
          tooltips={state.tooltips} 
        />
      )}

      {/* 2. Admin: For Admins AND Managers */}
      <Admin state={state} currentUserEmail={user.email} role={role} />
      
    </div>
  ) : (
    <div className="animate-fade-in">
       {/* ... Employee Forms Portal ... */}
       <Forms state={state} currentUserEmail={user.email} submitTimeLog={handleTimeLogSubmit} submitTravel={handleTravelSubmit} />
    </div>
  )}
</main>
      {/* Emergency Seeder - Only visible to Master Admin */}
{role === 'MASTER_ADMIN' && <DatabaseSeeder />}
    </div>
  );
}


export default App;