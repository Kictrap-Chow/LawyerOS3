import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatDateTime, nowISO } from '../utils';
import { Calendar as CalendarIcon, Clock, CheckSquare, AlertCircle, ArrowRight, X } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { cases, navigate } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeCases = cases.filter(c => c.status !== 'archived');
  const todayStr = nowISO().split('T')[0];

  // Logic for widgets
  const deadlines = activeCases
    .flatMap(c => (c.deadlines || []).map(d => ({ ...d, caseName: c.name, caseId: c.id })))
    .filter(d => !d.completed && d.date >= todayStr)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const tasks = activeCases
    .flatMap(c => (c.tasks || []).map(t => ({ ...t, caseName: c.name, caseId: c.id })))
    .filter(t => !t.isCompleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const reminders = activeCases
    .flatMap(c => (c.reminders || []).map(r => ({ ...r, caseName: c.name, caseId: c.id })))
    .filter(r => r.date >= todayStr)
    .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())
    .slice(0, 6);

  // Calendar Logic
  const generateCalendar = () => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    
    const events: Record<string, string[]> = {};
    activeCases.forEach(c => {
      c.reminders?.forEach(r => { 
        if (!events[r.date]) events[r.date] = []; 
        events[r.date].push('rem');
      });
      c.deadlines?.forEach(d => {
        if (!d.completed) {
          if (!events[d.date]) events[d.date] = []; 
          events[d.date].push('dl');
        }
      });
    });

    const days = [];
    for (let i = 0; i < padding; i++) days.push(<div key={`pad-${i}`} className="h-24 bg-gray-50/50 border-r border-b border-[#f0f0f0]" />);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const dayEvents = events[dateStr] || [];
      const isToday = dateStr === todayStr;

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateStr)}
          className={`h-24 p-1 border-r border-b border-[#f0f0f0] bg-white hover:bg-gray-50 transition-colors relative group cursor-pointer`}
        >
          <div className={`w-6 h-6 flex items-center justify-center text-xs rounded-full mb-1 ${isToday ? 'bg-red-500 text-white font-bold' : 'text-gray-500'}`}>
            {d}
          </div>
          <div className="flex flex-col gap-0.5">
            {dayEvents.includes('dl') && <div className="h-1.5 w-1.5 rounded-full bg-red-500 mx-auto mb-1" />}
            {dayEvents.includes('rem') && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mx-auto" />}
            {(dayEvents.length > 0) && <div className="hidden group-hover:block absolute top-8 left-0 z-10 bg-white shadow-xl border p-2 rounded text-xs w-32">
                Click to view events
            </div>}
          </div>
        </div>
      );
    }
    return days;
  };

  const changeMonth = (delta: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  return (
    <div className="max-w-6xl mx-auto p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#37352f] mb-2">Good morning</h1>
        <p className="text-[#787774]">Here is your overview for {todayStr}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Deadlines Widget */}
        <div className="bg-white rounded-lg border border-[#e9e9e7] shadow-sm p-4 col-span-1">
          <div className="flex items-center gap-2 mb-4 text-[#eb5757] font-medium">
            <AlertCircle size={18} />
            <span>Upcoming Deadlines</span>
          </div>
          <div className="space-y-2">
            {deadlines.length === 0 ? <p className="text-sm text-gray-400 italic">No urgent deadlines.</p> : deadlines.map(d => (
              <div key={d.id} onClick={() => navigate('case', d.caseId)} className="p-2 rounded bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors">
                <div className="text-sm font-medium text-gray-800">{d.title}</div>
                <div className="flex justify-between text-xs text-red-600 mt-1">
                  <span>{d.date}</span>
                  <span className="truncate max-w-[100px]">{d.caseName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks Widget */}
        <div className="bg-white rounded-lg border border-[#e9e9e7] shadow-sm p-4 col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 mb-4 text-[#0085FF] font-medium">
            <CheckSquare size={18} />
            <span>Recent Tasks</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {tasks.length === 0 ? <p className="text-sm text-gray-400 italic col-span-2">No pending tasks.</p> : tasks.map(t => (
               <div key={t.id} onClick={() => navigate('case', t.caseId)} className="flex flex-col p-3 rounded-md border border-[#e9e9e7] hover:bg-gray-50 cursor-pointer group">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-gray-800 line-clamp-1">{t.desc}</span>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded">{t.type}</span>
                    <span className="truncate max-w-[120px]">{t.caseName}</span>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Reminders List */}
      <div className="mb-8 bg-white rounded-lg border border-[#e9e9e7] shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase mb-4 flex items-center gap-2">
           <Clock size={16} /> Schedule
        </h3>
        <div className="space-y-2">
          {reminders.length === 0 ? <p className="text-sm text-gray-400 italic">No scheduled events.</p> : reminders.map(r => (
            <div key={r.id} onClick={() => navigate('case', r.caseId)} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-50 last:border-0">
               <div className="w-24 text-xs font-mono text-blue-600 text-center border-r border-gray-100 pr-2 mr-3">
                 <div className="font-bold">{r.date.slice(5)}</div>
                 <div>{r.time}</div>
               </div>
               <div className="flex-1">
                 <div className="text-sm text-[#37352f]">{r.title}</div>
                 <div className="text-xs text-gray-400">{r.caseName}</div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Section */}
      <div className="bg-white rounded-lg border border-[#e9e9e7] shadow-sm overflow-hidden">
         <div className="p-4 border-b border-[#e9e9e7] flex items-center justify-between bg-gray-50">
           <div className="flex items-center gap-2 font-medium text-[#37352f]">
             <CalendarIcon size={18} />
             {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
           </div>
           <div className="flex gap-1">
             <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 rounded">◀</button>
             <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 rounded">▶</button>
           </div>
         </div>
         <div className="grid grid-cols-7 text-xs text-center text-gray-400 border-b border-[#e9e9e7] py-2">
           <div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div><div>SUN</div>
         </div>
         <div className="grid grid-cols-7 bg-[#fbfbfa]">
            {generateCalendar()}
         </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-[90vw] overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
               <h3 className="font-semibold text-gray-800">{selectedDate}</h3>
               <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
               {(() => {
                 const dayDeadlines = activeCases.flatMap(c => (c.deadlines || []).map(d => ({ ...d, type: 'Deadline', caseName: c.name, caseId: c.id }))).filter(d => d.date === selectedDate && !d.completed);
                 const dayReminders = activeCases.flatMap(c => (c.reminders || []).map(r => ({ ...r, type: 'Reminder', caseName: c.name, caseId: c.id }))).filter(r => r.date === selectedDate);
                 // @ts-ignore
                 const allEvents = [...dayDeadlines, ...dayReminders];

                 if (allEvents.length === 0) return <p className="text-gray-400 text-center italic py-4">No events for this day.</p>;

                 return (
                   <div className="space-y-3">
                     {allEvents.map((e, i) => (
                       <div key={i} onClick={() => { navigate('case', e.caseId); setSelectedDate(null); }} className="p-3 rounded border border-gray-100 hover:bg-gray-50 cursor-pointer">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${e.type === 'Deadline' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{e.type}</span>
                            {/* @ts-ignore */}
                            {e.time && <span className="text-xs text-gray-400">{e.time}</span>}
                          </div>
                          <div className="text-sm font-medium text-gray-800">{e.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{e.caseName}</div>
                       </div>
                     ))}
                   </div>
                 );
               })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
