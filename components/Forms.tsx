import React, { useState } from 'react';
import { AppState, BudgetCategory } from '../types';
import { db, storage } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, DollarSign, Calendar, Clock, AlertCircle, CheckCircle, XCircle, History, Plane } from 'lucide-react';

interface FormsProps {
  state: AppState;
  currentUserEmail: string;
  submitTimeLog: (log: any) => void;
  submitTravel: (req: any) => void;
}

export const Forms: React.FC<FormsProps> = ({ state, currentUserEmail }) => {
  const [activeForm, setActiveForm] = useState<'time' | 'travel'>('time');
  const [submitting, setSubmitting] = useState(false);
  
  // UI Feedback States
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SHARED STATE
  const [sharedDate, setSharedDate] = useState('');

  // Time Form State
  const [hours, setHours] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('Personnel');
  const [journal, setJournal] = useState('');
  
  // Expense Toggles
  const [hasEquipment, setHasEquipment] = useState(false);
  const [equipCost, setEquipCost] = useState('');
  const [hasSupplies, setHasSupplies] = useState(false); 
  const [suppliesCost, setSuppliesCost] = useState('');

  // Travel Form State
  const [miles, setMiles] = useState('');
  const [lodging, setLodging] = useState('');
  const [travelFile, setTravelFile] = useState<File | null>(null);

  // File States
  const [equipFile, setEquipFile] = useState<File | null>(null);
  const [suppliesFile, setSuppliesFile] = useState<File | null>(null);

  // Get Current Employee Info
  const employee = state.employees.find(e => e.email === currentUserEmail);
  const isMarkHillTeam = employee?.managerId === 'e6' || employee?.id === 'e6';

  // HELPER: Upload File
  const handleUpload = async (file: File, path: string) => {
    if (!file) return null;
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // --- SUBMIT TIME LOG ---
  const handleTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    clearMessages();

    if (!employee) {
      setErrorMsg(`User profile not found for ${currentUserEmail}.`);
      return;
    }

    setSubmitting(true);

    try {
      const [equipUrl, suppliesUrl] = await Promise.all([
        equipFile ? handleUpload(equipFile, 'receipts/equipment') : Promise.resolve(null),
        suppliesFile ? handleUpload(suppliesFile, 'receipts/supplies') : Promise.resolve(null)
      ]);

      // Priority: Use Wage if available. Fallback to Budget/FTE calculation.
      const budgetRate = (employee.plannedProgramBudget && employee.fteOperationalHours) 
        ? (employee.plannedProgramBudget / employee.fteOperationalHours) 
        : 0;
      
      const rate = employee.wage > 0 ? employee.wage : budgetRate;
      
      const hoursNum = parseFloat(hours);
      const calculatedTotalCost = hoursNum * rate;

      const newLog = {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        weekEnding: sharedDate,
        actualHours: hoursNum,
        billableHours: hoursNum,
        hourlyRate: rate,
        totalCost: calculatedTotalCost,
        journalEntry: journal,
        equipmentCost: hasEquipment ? parseFloat(equipCost) : 0,
        equipmentReceiptUrl: equipUrl,
        suppliesCost: hasSupplies ? parseFloat(suppliesCost) : 0,
        suppliesReceiptUrl: suppliesUrl,
        status: isMarkHillTeam ? 'Pending Manager' : 'Pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'timeLogs'), newLog);
      
      setSuccessMsg(`Logged successfully! ($${calculatedTotalCost.toFixed(2)})`);
      setHours('');
      setJournal('');
      setEquipCost('');
      setSuppliesCost('');
    } catch (err) {
      console.error(err);
      setErrorMsg("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- SUBMIT TRAVEL REQUEST (FIXED) ---
  const handleTravelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!employee) return setErrorMsg(`User profile not found.`);
    if (!sharedDate) return setErrorMsg("Please select a Travel Date.");

    setSubmitting(true);

    try {
      // 1. FIXED: Calculate Totals BEFORE creating object
      const mileageCost = parseFloat(miles || '0') * 0.67;
      const lodgingCost = parseFloat(lodging || '0');
      const total = mileageCost + lodgingCost;

      const attachmentUrl = travelFile ? await handleUpload(travelFile, 'receipts/travel') : null;
      const status = isMarkHillTeam ? 'Pending Manager' : 'Pending';

      const newTravel = {
        employeeId: employee.id,
        weekEnding: sharedDate,
        distanceMiles: parseFloat(miles || '0'),
        lodgingCost,
        totalReimbursement: total, // Now properly defined
        status,
        attachmentUrl,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'travelRequests'), newTravel);
      
      setSuccessMsg(`Travel Request for $${total.toFixed(2)} Submitted!`);
      setMiles('');
      setLodging('');
      setTravelFile(null);

    } catch (err) {
      console.error(err);
      setErrorMsg("Error submitting travel request.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- AUDIT TRAIL DATA ---
  const myTimeLogs = state.timeLogs.filter(l => l.employeeId === employee?.id).slice(0, 5);
  const myTravels = state.travelRequests.filter(t => t.employeeId === employee?.id).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="max-w-2xl mx-auto bg-white dark:bg-ramp-surface p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 relative">
        
        {/* MESSAGES */}
        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded flex items-center gap-3 animate-fade-in">
            <CheckCircle className="text-green-600" size={20} />
            <span className="font-bold text-green-800 dark:text-green-200">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded flex items-center gap-3 animate-fade-in">
            <XCircle className="text-red-600" size={20} />
            <span className="font-bold text-red-800 dark:text-red-200">{errorMsg}</span>
          </div>
        )}

        {/* DATE SELECTOR */}
        <div className="mb-6 bg-gray-50 dark:bg-black p-4 rounded border border-gray-200 dark:border-gray-700">
           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Week Ending / Travel Date</label>
           <div className="relative">
              <Calendar className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
              <input type="date" required value={sharedDate} onChange={e => setSharedDate(e.target.value)} className="w-full pl-10 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm dark:text-white" />
           </div>
        </div>

        {/* TABS */}
        <div className="flex space-x-4 mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button onClick={() => { setActiveForm('time'); clearMessages(); }} className={`pb-2 text-sm font-bold uppercase ${activeForm === 'time' ? 'border-b-2 border-ramp-gold text-ramp-gold' : 'text-gray-500'}`}>Time & Expenses</button>
          <button onClick={() => { setActiveForm('travel'); clearMessages(); }} className={`pb-2 text-sm font-bold uppercase ${activeForm === 'travel' ? 'border-b-2 border-ramp-gold text-ramp-gold' : 'text-gray-500'}`}>Travel Request</button>
        </div>

        {/* TIME FORM */}
        {activeForm === 'time' ? (
          <form onSubmit={handleTimeSubmit} className="space-y-6">
             <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hours Worked</label>
                <Clock className="absolute left-3 top-8 text-gray-400 w-4 h-4" />
                <input type="number" step="0.5" required value={hours} onChange={e => setHours(e.target.value)} className="w-full pl-10 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded p-2 text-sm dark:text-white" placeholder="0.0" />
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Budget Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as BudgetCategory)} className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded p-2 text-sm dark:text-white">
                  <option value="Personnel">Personnel (Default)</option>
                  <option value="Contractual">Contractual</option>
                  <option value="Fringe">Fringe Benefits</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
                {category === 'Marketing' && (
                  <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/50 rounded flex items-center gap-2"><AlertCircle className="w-4 h-4 text-yellow-500" /><span className="text-xs text-yellow-500 font-bold">Marketing requires pre-approval.</span></div>
                )}
             </div>

             <textarea required value={journal} onChange={e => setJournal(e.target.value)} className="w-full h-24 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded p-2 text-sm dark:text-white" placeholder="Journal Entry..." />

             <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <label className="flex items-center space-x-2"><input type="checkbox" checked={hasEquipment} onChange={e => setHasEquipment(e.target.checked)} className="text-ramp-gold" /><span className="text-sm font-bold dark:text-white">Equipment Expense?</span></label>
                {hasEquipment && (
                  <div className="flex gap-4 pl-6">
                     <input type="number" value={equipCost} onChange={e => setEquipCost(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm" placeholder="$ Amount" />
                     <input type="file" required onChange={e => setEquipFile(e.target.files?.[0] || null)} className="flex-1 text-xs text-gray-500" />
                  </div>
                )}

                <label className="flex items-center space-x-2"><input type="checkbox" checked={hasSupplies} onChange={e => setHasSupplies(e.target.checked)} className="text-ramp-gold" /><span className="text-sm font-bold dark:text-white">Supplies Expense?</span></label>
                {hasSupplies && (
                  <div className="flex gap-4 pl-6">
                     <input type="number" value={suppliesCost} onChange={e => setSuppliesCost(e.target.value)} className="flex-1 bg-black border border-gray-700 rounded p-2 text-white text-sm" placeholder="$ Amount" />
                     <input type="file" required onChange={e => setSuppliesFile(e.target.files?.[0] || null)} className="flex-1 text-xs text-gray-500" />
                  </div>
                )}
             </div>

             <button disabled={submitting} className="w-full bg-ramp-gold hover:bg-yellow-500 text-black font-bold py-3 rounded uppercase tracking-widest text-sm shadow-lg">
                {submitting ? 'Submitting...' : 'Submit Log'}
             </button>
          </form>
        ) : (
          /* TRAVEL FORM */
          <form onSubmit={handleTravelSubmit} className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Miles</label>
                   <input type="number" value={miles} onChange={e => setMiles(e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded p-2 text-sm dark:text-white" placeholder="0" />
                   <p className="text-[10px] text-gray-500 mt-1">Reimbursed at $0.67/mile</p>
                </div>
                <div className="relative">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lodging ($)</label>
                   <DollarSign className="absolute left-3 top-8 text-gray-400 w-4 h-4" />
                   <input type="number" value={lodging} onChange={e => setLodging(e.target.value)} className="w-full pl-10 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded p-2 text-sm dark:text-white" placeholder="0.00" />
                </div>
             </div>

             <div className="p-4 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-sm font-bold text-gray-500">Total Reimbursement</span>
                   <span className="text-xl font-bold text-ramp-gold">
                      ${((parseFloat(miles||'0') * 0.67) + parseFloat(lodging||'0')).toFixed(2)}
                   </span>
                </div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload Receipt (Required)</label>
                <input type="file" required onChange={e => setTravelFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-500" />
             </div>

             <button disabled={submitting} className="w-full bg-ramp-gold hover:bg-yellow-500 text-black font-bold py-3 rounded uppercase tracking-widest text-sm shadow-lg">
                {submitting ? 'Submitting...' : 'Submit Travel Request'}
             </button>
          </form>
        )}
      </div>

      {/* --- AUDIT TRAIL / RECENT ACTIVITY --- */}
      <div className="max-w-2xl mx-auto space-y-4">
        <h3 className="font-bold text-gray-500 uppercase text-xs tracking-widest flex items-center gap-2">
          <History size={14}/> Recent Activity (Audit Trail)
        </h3>
        
        {myTimeLogs.length === 0 && myTravels.length === 0 && <p className="text-sm text-gray-400 italic">No history found.</p>}

        {myTimeLogs.map(log => (
          <div key={log.id} className="bg-white dark:bg-ramp-surface p-4 rounded border-l-4 border-ramp-gold shadow-sm flex justify-between items-center">
             <div>
                <p className="font-bold text-sm dark:text-white">Time Log: {log.actualHours} hrs</p>
                <p className="text-xs text-gray-500">{log.weekEnding} • {log.budgetCategory || 'Personnel'}</p>
             </div>
             <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${log.status==='Approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
               {log.status}
             </span>
          </div>
        ))}

        {myTravels.map(t => (
          <div key={t.id} className="bg-white dark:bg-ramp-surface p-4 rounded border-l-4 border-blue-500 shadow-sm flex justify-between items-center">
             <div>
                <p className="font-bold text-sm dark:text-white flex items-center gap-2"><Plane size={12}/> Travel: ${t.totalReimbursement.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{t.weekEnding}</p>
             </div>
             <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${t.status==='Approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
               {t.status}
             </span>
          </div>
        ))}
      </div>
    </div>
  );
};