import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { INITIAL_EMPLOYEES, INITIAL_SHIFTS, INITIAL_COHORTS, INITIAL_TOOLTIPS } from '../constants';
import { Database, AlertTriangle } from 'lucide-react';

export const DatabaseSeeder: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const seedDatabase = async () => {
    if (!window.confirm("This will write the Initial Data to the Staging Database. Continue?")) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Employees
      INITIAL_EMPLOYEES.forEach(emp => {
        const ref = doc(db, 'employees', emp.id);
        batch.set(ref, emp);
      });

      // 2. Shifts (Ensuring IDs are strings)
      INITIAL_SHIFTS.forEach(shift => {
        const ref = doc(db, 'shifts', shift.id.toString());
        batch.set(ref, shift);
      });

      // 3. Cohorts
      INITIAL_COHORTS.forEach(cohort => {
        const ref = doc(db, 'cohorts', cohort.id);
        batch.set(ref, cohort);
      });

      // 4. Config
      const configRef = doc(db, 'system', 'config');
      batch.set(configRef, { tooltips: INITIAL_TOOLTIPS });

      await batch.commit();
      alert("Success! Staging Database Populated.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Error. Check Console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={seedDatabase} 
      disabled={loading}
      className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 font-bold text-xs"
    >
      {loading ? <AlertTriangle className="animate-spin" size={16} /> : <Database size={16} />}
      {loading ? "Seeding..." : "Initialize Staging DB"}
    </button>
  );
};