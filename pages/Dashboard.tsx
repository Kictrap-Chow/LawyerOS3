import React, { useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { nowISO, uuid } from '../utils';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Search } from 'lucide-react';
import { ActionReminder, Reminder, Task } from '../types';

type QuickCreateType = 'task' | 'reminder' | 'schedule' | 'log';

interface CalendarEvent {
  title: string;
  type: 'deadline' | 'reminder';
  caseId: string;
  caseName: string;
  time?: string;
}

export const Dashboard: React.FC = () => {
  const { cases, navigate, updateCase } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickType, setQuickType] = useState<QuickCreateType>('task');
  const [quickCaseId, setQuickCaseId] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDate, setQuickDate] = useState(() => nowISO().slice(0, 10));
  const [quickTime, setQuickTime] = useState('09:00');
  const [panelMode, setPanelMode] = useState<'reminder' | 'schedule' | 'task' | 'deadline'>('reminder');

  const todayStr = nowISO().split('T')[0];
  const activeCases = useMemo(() => cases.filter((c) => c.status !== 'archived'), [cases]);

  const pendingTasks = useMemo(
    () =>
      activeCases
        .flatMap((c) => (c.tasks || []).map((task) => ({ ...task, caseId: c.id, caseName: c.name })))
        .filter((t) => !t.isCompleted),
    [activeCases]
  );

  const reminders = useMemo(
    () =>
      activeCases
        .flatMap((c) => (c.reminders || []).map((r) => ({ ...r, caseId: c.id, caseName: c.name })))
        .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()),
    [activeCases]
  );

  const actionReminders = useMemo(
    () =>
      activeCases
        .flatMap((c) => (c.actionReminders || []).map((r) => ({ ...r, caseId: c.id, caseName: c.name })))
        .filter((x) => !x.completed)
        .sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }),
    [activeCases]
  );
  const deadlineItems = useMemo(
    () =>
      activeCases
        .flatMap((c) => (c.deadlines || []).map((d) => ({ ...d, caseId: c.id, caseName: c.name })))
        .filter((x) => !x.completed)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [activeCases]
  );

  const calendarMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
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

  const selectedEvents = selectedDate ? calendarMap[selectedDate] || [] : [];

  const scheduleItems = reminders.filter((x) => x.date >= todayStr);
  const activeItems =
    panelMode === 'task'
      ? pendingTasks
      : panelMode === 'reminder'
        ? actionReminders
        : panelMode === 'schedule'
          ? scheduleItems
          : deadlineItems;

  const openQuickCreate = () => {
    if (activeCases.length === 0) {
      alert('请先新建案件');
      return;
    }
    setQuickCaseId((prev) => prev || activeCases[0].id);
    setQuickType('task');
    setQuickTitle('');
    setQuickDate(todayStr);
    setQuickTime('09:00');
    setShowQuickCreate(true);
  };

  const submitQuickCreate = () => {
    const target = activeCases.find((c) => c.id === quickCaseId);
    if (!target) {
      alert('请选择案件');
      return;
    }
    if (!quickTitle.trim()) {
      alert('请填写内容');
      return;
    }

    if (quickType === 'task') {
      const task: Task = {
        id: uuid(),
        type: '文书',
        desc: quickTitle.trim(),
        assignee: '',
        notes: '',
        createdAt: nowISO(),
        completedAt: null,
        sessions: [],
        isRunning: false,
        isCompleted: false,
      };
      updateCase({ ...target, tasks: [task, ...(target.tasks || [])] });
      navigate('case', target.id, 'tasks');
    }

    if (quickType === 'reminder') {
      const reminder: ActionReminder = {
        id: uuid(),
        title: quickTitle.trim(),
        note: '',
        dueDate: quickDate,
        completed: false,
      };
      updateCase({ ...target, actionReminders: [reminder, ...(target.actionReminders || [])] });
      navigate('case', target.id, 'reminders');
    }

    if (quickType === 'schedule') {
      const schedule: Reminder = {
        id: uuid(),
        title: quickTitle.trim(),
        date: quickDate,
        time: quickTime || '09:00',
      };
      updateCase({ ...target, reminders: [schedule, ...(target.reminders || [])] });
      navigate('case', target.id, 'schedule');
    }

    if (quickType === 'log') {
      const log = {
        id: uuid(),
        date: nowISO(),
        content: quickTitle.trim(),
      };
      updateCase({ ...target, logs: [log, ...(target.logs || [])] });
      navigate('case', target.id, 'logs');
    }

    setShowQuickCreate(false);
  };

  return (
    <div className="max-w-[1300px] mx-auto p-2 md:p-4 pb-24 md:pb-4 animate-fade-in">
      <style>{`
        @keyframes listRise {
          0% { opacity: 0; transform: translateY(14px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="rounded-[30px] p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[30px] leading-tight font-semibold text-[var(--ui-text-strong)]">🗂️ 今日案件看板</div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => window.dispatchEvent(new Event('lawyer:open-search'))}
              className="h-12 min-w-0 flex-1 md:w-[320px] rounded-[18px] bg-white/86 border border-[var(--ui-line)] px-4 flex items-center gap-2 text-sm text-[var(--ui-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
            >
              <Search size={16} />
              <span className="truncate">搜索案件、当事人或任务</span>
            </button>
            <button
              onClick={openQuickCreate}
              className="h-12 px-5 rounded-[18px] text-white text-sm font-medium inline-flex items-center gap-1.5 accent-gradient-bg shadow-[0_10px_24px_rgba(93,67,41,0.24)]"
            >
              <Plus size={15} /> 新建工作
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.35fr] gap-4">
          <div className="rounded-[28px] text-white p-5 bg-[linear-gradient(160deg,#2f2a24_0%,#2f2721_52%,#352d26_100%)] border border-[rgba(214,189,160,0.34)] shadow-[0_18px_36px_rgba(68,50,33,0.35)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-2xl font-semibold">🗓️ 日程日历</h3>
                <p className="text-xs text-[#b7a898] mt-0.5">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="h-8 w-8 rounded-full bg-white/12 hover:bg-white/22 grid place-items-center"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="h-8 w-8 rounded-full bg-white/12 hover:bg-white/22 grid place-items-center"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] text-[#af9e8b] mb-2">
              <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`pad-${idx}`} className="h-9" />;
                const events = calendarMap[cell.date] || [];
                const isToday = cell.date === todayStr;
                const hasDeadline = events.some((e) => e.type === 'deadline');
                const hasReminder = events.some((e) => e.type === 'reminder');
                return (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    className={`h-9 w-9 mx-auto rounded-full text-sm transition-all ${isToday ? 'bg-[#f2d668] text-[#4c3717] font-semibold' : hasDeadline ? 'bg-[#bb6a5a] text-white ring-1 ring-[#e8b3a8]' : hasReminder ? 'bg-[#8b532f] text-[#fff2e8] ring-1 ring-[#cc9169]' : 'text-[#d6c9b8] hover:bg-white/10'}`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-[#b7a898]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f2d668]" />今天</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#bb6a5a]" />截止节点</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#8b532f]" />日程提醒</div>
            </div>
          </div>

          <div className="rounded-[24px] bg-[var(--ui-card)] p-4 min-h-[520px]">
            <div className="rounded-[24px] bg-[linear-gradient(145deg,rgba(255,247,236,0.66)_0%,rgba(238,224,204,0.74)_45%,rgba(230,214,192,0.78)_100%)] p-3 md:p-4 min-h-[460px]">
              <div className="text-xs text-[var(--ui-muted)] mb-3">✨ 标签切换</div>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setPanelMode('reminder')}
                  className={`h-10 px-4 rounded-[14px] border transition-colors ${panelMode === 'reminder' ? 'bg-[#f3d468] border-[#ddbd4b] text-[#5b4518]' : 'bg-white/74 border-[rgba(214,189,160,0.54)] text-[var(--ui-muted)]'}`}
                >
                  提醒 {actionReminders.length}
                </button>
                <button
                  onClick={() => setPanelMode('schedule')}
                  className={`h-10 px-4 rounded-[14px] border transition-colors ${panelMode === 'schedule' ? 'bg-[#e99f8f] border-[#d78477] text-[#6f332c]' : 'bg-white/74 border-[rgba(214,189,160,0.54)] text-[var(--ui-muted)]'}`}
                >
                  日程 {scheduleItems.length}
                </button>
                <button
                  onClick={() => setPanelMode('task')}
                  className={`h-10 px-4 rounded-[14px] border transition-colors ${panelMode === 'task' ? 'bg-[#4f5d60] border-[#455558] text-[#edf5f8]' : 'bg-white/74 border-[rgba(214,189,160,0.54)] text-[var(--ui-muted)]'}`}
                >
                  任务 {pendingTasks.length}
                </button>
                <button
                  onClick={() => setPanelMode('deadline')}
                  className={`h-10 px-4 rounded-[14px] border transition-colors ${panelMode === 'deadline' ? 'bg-[#8b532f] border-[#7a4523] text-[#fff2e8]' : 'bg-white/74 border-[rgba(214,189,160,0.54)] text-[var(--ui-muted)]'}`}
                >
                  期限 {deadlineItems.length}
                </button>
              </div>

              <div
                key={panelMode}
                className="rounded-[20px] bg-[rgba(255,250,243,0.78)] border border-[rgba(214,189,160,0.62)] p-3 shadow-[0_16px_34px_rgba(93,67,41,0.14)] backdrop-blur-[1px] overflow-y-auto max-h-[360px]"
                style={{ animation: 'listRise 420ms cubic-bezier(0.2, 0.75, 0.3, 1)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[var(--ui-text-strong)]">
                    {panelMode === 'reminder' ? '提醒' : panelMode === 'schedule' ? '日程' : panelMode === 'task' ? '任务' : '期限'}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--ui-accent-soft)] text-[var(--ui-tint-text)] border border-[var(--ui-tint-border)]">{activeItems.length} 条</span>
                </div>
                <div className="space-y-2">
                  {panelMode === 'task' && pendingTasks.map((item) => (
                    <button key={item.id} onClick={() => navigate('case', item.caseId, 'tasks')} className="w-full text-left p-2.5 rounded-[14px] bg-white/88 border border-[rgba(214,189,160,0.54)] hover:bg-white">
                      <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate">{item.desc}</div>
                      <div className="text-xs text-[var(--ui-muted)] truncate">{item.caseName}</div>
                    </button>
                  ))}
                  {panelMode === 'reminder' && actionReminders.map((item) => (
                    <button key={item.id} onClick={() => navigate('case', item.caseId, 'reminders')} className="w-full text-left p-2.5 rounded-[14px] bg-white/88 border border-[rgba(223,193,111,0.62)] hover:bg-[#fffdf7]">
                      <div className="text-sm font-medium text-[#7c5a1f] truncate">{item.title}</div>
                      <div className="text-xs text-[#90764a] truncate">{item.caseName}{item.dueDate ? ` · 截止 ${item.dueDate}` : ''}</div>
                    </button>
                  ))}
                  {panelMode === 'schedule' && scheduleItems.map((item) => (
                    <button key={item.id} onClick={() => navigate('case', item.caseId, 'schedule')} className="w-full text-left p-2.5 rounded-[14px] bg-white/88 border border-[rgba(222,150,136,0.55)] hover:bg-[#fff9f8]">
                      <div className="text-sm font-medium text-[#8f4339] truncate">{item.title}</div>
                      <div className="text-xs text-[#9b6a66] truncate">{item.date} {item.time} · {item.caseName}</div>
                    </button>
                  ))}
                  {panelMode === 'deadline' && deadlineItems.map((item) => (
                    <button key={item.id} onClick={() => navigate('case', item.caseId, 'deadlines')} className="w-full text-left p-2.5 rounded-[14px] bg-white/88 border border-[rgba(139,83,47,0.42)] hover:bg-[#fffbf7]">
                      <div className="text-sm font-medium text-[#7a4523] truncate">{item.title}</div>
                      <div className="text-xs text-[#8a6347] truncate">到期 {item.date} · {item.caseName}</div>
                    </button>
                  ))}
                  {activeItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无相关事项。</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[20px] bg-[rgba(255,250,243,0.68)] border border-[var(--ui-line)] p-3 flex flex-wrap gap-2 text-xs text-[var(--ui-muted)]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/86 border border-[rgba(214,189,160,0.56)]"><CalendarDays size={13} /> 今日 {todayStr}</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/86 border border-[rgba(214,189,160,0.56)]"><AlertCircle size={13} /> 提醒 {actionReminders.length}</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/86 border border-[rgba(214,189,160,0.56)]"><Clock3 size={13} /> 日程 {reminders.length}</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/86 border border-[rgba(214,189,160,0.56)]"><AlertCircle size={13} /> 任务 {pendingTasks.length}</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/86 border border-[rgba(214,189,160,0.56)]"><AlertCircle size={13} /> 期限 {deadlineItems.length}</span>
        </div>
      </div>

      {showQuickCreate && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowQuickCreate(false)}>
          <div className="w-[580px] max-w-[92vw] rounded-[26px] craft-panel p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold text-[#1f2c3e] mb-3">新建工作</div>
            <div className="space-y-3">
              <select className="w-full h-12 px-4 rounded-[14px] bg-white border border-[#d7e2ef] outline-none" value={quickCaseId} onChange={(e) => setQuickCaseId(e.target.value)}>
                {activeCases.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <select className="w-full h-12 px-4 rounded-[14px] bg-white border border-[#d7e2ef] outline-none" value={quickType} onChange={(e) => setQuickType(e.target.value as QuickCreateType)}>
                <option value="task">新建任务</option>
                <option value="reminder">新建提醒事项</option>
                <option value="schedule">新建日程</option>
                <option value="log">新建日志</option>
              </select>
              <input className="w-full h-12 px-4 rounded-[14px] bg-white border border-[#d7e2ef] outline-none" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder={quickType === 'log' ? '日志内容' : '标题/内容'} />
              {(quickType === 'reminder' || quickType === 'schedule') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="date" className="w-full h-12 px-4 rounded-[14px] bg-white border border-[#d7e2ef] outline-none" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
                  {quickType === 'schedule' ? (
                    <input type="time" className="w-full h-12 px-4 rounded-[14px] bg-white border border-[#d7e2ef] outline-none" value={quickTime} onChange={(e) => setQuickTime(e.target.value)} />
                  ) : (
                    <div className="h-12 rounded-[14px] bg-[#f8fafc] border border-[#d7e2ef] flex items-center px-4 text-sm text-[#7b8ea4]">提醒事项默认不含时分</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowQuickCreate(false)} className="px-4 py-2 rounded-[12px] border border-[#d7e2ef] bg-white text-[#304861]">取消</button>
              <button onClick={submitQuickCreate} className="px-4 py-2 rounded-[12px] bg-[#1f293b] text-white">创建</button>
            </div>
          </div>
        </div>
      )}

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
                      {ev.type === 'deadline' ? '截止节点' : '日程提醒'}
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
