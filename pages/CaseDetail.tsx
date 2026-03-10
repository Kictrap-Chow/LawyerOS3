import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { useI18n } from '../store/I18nContext';
import { Case, Task, Log, Reminder, Deadline, Party, Proceeding, PropertyPreservation, ActionReminder } from '../types';
import { calculateTaskDuration, formatTimeDuration, nowISO, uuid, formatDateTime } from '../utils';
import { 
  Play, Pause, CheckCircle, RotateCcw, Plus, Trash2, Calendar, 
  FileText, Clock, AlertTriangle, MessageSquare, ChevronDown, Scale, Edit2, List
} from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const labels = {
    active: '进行中',
    dormant: '休眠',
    archived: '已归档'
  };
  const colors = {
    active: 'tint-bg tint-text tint-border',
    dormant: 'tint-bg tint-text tint-border',
    archived: 'tint-bg tint-text tint-border'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs border ${colors[status as keyof typeof colors] || colors.active} font-semibold`}>
      {labels[status as keyof typeof labels] || labels.active}
    </span>
  );
};

// --- Sub Components ---

const PartySelector = ({ 
  parties, 
  onSelect, 
  onCancel 
}: { 
  parties: Party[], 
  onSelect: (p: Party) => void, 
  onCancel: () => void 
}) => {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();
  const filtered = parties.filter(p => 
    (p.name || '').toLowerCase().includes(q) || 
    (p.idCode || '').toLowerCase().includes(q) ||
    (p.address || '').toLowerCase().includes(q) ||
    (p.note || '').toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-[95vw] max-h-[80vh] overflow-y-auto p-4 animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Select or Create Party</h3>
        <input 
          className="w-full border border-gray-300 rounded p-2 mb-4 text-sm outline-none focus:border-[var(--ui-accent)]"
          placeholder="Search parties..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded mb-4">
          {filtered.map(p => (
            <div 
              key={p.id} 
              className="p-2 hover:tint-bg cursor-pointer text-sm border-b border-gray-50 last:border-0"
              onClick={() => onSelect(p)}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-400">{p.type} • {p.idCode || 'No ID'}</div>
            </div>
          ))}
          {filtered.length === 0 && <div className="p-4 text-center text-gray-400 text-xs">No parties found.</div>}
        </div>
        <div className="flex justify-end gap-2">
           <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
           <button onClick={() => onSelect({ id: uuid(), name: search, type: 'company', idCode: '', address: '' })} className="px-3 py-1.5 text-sm accent-bg accent-bg-hover text-white rounded">Create "{search}"</button>
        </div>
      </div>
    </div>
  );
};

interface TaskItemProps {
  task: Task;
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete }) => {
  const { t } = useI18n();
  const [duration, setDuration] = useState(calculateTaskDuration(task));
  const [showManualInput, setShowManualInput] = useState(false);
  // Manual entry state
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => {
    let interval: any;
    if (task.isRunning) {
      interval = setInterval(() => {
        setDuration(calculateTaskDuration(task));
      }, 1000);
    } else {
      setDuration(calculateTaskDuration(task));
    }
    return () => clearInterval(interval);
  }, [task.isRunning, task.sessions, task.manualTime]);

  useEffect(() => {
    if (showManualInput) {
      const now = new Date();
      const format = (d: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setManualStart(format(now));
      setManualEnd(format(new Date(now.getTime() + 3600000))); // Default 1 hour later
    }
  }, [showManualInput]);

  const toggleTimer = () => {
    const updated = { ...task };
    if (task.isRunning) {
      updated.isRunning = false;
      const lastSession = updated.sessions[updated.sessions.length - 1];
      if (lastSession && !lastSession.end) lastSession.end = nowISO();
    } else {
      updated.isRunning = true;
      updated.sessions.push({ start: nowISO(), end: null });
    }
    onUpdate(updated);
  };

  const handleManualSubmit = () => {
    if (!manualStart || !manualEnd) return;
    
    const start = new Date(manualStart);
    const end = new Date(manualEnd);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert("Invalid date/time");
      return;
    }
    
    if (end <= start) {
      alert("End time must be after start time");
      return;
    }
    
    const newSession = {
      start: start.toISOString(),
      end: end.toISOString()
    };
    
    onUpdate({
      ...task,
      sessions: [...(task.sessions || []), newSession]
    });
    
    setShowManualInput(false);
    setManualStart('');
    setManualEnd('');
  };

  const completeTask = () => {
    const updated = { ...task };
    if (updated.isRunning) {
      updated.isRunning = false;
      updated.sessions[updated.sessions.length - 1].end = nowISO();
    }
    updated.isCompleted = true;
    updated.completedAt = nowISO();
    onUpdate(updated);
  };

  const isoToLocalInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const localInputToIso = (val: string) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
  };
  const updateSessionField = (idx: number, field: 'start' | 'end', value: string) => {
    const updated = { ...task };
    const next = [...updated.sessions];
    const iso = localInputToIso(value);
    next[idx] = { ...next[idx], [field]: iso || null } as any;
    updated.sessions = next;
    onUpdate(updated);
  };
  const endSessionNow = (idx: number) => {
    const updated = { ...task };
    const next = [...updated.sessions];
    next[idx] = { ...next[idx], end: nowISO() } as any;
    updated.sessions = next;
    updated.isRunning = false;
    onUpdate(updated);
  };
  const deleteSession = (idx: number) => {
    const updated = { ...task };
    updated.sessions = (updated.sessions || []).filter((_, i) => i !== idx);
    onUpdate(updated);
  };

  return (
    <div className={`group flex flex-col sm:flex-row gap-3 p-3 mb-2 rounded border transition-all max-w-full min-w-0 ${task.isRunning ? 'tint-bg border tint-border shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          {task.isCompleted && <CheckCircle size={16} className="tint-text" />}
          <input 
            className={`font-medium text-sm bg-transparent outline-none w-full ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}
            value={task.desc}
            onChange={(e) => onUpdate({ ...task, desc: e.target.value })}
            placeholder={t('tasks.taskDescription')}
            disabled={task.isCompleted}
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs min-w-0">
          <select 
            className="bg-gray-100 rounded px-2 py-1 outline-none shrink-0"
            value={task.type}
            onChange={(e) => onUpdate({...task, type: e.target.value as any})}
            disabled={task.isCompleted}
          >
            <option>文书</option><option>会议</option><option>咨询</option><option>其他</option>
          </select>
          <input 
            className="bg-transparent text-gray-500 outline-none flex-1 min-w-[120px]" 
            placeholder={t('tasks.assignee')}
            value={task.assignee}
            onChange={(e) => onUpdate({...task, assignee: e.target.value})}
          />
        </div>
        <textarea 
           className="w-full text-xs text-gray-500 bg-transparent outline-none resize-none h-auto overflow-hidden placeholder-gray-300" 
           placeholder={t('tasks.notes')}
           rows={1}
           value={task.notes}
           onChange={(e) => onUpdate({...task, notes: e.target.value})}
        />
      </div>

      <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 min-w-[120px]">
        {task.isCompleted ? (
           <div className="text-center">
             <div className="text-xs font-bold tint-text">{t('tasks.done')}</div>
             <button onClick={() => onUpdate({...task, isCompleted: false})} className="text-[10px] underline text-gray-400 hover:tint-text flex items-center gap-1 mt-1">
               <RotateCcw size={10} /> {t('tasks.reopen')}
             </button>
           </div>
        ) : (
          <>
            <div className="font-mono text-lg font-semibold tint-text cursor-help" title="Total duration">{formatTimeDuration(duration)}</div>
            <div className="flex gap-2 w-full items-center justify-center">
              <button 
                onClick={toggleTimer}
                className="flex-1 flex items-center justify-center h-10 sm:h-8 rounded text-white text-xs sm:text-[11px] transition-colors accent-bg accent-bg-hover min-w-[44px]"
              >
                {task.isRunning ? <Pause size={16} /> : <Play size={16} />}
              </button>
              
              <div className="relative">
                  <button 
                    onClick={() => setShowManualInput(!showManualInput)} 
                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded hover:tint-bg hover:tint-text transition-colors flex items-center justify-center ${showManualInput ? 'tint-bg tint-text' : 'bg-gray-100 text-gray-600'}`}
                    title="Add/Subtract Time"
                    type="button"
                  >
                    <Clock size={16} />
                  </button>
              </div>

              <button onClick={completeTask} className="h-10 w-10 sm:h-8 sm:w-8 rounded bg-gray-100 hover:tint-bg text-gray-600 hover:tint-text transition-colors flex items-center justify-center">
                <CheckCircle size={16} />
              </button>
              <button
                type="button"
                className={`h-10 w-10 sm:h-8 sm:w-8 rounded border transition-colors flex items-center justify-center ${showSessions ? 'tint-bg tint-text tint-border' : 'bg-white border-gray-200 text-gray-600 hover:tint-bg hover:tint-text'}`}
                onClick={() => setShowSessions(!showSessions)}
                title={t('tasks.sessions')}
              >
                <List size={16} />
              </button>
            </div>
          </>
        )}
         <button onClick={() => onDelete(task.id)} className="opacity-70 sm:opacity-0 group-hover:opacity-100 text-gray-400 hover:tint-text transition-all absolute top-2 right-2 sm:static h-8 w-8 flex items-center justify-center">
             <Trash2 size={14} />
        </button>
      </div>
      {showSessions && (
          <div className="mt-2 space-y-2 w-full">
            {(task.sessions || []).map((s, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border rounded p-2 bg-gray-50">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] text-gray-500 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 outline-none"
                    value={isoToLocalInput(s.start)}
                    onChange={(e) => updateSessionField(idx, 'start', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-[10px] text-gray-500 mb-1">End</label>
                  <input
                    type="datetime-local"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 outline-none"
                    value={isoToLocalInput(s.end)}
                    onChange={(e) => updateSessionField(idx, 'end', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 flex items-end gap-2">
                  {!s.end && (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded accent-bg accent-bg-hover text-white"
                      onClick={() => endSessionNow(idx)}
                    >{t('tasks.endNow')}</button>
                  )}
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded tint-bg tint-text border tint-border hover:tint-bg-strong"
                    onClick={() => deleteSession(idx)}
                  >Delete</button>
                </div>
              </div>
            ))}
            {(task.sessions || []).length === 0 && (
              <div className="text-xs text-gray-400">{t('tasks.noSessions')}</div>
            )}
          </div>
      )}
      {showManualInput && (
        <div className="fixed inset-0 z-[140] bg-black/20 backdrop-blur-[2px] flex items-center justify-center p-3" onClick={() => setShowManualInput(false)}>
          <div className="craft-surface w-[360px] max-w-[95vw] p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-bold tint-text mb-2">{t('tasks.manualSession')}</div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('tasks.startTime')}</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[var(--ui-accent)]"
                  value={manualStart}
                  onChange={e => setManualStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('tasks.endTime')}</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[var(--ui-accent)]"
                  value={manualEnd}
                  onChange={e => setManualEnd(e.target.value)}
                />
              </div>
              <button onClick={handleManualSubmit} className="w-full accent-bg accent-bg-hover text-white py-1 rounded text-xs mt-2">{t('tasks.addSession')}</button>
            </div>
            <div className="mt-2 text-[10px] text-gray-400 text-center cursor-pointer hover:text-gray-600 underline" onClick={() => setShowManualInput(false)}>{t('actions.cancel')}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoTab = ({ c, editing, onDraftUpdate, onCommitUpdate, allParties, viewMode = 'info' }: { c: Case, editing: boolean, onDraftUpdate: (c: Case) => void, onCommitUpdate: (c: Case) => void, allParties: Party[], viewMode?: 'info' | 'procedure' }) => {
  const [showPartySelector, setShowPartySelector] = useState<'client' | 'opponent' | null>(null);
  const { addParty, updateParty, parties } = useData();
  const { t } = useI18n();
  const showInfo = viewMode === 'info';
  const showProcedure = viewMode === 'procedure';
  const showSpecialProject = c.type === '专项法律服务' || c.type === '常年法律顾问';

  const handlePartyUpdate = (isClient: boolean, id: string, field: keyof Party, value: string) => {
    const list = isClient ? c.clients : c.opponents;
    const updatedList = list.map(p => p.id === id ? { ...p, [field]: value } : p);
    if (editing) {
      onDraftUpdate({ ...c, [isClient ? 'clients' : 'opponents']: updatedList });
      const globalExisting = parties.find(p => p.id === id);
      if (globalExisting) {
        updateParty({ ...globalExisting, [field]: value });
      } else {
        const newP = updatedList.find(p => p.id === id)!;
        addParty(newP);
      }
    }
  };

  const addPartyToCase = (isClient: boolean) => {
    setShowPartySelector(isClient ? 'client' : 'opponent');
  };

  const removeParty = (isClient: boolean, id: string) => {
    if (!editing) {
      alert('请先点击“编辑”后再进行删除');
      return;
    }
    onCommitUpdate({ ...c, [isClient ? 'clients' : 'opponents']: (isClient ? c.clients : c.opponents).filter(p => p.id !== id) });
  };

  const handleProcUpdate = (procId: string, field: keyof Proceeding, value: any) => {
    const updatedProcs = c.litigation.proceedings.map(p => p.id === procId ? { ...p, [field]: value } : p);
    if (editing) onDraftUpdate({ ...c, litigation: { ...c.litigation, proceedings: updatedProcs } });
  };
  
  const handleAddPerson = (procId: string) => {
     const proc = c.litigation.proceedings.find(p => p.id === procId);
     if(proc) {
        const newPerson = { id: uuid(), role: '法官', name: '', contact: '', note: '' };
        const updatedPersonnel = [...(proc.personnel || []), newPerson];
        handleProcUpdate(procId, 'personnel', updatedPersonnel);
     }
  };

  const handleUpdatePerson = (procId: string, pId: string, field: string, val: string) => {
      const proc = c.litigation.proceedings.find(p => p.id === procId);
      if(proc) {
          const updatedPersonnel = (proc.personnel || []).map((p: any) => p.id === pId ? {...p, [field]: val} : p);
          handleProcUpdate(procId, 'personnel', updatedPersonnel);
      }
  };

  const handleRemovePerson = (procId: string, pId: string) => {
      const proc = c.litigation.proceedings.find(p => p.id === procId);
      if(proc) {
          const updatedPersonnel = (proc.personnel || []).filter((p: any) => p.id !== pId);
          handleProcUpdate(procId, 'personnel', updatedPersonnel);
      }
  };

  const preservationDeadlineTitle = (item: PropertyPreservation) => {
    const suffix = item.caseNo?.trim() || item.courtName?.trim();
    return suffix ? `${t('preservation.deadlinePrefix')} - ${suffix}` : t('preservation.deadlinePrefix');
  };

  const syncPreservationDeadlines = (nextCase: Case): Case => {
    let deadlines = [...(nextCase.deadlines || [])];
    const propertyPreservations = (nextCase.litigation.propertyPreservations || []).map(item => ({ ...item }));

    const syncedPreservations = propertyPreservations.map((item) => {
      if (!item.deadlineDate) {
        if (item.deadlineId) {
          deadlines = deadlines.filter(d => d.id !== item.deadlineId);
        }
        return { ...item, deadlineId: undefined };
      }

      const title = preservationDeadlineTitle(item);
      if (item.deadlineId && deadlines.some(d => d.id === item.deadlineId)) {
        deadlines = deadlines.map(d => d.id === item.deadlineId ? { ...d, title, date: item.deadlineDate } : d);
        return item;
      }

      const newDeadlineId = uuid();
      deadlines = [...deadlines, { id: newDeadlineId, title, date: item.deadlineDate, completed: false }];
      return { ...item, deadlineId: newDeadlineId };
    });

    return {
      ...nextCase,
      deadlines,
      litigation: {
        ...nextCase.litigation,
        propertyPreservations: syncedPreservations
      }
    };
  };

  const handleAddPreservation = () => {
    if (!editing) return;
    const newItem: PropertyPreservation = {
      id: uuid(),
      caseNo: '',
      courtName: '',
      assetDetails: '',
      judgeName: '',
      judgeContact: '',
      deadlineDate: ''
    };
    const nextCase: Case = {
      ...c,
      litigation: {
        ...c.litigation,
        propertyPreservations: [...(c.litigation.propertyPreservations || []), newItem]
      }
    };
    onDraftUpdate(nextCase);
  };

  const handleUpdatePreservation = (id: string, field: keyof PropertyPreservation, value: string) => {
    if (!editing) return;
    const nextCase: Case = {
      ...c,
      litigation: {
        ...c.litigation,
        propertyPreservations: (c.litigation.propertyPreservations || []).map(item =>
          item.id === id ? { ...item, [field]: value } : item
        )
      }
    };
    onDraftUpdate(syncPreservationDeadlines(nextCase));
  };

  const handleRemovePreservation = (id: string) => {
    if (!editing) return;
    const target = (c.litigation.propertyPreservations || []).find(item => item.id === id);
    let deadlines = [...(c.deadlines || [])];
    if (target?.deadlineId) {
      deadlines = deadlines.filter(d => d.id !== target.deadlineId);
    }
    onDraftUpdate({
      ...c,
      deadlines,
      litigation: {
        ...c.litigation,
        propertyPreservations: (c.litigation.propertyPreservations || []).filter(item => item.id !== id)
      }
    });
  };

  return (
    <>
    {showPartySelector && (
        <PartySelector 
           parties={allParties}
           onSelect={(p) => {
              const field = showPartySelector === 'client' ? 'clients' : 'opponents';
              // Avoid duplicates
              if (!c[field].find(x => x.id === p.id)) {
                  // 立即将新增当事人加入案件，并同步到全局 Party
                  const updated = { ...c, [field]: [...c[field], p] } as Case;
                  onCommitUpdate(updated);
                  if (!parties.find(x => x.id === p.id)) addParty(p);
              }
              setShowPartySelector(null);
           }}
           onCancel={() => setShowPartySelector(null)}
        />
    )}
    <div className="grid grid-cols-1 gap-3 md:gap-4 animate-fade-in pb-12">
      {showInfo && (
      <div className="space-y-4 min-w-0">
        {/* Client Info */}
        <div className="craft-panel p-3 shadow-sm group">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold tint-text uppercase flex items-center gap-2"><MessageSquare size={14}/>{t('info.client')}</h3>
            <button onClick={() => addPartyToCase(true)} className="text-xs tint-text hover:underline">{t('info.addClient')}</button>
          </div>
          {c.clients.map(p => (
             <div key={p.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-50 last:border-0 relative min-w-0">
               <button disabled={!editing} onClick={() => removeParty(true, p.id)} className={`absolute right-0 top-0 ${editing ? 'text-gray-300 hover:tint-text' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>
               <div className="flex gap-2 mb-2 min-w-0 items-start">
                  <select 
                    className="text-lg bg-transparent outline-none cursor-pointer shrink-0"
                    value={p.type}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'type', e.target.value as any)}
                    disabled={!editing}
                  >
                    <option value="company">🏢</option>
                    <option value="individual">👤</option>
                  </select>
                  <input 
                    className="font-medium tint-text bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none w-full min-w-0 transition-colors"
                    placeholder={t('info.client')}
                    value={p.name}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'name', e.target.value)}
                    disabled={!editing}
                  />
               </div>
               <div className="grid grid-cols-1 gap-2 mb-2">
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-[#dfcfe8] min-w-0"
                    placeholder={t('info.idCode')}
                    value={p.idCode || ''}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'idCode', e.target.value)}
                    disabled={!editing}
                 />
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-[#dfcfe8] min-w-0"
                    placeholder={t('info.address')}
                    value={p.address || ''}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'address', e.target.value)}
                    disabled={!editing}
                 />
               </div>
               <input
                  className="w-full min-w-0 text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-[#dfcfe8]"
                  placeholder={t('info.remarks')}
                  value={p.note || ''}
                  onChange={(e) => handlePartyUpdate(true, p.id, 'note', e.target.value)}
                  disabled={!editing}
              />
             </div>
          ))}
          {c.clients.length === 0 && <div className="text-sm text-gray-400 italic py-2 text-center">{t('detail.noClients')}</div>}
          
          <div className="mt-4 pt-4 border-t border-[#e8dfeb] text-sm">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="min-w-0">
                  <label className="block text-xs tint-text mb-1">{t('info.contactPerson')}</label>
                  <input 
                    className="w-full min-w-0 tint-text border-b border-transparent hover:border-gray-200 focus:border-[var(--ui-accent)] outline-none bg-transparent"
                    placeholder={t('info.contactPerson')}
                    value={c.clientContactName || ''}
                    onChange={(e) => editing && onDraftUpdate({...c, clientContactName: e.target.value})}
                  />
               </div>
               <div className="min-w-0">
                  <label className="block text-xs tint-text mb-1">{t('info.contactInfo')}</label>
                  <input 
                    className="w-full min-w-0 tint-text border-b border-transparent hover:border-gray-200 focus:border-[var(--ui-accent)] outline-none bg-transparent"
                    placeholder={t('info.contactInfo')}
                    value={c.clientContactInfo || ''}
                    onChange={(e) => editing && onDraftUpdate({...c, clientContactInfo: e.target.value})}
                  />
               </div>
             </div>
          </div>
        </div>

        {/* Opponent Info */}
        <div className="craft-panel p-3 shadow-sm group">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold tint-text uppercase flex items-center gap-2"><Scale size={14}/>{t('info.opponent')}</h3>
            <button onClick={() => addPartyToCase(false)} className="text-xs tint-text hover:underline">{t('info.addOpponent')}</button>
          </div>
          {c.opponents.map(p => (
             <div key={p.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-50 last:border-0 relative min-w-0">
               <button disabled={!editing} onClick={() => removeParty(false, p.id)} className={`absolute right-0 top-0 ${editing ? 'text-gray-300 hover:tint-text' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>
               <div className="flex gap-2 mb-2 min-w-0 items-start">
                  <select 
                    className="text-lg bg-transparent outline-none cursor-pointer shrink-0"
                    value={p.type}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'type', e.target.value as any)}
                    disabled={!editing}
                  >
                    <option value="company">🏢</option>
                    <option value="individual">👤</option>
                  </select>
                  <input 
                    className="font-medium tint-text bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none w-full min-w-0 transition-colors"
                    placeholder={t('info.opponent')}
                    value={p.name}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'name', e.target.value)}
                    disabled={!editing}
                  />
               </div>
               <div className="grid grid-cols-1 gap-2 mb-2">
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-[#dfcfe8] min-w-0"
                    placeholder={t('info.idCode')}
                    value={p.idCode || ''}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'idCode', e.target.value)}
                    disabled={!editing}
                 />
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-[#dfcfe8] min-w-0"
                    placeholder={t('info.address')}
                    value={p.address || ''}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'address', e.target.value)}
                    disabled={!editing}
                 />
               </div>
               <input
                  className="w-full min-w-0 text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-[#dfcfe8]"
                  placeholder={t('info.remarks')}
                  value={p.note || ''}
                  onChange={(e) => handlePartyUpdate(false, p.id, 'note', e.target.value)}
                  disabled={!editing}
              />
             </div>
          ))}
          {c.opponents.length === 0 && <div className="text-sm text-gray-400 italic py-2 text-center">{t('detail.noOpponents')}</div>}
        </div>
      </div>
      )}

      {(showProcedure || (showInfo && showSpecialProject)) && (
      <div className="space-y-4 min-w-0">
         {/* Proceedings */}
         {showProcedure && (c.type === '诉讼' || c.type === '仲裁') && (
           <div className="craft-panel p-3 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold tint-text uppercase">{t('proceedings.title')}</h3>
                <button 
                  onClick={() => {
                    const newProc: Proceeding = {
                      id: uuid(), stageName: '', myRole: '', caseNo: '', courtName: '', courtAddress: '',
                      personnel: []
                    };
                    onCommitUpdate({ ...c, litigation: { ...c.litigation, proceedings: [...c.litigation.proceedings, newProc] } });
                  }}
                  className="text-xs tint-text hover:underline"
                >{t('proceedings.addStage')}</button>
              </div>
              
              {c.litigation.proceedings.map((proc, idx) => (
                <div key={proc.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-100 last:border-0 relative bg-white/58 rounded-xl px-2.5 pt-2.5">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-1.5 items-start">
                      <div className="min-w-0">
                        <label className="block text-[10px] tint-text mb-1">{t('proceedings.stage')}</label>
                        <input
                          className="w-full min-w-0 font-semibold text-sm bg-white/90 border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                          value={proc.stageName}
                          onChange={(e) => handleProcUpdate(proc.id, 'stageName', e.target.value)}
                          disabled={!editing}
                          placeholder={t('proceedings.stage')}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] tint-text mb-1">{t('proceedings.myRole')}</label>
                        <input
                           className="w-full min-w-0 text-sm tint-text tint-bg rounded border tint-border outline-none py-1.5 px-2 focus:border-[var(--ui-accent)]"
                           value={proc.myRole}
                           onChange={(e) => handleProcUpdate(proc.id, 'myRole', e.target.value)}
                           placeholder={t('proceedings.myRole')}
                           disabled={!editing}
                        />
                      </div>
                   </div>
                   <div className="mb-2">
                     <label className="block text-[10px] tint-text mb-1">{t('proceedings.caseNo')}</label>
                     <div className="flex items-center gap-2 w-full min-w-0">
                         <input
                           className="text-xs font-mono bg-gray-50 px-2 py-1.5 rounded border border-transparent hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none w-full min-w-0 text-left"
                           value={proc.caseNo}
                           onChange={(e) => handleProcUpdate(proc.id, 'caseNo', e.target.value)}
                           disabled={!editing}
                           placeholder={t('proceedings.caseNo')}
                         />
                         {idx > 0 && <button disabled={!editing} onClick={() => {
                            const updated = c.litigation.proceedings.filter(p => p.id !== proc.id);
                            onCommitUpdate({ ...c, litigation: { ...c.litigation, proceedings: updated } });
                         }} className={`${editing ? 'text-gray-300 hover:tint-text' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>}
                   </div>
                   </div>

                   <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                           <span className="text-xs text-gray-400 w-16 shrink-0">{t('proceedings.institution')}</span>
                           <input 
                             className="flex-1 min-w-0 text-xs border-b border-gray-100 hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none py-0.5"
                             value={proc.courtName}
                             onChange={(e) => handleProcUpdate(proc.id, 'courtName', e.target.value)}
                             disabled={!editing}
                             placeholder={t('proceedings.court')}
                           />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                           <span className="text-xs text-gray-400 w-16 shrink-0">{t('proceedings.address')}</span>
                           <input 
                             className="flex-1 min-w-0 text-xs border-b border-gray-100 hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none py-0.5"
                             value={proc.courtAddress}
                             onChange={(e) => handleProcUpdate(proc.id, 'courtAddress', e.target.value)}
                             disabled={!editing}
                             placeholder={t('proceedings.address')}
                           />
                        </div>
                      </div>
                      
                      {/* Personnel List */}
                      <div className="tint-bg rounded-lg p-2 border tint-border">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold tint-text uppercase">{t('proceedings.personnel')}</span>
                            <button onClick={() => handleAddPerson(proc.id)} className="text-[10px] tint-text hover:underline">+ Add Person</button>
                         </div>
                         {(proc.personnel || []).map((per: any) => (
                            <div key={per.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center mb-2 last:mb-0 group">
                               <input 
                                 className="sm:col-span-2 text-xs bg-white border border-gray-200 rounded px-1 py-1 outline-none"
                                 value={per.role}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'role', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Role"
                               />
                               <input 
                                 className="sm:col-span-3 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none py-1"
                                 value={per.name}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'name', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Name"
                               />
                               <input 
                                 className="sm:col-span-3 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none py-1"
                                 value={per.contact}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'contact', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Contact"
                               />
                               <input 
                                 className="sm:col-span-3 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[var(--ui-accent)] outline-none py-1"
                                 value={per.note || ''}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'note', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Notes"
                               />
                               <button disabled={!editing} onClick={() => handleRemovePerson(proc.id, per.id)} className={`sm:col-span-1 justify-self-end ${editing ? 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:tint-text' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={12}/></button>
                            </div>
                         ))}
                         {(proc.personnel || []).length === 0 && <div className="text-xs text-gray-400 italic text-center py-2">{t('proceedings.noPersonnel')}</div>}
                      </div>
                   </div>
                </div>
              ))}
           </div>
         )}

         {showProcedure && c.type === '诉讼' && (
           <div className="craft-panel p-4 shadow-sm">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-bold tint-text uppercase">{t('preservation.title')}</h3>
               <button onClick={handleAddPreservation} className="text-xs tint-text hover:underline">{t('preservation.add')}</button>
             </div>

             {(c.litigation.propertyPreservations || []).map((item) => (
               <div key={item.id} className="mb-4 last:mb-0 p-3 rounded-xl border tint-border tint-bg">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                   <div>
                     <label className="block text-[10px] tint-text mb-1">{t('preservation.caseNo')}</label>
                     <input
                       className="w-full text-xs bg-white border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                       value={item.caseNo}
                       onChange={(e) => handleUpdatePreservation(item.id, 'caseNo', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] tint-text mb-1">{t('preservation.court')}</label>
                     <input
                       className="w-full text-xs bg-white border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                       value={item.courtName}
                       onChange={(e) => handleUpdatePreservation(item.id, 'courtName', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] tint-text mb-1">{t('preservation.assets')}</label>
                     <input
                       className="w-full text-xs bg-white border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                       value={item.assetDetails}
                       onChange={(e) => handleUpdatePreservation(item.id, 'assetDetails', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] tint-text mb-1">{t('preservation.deadline')}</label>
                     <input
                       type="date"
                       className="w-full text-xs bg-white border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                       value={item.deadlineDate || ''}
                       onChange={(e) => handleUpdatePreservation(item.id, 'deadlineDate', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] tint-text mb-1">{t('preservation.judge')}</label>
                     <input
                       className="w-full text-xs bg-white border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                       value={item.judgeName}
                       onChange={(e) => handleUpdatePreservation(item.id, 'judgeName', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] tint-text mb-1">{t('preservation.judgeContact')}</label>
                     <div className="flex items-center gap-2">
                       <input
                         className="w-full text-xs bg-white border tint-border rounded px-2 py-1.5 outline-none focus:border-[var(--ui-accent)]"
                         value={item.judgeContact}
                         onChange={(e) => handleUpdatePreservation(item.id, 'judgeContact', e.target.value)}
                         disabled={!editing}
                       />
                       <button
                         disabled={!editing}
                         onClick={() => handleRemovePreservation(item.id)}
                         className={`${editing ? 'text-gray-300 hover:tint-text' : 'text-gray-200 cursor-not-allowed'}`}
                       >
                         <Trash2 size={14}/>
                       </button>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
             {(c.litigation.propertyPreservations || []).length === 0 && (
               <div className="text-sm text-gray-400 italic py-2 text-center">{t('preservation.noItems')}</div>
             )}
           </div>
         )}
         
         {/* Special Project Scope */}
         {showInfo && showSpecialProject && (
           <div className="craft-panel p-4 shadow-sm">
              <h3 className="text-xs font-bold tint-text uppercase mb-3">{t('detail.projectScope')}</h3>
              <textarea 
                className="w-full text-sm tint-text min-h-[150px] border border-transparent hover:border-gray-200 focus:border-[var(--ui-accent)] rounded p-2 outline-none resize-y"
                value={c.specialProjectRemarks || ''}
                onChange={(e) => editing && onDraftUpdate({...c, specialProjectRemarks: e.target.value})}
                placeholder="Describe the project scope, goals, and deliverables..."
              />
           </div>
         )}
      </div>
      )}
    </div>
    </>
  );
};

// --- Main Component ---

export const CaseDetail: React.FC = () => {
  const { cases, activeCaseId, activeCaseTab, updateCase, deleteCase, navigate, parties } = useData();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'info' | 'procedure' | 'tasks' | 'schedule' | 'reminders' | 'deadlines' | 'logs' | 'trash'>('info');
  const currentCase = cases.find(c => c.id === activeCaseId);
  const [isEditing, setIsEditing] = useState(false);
  const [draftCase, setDraftCase] = useState<Case | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [remEditTitle, setRemEditTitle] = useState('');
  const [remEditDate, setRemEditDate] = useState('');
  const [remEditTime, setRemEditTime] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState<'文书' | '会议' | '咨询' | '其他'>('文书');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  const [newReminderNote, setNewReminderNote] = useState('');

  useEffect(() => {
    if (currentCase) {
      setDraftCase(currentCase);
      setIsEditing(false);
      setActiveTab(activeCaseTab || 'info');
    }
  }, [currentCase?.id, activeCaseTab]);

  if (!currentCase) return <div className="p-8 text-center text-gray-500">{t('detail.caseNotFound')}</div>;

  const getTrash = () => currentCase.trash || { tasks: [], logs: [], reminders: [], deadlines: [] };

  const handleUpdateTask = (updatedTask: Task) => {
    const newTasks = currentCase.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    updateCase({ ...currentCase, tasks: newTasks });
  };

  const handleAddTask = () => {
    setNewTaskType('文书');
    setNewTaskDesc('');
    setNewTaskAssignee('');
    setNewTaskNotes('');
    setShowCreateTask(true);
  };

  const confirmCreateTask = () => {
    if (!newTaskDesc.trim()) {
      alert('请先填写任务内容');
      return;
    }
    const newTask: Task = {
      id: uuid(),
      type: newTaskType,
      desc: newTaskDesc.trim(),
      assignee: newTaskAssignee.trim(),
      notes: newTaskNotes.trim(),
      createdAt: nowISO(),
      completedAt: null,
      sessions: [],
      isRunning: false,
      isCompleted: false
    };
    updateCase({ ...currentCase, tasks: [newTask, ...currentCase.tasks] });
    setShowCreateTask(false);
  };

  const handleDeleteTask = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    const task = currentCase.tasks.find(t => t.id === id);
    if (task) {
       const trash = getTrash();
       updateCase({ 
         ...currentCase, 
         tasks: currentCase.tasks.filter(t => t.id !== id),
         trash: { ...trash, tasks: [task, ...trash.tasks] }
       });
    }
  };

  const handleAddLog = (content: string) => {
    if (!content.trim()) return;
    const newLog: Log = { id: uuid(), date: nowISO(), content };
    updateCase({ ...currentCase, logs: [newLog, ...currentCase.logs] });
  };
  
  const handleDeleteLog = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this log?")) return;
    const log = currentCase.logs.find(l => l.id === id);
    if (log) {
       const trash = getTrash();
       updateCase({ 
         ...currentCase, 
         logs: currentCase.logs.filter(l => l.id !== id),
         trash: { ...trash, logs: [log, ...trash.logs] }
       });
    }
  };

  const handleDeleteReminder = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this schedule item?")) return;
    const item = currentCase.reminders.find(r => r.id === id);
    if (item) {
       const trash = getTrash();
       updateCase({
         ...currentCase,
         reminders: currentCase.reminders.filter(r => r.id !== id),
         trash: { ...trash, reminders: [item, ...trash.reminders] }
       });
    }
  };

  const handleDeleteDeadline = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this deadline?")) return;
    const item = currentCase.deadlines.find(d => d.id === id);
    if (item) {
       const trash = getTrash();
       const updatedPreservations = (currentCase.litigation.propertyPreservations || []).map(p =>
        p.deadlineId === id ? { ...p, deadlineId: undefined, deadlineDate: '' } : p
       );
       updateCase({
         ...currentCase,
         deadlines: currentCase.deadlines.filter(d => d.id !== id),
         litigation: { ...currentCase.litigation, propertyPreservations: updatedPreservations },
         trash: { ...trash, deadlines: [item, ...trash.deadlines] }
       });
    }
  };

  const handleRestore = (type: 'task' | 'log' | 'reminder' | 'deadline', id: string) => {
     const trash = getTrash();
     if (type === 'task') {
        const item = trash.tasks.find(t => t.id === id);
        if (item) {
           updateCase({
              ...currentCase,
              tasks: [item, ...currentCase.tasks],
              trash: { ...trash, tasks: trash.tasks.filter(t => t.id !== id) }
           });
        }
     } else if (type === 'log') {
        const item = trash.logs.find(l => l.id === id);
        if (item) {
           updateCase({
              ...currentCase,
              logs: [item, ...currentCase.logs],
              trash: { ...trash, logs: trash.logs.filter(l => l.id !== id) }
           });
        }
     } else if (type === 'reminder') {
        const item = trash.reminders.find(r => r.id === id);
        if (item) {
           updateCase({
              ...currentCase,
              reminders: [item, ...currentCase.reminders],
              trash: { ...trash, reminders: trash.reminders.filter(r => r.id !== id) }
           });
        }
     } else if (type === 'deadline') {
        const item = trash.deadlines.find(d => d.id === id);
        if (item) {
           updateCase({
              ...currentCase,
              deadlines: [item, ...currentCase.deadlines],
              trash: { ...trash, deadlines: trash.deadlines.filter(d => d.id !== id) }
           });
        }
     }
  };
  
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateCase({...currentCase, status: e.target.value as any});
  };

  return (
    <div className="h-full flex flex-col craft-surface min-w-0 overflow-x-hidden rounded-[28px]">
      {/* Header */}
      <div className="px-3 md:px-6 py-2.5 md:py-3 border-b border-[#e2e8f0] sticky top-0 bg-[#f8fbff]/92 backdrop-blur-xl z-10 flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 w-full min-w-0 xl:justify-end">
             {!isEditing ? (
               <button onClick={() => { setIsEditing(true); setDraftCase(currentCase); }} className="h-9 px-3 border border-[#d9e1ed] bg-white rounded-[12px] text-sm whitespace-nowrap hover:bg-gray-50">{t('actions.edit')}</button>
             ) : (
             <button onClick={() => { if (draftCase) updateCase(draftCase); setIsEditing(false); }} className="h-9 px-3 border accent-border rounded-[12px] text-sm whitespace-nowrap accent-bg accent-bg-hover text-white">{t('actions.saveChanges')}</button>
             )}
             <button 
               onClick={() => setShowDeleteConfirm(true)}
               className="h-9 px-3 border tint-border tint-text rounded-[12px] text-sm whitespace-nowrap hover:tint-bg"
             >{t('actions.deleteCase')}</button>
             <select 
               className="h-9 px-3 border border-[#d9e1ed] bg-white rounded-[12px] text-sm min-w-[112px] max-w-full hover:bg-gray-50 outline-none cursor-pointer"
               value={currentCase.status}
               onChange={handleStatusChange}
             >
                <option value="active">{t('status.active')}</option>
                <option value="dormant">{t('status.dormant')}</option>
                <option value="archived">{t('status.archived')}</option>
             </select>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 text-xs md:text-sm text-slate-500">
               <span className="cursor-pointer hover:underline" onClick={() => navigate('dashboard')}>{t('breadcrumbs.dashboard')}</span> / <span>{t('breadcrumbs.cases')}</span>
            </div>
            <div className="min-w-0 flex items-start gap-2">
              {isEditing && draftCase ? (
                <input
                  className="min-w-0 flex-1 text-[clamp(1.24rem,2.4vw,1.86rem)] leading-[1.18] font-bold text-[#1f2937] bg-transparent border-b border-[#d9e1ed] focus:border-[var(--ui-accent)] outline-none"
                  value={draftCase.name}
                  onChange={(e) => setDraftCase({ ...draftCase, name: e.target.value })}
                  placeholder={t('case.create.name')}
                />
              ) : (
                <h1 className="min-w-0 flex-1 text-[clamp(1.24rem,2.4vw,1.86rem)] leading-[1.18] font-bold text-[#1f2937] whitespace-normal break-keep">
                  {currentCase.name}
                </h1>
              )}
              <span className="shrink-0 mt-1">
                <StatusBadge status={currentCase.status} />
              </span>
            </div>
            <div className="text-xs md:text-sm text-slate-500 mt-1 flex gap-2.5 flex-wrap items-center">
               <span>{currentCase.type}</span>
               {currentCase.updatedAt && <span>• Updated {new Date(currentCase.updatedAt).toLocaleString()}</span>}
               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#e1e8f2]">待办 <b className="text-[#22344a]">{currentCase.tasks.filter((x) => !x.isCompleted).length}</b></span>
               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#e1e8f2]">提醒 <b className="text-[#22344a]">{currentCase.reminders.length}</b></span>
               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#e1e8f2]">期限 <b className="text-[#22344a]">{currentCase.deadlines.filter((x) => !x.completed).length}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full px-3 md:px-6 py-2 border-b border-[#e2e8f0]">
        <div className="craft-panel rounded-[16px] px-2 py-1 flex gap-1.5 text-sm overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory">
          {['info', 'procedure', 'tasks', 'schedule', 'reminders', 'deadlines', 'logs', 'trash'].map(tab => (
            <div
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`craft-tab capitalize whitespace-nowrap snap-start ${activeTab === tab ? 'craft-tab-active font-medium' : ''}`}
            >
              {tab === 'trash' ? t('tabs.trash') : t(`tabs.${tab}`)}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 pb-20 md:pb-6 bg-gradient-to-b from-[#f6f9fd]/70 to-[#f1f6fc]/45">
        <div className="w-full max-w-[1060px] mx-auto min-w-0">
          
          {activeTab === 'info' && draftCase && (
            <InfoTab 
              c={draftCase} 
              editing={isEditing} 
              onDraftUpdate={(c) => setDraftCase(c)} 
              onCommitUpdate={(c) => { setDraftCase(c); updateCase(c); }} 
              allParties={parties}
              viewMode="info"
            />
          )}

          {activeTab === 'procedure' && draftCase && (
            <InfoTab
              c={draftCase}
              editing={isEditing}
              onDraftUpdate={(c) => setDraftCase(c)}
              onCommitUpdate={(c) => { setDraftCase(c); updateCase(c); }}
              allParties={parties}
              viewMode="procedure"
            />
          )}

          {activeTab === 'tasks' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                 <h3 className="font-bold tint-text">{t('tasks.title')} ({currentCase.tasks.length})</h3>
                 <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => {
                        const headers = ['Date', 'Start Time', 'End Time', 'Description', 'Duration (Hrs)', 'Notes', 'Assignee'];
                        const rows = currentCase.tasks.map(t => {
                            const dur = (calculateTaskDuration(t) / 3600).toFixed(2);
                            const safeDesc = (t.desc || '').replace(/"/g, '""');
                            const safeNotes = (t.notes || '').replace(/"/g, '""');
                            const safeAssignee = (t.assignee || '').replace(/"/g, '""');
                            
                            // Determine Start and End times
                            let startTime = '';
                            let endTime = '';
                            
                            if (t.sessions && t.sessions.length > 0) {
                                const firstSession = t.sessions[0];
                                if (firstSession && firstSession.start) {
                                    startTime = formatDateTime(firstSession.start);
                                }
                                
                                // For end time, use completedAt if available, otherwise check the last session
                                if (t.completedAt) {
                                    endTime = formatDateTime(t.completedAt);
                                } else {
                                    const lastSession = t.sessions[t.sessions.length - 1];
                                    if (lastSession && lastSession.end) {
                                        endTime = formatDateTime(lastSession.end);
                                    }
                                }
                            } else if (t.createdAt) {
                                // Fallback to creation time if no sessions
                                startTime = formatDateTime(t.createdAt);
                            }

                            return `"${t.createdAt.split('T')[0]}","${startTime}","${endTime}","${safeDesc}","${dur}","${safeNotes}","${safeAssignee}"`;
                        });
                        const csv = [headers.join(','), ...rows].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${currentCase.name}_Billing.csv`;
                        link.click();
                    }}
                      className="flex-1 sm:flex-none items-center justify-center flex gap-1 border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      <FileText size={16} /> {t('tasks.export')}
                    </button>
                    <button onClick={handleAddTask} className="flex-1 sm:flex-none flex items-center justify-center gap-1 accent-bg accent-bg-hover text-white px-3 py-1.5 rounded text-sm shadow-sm">
                      <Plus size={16} /> {t('tasks.add')}
                    </button>
                 </div>
              </div>
              <div className="space-y-1">
                {currentCase.tasks.length === 0 ? <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg">{t('tasks.noTasksYet')}</div> : 
                  currentCase.tasks.map(t => (
                    <TaskItem key={t.id} task={t} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                  ))
                }
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
             <div className="animate-fade-in max-w-3xl">
              <div className="mb-6 flex flex-col sm:flex-row gap-2">
                 <textarea
                   id="logInput"
                   className="w-full border border-[#d9cfde] rounded-xl p-3 text-sm bg-white/90 tint-text focus:ring-2 focus:ring-[var(--ui-accent-soft-2)] outline-none"
                   placeholder={t('logs.placeholder')}
                   rows={2}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleAddLog(e.currentTarget.value);
                       e.currentTarget.value = '';
                     }
                   }}
                 />
                 <button 
                    onClick={() => {
                       const el = document.getElementById('logInput') as HTMLTextAreaElement;
                       handleAddLog(el.value);
                       el.value = '';
                    }}
                    className="accent-bg accent-bg-hover text-white px-4 py-2 rounded transition-colors sm:self-auto self-end"
                 >{t('logs.post')}</button>
               </div>
               <div className="space-y-6 relative border-l tint-border ml-4 pl-8">
                 {currentCase.logs.map(log => (
                   <div key={log.id} className="relative group">
                     <div className="absolute -left-[39px] top-1 h-5 w-5 rounded-full bg-white border-2 border-[#d2c3da] z-10"></div>
                     <div className="text-xs text-gray-400 mb-1">{formatDateTime(log.date)}</div>
                     <div className="bg-white/92 p-3 rounded-xl border tint-border text-sm shadow-sm tint-text whitespace-pre-wrap">
                       {log.content}
                     </div>
                     <button 
                       onClick={() => handleDeleteLog(log.id)}
                       className="absolute top-0 right-0 p-2 text-gray-300 hover:tint-text opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                       <Trash2 size={12}/>
                     </button>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {activeTab === 'schedule' && (
            <div className="animate-fade-in">
              <div className="tint-bg border tint-border p-4 rounded-lg mb-6 flex flex-col sm:flex-row sm:items-end gap-2 min-w-0">
               <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                 <div className="sm:col-span-2">
                     <label className="block text-xs tint-text font-bold mb-1">{t('schedule.newEvent')}</label>
                     <input id="sch-title" placeholder={t('schedule.eventPlaceholder')} className="w-full text-sm p-2 rounded border tint-border outline-none" />
                 </div>
                 <div>
                     <label className="block text-xs tint-text font-bold mb-1">{t('schedule.dateTime')}</label>
                    <div className="flex flex-col sm:flex-row gap-1 min-w-0">
                       <input id="sch-date" type="date" className="w-full text-sm p-2 rounded border tint-border outline-none" />
                       <input id="sch-time" type="time" className="w-full sm:w-24 text-sm p-2 rounded border tint-border outline-none" />
                    </div>
                 </div>
               </div>
                <button 
                  className="accent-bg accent-bg-hover text-white px-4 py-2 rounded text-sm shadow-sm h-[38px] w-full sm:w-auto"
                  onClick={() => {
                   const t = (document.getElementById('sch-title') as HTMLInputElement).value;
                   const d = (document.getElementById('sch-date') as HTMLInputElement).value;
                   const time = (document.getElementById('sch-time') as HTMLInputElement).value;
                   if(t && d) {
                     updateCase({...currentCase, reminders: [...currentCase.reminders, { id: uuid(), title: t, date: d, time: time || '09:00' }]});
                     (document.getElementById('sch-title') as HTMLInputElement).value = '';
                     (document.getElementById('sch-time') as HTMLInputElement).value = '';
                   }
                 }}
               >{t('schedule.add')}</button>
              </div>

              <div className="space-y-2">
                {currentCase.reminders.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time)).map(r => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border bg-white/92 tint-border shadow-sm min-w-0">
                    {editingReminderId === r.id ? (
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end sm:mr-4">
                        <div>
                          <label className="block text-[10px] tint-text mb-1">Title</label>
                          <input className="w-full text-sm p-2 rounded border tint-border outline-none tint-text" value={remEditTitle} onChange={e => setRemEditTitle(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] tint-text mb-1">Date</label>
                          <input type="date" className="w-full text-sm p-2 rounded border tint-border outline-none tint-text" value={remEditDate} onChange={e => setRemEditDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] tint-text mb-1">Time</label>
                          <input type="time" className="w-full text-sm p-2 rounded border tint-border outline-none tint-text" value={remEditTime} onChange={e => setRemEditTime(e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-center shrink-0 min-w-[56px]">
                          <div className="text-xs tint-text uppercase font-bold">{new Date(r.date).toLocaleString('default', { month: 'short' })}</div>
                          <div className="text-xl font-bold tint-text leading-none">{new Date(r.date).getDate()}</div>
                          <div className="text-xs text-gray-400">{r.time}</div>
                        </div>
                        <div className="h-8 w-px tint-bg"></div>
                        <div className="font-medium text-sm tint-text min-w-0 break-words">{r.title}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      {editingReminderId === r.id ? (
                        <>
                          <button 
                            className="text-sm px-3 py-1 border tint-border rounded hover:bg-white"
                            onClick={() => {
                              const newReminders = currentCase.reminders.map(x => x.id === r.id ? { ...x, title: remEditTitle, date: remEditDate, time: remEditTime || x.time } : x);
                              updateCase({ ...currentCase, reminders: newReminders });
                              setEditingReminderId(null);
                              setRemEditTitle('');
                              setRemEditDate('');
                              setRemEditTime('');
                            }}
                          >Save</button>
                          <button 
                            className="text-sm px-3 py-1 border tint-border rounded hover:bg-white"
                            onClick={() => { setEditingReminderId(null); }}
                          >Cancel</button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="text-gray-400 hover:tint-text"
                            onClick={() => { setEditingReminderId(r.id); setRemEditTitle(r.title); setRemEditDate(r.date); setRemEditTime(r.time); }}
                          ><Edit2 size={14}/></button>
                          <button onClick={() => handleDeleteReminder(r.id)} className="text-gray-300 hover:tint-text"><Trash2 size={14}/></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {currentCase.reminders.length === 0 && <div className="text-center py-10 text-gray-400">No scheduled events.</div>}
              </div>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="animate-fade-in">
              <div className="tint-bg border tint-border p-4 rounded-lg mb-6 flex flex-col sm:flex-row sm:items-end gap-2 min-w-0">
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs tint-text font-bold mb-1">{t('reminders.new')}</label>
                    <input
                      value={newReminderTitle}
                      onChange={(e) => setNewReminderTitle(e.target.value)}
                      placeholder={t('reminders.title')}
                      className="w-full text-sm p-2 rounded border tint-border outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tint-text font-bold mb-1">{t('reminders.dueDate')}</label>
                    <input
                      type="date"
                      value={newReminderDate}
                      onChange={(e) => setNewReminderDate(e.target.value)}
                      className="w-full text-sm p-2 rounded border tint-border outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      value={newReminderNote}
                      onChange={(e) => setNewReminderNote(e.target.value)}
                      placeholder={t('reminders.note')}
                      className="w-full text-sm p-2 rounded border tint-border outline-none"
                    />
                  </div>
                </div>
                <button
                  className="accent-bg accent-bg-hover text-white px-4 py-2 rounded text-sm shadow-sm h-[38px] w-full sm:w-auto"
                  onClick={() => {
                    if (!newReminderTitle.trim()) {
                      alert('请先填写提醒内容');
                      return;
                    }
                    const item: ActionReminder = {
                      id: uuid(),
                      title: newReminderTitle.trim(),
                      note: newReminderNote.trim(),
                      dueDate: newReminderDate,
                      completed: false,
                    };
                    updateCase({ ...currentCase, actionReminders: [item, ...(currentCase.actionReminders || [])] });
                    setNewReminderTitle('');
                    setNewReminderDate('');
                    setNewReminderNote('');
                  }}
                >
                  {t('reminders.add')}
                </button>
              </div>

              <div className="space-y-2">
                {(currentCase.actionReminders || []).map((item) => (
                  <div key={item.id} className={`flex items-center justify-between gap-2 p-3 rounded-xl border min-w-0 ${item.completed ? 'tint-bg border tint-border opacity-70' : 'bg-white/92 border tint-border shadow-sm'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          const next = (currentCase.actionReminders || []).map((x) => x.id === item.id ? { ...x, completed: !x.completed } : x);
                          updateCase({ ...currentCase, actionReminders: next });
                        }}
                        className="w-4 h-4 rounded border-gray-300 accent-text focus:ring-[var(--ui-accent-soft-2)]"
                      />
                      <div className="min-w-0">
                        <div className={`font-medium text-sm break-words ${item.completed ? 'line-through text-gray-500' : 'tint-text'}`}>{item.title}</div>
                        <div className="text-xs text-gray-500">
                          {item.dueDate ? `${t('reminders.dueDate')}: ${item.dueDate}` : ''}
                          {item.note ? `  ·  ${item.note}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const next = (currentCase.actionReminders || []).filter((x) => x.id !== item.id);
                        updateCase({ ...currentCase, actionReminders: next });
                      }}
                      className="text-gray-300 hover:tint-text shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(currentCase.actionReminders || []).length === 0 && (
                  <div className="text-center py-10 text-gray-400">{t('reminders.noItems')}</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'deadlines' && (
            <div className="animate-fade-in">
              <div className="tint-bg border tint-border p-4 rounded-lg mb-6 flex flex-col sm:flex-row sm:items-end gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs tint-text font-bold mb-1">{t('deadlines.new')}</label>
                  <input id="dl-title" placeholder="Description (e.g. Evidence Submission)" className="w-full text-sm p-2 rounded border tint-border outline-none mb-2" />
                  <input id="dl-date" type="date" className="w-full text-sm p-2 rounded border tint-border outline-none" />
                </div>
                <button 
                  className="accent-bg text-white px-4 py-2 rounded text-sm accent-bg-hover shadow-sm w-full sm:w-auto"
                  onClick={() => {
                    const t = (document.getElementById('dl-title') as HTMLInputElement).value;
                    const d = (document.getElementById('dl-date') as HTMLInputElement).value;
                    if(t && d) {
                      updateCase({...currentCase, deadlines: [...currentCase.deadlines, { id: uuid(), title: t, date: d, completed: false }]});
                      (document.getElementById('dl-title') as HTMLInputElement).value = '';
                    }
                  }}
                >{t('deadlines.add')}</button>
              </div>

              <div className="space-y-2">
                {currentCase.deadlines.map(dl => (
                  <div key={dl.id} className={`flex items-center justify-between gap-2 p-3 rounded-xl border min-w-0 ${dl.completed ? 'tint-bg border tint-border opacity-70' : 'bg-white/92 border tint-border shadow-sm'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                       <input 
                         type="checkbox" 
                         checked={dl.completed} 
                         onChange={() => {
                            const newDLs = currentCase.deadlines.map(x => x.id === dl.id ? {...x, completed: !x.completed} : x);
                            updateCase({...currentCase, deadlines: newDLs});
                         }}
                         className="w-4 h-4 rounded border-gray-300 accent-text focus:ring-[var(--ui-accent-soft-2)]"
                       />
                       <div className="min-w-0">
                         <div className={`font-medium text-sm break-words ${dl.completed ? 'line-through text-[#847b8d]' : 'tint-text'}`}>{dl.title}</div>
                         <div className="text-xs tint-text font-mono">{dl.date}</div>
                       </div>
                    </div>
                    <button onClick={() => handleDeleteDeadline(dl.id)} className="text-gray-300 hover:tint-text shrink-0"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trash' && (
            <div className="animate-fade-in">
               <h3 className="font-bold tint-text mb-4">Recycle Bin</h3>
               <div className="space-y-6">
                  {/* Tasks */}
                  <div>
                     <h4 className="text-sm font-bold tint-text mb-2 flex items-center gap-2"><CheckCircle size={14}/> Deleted Tasks</h4>
                     {getTrash().tasks.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted tasks.</div> : 
                       <div className="space-y-2">
                         {getTrash().tasks.map(t => (
                           <div key={t.id} className="flex justify-between items-center p-2 tint-bg border tint-border rounded-xl">
                              <span className="text-sm tint-text line-through">{t.desc}</span>
                              <button onClick={() => handleRestore('task', t.id)} className="text-xs tint-text hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Logs */}
                  <div>
                     <h4 className="text-sm font-bold tint-text mb-2 flex items-center gap-2"><FileText size={14}/> Deleted Logs</h4>
                     {getTrash().logs.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted logs.</div> : 
                       <div className="space-y-2">
                         {getTrash().logs.map(l => (
                           <div key={l.id} className="flex justify-between items-center p-2 tint-bg border tint-border rounded-xl">
                              <span className="text-sm tint-text truncate max-w-[300px]">{l.content}</span>
                              <button onClick={() => handleRestore('log', l.id)} className="text-xs tint-text hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Schedule */}
                  <div>
                     <h4 className="text-sm font-bold tint-text mb-2 flex items-center gap-2"><Calendar size={14}/> Deleted Schedule</h4>
                     {getTrash().reminders.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted schedule items.</div> : 
                       <div className="space-y-2">
                         {getTrash().reminders.map(r => (
                           <div key={r.id} className="flex justify-between items-center p-2 tint-bg border tint-border rounded-xl">
                              <span className="text-sm tint-text">{r.title} ({r.date})</span>
                              <button onClick={() => handleRestore('reminder', r.id)} className="text-xs tint-text hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Deadlines */}
                  <div>
                     <h4 className="text-sm font-bold tint-text mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Deleted Deadlines</h4>
                     {getTrash().deadlines.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted deadlines.</div> : 
                       <div className="space-y-2">
                         {getTrash().deadlines.map(d => (
                           <div key={d.id} className="flex justify-between items-center p-2 tint-bg border tint-border rounded-xl">
                              <span className="text-sm tint-text">{d.title} ({d.date})</span>
                              <button onClick={() => handleRestore('deadline', d.id)} className="text-xs tint-text hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
               </div>
            </div>
          )}

        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setShowDeleteConfirm(false)}>
          <div className="craft-surface w-[420px] max-w-[95vw] p-6" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-2">确认删除案件</div>
            <div className="text-sm tint-text mb-4">此操作将移除该案件并返回仪表盘。请确认。</div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border tint-border rounded text-sm" onClick={() => setShowDeleteConfirm(false)}>取消</button>
              <button className="px-3 py-1.5 border tint-border text-white accent-bg rounded text-sm accent-bg-hover" onClick={() => { setShowDeleteConfirm(false); deleteCase(currentCase.id); }}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {showCreateTask && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-[60] flex items-center justify-center p-3" onClick={() => setShowCreateTask(false)}>
          <div className="craft-surface w-[420px] max-w-[95vw] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">新增任务</div>
            <div className="space-y-2">
              <select
                className="w-full text-sm p-2 rounded border tint-border outline-none bg-white"
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value as any)}
              >
                <option value="文书">文书</option>
                <option value="会议">会议</option>
                <option value="咨询">咨询</option>
                <option value="其他">其他</option>
              </select>
              <input
                className="w-full text-sm p-2 rounded border tint-border outline-none bg-white"
                placeholder="任务内容（必填）"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
              />
              <input
                className="w-full text-sm p-2 rounded border tint-border outline-none bg-white"
                placeholder="负责人（可选）"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              />
              <textarea
                className="w-full text-sm p-2 rounded border tint-border outline-none bg-white min-h-[76px]"
                placeholder="备注（可选）"
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 border tint-border rounded text-sm" onClick={() => setShowCreateTask(false)}>取消</button>
              <button className="px-3 py-1.5 accent-bg accent-bg-hover text-white rounded text-sm" onClick={confirmCreateTask}>确认新增</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
