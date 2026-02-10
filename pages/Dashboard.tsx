import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { useI18n } from '../store/I18nContext';
import { calculateTaskDuration, formatTimeDuration, nowISO } from '../utils';
import { Calendar as CalendarIcon, Clock, CheckSquare, AlertCircle, ArrowRight, X } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { cases, navigate } = useData();
  const { lang, t } = useI18n();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [widgetSize, setWidgetSize] = useState<'compact' | 'comfort' | 'expanded'>(() => {
    const saved = localStorage.getItem('dashboardWidgetSize');
    return saved === 'compact' || saved === 'expanded' ? saved : 'comfort';
  });
  const [horizontalSplit, setHorizontalSplit] = useState<number>(() => {
    const saved = Number(localStorage.getItem('dashboardHorizontalSplit'));
    return Number.isFinite(saved) && saved >= 25 && saved <= 60 ? saved : 34;
  });

  const activeCases = cases.filter(c => c.status !== 'archived');
  const todayStr = nowISO().split('T')[0];
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [todayStr]);
  const todayEnd = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [todayStart]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    localStorage.setItem('dashboardWidgetSize', widgetSize);
  }, [widgetSize]);
  useEffect(() => {
    localStorage.setItem('dashboardHorizontalSplit', String(horizontalSplit));
  }, [horizontalSplit]);

  const widgetSizeConfig = {
    compact: { cardHeight: 236, deadlineLimit: 4, taskLimit: 4, taskCols: 'grid-cols-1' },
    comfort: { cardHeight: 308, deadlineLimit: 6, taskLimit: 8, taskCols: 'grid-cols-1 sm:grid-cols-2' },
    expanded: { cardHeight: 392, deadlineLimit: 9, taskLimit: 12, taskCols: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' },
  } as const;
  const sizeCfg = widgetSizeConfig[widgetSize];

  const sessionSecondsInToday = (startIso: string, endIso: string | null) => {
    const start = new Date(startIso).getTime();
    const endRaw = endIso ? new Date(endIso).getTime() : Date.now();
    if (Number.isNaN(start) || Number.isNaN(endRaw)) return 0;
    const overlapStart = Math.max(start, todayStart);
    const overlapEnd = Math.min(endRaw, todayEnd);
    return overlapEnd > overlapStart ? Math.floor((overlapEnd - overlapStart) / 1000) : 0;
  };

  const totalWorkSeconds = useMemo(
    () =>
      activeCases.reduce(
        (sum, c) => sum + (c.tasks || []).reduce((tSum, t) => tSum + calculateTaskDuration(t), 0),
        0
      ),
    [activeCases, now]
  );

  const todayWorkSeconds = useMemo(
    () =>
      activeCases.reduce(
        (sum, c) =>
          sum +
          (c.tasks || []).reduce((tSum, t) => {
            const daySeconds = (t.sessions || []).reduce(
              (sSum, s) => sSum + sessionSecondsInToday(s.start, s.end),
              0
            );
            return tSum + daySeconds;
          }, 0),
        0
      ),
    [activeCases, todayStart, todayEnd, now]
  );

  const quotePool = useMemo(() => {
    if (lang === 'zh') {
      return [
        '法不阿贵，绳不挠曲。',
        '徒法不足以自行。',
        '法者，治之端也。',
        '法与时转则治，治与世宜则有功。',
        '公平正义，比太阳更有光辉。',
        '法律之内，应有天理人情。'
      ];
    }
    return [
      'Justice delayed is justice denied.',
      'Let right be done.',
      'The law should serve people, not burden them.',
      'Where law ends, tyranny begins.',
      'Fairness is the first duty of law.',
      'Law gains force when it keeps pace with time.'
    ];
  }, [lang]);

  const dayIndex = Math.floor(new Date(todayStr).getTime() / 86_400_000);
  const quote = quotePool[Math.abs(dayIndex) % quotePool.length];
  const hour = now.getHours();
  const greeting = lang === 'zh'
    ? (hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好')
    : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

  // Logic for widgets
  const deadlines = activeCases
    .flatMap(c => (c.deadlines || []).map(d => ({ ...d, caseName: c.name, caseId: c.id })))
    .filter(d => !d.completed && d.date >= todayStr)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, sizeCfg.deadlineLimit);

  const tasks = activeCases
    .flatMap(c => (c.tasks || []).map(t => ({ ...t, caseName: c.name, caseId: c.id })))
    .filter(t => !t.isCompleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, sizeCfg.taskLimit);

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
    for (let i = 0; i < padding; i++) days.push(<div key={`pad-${i}`} className="h-16 md:h-24 bg-gray-50/50 border-r border-b border-[#f0f0f0]" />);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const dayEvents = events[dateStr] || [];
      const isToday = dateStr === todayStr;

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateStr)}
          className={`h-16 md:h-24 p-1 border-r border-b border-[#f0f0f0] bg-white hover:bg-gray-50 transition-colors relative group cursor-pointer`}
        >
          <div className={`w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-[10px] md:text-xs rounded-full mb-1 ${isToday ? 'accent-bg text-white font-bold' : 'text-gray-500'}`}>
            {d}
          </div>
          <div className="flex flex-col gap-0.5">
            {dayEvents.includes('dl') && <div className="h-1.5 w-1.5 rounded-full accent-bg mx-auto mb-1" />}
            {dayEvents.includes('rem') && <div className="h-1.5 w-1.5 rounded-full accent-bg mx-auto" />}
            {(dayEvents.length > 0) && <div className="hidden group-hover:block absolute top-8 left-0 z-10 bg-white shadow-xl border p-2 rounded text-xs w-32">
                {t('dashboard.clickToViewEvents')}
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

  const taskGridCols = sizeCfg.taskCols;

  return (
    <div className="max-w-6xl mx-auto p-2.5 md:p-6 pb-24 md:pb-6 animate-fade-in">
      <div className="mb-6 md:mb-8 craft-surface p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-strong-theme mb-2">{greeting}</h1>
        <p className="text-[#787774] mb-1">{quote}</p>
        <p className="text-[#9b9a97] text-sm">{todayStr}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#dce6f2] bg-white/80 px-3 py-2">
            <div className="text-[11px] text-[#72819a]">{t('dashboard.todayWork')}</div>
            <div className="text-base font-semibold text-[#30425d] mt-0.5">{formatTimeDuration(todayWorkSeconds)}</div>
          </div>
          <div className="rounded-xl border border-[#dce6f2] bg-white/80 px-3 py-2">
            <div className="text-[11px] text-[#72819a]">{t('dashboard.totalWork')}</div>
            <div className="text-base font-semibold text-[#30425d] mt-0.5">{formatTimeDuration(totalWorkSeconds)}</div>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('dashboard.widgetSize')}</span>
          <select
            value={widgetSize}
            onChange={(e) => {
              const next = e.target.value;
              if (next === 'compact' || next === 'comfort' || next === 'expanded') setWidgetSize(next);
            }}
            className="text-xs border border-[#ddd2e3] rounded px-2 py-1 bg-white outline-none"
          >
            <option value="compact">{t('dashboard.sizeCompact')}</option>
            <option value="comfort">{t('dashboard.sizeComfort')}</option>
            <option value="expanded">{t('dashboard.sizeExpanded')}</option>
          </select>
        </div>
        <div className="hidden md:flex items-center gap-2 min-w-[210px]">
          <span className="text-xs text-gray-500 whitespace-nowrap">{t('dashboard.horizontalRatio')}</span>
          <input
            type="range"
            min={25}
            max={60}
            step={1}
            value={horizontalSplit}
            onChange={(e) => setHorizontalSplit(Number(e.target.value))}
            className="w-28"
          />
          <span className="text-xs text-gray-500 w-10 text-right">{horizontalSplit}%</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Deadlines Widget */}
        <div
          className="craft-surface p-4 md:resize-y overflow-auto min-h-[220px]"
          style={{ height: `${sizeCfg.cardHeight}px`, width: `min(100%, clamp(280px, ${horizontalSplit}%, 62%))` }}
        >
          <div className="flex items-center gap-2 mb-4 accent-text-2 font-medium">
            <AlertCircle size={18} />
            <span>{t('dashboard.upcomingDeadlines')}</span>
          </div>
          <div className="space-y-2">
            {deadlines.length === 0 ? <p className="text-sm text-gray-400 italic">{t('dashboard.noUrgentDeadlines')}</p> : deadlines.map(d => (
              <div key={d.id} onClick={() => navigate('case', d.caseId, 'deadlines')} className="p-2 rounded bg-[#f8eeef] border border-[#e7d2d8] cursor-pointer hover:bg-[#f2e4e9] transition-colors">
                <div className="text-sm font-medium text-gray-800">{d.title}</div>
                <div className="flex justify-between text-xs text-[#7a4f69] mt-1">
                  <span>{d.date}</span>
                  <span className="truncate max-w-[100px]">{d.caseName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks Widget */}
        <div
          className="craft-surface p-4 md:resize-y overflow-auto min-h-[220px] md:flex-1"
          style={{ height: `${sizeCfg.cardHeight}px` }}
        >
          <div className="flex items-center gap-2 mb-4 accent-text font-medium">
            <CheckSquare size={18} />
            <span>{t('dashboard.recentTasks')}</span>
          </div>
          <div className={`grid ${taskGridCols} gap-3`}>
             {tasks.length === 0 ? <p className="text-sm text-gray-400 italic col-span-2">{t('dashboard.noPendingTasks')}</p> : tasks.map(t => (
               <div key={t.id} onClick={() => navigate('case', t.caseId, 'tasks')} className="flex flex-col p-3 rounded-md border border-[#e9e9e7] hover:bg-gray-50 cursor-pointer group">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-gray-800 line-clamp-1">{t.desc}</span>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-[#6b5a8b] opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span className="bg-[#f3edf5] px-1.5 py-0.5 rounded">{t.type}</span>
                    <span className="truncate max-w-[120px]">{t.caseName}</span>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Reminders List */}
      <div className="mb-6 md:mb-8 craft-surface p-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase mb-4 flex items-center gap-2">
           <Clock size={16} /> {t('dashboard.schedule')}
        </h3>
        <div className="space-y-2">
          {reminders.length === 0 ? <p className="text-sm text-gray-400 italic">{t('dashboard.noScheduledEvents')}</p> : reminders.map(r => (
            <div key={r.id} onClick={() => navigate('case', r.caseId, 'schedule')} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-50 last:border-0">
               <div className="w-16 md:w-24 text-[11px] md:text-xs font-mono text-[#6b5a8b] text-center border-r border-gray-100 pr-2 mr-3">
                 <div className="font-bold">{r.date.slice(5)}</div>
                 <div>{r.time}</div>
               </div>
               <div className="flex-1">
                 <div className="text-sm text-[#3f2f4d]">{r.title}</div>
                 <div className="text-xs text-gray-400">{r.caseName}</div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Section */}
      <div className="craft-surface overflow-hidden">
         <div className="p-4 border-b border-[#e9e9e7] flex items-center justify-between bg-gray-50">
           <div className="flex items-center gap-2 font-medium text-[#3f2f4d]">
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
          <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-[94vw] overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
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

                 if (allEvents.length === 0) return <p className="text-gray-400 text-center italic py-4">{t('dashboard.noEventsForDay')}</p>;

                 return (
                   <div className="space-y-3">
                     {allEvents.map((e, i) => (
                       <div key={i} onClick={() => { navigate('case', e.caseId, e.type === 'Deadline' ? 'deadlines' : 'schedule'); setSelectedDate(null); }} className="p-3 rounded border border-gray-100 hover:bg-gray-50 cursor-pointer">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${e.type === 'Deadline' ? 'bg-[#f2e4e9] text-[#7a4f69]' : 'bg-[#efe6f5] text-[#6b5a8b]'}`}>{e.type}</span>
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
