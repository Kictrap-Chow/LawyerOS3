import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { useI18n } from '../store/I18nContext';
import { Case, Task, Log, Reminder, Deadline, Party, Proceeding } from '../types';
import { calculateTaskDuration, formatTimeDuration, nowISO, uuid, formatDateTime } from '../utils';
import { 
  Play, Pause, CheckCircle, RotateCcw, Plus, Trash2, Calendar, 
  FileText, Clock, AlertTriangle, MessageSquare, ChevronDown, Scale, Edit2
} from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    active: 'bg-green-100 text-green-700 border-green-200',
    dormant: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    archived: 'bg-gray-100 text-gray-600 border-gray-200'
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${colors[status as keyof typeof colors] || colors.active} uppercase font-medium`}>
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
          className="w-full border border-gray-300 rounded p-2 mb-4 text-sm outline-none focus:border-blue-500"
          placeholder="Search parties..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded mb-4">
          {filtered.map(p => (
            <div 
              key={p.id} 
              className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-0"
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
           <button onClick={() => onSelect({ id: uuid(), name: search, type: 'company', idCode: '', address: '' })} className="px-3 py-1.5 text-sm bg-black text-white rounded hover:bg-gray-800">Create "{search}"</button>
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
  const [duration, setDuration] = useState(calculateTaskDuration(task));
  const [showManualInput, setShowManualInput] = useState(false);
  // Manual entry state
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

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

  return (
    <div className={`group flex flex-col sm:flex-row gap-3 p-3 mb-2 rounded border transition-all ${task.isRunning ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          {task.isCompleted && <CheckCircle size={16} className="text-green-500" />}
          <input 
            className={`font-medium text-sm bg-transparent outline-none w-full ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}
            value={task.desc}
            onChange={(e) => onUpdate({ ...task, desc: e.target.value })}
            placeholder="Task description..."
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
            placeholder="Assignee"
            value={task.assignee}
            onChange={(e) => onUpdate({...task, assignee: e.target.value})}
          />
        </div>
        <textarea 
           className="w-full text-xs text-gray-500 bg-transparent outline-none resize-none h-auto overflow-hidden placeholder-gray-300" 
           placeholder="Notes..."
           rows={1}
           value={task.notes}
           onChange={(e) => onUpdate({...task, notes: e.target.value})}
        />
      </div>

      <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 min-w-[100px]">
        {task.isCompleted ? (
           <div className="text-center">
             <div className="text-xs font-bold text-green-600">Done</div>
             <button onClick={() => onUpdate({...task, isCompleted: false})} className="text-[10px] underline text-gray-400 hover:text-blue-500 flex items-center gap-1 mt-1">
               <RotateCcw size={10} /> Reopen
             </button>
           </div>
        ) : (
          <>
            <div className="font-mono text-lg font-semibold text-gray-700 cursor-help" title="Total duration">{formatTimeDuration(duration)}</div>
            <div className="flex gap-1 w-full items-center justify-center">
              <button 
                onClick={toggleTimer}
                className={`flex-1 flex items-center justify-center p-1 rounded text-white text-xs transition-colors ${task.isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                {task.isRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
              
              <div className="relative">
                  <button 
                    onClick={() => setShowManualInput(!showManualInput)} 
                    className={`p-1 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors ${showManualInput ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                    title="Add/Subtract Time"
                    type="button"
                  >
                    <Clock size={14} />
                  </button>
                  
                  {showManualInput && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-gray-200 p-3 rounded z-20 w-64 max-w-[95vw] animate-fade-in">
                       <div className="text-xs font-bold text-gray-700 mb-2">Add Manual Session</div>
                       <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">Start Time</label>
                            <input 
                              type="datetime-local"
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                              value={manualStart}
                              onChange={e => setManualStart(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">End Time</label>
                            <input 
                              type="datetime-local"
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                              value={manualEnd}
                              onChange={e => setManualEnd(e.target.value)}
                            />
                          </div>
                          <button onClick={handleManualSubmit} className="w-full bg-blue-600 text-white py-1 rounded text-xs hover:bg-blue-700 mt-2">Add Session</button>
                       </div>
                       <div className="mt-2 text-[10px] text-gray-400 text-center cursor-pointer hover:text-gray-600 underline" onClick={() => setShowManualInput(false)}>Cancel</div>
                    </div>
                  )}
              </div>

              <button onClick={completeTask} className="p-1 rounded bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 transition-colors">
                <CheckCircle size={14} />
              </button>
            </div>
          </>
        )}
         <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all absolute top-2 right-2 sm:static">
             <Trash2 size={12} />
         </button>
      </div>
    </div>
  );
};

const InfoTab = ({ c, editing, onDraftUpdate, onCommitUpdate, allParties }: { c: Case, editing: boolean, onDraftUpdate: (c: Case) => void, onCommitUpdate: (c: Case) => void, allParties: Party[] }) => {
  const [showPartySelector, setShowPartySelector] = useState<'client' | 'opponent' | null>(null);
  const { addParty, updateParty, parties } = useData();

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
      alert('请点击 Edit Properties 开启编辑后再进行删除');
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in pb-20">
      <div className="space-y-6">
        {/* Client Info */}
        <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm group">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><MessageSquare size={14}/> Client Information</h3>
            <button onClick={() => addPartyToCase(true)} className="text-xs text-blue-600 hover:underline">+ Add Client</button>
          </div>
          {c.clients.map(p => (
             <div key={p.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-50 last:border-0 relative">
               <button disabled={!editing} onClick={() => removeParty(true, p.id)} className={`absolute right-0 top-0 ${editing ? 'text-gray-300 hover:text-red-500' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>
               <div className="flex gap-2 mb-2">
                  <select 
                    className="text-lg bg-transparent outline-none cursor-pointer"
                    value={p.type}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'type', e.target.value as any)}
                    disabled={!editing}
                  >
                    <option value="company">🏢</option>
                    <option value="individual">👤</option>
                  </select>
                  <input 
                    className="font-medium text-[#37352f] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-full transition-colors"
                    placeholder="Client Name"
                    value={p.name}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'name', e.target.value)}
                    disabled={!editing}
                  />
               </div>
               <div className="grid grid-cols-2 gap-2 mb-2">
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-blue-200"
                    placeholder="ID/Credit Code"
                    value={p.idCode || ''}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'idCode', e.target.value)}
                    disabled={!editing}
                 />
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-blue-200"
                    placeholder="Address"
                    value={p.address || ''}
                    onChange={(e) => handlePartyUpdate(true, p.id, 'address', e.target.value)}
                    disabled={!editing}
                 />
               </div>
               <input 
                  className="w-full text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-blue-200"
                  placeholder="Remarks / Notes"
                  value={p.note || ''}
                  onChange={(e) => handlePartyUpdate(true, p.id, 'note', e.target.value)}
                  disabled={!editing}
              />
             </div>
          ))}
          {c.clients.length === 0 && <div className="text-sm text-gray-400 italic py-2 text-center">No clients added.</div>}
          
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Person</label>
                  <input 
                    className="w-full text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-blue-500 outline-none bg-transparent"
                    placeholder="Name"
                    value={c.clientContactName || ''}
                    onChange={(e) => onUpdate({...c, clientContactName: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Info</label>
                  <input 
                    className="w-full text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-blue-500 outline-none bg-transparent"
                    placeholder="Phone/Email"
                    value={c.clientContactInfo || ''}
                    onChange={(e) => onUpdate({...c, clientContactInfo: e.target.value})}
                  />
               </div>
             </div>
          </div>
        </div>

        {/* Opponent Info */}
        <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm group">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Scale size={14}/> Opponent Information</h3>
            <button onClick={() => addPartyToCase(false)} className="text-xs text-blue-600 hover:underline">+ Add Opponent</button>
          </div>
          {c.opponents.map(p => (
             <div key={p.id} className="mb-4 last:mb-0 pb-4 border-b border-gray-50 last:border-0 relative">
               <button disabled={!editing} onClick={() => removeParty(false, p.id)} className={`absolute right-0 top-0 ${editing ? 'text-gray-300 hover:text-red-500' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>
               <div className="flex gap-2 mb-2">
                  <select 
                    className="text-lg bg-transparent outline-none cursor-pointer"
                    value={p.type}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'type', e.target.value as any)}
                    disabled={!editing}
                  >
                    <option value="company">🏢</option>
                    <option value="individual">👤</option>
                  </select>
                  <input 
                    className="font-medium text-[#37352f] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-full transition-colors"
                    placeholder="Opponent Name"
                    value={p.name}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'name', e.target.value)}
                    disabled={!editing}
                  />
               </div>
               <div className="grid grid-cols-2 gap-2 mb-2">
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-blue-200"
                    placeholder="ID/Credit Code"
                    value={p.idCode || ''}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'idCode', e.target.value)}
                    disabled={!editing}
                 />
                 <input 
                    className="text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-blue-200"
                    placeholder="Address"
                    value={p.address || ''}
                    onChange={(e) => handlePartyUpdate(false, p.id, 'address', e.target.value)}
                    disabled={!editing}
                 />
               </div>
               <input 
                  className="w-full text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 outline-none focus:bg-white focus:ring-1 ring-blue-200"
                  placeholder="Remarks / Notes"
                  value={p.note || ''}
                  onChange={(e) => handlePartyUpdate(false, p.id, 'note', e.target.value)}
                  disabled={!editing}
              />
             </div>
          ))}
          {c.opponents.length === 0 && <div className="text-sm text-gray-400 italic py-2 text-center">No opponents added.</div>}
        </div>
      </div>

      <div className="space-y-6">
         {/* Proceedings */}
         {(c.type === '诉讼' || c.type === '仲裁') && (
           <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase">Proceedings</h3>
                <button 
                  onClick={() => {
                    const newProc: Proceeding = {
                      id: uuid(), stageName: 'New Stage', myRole: '', caseNo: '', courtName: '', courtAddress: '',
                      personnel: []
                    };
                    onCommitUpdate({ ...c, litigation: { ...c.litigation, proceedings: [...c.litigation.proceedings, newProc] } });
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >+ Add Stage</button>
              </div>
              
              {c.litigation.proceedings.map((proc, idx) => (
                <div key={proc.id} className="mb-6 last:mb-0 pb-6 border-b border-gray-100 last:border-0 relative">
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2 items-center">
                        <input 
                          className="font-bold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-32"
                          value={proc.stageName}
                          onChange={(e) => handleProcUpdate(proc.id, 'stageName', e.target.value)}
                          disabled={!editing}
                          placeholder="Stage"
                        />
                        <input 
                           className="text-xs text-gray-500 bg-gray-50 rounded border-none outline-none py-1 px-2"
                           value={proc.myRole}
                           onChange={(e) => handleProcUpdate(proc.id, 'myRole', e.target.value)}
                           placeholder="客户地位"
                           disabled={!editing}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                         <input 
                           className="text-xs font-mono bg-gray-50 px-2 py-1 rounded border border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-40 text-right"
                           value={proc.caseNo}
                           onChange={(e) => handleProcUpdate(proc.id, 'caseNo', e.target.value)}
                           disabled={!editing}
                           placeholder="Case No."
                         />
                         {idx > 0 && <button disabled={!editing} onClick={() => {
                            const updated = c.litigation.proceedings.filter(p => p.id !== proc.id);
                            onCommitUpdate({ ...c, litigation: { ...c.litigation, proceedings: updated } });
                         }} className={`${editing ? 'text-gray-300 hover:text-red-500' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={14}/></button>}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-16">Institution</span>
                           <input 
                             className="flex-1 text-xs border-b border-gray-100 hover:border-gray-300 focus:border-blue-500 outline-none py-1"
                             value={proc.courtName}
                             onChange={(e) => handleProcUpdate(proc.id, 'courtName', e.target.value)}
                             disabled={!editing}
                             placeholder="Court / Arbitration Comm."
                           />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-16">Address</span>
                           <input 
                             className="flex-1 text-xs border-b border-gray-100 hover:border-gray-300 focus:border-blue-500 outline-none py-1"
                             value={proc.courtAddress}
                             onChange={(e) => handleProcUpdate(proc.id, 'courtAddress', e.target.value)}
                             disabled={!editing}
                             placeholder="Address"
                           />
                        </div>
                      </div>
                      
                      {/* Personnel List */}
                      <div className="bg-gray-50 rounded p-2">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Personnel</span>
                            <button onClick={() => handleAddPerson(proc.id)} className="text-[10px] text-blue-600 hover:underline">+ Add Person</button>
                         </div>
                         {(proc.personnel || []).map((per: any) => (
                            <div key={per.id} className="flex gap-2 items-center mb-2 last:mb-0 group">
                               <input 
                                 className="w-20 text-xs bg-white border border-gray-200 rounded px-1 py-0.5 outline-none"
                                 value={per.role}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'role', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Role"
                               />
                               <input 
                                 className="flex-1 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
                                 value={per.name}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'name', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Name"
                               />
                               <input 
                                 className="w-24 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
                                 value={per.contact}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'contact', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Contact"
                               />
                               <input 
                                 className="flex-1 text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
                                 value={per.note || ''}
                                 onChange={(e) => handleUpdatePerson(proc.id, per.id, 'note', e.target.value)}
                                 disabled={!editing}
                                 placeholder="Notes"
                               />
                               <button disabled={!editing} onClick={() => handleRemovePerson(proc.id, per.id)} className={`${editing ? 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500' : 'text-gray-200 cursor-not-allowed'}`}><Trash2 size={12}/></button>
                            </div>
                         ))}
                         {(proc.personnel || []).length === 0 && <div className="text-xs text-gray-400 italic text-center py-2">No personnel added.</div>}
                      </div>
                   </div>
                </div>
              ))}
           </div>
         )}
         
         {/* Special Project Scope */}
         {(c.type === '专项法律服务' || c.type === '常年法律顾问') && (
           <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Project Scope</h3>
              <textarea 
                className="w-full text-sm text-gray-700 min-h-[150px] border border-transparent hover:border-gray-200 focus:border-blue-500 rounded p-2 outline-none resize-y"
                value={c.specialProjectRemarks || ''}
                onChange={(e) => onUpdate({...c, specialProjectRemarks: e.target.value})}
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
  const { cases, activeCaseId, updateCase, deleteCase, navigate, parties } = useData();
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
    }
  }, [currentCase?.id]);

  if (!currentCase) return <div className="p-8 text-center text-gray-500">Case not found.</div>;

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
       updateCase({
         ...currentCase,
         deadlines: currentCase.deadlines.filter(d => d.id !== id),
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
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#e9e9e7] sticky top-0 bg-white/80 backdrop-blur-md z-10 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
             <span className="cursor-pointer hover:underline" onClick={() => navigate('dashboard')}>{t('breadcrumbs.dashboard')}</span> / <span>{t('breadcrumbs.cases')}</span>
          </div>
          <h1 className="text-3xl font-bold text-[#37352f] flex items-center gap-3">
            {currentCase.name}
            <StatusBadge status={currentCase.status} />
          </h1>
          <div className="text-sm text-gray-500 mt-1 flex gap-4">
             <span>{currentCase.type}</span>
             <span>• Created {currentCase.id.substring(0, 8)}...</span>
          </div>
        </div>
        <div className="flex gap-2">
           {!isEditing ? (
             <button onClick={() => { setIsEditing(true); setDraftCase(currentCase); }} className="px-3 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50">{t('actions.edit')}</button>
           ) : (
             <button onClick={() => { if (draftCase) updateCase(draftCase); setIsEditing(false); }} className="px-3 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 bg-black text-white">{t('actions.saveChanges')}</button>
           )}
           <button 
             onClick={() => setShowDeleteConfirm(true)}
             className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
           >{t('actions.deleteCase')}</button>
           <select 
             className="px-3 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 outline-none cursor-pointer"
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
      <div className="px-8 border-b border-[#e9e9e7] flex gap-6 text-sm">
        {['info', 'tasks', 'schedule', 'deadlines', 'logs', 'trash'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`py-3 cursor-pointer border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-black text-black font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {tab === 'trash' ? t('tabs.trash') : t(`tabs.${tab}`)}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
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
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-700">{t('tasks.title')} ({currentCase.tasks.length})</h3>
                 <div className="flex gap-2">
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
                      className="flex items-center gap-1 border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      <FileText size={16} /> {t('tasks.export')}
                    </button>
                    <button onClick={handleAddTask} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 shadow-sm">
                      <Plus size={16} /> {t('tasks.add')}
                    </button>
                 </div>
              </div>
              <div className="space-y-1">
                {currentCase.tasks.length === 0 ? <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg">No tasks yet. Create one!</div> : 
                  currentCase.tasks.map(t => (
                    <TaskItem key={t.id} task={t} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                  ))
                }
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
             <div className="animate-fade-in max-w-3xl">
               <div className="mb-6 flex gap-2">
                 <textarea 
                   id="logInput"
                   className="w-full border border-gray-300 rounded p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
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
                    className="bg-gray-800 text-white px-4 rounded hover:bg-black transition-colors"
                 >{t('logs.post')}</button>
               </div>
               <div className="space-y-6 relative border-l border-gray-200 ml-4 pl-8">
                 {currentCase.logs.map(log => (
                   <div key={log.id} className="relative group">
                     <div className="absolute -left-[39px] top-1 h-5 w-5 rounded-full bg-white border-2 border-gray-300 z-10"></div>
                     <div className="text-xs text-gray-400 mb-1">{formatDateTime(log.date)}</div>
                     <div className="bg-white p-3 rounded border border-gray-200 text-sm shadow-sm text-gray-800 whitespace-pre-wrap">
                       {log.content}
                     </div>
                     <button 
                       onClick={() => handleDeleteLog(log.id)}
                       className="absolute top-0 right-0 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6 flex items-end gap-2">
               <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                 <div className="col-span-2">
                     <label className="block text-xs text-blue-700 font-bold mb-1">{t('schedule.newEvent')}</label>
                     <input id="sch-title" placeholder={t('schedule.eventPlaceholder')} className="w-full text-sm p-2 rounded border border-blue-200 outline-none" />
                 </div>
                 <div>
                     <label className="block text-xs text-blue-700 font-bold mb-1">{t('schedule.dateTime')}</label>
                    <div className="flex gap-1">
                       <input id="sch-date" type="date" className="w-full text-sm p-2 rounded border border-blue-200 outline-none" />
                       <input id="sch-time" type="time" className="w-24 text-sm p-2 rounded border border-blue-200 outline-none" />
                    </div>
                 </div>
               </div>
                <button 
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 shadow-sm h-[38px]"
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
                  <div key={r.id} className="flex items-center justify-between p-3 rounded border bg-white border-blue-200 shadow-sm">
                    {editingReminderId === r.id ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end mr-4">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Title</label>
                          <input className="w-full text-sm p-2 rounded border border-gray-200 outline-none" value={remEditTitle} onChange={e => setRemEditTitle(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Date</label>
                          <input type="date" className="w-full text-sm p-2 rounded border border-gray-200 outline-none" value={remEditDate} onChange={e => setRemEditDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Time</label>
                          <input type="time" className="w-full text-sm p-2 rounded border border-gray-200 outline-none" value={remEditTime} onChange={e => setRemEditTime(e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-xs text-gray-500 uppercase font-bold">{new Date(r.date).toLocaleString('default', { month: 'short' })}</div>
                          <div className="text-xl font-bold text-gray-800 leading-none">{new Date(r.date).getDate()}</div>
                          <div className="text-xs text-gray-400">{r.time}</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <div className="font-medium text-sm text-gray-800">{r.title}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {editingReminderId === r.id ? (
                        <>
                          <button 
                            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
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
                            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                            onClick={() => { setEditingReminderId(null); }}
                          >Cancel</button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="text-gray-400 hover:text-blue-600"
                            onClick={() => { setEditingReminderId(r.id); setRemEditTitle(r.title); setRemEditDate(r.date); setRemEditTime(r.time); }}
                          ><Edit2 size={14}/></button>
                          <button onClick={() => handleDeleteReminder(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
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
              <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-red-700 font-bold mb-1">{t('deadlines.new')}</label>
                  <input id="dl-title" placeholder="Description (e.g. Evidence Submission)" className="w-full text-sm p-2 rounded border border-red-200 outline-none mb-2" />
                  <input id="dl-date" type="date" className="w-full text-sm p-2 rounded border border-red-200 outline-none" />
                </div>
                <button 
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 shadow-sm"
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
                  <div key={dl.id} className={`flex items-center justify-between p-3 rounded border ${dl.completed ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-red-200 shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                       <input 
                         type="checkbox" 
                         checked={dl.completed} 
                         onChange={() => {
                            const newDLs = currentCase.deadlines.map(x => x.id === dl.id ? {...x, completed: !x.completed} : x);
                            updateCase({...currentCase, deadlines: newDLs});
                         }}
                         className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                       />
                       <div>
                         <div className={`font-medium text-sm ${dl.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{dl.title}</div>
                         <div className="text-xs text-red-500 font-mono">{dl.date}</div>
                       </div>
                    </div>
                    <button onClick={() => handleDeleteDeadline(dl.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trash' && (
            <div className="animate-fade-in">
               <h3 className="font-bold text-gray-700 mb-4">Recycle Bin</h3>
               <div className="space-y-6">
                  {/* Tasks */}
                  <div>
                     <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2"><CheckCircle size={14}/> Deleted Tasks</h4>
                     {getTrash().tasks.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted tasks.</div> : 
                       <div className="space-y-2">
                         {getTrash().tasks.map(t => (
                           <div key={t.id} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded">
                              <span className="text-sm text-gray-600 line-through">{t.desc}</span>
                              <button onClick={() => handleRestore('task', t.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Logs */}
                  <div>
                     <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2"><FileText size={14}/> Deleted Logs</h4>
                     {getTrash().logs.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted logs.</div> : 
                       <div className="space-y-2">
                         {getTrash().logs.map(l => (
                           <div key={l.id} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded">
                              <span className="text-sm text-gray-600 truncate max-w-[300px]">{l.content}</span>
                              <button onClick={() => handleRestore('log', l.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Schedule */}
                  <div>
                     <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2"><Calendar size={14}/> Deleted Schedule</h4>
                     {getTrash().reminders.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted schedule items.</div> : 
                       <div className="space-y-2">
                         {getTrash().reminders.map(r => (
                           <div key={r.id} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded">
                              <span className="text-sm text-gray-600">{r.title} ({r.date})</span>
                              <button onClick={() => handleRestore('reminder', r.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
                           </div>
                         ))}
                       </div>
                     }
                  </div>
                  {/* Deadlines */}
                  <div>
                     <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Deleted Deadlines</h4>
                     {getTrash().deadlines.length === 0 ? <div className="text-xs text-gray-400 italic">No deleted deadlines.</div> : 
                       <div className="space-y-2">
                         {getTrash().deadlines.map(d => (
                           <div key={d.id} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded">
                              <span className="text-sm text-gray-600">{d.title} ({d.date})</span>
                              <button onClick={() => handleRestore('deadline', d.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><RotateCcw size={12}/> Restore</button>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[420px] max-w-[95vw] p-6" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-2">确认删除案件</div>
            <div className="text-sm text-gray-600 mb-4">此操作将移除该案件并返回仪表盘。请确认。</div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded text-sm" onClick={() => setShowDeleteConfirm(false)}>取消</button>
              <button className="px-3 py-1.5 border border-red-300 text-white bg-red-600 rounded text-sm hover:bg-red-700" onClick={() => { setShowDeleteConfirm(false); deleteCase(currentCase.id); }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
