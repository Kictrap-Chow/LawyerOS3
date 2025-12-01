import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { Case, Task, Log, Reminder, Deadline } from '../types';
import { calculateTaskDuration, formatTimeDuration, nowISO, uuid, formatDateTime } from '../utils';
import { 
  Play, Pause, CheckCircle, RotateCcw, Plus, Trash2, Calendar, 
  FileText, Clock, AlertTriangle, MessageSquare, ChevronDown, Scale
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

interface TaskItemProps {
  task: Task;
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete }) => {
  const [duration, setDuration] = useState(calculateTaskDuration(task));

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
  }, [task.isRunning, task.sessions]);

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
            <div className="font-mono text-lg font-semibold text-gray-700">{formatTimeDuration(duration)}</div>
            <div className="flex gap-1 w-full">
              <button 
                onClick={toggleTimer}
                className={`flex-1 flex items-center justify-center p-1 rounded text-white text-xs transition-colors ${task.isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                {task.isRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
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

const InfoTab = ({ c }: { c: Case }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><MessageSquare size={14}/> Client Information</h3>
        {c.clients.map(p => (
           <div key={p.id} className="mb-2 last:mb-0 pb-2 border-b border-gray-50 last:border-0">
             <div className="flex items-center gap-2">
                <span className="text-lg">{p.type === 'company' ? '🏢' : '👤'}</span>
                <span className="font-medium text-[#37352f]">{p.name}</span>
             </div>
             <div className="pl-7 text-xs text-gray-500 font-mono mt-1">
                {p.idCode || 'No ID'} • {p.address || 'No Addr'}
             </div>
           </div>
        ))}
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
           <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs text-gray-400">Contact</label>
                <div className="text-gray-800">{c.clientContactName || '-'}</div>
             </div>
             <div>
                <label className="block text-xs text-gray-400">Info</label>
                <div className="text-gray-800">{c.clientContactInfo || '-'}</div>
             </div>
           </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={14}/> Opponents</h3>
        {c.opponents.length === 0 ? <p className="text-sm text-gray-400 italic">None listed</p> : c.opponents.map(p => (
           <div key={p.id} className="mb-2">
             <div className="font-medium text-[#37352f] flex items-center gap-2">
               <span className="text-xs bg-red-100 text-red-600 px-1 rounded">VS</span> {p.name}
             </div>
           </div>
        ))}
      </div>
    </div>

    <div className="space-y-6">
       {(c.type === '诉讼' || c.type === '仲裁') && (
         <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Scale size={14} /> Proceedings</h3>
            {c.litigation.proceedings.length === 0 ? <p className="text-sm text-gray-400 italic">No proceedings data.</p> : c.litigation.proceedings.map(proc => (
              <div key={proc.id} className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                 <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-200 border-dashed">
                    <div>
                      <span className="font-bold text-blue-700">{proc.stageName}</span>
                      <span className="text-xs text-gray-500 ml-2">({proc.myRole})</span>
                    </div>
                    <span className="text-xs font-mono bg-white px-1 border rounded">{proc.caseNo || 'N/A'}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div><span className="text-gray-400">Court:</span> {proc.courtName || '-'}</div>
                    <div><span className="text-gray-400">Judge:</span> {proc.judgeName || proc.chiefArb || '-'}</div>
                    <div className="col-span-2 text-gray-500 truncate"><span className="text-gray-400">Addr:</span> {proc.courtAddress}</div>
                 </div>
              </div>
            ))}
         </div>
       )}
       {c.type === '专项法律服务' && (
         <div className="bg-white p-4 rounded-lg border border-[#e9e9e7] shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Project Scope</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.specialProjectRemarks || 'No remarks.'}</p>
         </div>
       )}
    </div>
  </div>
);

// --- Main Component ---

export const CaseDetail: React.FC = () => {
  const { cases, activeCaseId, updateCase, deleteCase, navigate } = useData();
  const [activeTab, setActiveTab] = useState<'info' | 'tasks' | 'deadlines' | 'logs'>('info');

  const currentCase = cases.find(c => c.id === activeCaseId);

  if (!currentCase) return <div className="p-8 text-center text-gray-500">Case not found.</div>;

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
    updateCase({ ...currentCase, tasks: currentCase.tasks.filter(t => t.id !== id) });
  };

  const handleAddLog = (content: string) => {
    if (!content.trim()) return;
    const newLog: Log = { id: uuid(), date: nowISO(), content };
    updateCase({ ...currentCase, logs: [newLog, ...currentCase.logs] });
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
             <span className="cursor-pointer hover:underline" onClick={() => navigate('dashboard')}>Dashboard</span> / <span>Cases</span>
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
           <button onClick={() => navigate('case', currentCase.id + '?edit')} className="px-3 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50">Edit Properties</button>
           <select 
             className="px-3 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 outline-none cursor-pointer"
             value={currentCase.status}
             onChange={handleStatusChange}
           >
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="archived">Archived</option>
           </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-[#e9e9e7] flex gap-6 text-sm">
        {['info', 'tasks', 'deadlines', 'logs'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`py-3 cursor-pointer border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-black text-black font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
        <div className="max-w-5xl mx-auto">
          
          {activeTab === 'info' && <InfoTab c={currentCase} />}

          {activeTab === 'tasks' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-700">Tasks ({currentCase.tasks.length})</h3>
                 <button onClick={handleAddTask} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 shadow-sm">
                   <Plus size={16} /> Add Task
                 </button>
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
                   placeholder="Log a new event or note..."
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
                 >Post</button>
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
                       onClick={() => updateCase({...currentCase, logs: currentCase.logs.filter(l => l.id !== log.id)})}
                       className="absolute top-0 right-0 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                       <Trash2 size={12}/>
                     </button>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {activeTab === 'deadlines' && (
            <div className="animate-fade-in">
              <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-red-700 font-bold mb-1">NEW DEADLINE</label>
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
                >Add</button>
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
                    <button onClick={() => updateCase({...currentCase, deadlines: currentCase.deadlines.filter(x => x.id !== dl.id)})} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};