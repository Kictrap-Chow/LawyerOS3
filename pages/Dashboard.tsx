import React, { useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { nowISO } from '../utils';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Crown, Flame, MoreHorizontal, Search, Timer } from 'lucide-react';

interface DayEvent {
  title: string;
  type: 'deadline' | 'reminder';
  caseId: string;
  caseName: string;
  time?: string;
}

export const Dashboard: React.FC = () => {
  const { cases, navigate } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeCases = useMemo(() => cases.filter((c) => c.status !== 'archived'), [cases]);
  const todayStr = nowISO().split('T')[0];

  const allTasks = useMemo(
    () => activeCases.flatMap((c) => (c.tasks || []).map((task) => ({ ...task, caseId: c.id, caseName: c.name }))),
    [activeCases]
  );

  const pendingTasks = useMemo(() => allTasks.filter((t) => !t.isCompleted), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter((t) => t.isCompleted), [allTasks]);

  const todaySeconds = useMemo(() => {
    const dayStart = new Date(`${todayStr}T00:00:00`).getTime();
    const dayEnd = new Date(`${todayStr}T23:59:59`).getTime();

    return allTasks.reduce((sum, task) => {
      const sessionSeconds = (task.sessions || []).reduce((acc, s) => {
        const start = new Date(s.start).getTime();
        const end = s.end ? new Date(s.end).getTime() : Date.now();
        const overlapStart = Math.max(start, dayStart);
        const overlapEnd = Math.min(end, dayEnd);
        if (Number.isNaN(overlapStart) || Number.isNaN(overlapEnd) || overlapEnd <= overlapStart) return acc;
        return acc + Math.floor((overlapEnd - overlapStart) / 1000);
      }, 0);
      return sum + sessionSeconds;
    }, 0);
  }, [allTasks, todayStr]);

  const totalSeconds = useMemo(
    () =>
      allTasks.reduce((sum, task) => {
        const sessionSeconds = (task.sessions || []).reduce((acc, s) => {
          const start = new Date(s.start).getTime();
          const end = s.end ? new Date(s.end).getTime() : Date.now();
          if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return acc;
          return acc + Math.floor((end - start) / 1000);
        }, 0);
        return sum + sessionSeconds;
      }, 0),
    [allTasks]
  );

  const workout = useMemo(() => {
    const hoursToday = todaySeconds / 3600;
    const hoursTotal = totalSeconds / 3600;
    const intake = Math.round(1600 + activeCases.length * 120 + Math.min(hoursTotal * 40, 450));
    const burned = Math.round(420 + Math.min(hoursToday * 260, 980));
    return {
      intake,
      burned,
      activityHours: Math.max(0.1, hoursToday),
    };
  }, [todaySeconds, totalSeconds, activeCases.length]);

  const eventMap = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};
    activeCases.forEach((c) => {
      (c.deadlines || []).forEach((d) => {
        if (d.completed) return;
        map[d.date] = map[d.date] || [];
        map[d.date].push({ title: d.title, type: 'deadline', caseId: c.id, caseName: c.name });
      });
      (c.reminders || []).forEach((r) => {
        map[r.date] = map[r.date] || [];
        map[r.date].push({ title: r.title, type: 'reminder', caseId: c.id, caseName: c.name, time: r.time });
      });
    });
    return map;
  }, [activeCases]);

  const calendarCells = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells: Array<{ day: number; date: string } | null> = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const habits = useMemo(() => {
    return pendingTasks.slice(0, 4).map((task, idx) => {
      const sessionsCompleted = Math.min((task.sessions || []).length, 12);
      const sessionGoal = 12;
      return {
        id: task.id,
        title: task.desc,
        subtitle: task.caseName,
        completed: sessionsCompleted,
        goal: sessionGoal,
        tint: ['#ef7d61', '#ef9761', '#efa961', '#ef6f61'][idx % 4],
        caseId: task.caseId,
      };
    });
  }, [pendingTasks]);

  const stepsGoal = 8500;
  const stepsToday = Math.min(12000, Math.round(todaySeconds / 2.4));
  const stepsProgress = Math.min(100, Math.round((stepsToday / stepsGoal) * 100));

  const completion = Math.round(
    allTasks.length === 0 ? 0 : (completedTasks.length / allTasks.length) * 100
  );

  const weightNow = 58 - completion * 0.05;
  const weightTarget = 50;
  const weightStart = 58;
  const weightProgress = Math.min(100, Math.max(0, ((weightStart - weightNow) / (weightStart - weightTarget)) * 100));

  const selectedEvents = selectedDate ? eventMap[selectedDate] || [] : [];

  return (
    <div className="max-w-[1300px] mx-auto p-2 md:p-4 pb-24 md:pb-4 animate-fade-in">
      <div className="craft-surface rounded-[34px] p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-[#1d2b3f]">Hi, Counsel!</div>
            <div className="text-sm text-[#6d7f94] mt-1">今天继续推进案件节奏与执行效率</div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="h-11 min-w-0 flex-1 md:w-[300px] rounded-full bg-white/90 border border-white px-4 flex items-center gap-2 text-sm text-[#8395aa]">
              <Search size={16} />
              <span className="truncate">Search case, party or task</span>
            </div>
            <button className="h-11 px-6 rounded-full bg-[#1f293b] text-white text-sm font-medium inline-flex items-center gap-2">
              <Crown size={15} /> Upgrade
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.9fr] gap-4">
          <div className="rounded-[30px] bg-[#d6d0c4] p-5 md:p-6 relative overflow-hidden min-h-[320px]">
            <div className="text-[30px] leading-none absolute -top-3 -right-2 opacity-10">●●●</div>
            <h3 className="text-[28px] md:text-[30px] font-semibold text-[#23282f] leading-tight">Your Workout Results for Today</h3>
            <p className="text-sm text-[#4f5b69] mt-1">来自案件处理与任务推进的活跃度映射</p>

            <div className="relative h-[220px] mt-3">
              <div className="anim-float-a absolute left-[50%] top-[58%] -translate-x-1/2 -translate-y-1/2 w-[248px] h-[248px] rounded-full bg-[#f6d85f]/95 blur-[0.2px] border border-white/50 shadow-[0_20px_40px_rgba(177,144,52,0.28)] flex items-center justify-center">
                <div className="text-center text-[#2f2f2f]">
                  <div className="text-3xl font-bold">{workout.intake}</div>
                  <div className="text-xs tracking-wide">kcal intake</div>
                </div>
              </div>
              <div className="anim-float-b absolute left-[38%] top-[76%] -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] rounded-full bg-[#ff8a78]/90 border border-white/50 shadow-[0_12px_30px_rgba(208,87,67,0.35)] flex items-center justify-center">
                <div className="text-center text-[#312c2a]">
                  <div className="text-2xl font-bold">{workout.burned}</div>
                  <div className="text-xs">kcal burned</div>
                </div>
              </div>
              <div className="anim-float-c absolute left-[38%] top-[30%] -translate-x-1/2 -translate-y-1/2 w-[110px] h-[110px] rounded-full bg-[#1e2d33]/90 border border-white/30 shadow-[0_10px_26px_rgba(24,31,36,0.42)] flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-2xl font-bold">{workout.activityHours.toFixed(1)}</div>
                  <div className="text-xs">hours</div>
                </div>
              </div>

              <div className="absolute left-0 bottom-1 space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-[#3b4350]"><span className="inline-block w-9 h-2.5 rounded-full bg-[#f6d85f]" /> Calories intake</div>
                <div className="flex items-center gap-2 text-[#3b4350]"><span className="inline-block w-9 h-2.5 rounded-full bg-[#ff8a78]" /> Calories burned</div>
                <div className="flex items-center gap-2 text-[#3b4350]"><span className="inline-block w-9 h-2.5 rounded-full bg-[#1e2d33]" /> Activity time</div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] bg-[#1e2432] text-white p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-semibold">Your Training Days</h3>
                <p className="text-xs text-[#9ba8bc] mt-0.5">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] text-[#8191a8] mb-2">
              <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`e-${idx}`} className="h-9" />;
                const events = eventMap[cell.date] || [];
                const isToday = cell.date === todayStr;
                const hasDeadline = events.some((e) => e.type === 'deadline');
                const hasReminder = events.some((e) => e.type === 'reminder');
                return (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    className={`h-9 w-9 mx-auto rounded-full text-sm transition-all ${isToday ? 'bg-[#f6d85f] text-[#111827] font-semibold' : hasDeadline ? 'bg-[#2f3849] text-white' : hasReminder ? 'bg-[#222b39] text-[#c6d2e5]' : 'text-[#c7d1df] hover:bg-white/10'}`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-[#9aa8bc]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f6d85f]" />Current day</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2f3849]" />Deadline</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#222b39]" />Scheduled</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.55fr] gap-4 mt-4">
          <div className="space-y-4">
            <div className="rounded-[28px] bg-[#f6f7f8] border border-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-2xl font-semibold text-[#252d3a]">Steps for Today</h4>
                  <p className="text-sm text-[#73869b]">Keep your body toned</p>
                </div>
                <div className="relative h-[92px] w-[92px] rounded-full grid place-items-center" style={{ background: `conic-gradient(#ef7a60 ${stepsProgress * 3.6}deg, #e5e7eb 0deg)` }}>
                  <div className="h-[78px] w-[78px] rounded-full bg-[#f6f7f8] grid place-items-center text-center">
                    <div className="text-[11px] text-[#8ea0b5]">Goal</div>
                    <div className="text-lg font-semibold text-[#243142]">{stepsGoal.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="text-[#516378]">Current: <span className="font-semibold">{stepsToday.toLocaleString()}</span></div>
                <button className="h-8 w-8 rounded-full bg-[#1f293b] text-white grid place-items-center"><ArrowUpRight size={14} /></button>
              </div>
            </div>

            <div className="rounded-[28px] bg-[#f6f7f8] border border-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-2xl font-semibold text-[#252d3a]">Weight Loss Plan</h4>
                  <p className="text-sm text-[#73869b]">{completion}% completed</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#73869b]">Now</div>
                  <div className="text-xl font-semibold text-[#27384f]">{weightNow.toFixed(1)} kg</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-3 rounded-full bg-[#dfdfdf] overflow-hidden">
                  <div className="h-full rounded-full bg-[#1f293b]" style={{ width: `${weightProgress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-[#61748a]">
                  <span>{weightStart} kg</span>
                  <span>{weightTarget} kg</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-[#f6f7f8] border border-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-2xl font-semibold text-[#252d3a]">My Habits</h4>
              <button className="h-9 px-4 rounded-full bg-white text-[#263346] border border-[#dce4ed] inline-flex items-center gap-1.5 text-sm font-medium">
                Add New <span className="h-5 w-5 rounded-full bg-[#1f293b] text-white grid place-items-center">+</span>
              </button>
            </div>
            <div className="space-y-2.5">
              {habits.length === 0 && <div className="text-sm text-[#8da0b5] p-3">暂无待执行任务。</div>}
              {habits.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate('case', item.caseId, 'tasks')}
                  className="w-full rounded-2xl bg-white/80 border border-[#e4e8ee] p-3 text-left flex items-center gap-3 hover:bg-white hover:translate-y-[-1px] transition-all"
                >
                  <div className="h-10 w-10 rounded-full bg-[#d6d0c4] grid place-items-center text-[#253142]">
                    <Flame size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#27384f] truncate">{item.title}</div>
                    <div className="text-xs text-[#8193a7] truncate">{item.subtitle}</div>
                  </div>
                  <div className="hidden md:block text-xs text-[#6f8298]">Sessions: <span className="font-semibold">{item.completed}/{item.goal}</span></div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span key={`${item.id}-${i}`} className="h-2.5 w-1.5 rounded-full" style={{ backgroundColor: i < Math.round((item.completed / item.goal) * 10) ? item.tint : '#d8dbe0' }} />
                    ))}
                  </div>
                  <MoreHorizontal size={16} className="text-[#9eaab8]" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] bg-[#f7f8f9] border border-white p-4 flex flex-wrap items-center gap-3 text-sm text-[#5e738a]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0]"><Clock3 size={14} /> Today: {(todaySeconds / 3600).toFixed(1)}h</div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0]"><Timer size={14} /> Total: {(totalSeconds / 3600).toFixed(1)}h</div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0]"><CalendarDays size={14} /> Active Cases: {activeCases.length}</div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0]">Pending Tasks: {pendingTasks.length}</div>
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center" onClick={() => setSelectedDate(null)}>
          <div className="w-[480px] max-w-[92vw] rounded-2xl craft-panel p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-[#213246]">{selectedDate}</div>
              <button onClick={() => setSelectedDate(null)} className="h-8 w-8 rounded-full hover:bg-white/80">×</button>
            </div>
            <div className="mt-3 space-y-2 max-h-[55vh] overflow-y-auto">
              {selectedEvents.length === 0 && <div className="text-sm text-[#7f92a7] p-2">当天暂无事件</div>}
              {selectedEvents.map((ev, idx) => (
                <button
                  key={`${ev.caseId}-${idx}`}
                  onClick={() => {
                    navigate('case', ev.caseId, ev.type === 'deadline' ? 'deadlines' : 'schedule');
                    setSelectedDate(null);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-white/80 border border-[#e5eaf1]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${ev.type === 'deadline' ? 'bg-[#ffe1dc] text-[#9b4538]' : 'bg-[#dde8ff] text-[#2c579c]'}`}>
                      {ev.type === 'deadline' ? 'Deadline' : 'Reminder'}
                    </span>
                    {ev.time && <span className="text-xs text-[#789]">{ev.time}</span>}
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#25384d]">{ev.title}</div>
                  <div className="text-xs text-[#7f91a6]">{ev.caseName}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
