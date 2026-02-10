import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { useI18n } from '../store/I18nContext';
import { Case, Task, Log, Reminder, Deadline, Party, Proceeding, PropertyPreservation } from '../types';
import { calculateTaskDuration, formatTimeDuration, nowISO, uuid, formatDateTime } from '../utils';
import { 
  Play, Pause, CheckCircle, RotateCcw, Plus, Trash2, Calendar, 
  FileText, Clock, AlertTriangle, MessageSquare, ChevronDown, Scale, Edit2
} from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    active: 'bg-[#efe7f2] text-[#5b4f78] border-[#d8c8e1]',
    dormant: 'bg-[#f6ecef] text-[#7a4f69] border-[#e6d3da]',
    archived: 'bg-[#efeaf0] text-[#655a67] border-[#d8d0dc]'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs border ${colors[status as keyof typeof colors] || colors.active} uppercase font-semibold tracking-wide`}>
      {status}
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
          className="w-full border border-gray-300 rounded p-2 mb-4 text-sm outline-none focus:border-[#8a6d95]"
          placeholder="Search parties..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded mb-4">
          {filtered.map(p => (
            <div 
              key={p.id} 
              className="p-2 hover:bg-[#f4edf8] cursor-pointer text-sm border-b border-gray-50 last:border-0"
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
    <div className={`group flex flex-col sm:flex-row gap-3 p-3 mb-2 rounded border transition-all ${task.isRunning ? 'bg-[#f4edf8] border-[#dbcde6] shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          {task.isCompleted && <CheckCircle size={16} className="text-[#6a5b75]" />}
          <input 
            className={`font-medium text-sm bg-transparent outline-none w-full ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}
            value={task.desc}
            onChange={(e) => onUpdate({ ...task, desc: e.target.value })}
            placeholder={t('tasks.taskDescription')}
            disabled={task.isCompleted}
          />
        </div>
        <div className="flex gap-2 text-xs">
          <select 
            className="bg-gray-100 rounded px-1 py-0.5 outline-none"
            value={task.type}
            onChange={(e) => onUpdate({...task, type: e.target.value as any})}
            disabled={task.isCompleted}
          >
            <option>文书</option><option>会议</option><option>咨询</option><option>其他</option>
          </select>
          <input 
            className="bg-transparent text-gray-500 outline-none w-24" 
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

      <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 min-w-[100px]">
        {task.isCompleted ? (
           <div className="text-center">
             <div className="text-xs font-bold text-[#6a5b75]">{t('tasks.done')}</div>
             <button onClick={() => onUpdate({...task, isCompleted: false})} className="text-[10px] underline text-gray-400 hover:text-[#6b5a8b] flex items-center gap-1 mt-1">
               <RotateCcw size={10} /> {t('tasks.reopen')}
             </button>
           </div>
        ) : (
          <>
            <div className="font-mono text-lg font-semibold text-[#4f445a] cursor-help" title="Total duration">{formatTimeDuration(duration)}</div>
            <div className="flex gap-1 w-full items-center justify-center">
              <button 
                onClick={toggleTimer}
                className="flex-1 flex items-center justify-center p-1 rounded text-white text-xs transition-colors accent-bg accent-bg-hover"
              >
                {task.isRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
              
              <div className="relative">
                  <button 
                    onClick={() => setShowManualInput(!showManualInput)} 
                    className={`p-1 rounded hover:bg-[#efe6f5] hover:text-[#6b5a8b] transition-colors ${showManualInput ? 'bg-[#efe6f5] text-[#6b5a8b]' : 'bg-gray-100 text-gray-600'}`}
                    title="Add/Subtract Time"
                    type="button"
                  >
                    <Clock size={14} />
                  </button>
              </div>

              <button onClick={completeTask} className="p-1 rounded bg-gray-100 hover:bg-[#f0e8f2] text-gray-600 hover:text-[#6a5b75] transition-colors">
                <CheckCircle size={14} />
              </button>
            </div>
          </>
        )}
         <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#7a4f69] transition-all absolute top-2 right-2 sm:static">
             <Trash2 size={12} />
        </button>
      </div>
      <div className="mt-2">
        <button
          type="button"
          className={`text-xs px-2 py-1 rounded border ${showSessions ? 'bg-gray-100' : 'bg-white'}`}
          onClick={() => setShowSessions(!showSessions)}
        >
          {t('tasks.sessions')}
        </button>
        {showSessions && (
          <div className="mt-2 space-y-2">
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
                    className="text-xs px-2 py-1 rounded bg-[#f8eeef] text-[#7a4f69] border border-[#e2c7d1] hover:bg-[#f2e4e9]"
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
      </div>
      {showManualInput && (
        <div className="fixed inset-0 z-[140] bg-black/20 backdrop-blur-[2px] flex items-center justify-center p-3" onClick={() => setShowManualInput(false)}>
          <div className="craft-surface w-[360px] max-w-[95vw] p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-bold text-[#4f445a] mb-2">{t('tasks.manualSession')}</div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('tasks.startTime')}</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[#8a6d95]"
                  value={manualStart}
                  onChange={e => setManualStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('tasks.endTime')}</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[#8a6d95]"
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

const InfoTab = ({ c, editing, onDraftUpdate, onCommitUpdate, allParties }: { c: Case, editing: boolean, onDraftUpdate: (c: Case) => void, onCommitUpdate: (c: Case) => void, allParties: Party[] }) => {
  const [showPartySelector, setShowPartySelector] = useState<'client' | 'opponent' | null>(null);
  const { addParty, updateParty, parties } = useData();
  const { t } = useI18n();

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 animate-fade-in pb-20">
      <div className="space-y-6 min-w-0">
        {/* Client Info */}
        <div className="craft-panel p-4 shadow-sm group">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-[#6f6377] uppercase flex items-center gap-2"><MessageSquare size={14}/>{t('info.client')}</h3>
            <button onClick={() => addPartyToCase(true)} className="text-xs text-[#6b5a8b] hover:underline">{t('info.addClient')}</button>
          </div>
          {c.clients.map(p => (
             <div key={p.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-50 last:border-0 relative min-w-0">
               <button disabled={!editing} onClick={() => removeParty(true, p.id)} className={`absolute right-0 top-0 ${editing ? 'text-gray-300 hover:text-[#7a4f69]' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>
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
                    className="font-medium text-[#3f2f4d] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#8a6d95] outline-none w-full min-w-0 transition-colors"
                    placeholder={t('info.client')}
                    value={p.name}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'name', e.target.value)}
                    disabled={!editing}
                  />
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
                  <label className="block text-xs text-[#8a8092] mb-1">{t('info.contactPerson')}</label>
                  <input 
                    className="w-full min-w-0 text-[#3f2f4d] border-b border-transparent hover:border-gray-200 focus:border-[#8a6d95] outline-none bg-transparent"
                    placeholder={t('info.contactPerson')}
                    value={c.clientContactName || ''}
                    onChange={(e) => editing && onDraftUpdate({...c, clientContactName: e.target.value})}
                  />
               </div>
               <div className="min-w-0">
                  <label className="block text-xs text-[#8a8092] mb-1">{t('info.contactInfo')}</label>
                  <input 
                    className="w-full min-w-0 text-[#3f2f4d] border-b border-transparent hover:border-gray-200 focus:border-[#8a6d95] outline-none bg-transparent"
                    placeholder={t('info.contactInfo')}
                    value={c.clientContactInfo || ''}
                    onChange={(e) => editing && onDraftUpdate({...c, clientContactInfo: e.target.value})}
                  />
               </div>
             </div>
          </div>
        </div>

        {/* Opponent Info */}
        <div className="craft-panel p-4 shadow-sm group">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-[#6f6377] uppercase flex items-center gap-2"><Scale size={14}/>{t('info.opponent')}</h3>
            <button onClick={() => addPartyToCase(false)} className="text-xs text-[#6b5a8b] hover:underline">{t('info.addOpponent')}</button>
          </div>
          {c.opponents.map(p => (
             <div key={p.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-50 last:border-0 relative min-w-0">
               <button disabled={!editing} onClick={() => removeParty(false, p.id)} className={`absolute right-0 top-0 ${editing ? 'text-gray-300 hover:text-[#7a4f69]' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>
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
                    className="font-medium text-[#3f2f4d] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#8a6d95] outline-none w-full min-w-0 transition-colors"
                    placeholder={t('info.opponent')}
                    value={p.name}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'name', e.target.value)}
                    disabled={!editing}
                  />
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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

      <div className="space-y-6 min-w-0">
         {/* Proceedings */}
         {(c.type === '诉讼' || c.type === '仲裁') && (
           <div className="craft-panel p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-[#6f6377] uppercase">{t('proceedings.title')}</h3>
                <button 
                  onClick={() => {
                    const newProc: Proceeding = {
                      id: uuid(), stageName: '', myRole: '', caseNo: '', courtName: '', courtAddress: '',
                      personnel: []
                    };
                    onCommitUpdate({ ...c, litigation: { ...c.litigation, proceedings: [...c.litigation.proceedings, newProc] } });
                  }}
                  className="text-xs text-[#6b5a8b] hover:underline"
                >{t('proceedings.addStage')}</button>
              </div>
              
              {c.litigation.proceedings.map((proc, idx) => (
                <div key={proc.id} className="mb-6 last:mb-0 pb-6 border-b border-gray-100 last:border-0 relative">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 items-start">
                      <div className="min-w-0">
                        <label className="block text-[10px] text-[#8a8092] mb-1">{t('proceedings.stage')}</label>
                        <input
                          className="w-full min-w-0 font-semibold text-sm bg-white/90 border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                          value={proc.stageName}
                          onChange={(e) => handleProcUpdate(proc.id, 'stageName', e.target.value)}
                          disabled={!editing}
                          placeholder={t('proceedings.stage')}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] text-[#8a8092] mb-1">{t('proceedings.myRole')}</label>
                        <input
                           className="w-full min-w-0 text-sm text-[#6f6377] bg-[#f3edf5] rounded border border-[#ddd2e3] outline-none py-1.5 px-2 focus:border-[#8a6d95]"
                           value={proc.myRole}
                           onChange={(e) => handleProcUpdate(proc.id, 'myRole', e.target.value)}
                           placeholder={t('proceedings.myRole')}
                           disabled={!editing}
                        />
                      </div>
                   </div>
                   <div className="mb-3">
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('proceedings.caseNo')}</label>
                     <div className="flex items-center gap-2 w-full min-w-0">
                         <input
                           className="text-xs font-mono bg-gray-50 px-2 py-1.5 rounded border border-transparent hover:border-gray-300 focus:border-[#8a6d95] outline-none w-full min-w-0 text-left"
                           value={proc.caseNo}
                           onChange={(e) => handleProcUpdate(proc.id, 'caseNo', e.target.value)}
                           disabled={!editing}
                           placeholder={t('proceedings.caseNo')}
                         />
                         {idx > 0 && <button disabled={!editing} onClick={() => {
                            const updated = c.litigation.proceedings.filter(p => p.id !== proc.id);
                            onCommitUpdate({ ...c, litigation: { ...c.litigation, proceedings: updated } });
                         }} className={`${editing ? 'text-gray-300 hover:text-[#7a4f69]' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>}
                   </div>
                   </div>

                   <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                           <span className="text-xs text-gray-400 w-16 shrink-0">{t('proceedings.institution')}</span>
                           <input 
                             className="flex-1 min-w-0 text-xs border-b border-gray-100 hover:border-gray-300 focus:border-[#8a6d95] outline-none py-1"
                             value={proc.courtName}
                             onChange={(e) => handleProcUpdate(proc.id, 'courtName', e.target.value)}
                             disabled={!editing}
                             placeholder={t('proceedings.court')}
                           />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                           <span className="text-xs text-gray-400 w-16 shrink-0">{t('proceedings.address')}</span>
                           <input 
                             className="flex-1 min-w-0 text-xs border-b border-gray-100 hover:border-gray-300 focus:border-[#8a6d95] outline-none py-1"
                             value={proc.courtAddress}
                             onChange={(e) => handleProcUpdate(proc.id, 'courtAddress', e.target.value)}
                             disabled={!editing}
                             placeholder={t('proceedings.address')}
                           />
                        </div>
                      </div>
                      
                      {/* Personnel List */}
                      <div className="bg-[#f7f2f8] rounded p-2 border border-[#e6dcec]">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-[#8a8092] uppercase">{t('proceedings.personnel')}</span>
                            <button onClick={() => handleAddPerson(proc.id)} className="text-[10px] text-[#6b5a8b] hover:underline">+ Add Person</button>
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
                                 className="sm:col-span-3 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#8a6d95] outline-none py-1"
                                 value={per.name}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'name', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Name"
                               />
                               <input 
                                 className="sm:col-span-3 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#8a6d95] outline-none py-1"
                                 value={per.contact}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'contact', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Contact"
                               />
                               <input 
                                 className="sm:col-span-3 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#8a6d95] outline-none py-1"
                                 value={per.note || ''}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'note', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Notes"
                               />
                               <button disabled={!editing} onClick={() => handleRemovePerson(proc.id, per.id)} className={`sm:col-span-1 justify-self-end ${editing ? 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:text-[#7a4f69]' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={12}/></button>
                            </div>
                         ))}
                         {(proc.personnel || []).length === 0 && <div className="text-xs text-gray-400 italic text-center py-2">{t('proceedings.noPersonnel')}</div>}
                      </div>
                   </div>
                </div>
              ))}
           </div>
         )}

         {c.type === '诉讼' && (
           <div className="craft-panel p-4 shadow-sm">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-bold text-[#6f6377] uppercase">{t('preservation.title')}</h3>
               <button onClick={handleAddPreservation} className="text-xs text-[#6b5a8b] hover:underline">{t('preservation.add')}</button>
             </div>

             {(c.litigation.propertyPreservations || []).map((item) => (
               <div key={item.id} className="mb-4 last:mb-0 p-3 rounded-xl border border-[#e6dcec] bg-[#f7f2f8]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                   <div>
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('preservation.caseNo')}</label>
                     <input
                       className="w-full text-xs bg-white border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                       value={item.caseNo}
                       onChange={(e) => handleUpdatePreservation(item.id, 'caseNo', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('preservation.court')}</label>
                     <input
                       className="w-full text-xs bg-white border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                       value={item.courtName}
                       onChange={(e) => handleUpdatePreservation(item.id, 'courtName', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('preservation.assets')}</label>
                     <input
                       className="w-full text-xs bg-white border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                       value={item.assetDetails}
                       onChange={(e) => handleUpdatePreservation(item.id, 'assetDetails', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('preservation.deadline')}</label>
                     <input
                       type="date"
                       className="w-full text-xs bg-white border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                       value={item.deadlineDate || ''}
                       onChange={(e) => handleUpdatePreservation(item.id, 'deadlineDate', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('preservation.judge')}</label>
                     <input
                       className="w-full text-xs bg-white border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                       value={item.judgeName}
                       onChange={(e) => handleUpdatePreservation(item.id, 'judgeName', e.target.value)}
                       disabled={!editing}
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] text-[#8a8092] mb-1">{t('preservation.judgeContact')}</label>
                     <div className="flex items-center gap-2">
                       <input
                         className="w-full text-xs bg-white border border-[#ddd2e3] rounded px-2 py-1.5 outline-none focus:border-[#8a6d95]"
                         value={item.judgeContact}
                         onChange={(e) => handleUpdatePreservation(item.id, 'judgeContact', e.target.value)}
                         disabled={!editing}
                       />
                       <button
                         disabled={!editing}
                         onClick={() => handleRemovePreservation(item.id)}
                         className={`${editing ? 'text-gray-300 hover:text-[#7a4f69]' : 'text-gray-200 cursor-not-allowed'}`}
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
         {(c.type === '专项法律服务' || c.type === '常年法律顾问') && (
           <div className="craft-panel p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#6f6377] uppercase mb-3">{t('detail.projectScope')}</h3>
              <textarea 
                className="w-full text-sm text-[#4f445a] min-h-[150px] border border-transparent hover:border-gray-200 focus:border-[#8a6d95] rounded p-2 outline-none resize-y"
                value={c.specialProjectRemarks || ''}
                onChange={(e) => editing && onDraftUpdate({...c, specialProjectRemarks: e.target.value})}
                placeholder="Describe the project scope, goals, and deliverables..."
              />
           </div>
         )}
      </div>
    </div>
    </>
  );
};

// --- Main Component ---

export const CaseDetail: React.FC = () => {
  const { cases, activeCaseId, activeCaseTab, updateCase, deleteCase, navigate, parties } = useData();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'info' | 'tasks' | 'deadlines' | 'logs' | 'schedule' | 'trash'>('info');
  const currentCase = cases.find(c => c.id === activeCaseId);
  const [isEditing, setIsEditing] = useState(false);
  const [draftCase, setDraftCase] = useState<Case | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [remEditTitle, setRemEditTitle] = useState('');
  const [remEditDate, setRemEditDate] = useState('');
  const [remEditTime, setRemEditTime] = useState('');

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
    const newTask: Task = {
      id: uuid(),
      type: '文书',
      desc: '',
      assignee: '',
      notes: '',
      createdAt: nowISO(),
      completedAt: null,
      sessions: [],
      isRunning: false,
      isCompleted: false
    };
    updateCase({ ...currentCase, tasks: [newTask, ...currentCase.tasks] });
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
    <div className="h-full flex flex-col craft-surface">
      {/* Header */}
      <div className="px-3 md:px-8 py-3 md:py-5 border-b border-[#e2e8f0] sticky top-0 bg-[#f8fbff]/85 backdrop-blur-xl z-10 flex flex-col lg:flex-row justify-between lg:items-start gap-3 md:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm text-slate-500">
             <span className="cursor-pointer hover:underline" onClick={() => navigate('dashboard')}>{t('breadcrumbs.dashboard')}</span> / <span>{t('breadcrumbs.cases')}</span>
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-[#1f2937] flex items-center gap-2 md:gap-3">
            {currentCase.name}
            <StatusBadge status={currentCase.status} />
          </h1>
          <div className="text-xs md:text-sm text-slate-500 mt-1 flex gap-3 flex-wrap">
             <span>{currentCase.type}</span>
             {currentCase.updatedAt && <span>• Updated {new Date(currentCase.updatedAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           {!isEditing ? (
             <button onClick={() => { setIsEditing(true); setDraftCase(currentCase); }} className="px-3 py-1.5 border border-[#d9e1ed] bg-white rounded-xl text-sm whitespace-nowrap hover:bg-gray-50">{t('actions.edit')}</button>
           ) : (
           <button onClick={() => { if (draftCase) updateCase(draftCase); setIsEditing(false); }} className="px-3 py-1.5 border accent-border rounded-xl text-sm whitespace-nowrap accent-bg accent-bg-hover text-white">{t('actions.saveChanges')}</button>
           )}
           <button 
             onClick={() => setShowDeleteConfirm(true)}
             className="px-3 py-1.5 border border-[#d6b8c6] text-[#7a4f69] rounded-xl text-sm whitespace-nowrap hover:bg-[#f8eeef]"
           >{t('actions.deleteCase')}</button>
           <select 
             className="px-3 py-1.5 border border-[#d9e1ed] bg-white rounded-xl text-sm min-w-[112px] hover:bg-gray-50 outline-none cursor-pointer"
             value={currentCase.status}
             onChange={handleStatusChange}
           >
              <option value="active">{t('status.active')}</option>
              <option value="dormant">{t('status.dormant')}</option>
              <option value="archived">{t('status.archived')}</option>
           </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 md:px-8 py-2.5 border-b border-[#e2e8f0] flex gap-2 text-sm overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        {['info', 'tasks', 'schedule', 'deadlines', 'logs', 'trash'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`craft-tab capitalize whitespace-nowrap snap-start ${activeTab === tab ? 'craft-tab-active font-medium' : ''}`}
          >
            {tab === 'trash' ? t('tabs.trash') : t(`tabs.${tab}`)}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2.5 md:p-8 pb-24 md:pb-8 bg-gradient-to-b from-[#f8fbff]/70 to-[#f4f8ff]/45">
        <div className="max-w-5xl mx-auto">
          
          {activeTab === 'info' && draftCase && (
            <InfoTab 
              c={draftCase} 
              editing={isEditing} 
              onDraftUpdate={(c) => setDraftCase(c)} 
              onCommitUpdate={(c) => { setDraftCase(c); updateCase(c); }} 
              allParties={parties} 
            />
          )}

          {activeTab === 'tasks' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                 <h3 className="font-bold text-[#4f445a]">{t('tasks.title')} ({currentCase.tasks.length})</h3>
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
                   className="w-full border border-[#d9cfde] rounded-xl p-3 text-sm bg-white/90 text-[#3f2f4d] focus:ring-2 focus:ring-[#e7d9ee] outline-none"
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
               <div className="space-y-6 relative border-l border-[#ddd2e3] ml-4 pl-8">
                 {currentCase.logs.map(log => (
                   <div key={log.id} className="relative group">
                     <div className="absolute -left-[39px] top-1 h-5 w-5 rounded-full bg-white border-2 border-[#d2c3da] z-10"></div>
                     <div className="text-xs text-gray-400 mb-1">{formatDateTime(log.date)}</div>
                     <div className="bg-white/92 p-3 rounded-xl border border-[#ddd2e3] text-sm shadow-sm text-[#3f2f4d] whitespace-pre-wrap">
                       {log.content}
                     </div>
                     <button 
                       onClick={() => handleDeleteLog(log.id)}
                       className="absolute top-0 right-0 p-2 text-gray-300 hover:text-[#7a4f69] opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="bg-[#f4edf8] border border-[#dbcde6] p-4 rounded-lg mb-6 flex flex-col sm:flex-row sm:items-end gap-2">
               <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                 <div className="col-span-2">
                     <label className="block text-xs text-[#5b4f78] font-bold mb-1">{t('schedule.newEvent')}</label>
                     <input id="sch-title" placeholder={t('schedule.eventPlaceholder')} className="w-full text-sm p-2 rounded border border-[#dbcde6] outline-none" />
                 </div>
                 <div>
                     <label className="block text-xs text-[#5b4f78] font-bold mb-1">{t('schedule.dateTime')}</label>
                    <div className="flex gap-1">
                       <input id="sch-date" type="date" className="w-full text-sm p-2 rounded border border-[#dbcde6] outline-none" />
                       <input id="sch-time" type="time" className="w-24 text-sm p-2 rounded border border-[#dbcde6] outline-none" />
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
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border bg-white/92 border-[#dbcde6] shadow-sm">
                    {editingReminderId === r.id ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end mr-4">
                        <div>
                          <label className="block text-[10px] text-[#7a7083] mb-1">Title</label>
                          <input className="w-full text-sm p-2 rounded border border-[#ddd2e3] outline-none text-[#3f2f4d]" value={remEditTitle} onChange={e => setRemEditTitle(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7a7083] mb-1">Date</label>
                          <input type="date" className="w-full text-sm p-2 rounded border border-[#ddd2e3] outline-none text-[#3f2f4d]" value={remEditDate} onChange={e => setRemEditDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#7a7083] mb-1">Time</label>
                          <input type="time" className="w-full text-sm p-2 rounded border border-[#ddd2e3] outline-none text-[#3f2f4d]" value={remEditTime} onChange={e => setRemEditTime(e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-xs text-[#7a7083] uppercase font-bold">{new Date(r.date).toLocaleString('default', { month: 'short' })}</div>
                          <div className="text-xl font-bold text-[#3f2f4d] leading-none">{new Date(r.date).getDate()}</div>
                          <div className="text-xs text-gray-400">{r.time}</div>
                        </div>
                        <div className="h-8 w-px bg-[#ddd2e3]"></div>
                        <div className="font-medium text-sm text-[#3f2f4d]">{r.title}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {editingReminderId === r.id ? (
                        <>
                          <button 
                            className="text-sm px-3 py-1 border border-[#ddd2e3] rounded hover:bg-white"
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
                            className="text-sm px-3 py-1 border border-[#ddd2e3] rounded hover:bg-white"
                            onClick={() => { setEditingReminderId(null); }}
                          >Cancel</button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="text-gray-400 hover:text-[#6b5a8b]"
                            onClick={() => { setEditingReminderId(r.id); setRemEditTitle(r.title); setRemEditDate(r.date); setRemEditTime(r.time); }}
                          ><Edit2 size={14}/></button>
                          <button onClick={() => handleDeleteReminder(r.id)} className="text-gray-300 hover:text-[#7a4f69]"><Trash2 size={14}/></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {currentCase.reminders.length === 0 && <div className="text-center py-10 text-gray-400">No scheduled events.</div>}
              </div>
            </div>
          )}

          {activeTab === 'deadlines' && (
            <div className="animate-fade-in">
              <div className="bg-[#f8eeef] border border-[#e7d2d8] p-4 rounded-lg mb-6 flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-[#7a4f69] font-bold mb-1">{t('deadlines.new')}</label>
                  <input id="dl-title" placeholder="Description (e.g. Evidence Submission)" className="w-full text-sm p-2 rounded border border-[#e2c7d1] outline-none mb-2" />
                  <input id="dl-date" type="date" className="w-full text-sm p-2 rounded border border-[#e2c7d1] outline-none" />
                </div>
                <button 
                  className="bg-[#7a4f69] text-white px-4 py-2 rounded text-sm hover:bg-[#683f56] shadow-sm w-full sm:w-auto"
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
                  <div key={dl.id} className={`flex items-center justify-between p-3 rounded-xl border ${dl.completed ? 'bg-[#f5f1f6] border-[#ddd2e3] opacity-70' : 'bg-white/92 border-[#e2c7d1] shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                       <input 
                         type="checkbox" 
                         checked={dl.completed} 
                         onChange={() => {
                            const newDLs = currentCase.deadlines.map(x => x.id === dl.id ? {...x, completed: !x.completed} : x);
                            updateCase({...currentCase, deadlines: newDLs});
                         }}
                         className="w-4 h-4 rounded border-gray-300 text-[#7a4f69] focus:ring-[#d6b8c6]"
                       />
                       <div>
                         <div className={`font-medium text-sm ${dl.completed ? 'line-through text-[#847b8d]' : 'text-[#3f2f4d]'}`}>{dl.title}</div>
                         <div className="text-xs text-[#7a4f69] font-mono">{dl.date}</div>
                       </div>
                    </div>
                    <button onClick={() => handleDeleteDeadline(dl.id)} className="text-gray-300 hover:text-[#7a4f69]"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trash' && (
            <div className="animate-fade-in">
               <h3 className="font-bold text-[#4f445a] mb-4">Recycle Bin</h3>
               <div className="space-y-6">
                  {/* Tasks */}
                  <div>
                     <h4 className="text-sm font-bold text-[#6f6377] mb-2 flex items-center gap-2"><CheckCircle size={14}/> Deleted Tasks</h4>
                     {getTrash().tasks.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted tasks.</div> : 
                       <div className="space-y-2">
                         {getTrash().tasks.map(t => (
                           <div key={t.id} className="flex justify-between items-center p-2 bg-[#f5f1f6] border border-[#ddd2e3] rounded-xl">
                              <span className="text-sm text-[#7a7083] line-through">{t.desc}</span>
                              <button onClick={() => handleRestore('task', t.id)} className="text-xs text-[#6b5a8b] hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Logs */}
                  <div>
                     <h4 className="text-sm font-bold text-[#6f6377] mb-2 flex items-center gap-2"><FileText size={14}/> Deleted Logs</h4>
                     {getTrash().logs.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted logs.</div> : 
                       <div className="space-y-2">
                         {getTrash().logs.map(l => (
                           <div key={l.id} className="flex justify-between items-center p-2 bg-[#f5f1f6] border border-[#ddd2e3] rounded-xl">
                              <span className="text-sm text-[#7a7083] truncate max-w-[300px]">{l.content}</span>
                              <button onClick={() => handleRestore('log', l.id)} className="text-xs text-[#6b5a8b] hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Schedule */}
                  <div>
                     <h4 className="text-sm font-bold text-[#6f6377] mb-2 flex items-center gap-2"><Calendar size={14}/> Deleted Schedule</h4>
                     {getTrash().reminders.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted schedule items.</div> : 
                       <div className="space-y-2">
                         {getTrash().reminders.map(r => (
                           <div key={r.id} className="flex justify-between items-center p-2 bg-[#f5f1f6] border border-[#ddd2e3] rounded-xl">
                              <span className="text-sm text-[#7a7083]">{r.title} ({r.date})</span>
                              <button onClick={() => handleRestore('reminder', r.id)} className="text-xs text-[#6b5a8b] hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Deadlines */}
                  <div>
                     <h4 className="text-sm font-bold text-[#6f6377] mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Deleted Deadlines</h4>
                     {getTrash().deadlines.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted deadlines.</div> : 
                       <div className="space-y-2">
                         {getTrash().deadlines.map(d => (
                           <div key={d.id} className="flex justify-between items-center p-2 bg-[#f5f1f6] border border-[#ddd2e3] rounded-xl">
                              <span className="text-sm text-[#7a7083]">{d.title} ({d.date})</span>
                              <button onClick={() => handleRestore('deadline', d.id)} className="text-xs text-[#6b5a8b] hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
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
            <div className="text-sm text-[#6f6377] mb-4">此操作将移除该案件并返回仪表盘。请确认。</div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border border-[#ddd2e3] rounded text-sm" onClick={() => setShowDeleteConfirm(false)}>取消</button>
              <button className="px-3 py-1.5 border border-[#d6b8c6] text-white bg-[#7a4f69] rounded text-sm hover:bg-[#683f56]" onClick={() => { setShowDeleteConfirm(false); deleteCase(currentCase.id); }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
