import React, { useMemo, useState } from 'react';
import { Shift, Employee, TimeLog, TravelRequest } from '../types';
import { BUDGET_RATE } from '../constants';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Layout, Maximize2, Printer, Calendar, DollarSign, Users, Activity, Clock, AlertTriangle, TrendingUp, PieChart as PieChartIcon, Filter } from 'lucide-react';

interface DashboardProps {
  shifts: Shift[];
  employees: Employee[];
  timeLogs: TimeLog[];
  travelRequests: TravelRequest[];
  tooltips: any;
}

const BUDGET_CAPS = {
  Personnel: 87719.16,
  Fringe: 14197.26,
  Travel: 9648.58,
  Equipment: 5000.00,
  Supplies: 4500.00,
  Contractual: 25000.00,
  Other: 2000.00
};

const WALMART_INFLUX = 10000.00; 

export const Dashboard: React.FC<DashboardProps> = ({ shifts, employees, timeLogs, travelRequests, tooltips }) => {
  const [activeTab, setActiveTab] = useState<'executive' | 'financial'>('executive');
  const [fullPageView, setFullPageView] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 1. DATA FILTERING LOGIC
  const { filteredLogs, filteredTravel } = useMemo(() => {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    return {
      filteredLogs: timeLogs.filter(l => {
        const d = new Date(l.weekEnding).getTime();
        return d >= start && d <= end;
      }),
      filteredTravel: travelRequests.filter(t => {
        const d = new Date(t.weekEnding).getTime();
        return d >= start && d <= end;
      })
    };
  }, [timeLogs, travelRequests, startDate, endDate]);

  // 2. TIMELINE BOUNDS FOR GANTT
  const timelineBounds = useMemo(() => {
    if (shifts.length === 0) return { min: Date.now(), max: Date.now() + 86400000, duration: 86400000 };
    const starts = shifts.map(s => new Date(s.plannedStart).getTime());
    const ends = shifts.map(s => new Date(s.plannedEnd).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    return { min, max, duration: max - min || 86400000 };
  }, [shifts]);

  // 3. METRICS CALCULATIONS
  const metrics = useMemo(() => {
    let totalPlannedBudget = shifts.reduce((acc, s) => acc + (s.plannedBudget || 0), 0) + WALMART_INFLUX;
    let totalActualSpend = 0;
    let totalActualHours = 0;

    filteredLogs.filter(l => l.status === 'Approved').forEach(l => {
      const emp = employees.find(e => e.id === l.employeeId);
      // Reads the totalCost field we just added to types.ts
      const laborCost = l.totalCost || (l.actualHours * (emp?.wage || 0));
      totalActualSpend += laborCost + (l.equipmentCost || 0) + (l.suppliesCost || 0);
      totalActualHours += l.actualHours;
    });

    filteredTravel.filter(t => t.status === 'Approved').forEach(t => { totalActualSpend += t.totalReimbursement; });
    
    return { 
      totalPlannedBudget, 
      totalActualSpend, 
      totalCV: totalPlannedBudget - totalActualSpend,
      actualWeightedRate: totalActualHours > 0 ? (totalActualSpend / totalActualHours) : 0 
    };
  }, [shifts, filteredLogs, filteredTravel, employees]);

  // 4. CHART DATA
  const spendVsRateData = useMemo(() => {
    const dataMap: any = {};
    filteredLogs.filter(l => l.status === 'Approved').forEach(l => {
      if(!dataMap[l.weekEnding]) dataMap[l.weekEnding] = { date: l.weekEnding, spend: 0, hours: 0 };
      const emp = employees.find(e => e.id === l.employeeId);
      const laborCost = l.totalCost || (l.actualHours * (emp?.wage || 0));
      dataMap[l.weekEnding].spend += laborCost + (l.equipmentCost || 0) + (l.suppliesCost || 0);
      dataMap[l.weekEnding].hours += l.actualHours;
    });
    return Object.values(dataMap).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d:any) => ({ date: d.date, Spend: d.spend, Rate: d.hours > 0 ? d.spend / d.hours : 0 }));
  }, [filteredLogs, employees]);

  const budgetVarianceData = useMemo(() => {
    const actuals = { Personnel: 0, Fringe: 0, Travel: 0, Equipment: 0, Supplies: 0, Contractual: 0, Other: 0 };
    filteredLogs.filter(l => l.status === 'Approved').forEach(l => {
      const emp = employees.find(e => e.id === l.employeeId);
      const laborCost = l.totalCost || (l.actualHours * (emp?.wage || 0));
      const cat = l.budgetCategory || 'Personnel';
      if (actuals[cat as keyof typeof actuals] !== undefined) actuals[cat as keyof typeof actuals] += laborCost;
      if (l.equipmentCost) actuals['Equipment'] += l.equipmentCost;
      if (l.suppliesCost) actuals['Supplies'] += l.suppliesCost;
    });
    filteredTravel.filter(t => t.status === 'Approved').forEach(t => { actuals['Travel'] += t.totalReimbursement; });
    return Object.keys(BUDGET_CAPS).map(key => ({
      name: key,
      Planned: key === 'Supplies' ? BUDGET_CAPS[key as keyof typeof BUDGET_CAPS] + WALMART_INFLUX : BUDGET_CAPS[key as keyof typeof BUDGET_CAPS],
      Actual: actuals[key as keyof typeof actuals] || 0
    }));
  }, [filteredLogs, filteredTravel, employees]);

  const MetricCard = ({ title, value, subtext, icon: Icon, isGood }: any) => (
    <div className="bg-white dark:bg-ramp-surface p-6 rounded-lg shadow border-l-4 border-ramp-gold">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{title}</h3>
        <Icon className="w-5 h-5 text-ramp-gold" />
      </div>
      <div className={`text-2xl font-bold ${isGood === undefined ? 'text-gray-900 dark:text-white' : isGood ? 'text-green-500' : 'text-red-500'}`}>{value}</div>
      {subtext && <p className="text-[10px] text-gray-400 mt-1 uppercase">{subtext}</p>}
    </div>
  );

  return (
    <div className={fullPageView ? "fixed inset-0 z-50 bg-gray-50 dark:bg-black p-8 overflow-auto" : "space-y-6 max-w-7xl mx-auto pb-12"}>
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-ramp-surface p-4 rounded-lg border dark:border-gray-800 no-print">
        <div className="flex space-x-1 bg-gray-100 dark:bg-black p-1 rounded">
          <button onClick={() => setActiveTab('executive')} className={`px-4 py-2 text-sm font-bold rounded ${activeTab === 'executive' ? 'bg-white dark:bg-ramp-surface text-ramp-gold shadow' : 'text-gray-500'}`}><Layout className="w-4 h-4 mr-2 inline" />Executive</button>
          <button onClick={() => setActiveTab('financial')} className={`px-4 py-2 text-sm font-bold rounded ${activeTab === 'financial' ? 'bg-white dark:bg-ramp-surface text-ramp-gold shadow' : 'text-gray-500'}`}><PieChartIcon className="w-4 h-4 mr-2 inline" />Financial</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFullPageView(!fullPageView)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Maximize2 size={18}/></button>
          <button onClick={() => window.print()} className="p-2 bg-gray-100 dark:bg-gray-800 rounded shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Printer size={18}/></button>
          <Filter className="w-4 h-4 ml-4 text-gray-500" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs dark:text-white border-none focus:ring-0" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs dark:text-white border-none focus:ring-0" />
        </div>
      </div>

      {activeTab === 'executive' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard title="Total Budget" value={`$${metrics.totalPlannedBudget.toLocaleString()}`} subtext={`Includes $${WALMART_INFLUX.toLocaleString()} Walmart Grant`} icon={DollarSign} />
            <MetricCard title="Actual Spend" value={`$${metrics.totalActualSpend.toLocaleString()}`} isGood={metrics.totalActualSpend <= metrics.totalPlannedBudget} icon={Activity} />
            <MetricCard title="Program Health" value={metrics.totalCV >= 0 ? "ON TRACK" : "REVIEW"} isGood={metrics.totalCV >= 0} icon={AlertTriangle} />
            <MetricCard title="Utilized FTE" value={`${((metrics.totalActualSpend / (metrics.totalPlannedBudget || 1)) * 100).toFixed(1)}%`} icon={Users} />
          </div>

          <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border dark:border-gray-800">
            <h3 className="font-bold mb-4 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest text-ramp-gold"><Users size={16}/> Real-Time Utilization</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500 uppercase text-[10px] border-b dark:border-gray-800">
                <tr><th>Member</th><th>Role</th><th className="text-right">Logged Hrs</th><th className="text-right">Utilization %</th></tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const actual = filteredLogs.filter(l => l.employeeId === emp.id && l.status === 'Approved').reduce((acc, l) => acc + l.actualHours, 0);
                  const goal = emp.fteOperationalHours || 1;
                  const util = (actual / goal) * 100;
                  return (
                    <tr key={emp.id} className="border-b dark:border-gray-800">
                      <td className="py-3 font-bold dark:text-white">{emp.firstName} {emp.lastName}</td>
                      <td className="py-3 text-gray-500">{emp.role}</td>
                      <td className="py-3 text-right dark:text-white">{actual.toFixed(1)}</td>
                      <td className={`py-3 text-right font-mono ${util > 100 ? 'text-red-500' : 'text-green-500'}`}>{util.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border dark:border-gray-800">
             <h3 className="font-bold mb-6 flex items-center gap-2 uppercase text-xs tracking-widest text-ramp-gold"><Calendar size={16}/> Master Schedule</h3>
             <div className="space-y-6">
               {shifts.map(shift => {
                 const left = ((new Date(shift.plannedStart).getTime() - timelineBounds.min) / timelineBounds.duration) * 100;
                 const width = ((new Date(shift.plannedEnd).getTime() - new Date(shift.plannedStart).getTime()) / timelineBounds.duration) * 100;
                 return (
                   <div key={shift.id} className="relative mb-6 pb-2 border-b dark:border-gray-800 last:border-0">
                     <div className="flex justify-between text-[10px] mb-1 font-bold text-gray-500 uppercase tracking-wider">
                       <span>{shift.name}</span>
                       <span>{shift.plannedStart} - {shift.plannedEnd}</span>
                     </div>
                     <div className="h-4 bg-gray-100 dark:bg-gray-900 rounded-full relative overflow-hidden mb-2">
                       <div className="absolute h-full bg-ramp-gold/60 border-l-2 border-r-2 border-ramp-gold" style={{ left: `${left}%`, width: `${width}%` }} />
                     </div>
                     <div className="flex flex-wrap gap-2 mt-2 ml-4">
                        {shift.modules?.map((mod: any) => (
                           <div key={mod.id} className="text-[8px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold uppercase border dark:border-blue-800">
                             {mod.name} <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">({mod.plannedStart} - {mod.plannedEnd})</span>
                           </div>
                        ))}
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard title="Weighted Rate" value={`$${metrics.actualWeightedRate.toFixed(2)}`} subtext={`Target: $${BUDGET_RATE}`} isGood={metrics.actualWeightedRate <= BUDGET_RATE} icon={Activity} />
            <MetricCard title="Strategic Drift" value={metrics.totalCV >= 0 ? "Under (+)" : "Over (-)"} subtext={`Var: $${Math.abs(metrics.totalCV).toLocaleString()}`} isGood={metrics.totalCV >= 0} icon={TrendingUp} />
            <MetricCard title="Financial Health" value={metrics.totalCV >= 0 ? "GREEN" : "STRESSED"} isGood={metrics.totalCV >= 0} icon={AlertTriangle} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border dark:border-gray-800">
              <h3 className="font-bold mb-4 dark:text-white uppercase text-xs tracking-widest text-ramp-gold flex justify-between">
                <span>Budget Variance</span>
                <span className="text-gray-500 text-[9px] normal-case tracking-normal">Includes Walmart Influx in Supplies</span>
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={budgetVarianceData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="name" type="category" width={80} fontSize={10} />
                    <RechartsTooltip contentStyle={{backgroundColor: '#000', border: 'none'}} />
                    <Legend wrapperStyle={{fontSize: '10px'}} />
                    <Bar dataKey="Planned" fill="#E5E7EB" name="Planned" barSize={20} />
                    <Bar dataKey="Actual" name="Actual" barSize={20}>
                      {budgetVarianceData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.Actual > entry.Planned ? '#EF4444' : '#10B981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border dark:border-gray-800">
              <h3 className="font-bold mb-4 dark:text-white uppercase text-xs tracking-widest text-ramp-gold">Spend vs. Rate</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={spendVsRateData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis yAxisId="left" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" fontSize={10} />
                    <RechartsTooltip contentStyle={{backgroundColor: '#000', border: 'none'}} />
                    <Bar yAxisId="left" dataKey="Spend" fill="#D4AF37" barSize={30} />
                    <Line yAxisId="right" type="monotone" dataKey="Rate" stroke="#3B82F6" strokeWidth={3} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-ramp-surface p-6 rounded shadow border dark:border-gray-800">
            <h3 className="font-bold mb-4 dark:text-white uppercase text-xs tracking-widest text-ramp-gold">Resource Financial Efficiency</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500 text-[10px] uppercase border-b dark:border-gray-800">
                <tr><th>Employee</th><th>Actual Spend</th><th>Shift Limit (1/5)</th><th>Variance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const actual = filteredLogs.filter(l => l.employeeId === emp.id && l.status === 'Approved').reduce((acc, l) => acc + (l.totalCost || 0) + (l.equipmentCost || 0) + (l.suppliesCost || 0), 0);
                  const limit = (emp.plannedProgramBudget || 0) / 5;
                  const variance = limit - actual;
                  return (
                    <tr key={emp.id} className="border-b dark:border-gray-800">
                      <td className="py-3 font-bold dark:text-white">{emp.firstName} {emp.lastName}</td>
                      <td className="py-3 dark:text-white">${actual.toLocaleString()}</td>
                      <td className="py-3 text-gray-500">${limit.toLocaleString()}</td>
                      <td className={`py-3 font-mono ${variance < 0 ? 'text-red-500' : 'text-green-500'}`}>${variance.toLocaleString()}</td>
                      <td>{emp.role === 'INDUSTRY_PARTNER' ? <span className="text-blue-500 text-[10px] font-bold">CONTRACT</span> : <span className="text-[10px] dark:text-gray-400 font-bold">GRANT</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};