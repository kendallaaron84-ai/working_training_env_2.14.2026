import React, { useState } from 'react';
import { AppState, UserRole, Employee, Shift, ShiftModule, TimeLog, TravelRequest } from '../types'; 
import { db } from '../firebase';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore'; 
import { Check, X, Download, Users, Calendar, DollarSign, Plus, Save, Edit2, Settings, Mail, Trash2, Briefcase, Plane, FileText, Paperclip } from 'lucide-react';

interface AdminProps {
  state: AppState;
  currentUserEmail: string;
  role: UserRole;
}

export const Admin: React.FC<AdminProps> = ({ state, currentUserEmail, role }) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'staff' | 'schedule' | 'budget' | 'config' | 'cpa'>('approvals');
  
  // --- MODAL & EDIT STATES ---
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShift, setNewShift] = useState<Partial<Shift>>({
    name: '', plannedStart: '', plannedEnd: '', plannedBudget: 0, modules: []
  });

  const [editingEmp, setEditingEmp] = useState<string | null>(null);
  const [editEmpForm, setEditEmpForm] = useState<Partial<Employee>>({});
  
  const [editingShift, setEditingShift] = useState<number | null>(null);
  const [editShiftForm, setEditShiftForm] = useState<Partial<Shift>>({});

  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', role: 'EMPLOYEE' as UserRole, wage: 0, companyName: '' });
  const [tempTooltips, setTempTooltips] = useState(state.tooltips);

  // --- ACTIONS ---

  const handleApprove = async (collectionName: string, id: string, status: string) => {
    // 1. Standard status update
    await updateDoc(doc(db, collectionName, id), { status });

    // 2. "Smart" Actual Spend Logic
    if (status === 'Approved') {
      try {
        const financialRef = doc(db, 'system', 'financials');
        let spendToAdd = 0;

        // A. Handle Time Logs (Bundled Labor + Expenses)
        if (collectionName === 'timeLogs') {
          const log = state.timeLogs.find(l => l.id === id);
          if (log) {
            // 1. Calculate Labor
            if (log.totalCost) {
               spendToAdd += log.totalCost;
            } else {
               // Fallback if totalCost missing
               const staffMember = state.employees.find(e => e.id === log.employeeId);
               if (staffMember) {
                 const rate = staffMember.wage > 0 ? staffMember.wage : (staffMember.plannedProgramBudget / (staffMember.fteOperationalHours || 1));
                 spendToAdd += (log.actualHours * rate);
               }
            }
            // 2. Add Expenses (Even if Labor was 0)
            spendToAdd += (log.equipmentCost || 0) + (log.suppliesCost || 0);
          }
        }
        
        // B. Handle Travel Requests
        if (collectionName === 'travelRequests') {
          const travel = state.travelRequests.find(t => t.id === id);
          if (travel && travel.totalReimbursement) {
            spendToAdd += travel.totalReimbursement;
          }
        }

        // C. Update Financials
        if (spendToAdd > 0) {
          await updateDoc(financialRef, {
            totalActualSpend: ((state as any).totalActualSpend || 0) + spendToAdd
          });
        }

      } catch (error) {
        console.error("Failed to update Actual Spend:", error);
      }
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.firstName) return alert("Missing required fields");
    try {
      await setDoc(doc(db, 'employees', newUser.email), {
        ...newUser,
        id: newUser.email,
        plannedProgramBudget: 0, 
        fteOperationalHours: 0   
      });
      setNewUser({ firstName: '', lastName: '', email: '', role: 'EMPLOYEE' as UserRole, wage: 0, companyName: '' });
      alert("Member added successfully!");
    } catch (error) { console.error("Error adding user:", error); }
  };

  const saveEmpEdit = async () => {
    if(!editingEmp) return;
    await updateDoc(doc(db, 'employees', editingEmp), editEmpForm);
    setEditingEmp(null);
  };

  const handleCreateShift = async () => {
    const id = Date.now();
    if (!newShift.name) return alert("Please enter a name");
    await setDoc(doc(db, 'shifts', id.toString()), { ...newShift, id });
    setNewShift({ name: '', plannedStart: '', plannedEnd: '', plannedBudget: 0, modules: [] });
    setShowShiftModal(false);
  };

  const handleDeleteShift = async (id: number) => {
    if (window.confirm("Are you sure you want to remove this milestone? This cannot be undone.")) {
      await deleteDoc(doc(db, 'shifts', id.toString()));
    }
  };

  const addModuleToNewShift = () => {
    const mods = [...(newShift.modules || []), { id: `m${Date.now()}`, name: '', plannedStart: '', plannedEnd: '' }];
    setNewShift({ ...newShift, modules: mods as ShiftModule[] });
  };

  const saveShiftEdit = async () => {
    if(!editingShift) return;
    await updateDoc(doc(db, 'shifts', editingShift.toString()), editShiftForm);
    setEditingShift(null);
  };

  const generateCPAExport = () => {
    const headers = ["Type", "Week Ending", "Employee", "Role", "Category", "Labor Cost", "Equipment", "Supplies", "Travel", "Total", "Receipts"];
    const rows = state.timeLogs.filter(l => l.status === 'Approved').map(l => {
      const emp = state.employees.find(e => e.id === l.employeeId);
      const rate = emp?.wage || ((emp?.plannedProgramBudget||0) / (emp?.fteOperationalHours||1));
      const labor = l.totalCost || (l.actualHours * rate);
      return ["PAYROLL", l.weekEnding, `${emp?.firstName} ${emp?.lastName}`, emp?.role, l.budgetCategory, labor, l.equipmentCost || 0, l.suppliesCost || 0, 0, labor + (l.equipmentCost || 0) + (l.suppliesCost || 0), `${l.equipmentReceiptUrl || ''} ${l.suppliesReceiptUrl || ''}`];
    });
    state.travelRequests.filter(r => r.status === 'Approved').forEach(r => {
      const emp = state.employees.find(e => e.id === r.employeeId);
      rows.push(["TRAVEL", r.weekEnding, `${emp?.firstName} ${emp?.lastName}`, emp?.role, "Travel", 0, 0, 0, r.totalReimbursement, r.totalReimbursement, r.attachmentUrl || '']);
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    window.open(encodeURI(csvContent));
  };

  const isManager = role === 'MANAGER';
  const isAdmin = role === 'ADMIN' || role === 'MASTER_ADMIN';

  const pendingLogs = state.timeLogs.filter(l => isAdmin ? (l.status === 'Pending' || l.status === 'Pending Manager') : isManager ? l.status === 'Pending Manager' : false);
  const pendingTravels = state.travelRequests.filter(r => isAdmin ? (r.status === 'Pending' || r.status === 'Pending Manager') : isManager ? r.status === 'Pending Manager' : false);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* TAB NAV */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-ramp-surface p-2 rounded shadow no-print">
        {['approvals', 'staff', 'schedule', 'budget', 'config', 'cpa'].map(t => (
          <button key={t} onClick={()=>setActiveTab(t as any)} className={`capitalize px-4 py-2 rounded font-bold ${activeTab===t ? 'bg-black text-white' : 'text-gray-500'}`}>
            {t === 'staff' ? 'Staff & Partners' : t}
          </button>
        ))}
      </div>

      {activeTab === 'approvals' && (
        <div className="space-y-6">
          
          {/* TIME LOGS & EXPENSES */}
          <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow">
             <h3 className="font-bold mb-4 dark:text-white uppercase text-xs tracking-widest text-ramp-gold flex items-center gap-2">
               <FileText size={16}/> Pending Timesheets & Expenses
             </h3>
             {pendingLogs.length === 0 && <p className="text-gray-400 italic">No pending requests.</p>}
             {pendingLogs.map(l => (
               <div key={l.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                 <div className="space-y-1 mb-2 md:mb-0">
                    <div className="flex items-center gap-2">
                       <p className="font-bold dark:text-white">{state.employees.find(e=>e.id===l.employeeId)?.firstName} {state.employees.find(e=>e.id===l.employeeId)?.lastName}</p>
                       <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded uppercase">{l.budgetCategory}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">Week Ending: {l.weekEnding}</p>
                    
                    {/* VISIBLE EXPENSES */}
                    <div className="flex flex-wrap gap-2 mt-2">
                       <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold border border-blue-100">
                          Hours: {l.actualHours}
                       </span>
                       {(l.equipmentCost || 0) > 0 && (
                          <a href={l.equipmentReceiptUrl} target="_blank" rel="noreferrer" className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-bold border border-purple-100 flex items-center gap-1 hover:underline">
                            <Paperclip size={10}/> Equip: ${l.equipmentCost}
                          </a>
                       )}
                       {(l.suppliesCost || 0) > 0 && (
                          <a href={l.suppliesReceiptUrl} target="_blank" rel="noreferrer" className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded font-bold border border-orange-100 flex items-center gap-1 hover:underline">
                            <Paperclip size={10}/> Supplies: ${l.suppliesCost}
                          </a>
                       )}
                    </div>
                 </div>
                 <div className="flex gap-2 w-full md:w-auto">
                   <button onClick={()=>handleApprove('timeLogs',l.id, isManager ? 'Pending' : 'Approved')} className="flex-1 md:flex-none px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-bold flex items-center justify-center gap-2"><Check size={16}/> Approve</button>
                   <button onClick={()=>handleApprove('timeLogs',l.id,'Rejected')} className="flex-1 md:flex-none px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-bold flex items-center justify-center gap-2"><X size={16}/> Reject</button>
                 </div>
               </div>
             ))}
          </div>

          {/* TRAVEL REQUESTS */}
          <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border-l-4 border-blue-500">
            <h3 className="font-bold mb-4 dark:text-white uppercase text-xs tracking-widest text-blue-500 flex items-center gap-2">
              <Plane size={16}/> Pending Travel
            </h3>
            {pendingTravels.length === 0 && <p className="text-gray-400 italic">No pending travel requests.</p>}
            {pendingTravels.map(t => (
              <div key={t.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="mb-2 md:mb-0">
                  <p className="font-bold dark:text-white">
                    {state.employees.find(e => e.id === t.employeeId)?.firstName} {state.employees.find(e => e.id === t.employeeId)?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">Week: {t.weekEnding}</p>
                  <div className="flex gap-2">
                     <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-bold border border-green-100">Total: ${t.totalReimbursement?.toFixed(2)}</span>
                     {t.attachmentUrl && (
                        <a href={t.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline flex items-center gap-1"><Paperclip size={10}/> View Receipt</a>
                     )}
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => handleApprove('travelRequests', t.id, 'Approved')} className="flex-1 md:flex-none px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-bold flex items-center justify-center gap-2"><Check size={16}/> Approve</button>
                  <button onClick={() => handleApprove('travelRequests', t.id, 'Rejected')} className="flex-1 md:flex-none px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-bold flex items-center justify-center gap-2"><X size={16}/> Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border-l-4 border-ramp-gold">
              <h3 className="font-bold mb-4 dark:text-white">Add Team Member</h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-6 gap-4"> 
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">First Name</label>
                  <input value={newUser.firstName} onChange={e=>setNewUser({...newUser, firstName:e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Last Name</label>
                  <input value={newUser.lastName} onChange={e=>setNewUser({...newUser, lastName:e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Email</label>
                  <input value={newUser.email} onChange={e=>setNewUser({...newUser, email:e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Hourly Wage ($)</label>
                  <input type="number" value={newUser.wage} onChange={e=>setNewUser({...newUser, wage: parseFloat(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Staffing Type</label>
                  <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value as UserRole})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white">
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="INDUSTRY_PARTNER">Industry Partner</option>
                    <option value="ADMIN">System Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Company (Partners Only)</label>
                  <input 
                    value={newUser.companyName || ''} 
                    onChange={e=>setNewUser({...newUser, companyName:e.target.value})} 
                    placeholder="e.g. MKP Inspired"
                    className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" 
                  />
                </div>
                <button className="bg-ramp-gold text-black font-bold h-10 self-end rounded">Add Member</button>
              </form>
            </div>
          </div>
        )}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
           <button onClick={()=>setShowShiftModal(true)} className="bg-ramp-gold text-black px-6 py-2 rounded font-bold flex items-center gap-2"><Plus size={18} /> Add New Shift</button>
           {state.shifts.map(shift => (
              <div key={shift.id} className="bg-white dark:bg-ramp-surface p-6 rounded shadow border dark:border-gray-700">
                {editingShift === shift.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-bold text-gray-500 uppercase">Name</label><input value={editShiftForm.name} onChange={e=>setEditShiftForm({...editShiftForm, name: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                       <div><label className="text-[10px] font-bold text-gray-500 uppercase">Budget</label><input type="number" value={editShiftForm.plannedBudget} onChange={e=>setEditShiftForm({...editShiftForm, plannedBudget: parseFloat(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                       <div><label className="text-[10px] font-bold text-gray-500 uppercase">Start</label><input type="date" value={editShiftForm.plannedStart} onChange={e=>setEditShiftForm({...editShiftForm, plannedStart: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                       <div><label className="text-[10px] font-bold text-gray-500 uppercase">End</label><input type="date" value={editShiftForm.plannedEnd} onChange={e=>setEditShiftForm({...editShiftForm, plannedEnd: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                       <div><label className="text-[10px] font-bold text-gray-500 uppercase text-blue-500">Actual Start</label><input type="date" value={editShiftForm.actualStart || ''} onChange={e=>setEditShiftForm({...editShiftForm, actualStart: e.target.value})} className="w-full p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded dark:text-white" /></div>
                       <div><label className="text-[10px] font-bold text-gray-500 uppercase text-blue-500">Actual End</label><input type="date" value={editShiftForm.actualEnd || ''} onChange={e=>setEditShiftForm({...editShiftForm, actualEnd: e.target.value})} className="w-full p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded dark:text-white" /></div>
                    </div>
                    <div className="space-y-2 border-t dark:border-gray-800 pt-4">
                       <h4 className="font-bold text-xs text-ramp-gold">Modules</h4>
                       {editShiftForm.modules?.map((mod, idx) => (
                          <div key={idx} className="grid grid-cols-3 gap-2">
                             <input value={mod.name} onChange={e => {
                                const m = [...(editShiftForm.modules || [])];
                                m[idx] = { ...m[idx], name: e.target.value };
                                setEditShiftForm({ ...editShiftForm, modules: m });
                             }} className="p-1 text-sm bg-transparent border-b dark:border-gray-700 dark:text-white" placeholder="Module Name" />
                             <input type="date" value={mod.plannedStart} onChange={e => {
                                const m = [...(editShiftForm.modules || [])];
                                m[idx] = { ...m[idx], plannedStart: e.target.value };
                                setEditShiftForm({ ...editShiftForm, modules: m });
                             }} className="p-1 text-xs bg-transparent border-b dark:border-gray-700 dark:text-white" />
                             <input type="date" value={mod.plannedEnd} onChange={e => {
                                const m = [...(editShiftForm.modules || [])];
                                m[idx] = { ...m[idx], plannedEnd: e.target.value };
                                setEditShiftForm({ ...editShiftForm, modules: m });
                             }} className="p-1 text-xs bg-transparent border-b dark:border-gray-700 dark:text-white" />
                          </div>
                       ))}
                       <button onClick={() => {
                          const m = [...(editShiftForm.modules || [])];
                          m.push({ id: `m${Date.now()}`, name: '', plannedStart: '', plannedEnd: '' });
                          setEditShiftForm({ ...editShiftForm, modules: m });
                       }} className="text-xs text-blue-500 hover:underline">+ Add Module</button>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                      <button onClick={()=>setEditingShift(null)} className="px-4 py-2 text-gray-500 text-sm">Cancel</button>
                      <button onClick={saveShiftEdit} className="px-6 py-2 bg-green-500 text-white font-bold rounded flex items-center gap-2"><Save size={16}/> Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold dark:text-white">{shift.name}</h3>
                        <p className="text-xs text-gray-500">Planned: {shift.plannedStart} to {shift.plannedEnd}</p>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={()=>{setEditingShift(shift.id); setEditShiftForm(shift);}} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><Edit2 size={16}/></button>
                        <button onClick={()=>handleDeleteShift(shift.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                      </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* BUDGET TAB */}
      {activeTab === 'budget' && (
        <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow">
          <h3 className="font-bold mb-4 dark:text-white uppercase text-xs tracking-widest text-ramp-gold">Budget Management</h3>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500">
              <tr><th>Name</th><th>SBA Cap ($)</th><th>FTE Hours</th><th>Hourly Wage ($)</th><th>Action</th></tr>
            </thead>
            <tbody>
              {state.employees.map(emp => {
                const isPartner = emp.role === 'INDUSTRY_PARTNER'; 
                return (
                  <tr key={emp.id} className={`border-b dark:border-gray-700 ${isPartner ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                      <td className="p-2">
                        <div className="font-bold dark:text-white">{emp.firstName} {emp.lastName}</div>
                        {isPartner && (
                          <div className="text-[9px] text-blue-500 font-bold uppercase flex items-center gap-1">
                            <Briefcase size={10}/> {emp.companyName || 'External Partner'}
                          </div>
                        )}
                      </td>
                      
                      {editingEmp === emp.id ? (
                        <>
                          <td className="p-2">
                            {isPartner ? <span className="text-xs text-gray-400 italic">Locked</span> : 
                            <input type="number" value={editEmpForm.plannedProgramBudget} onChange={e=>setEditEmpForm({...editEmpForm, plannedProgramBudget: parseFloat(e.target.value)})} className="border p-1 w-24 text-black" />}
                          </td>
                          <td className="p-2">
                            {isPartner ? <span className="text-xs text-gray-400 italic">N/A</span> : 
                            <input type="number" value={editEmpForm.fteOperationalHours} onChange={e=>setEditEmpForm({...editEmpForm, fteOperationalHours: parseFloat(e.target.value)})} className="border p-1 w-24 text-black" />}
                          </td>
                          <td className="p-2">
                            <input type="number" value={editEmpForm.wage} onChange={e=>setEditEmpForm({...editEmpForm, wage: parseFloat(e.target.value)})} className="border p-1 w-24 text-black" />
                          </td>
                          <td className="p-2"><button onClick={saveEmpEdit} className="text-green-500"><Save size={16}/></button></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 dark:text-white font-bold">
                            {isPartner ? <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded">CONTRACTUAL</span> : `$${emp.plannedProgramBudget?.toLocaleString()}`}
                          </td>
                          <td className="p-2 dark:text-white">{emp.fteOperationalHours}</td>
                          <td className="p-2 dark:text-white font-mono text-green-600">${emp.wage}/hr</td>
                          <td className="p-2"><button onClick={()=>{setEditingEmp(emp.id); setEditEmpForm(emp)}} className="text-blue-500"><Edit2 size={16}/></button></td>
                        </>
                      )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow">
           <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2"><Settings size={20}/> Tooltip Configuration</h3>
           <div className="space-y-4">
             {Object.keys(tempTooltips).map(key => (
               <div key={key}>
                 <label className="text-[10px] font-bold text-gray-500 uppercase">{key}</label>
                 <input value={(tempTooltips as any)[key]} onChange={e => setTempTooltips({...tempTooltips, [key]: e.target.value})} className="w-full border p-2 rounded text-black" />
               </div>
             ))}
             <button onClick={async () => { await setDoc(doc(db, 'system', 'config'), { tooltips: tempTooltips }); alert("Saved to Cloud"); }} className="bg-black text-white px-6 py-2 rounded font-bold">Save Configuration</button>
           </div>
        </div>
      )}

      {activeTab === 'cpa' && (
        <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow text-center py-20 border-2 border-dashed border-gray-300">
           <Download className="w-16 h-16 text-ramp-gold mx-auto mb-4" />
           <h3 className="text-2xl font-bold dark:text-white mb-2">Master CPA Export</h3>
           <button onClick={generateCPAExport} className="bg-ramp-gold text-black font-bold px-8 py-3 rounded">Download CSV Report</button>
        </div>
      )}

      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white dark:bg-ramp-surface w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden border dark:border-gray-800">
            <div className="bg-gray-50 dark:bg-black p-4 border-b dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white">Create New Shift Milestone</h3>
              <button onClick={()=>setShowShiftModal(false)}><X className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="text-[10px] font-bold text-gray-500 uppercase">Shift Name</label><input value={newShift.name} onChange={e=>setNewShift({...newShift, name: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                  <div><label className="text-[10px] font-bold text-gray-500 uppercase">Start Date</label><input type="date" value={newShift.plannedStart} onChange={e=>setNewShift({...newShift, plannedStart: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                  <div><label className="text-[10px] font-bold text-gray-500 uppercase">End Date</label><input type="date" value={newShift.plannedEnd} onChange={e=>setNewShift({...newShift, plannedEnd: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
                  <div><label className="text-[10px] font-bold text-gray-500 uppercase">Budget ($)</label><input type="number" value={newShift.plannedBudget} onChange={e=>setNewShift({...newShift, plannedBudget: parseFloat(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-700 rounded dark:text-white" /></div>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center border-t dark:border-gray-800 pt-4"><h4 className="text-sm font-bold text-ramp-gold">Modules</h4><button onClick={addModuleToNewShift} className="text-xs bg-gray-100 dark:bg-gray-800 dark:text-white px-2 py-1 rounded">+ Add Module</button></div>
                  {newShift.modules?.map((mod, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-black rounded border dark:border-gray-800">
                      <input placeholder="Module Name" value={mod.name} onChange={e => { const m = [...newShift.modules!]; m[idx].name = e.target.value; setNewShift({...newShift, modules: m}); }} className="bg-transparent border-b dark:border-gray-700 text-sm dark:text-white outline-none" />
                      <input type="date" value={mod.plannedStart} onChange={e => { const m = [...newShift.modules!]; m[idx].plannedStart = e.target.value; setNewShift({...newShift, modules: m}); }} className="bg-transparent border-b dark:border-gray-700 text-xs dark:text-white outline-none" />
                      <input type="date" value={mod.plannedEnd} onChange={e => { const m = [...newShift.modules!]; m[idx].plannedEnd = e.target.value; setNewShift({...newShift, modules: m}); }} className="bg-transparent border-b dark:border-gray-700 text-xs dark:text-white outline-none" />
                    </div>
                  ))}
               </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-black border-t dark:border-gray-800 flex justify-end gap-3">
              <button onClick={()=>setShowShiftModal(false)} className="px-4 py-2 text-sm font-bold text-gray-500">Cancel</button>
              <button onClick={handleCreateShift} className="px-6 py-2 bg-ramp-gold text-black font-bold rounded">Create Shift</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};