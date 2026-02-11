import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { Search } from 'lucide-react';
import { useI18n } from '../store/I18nContext';

export const GlobalSearch: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { cases, parties, navigate } = useData();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if(e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const results: Array<{ type: string; title: string; sub: string; action: () => void }> = [];
  const q = query.toLowerCase();

  const deepText = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val).toLowerCase();
    if (Array.isArray(val)) return val.map(deepText).join(' ');
    if (typeof val === 'object') return Object.values(val).map(deepText).join(' ');
    return '';
  };

  const pushResult = (item: { type: string; title: string; sub: string; action: () => void }) => {
    const exists = results.some((r) => r.type === item.type && r.title === item.title && r.sub === item.sub);
    if (!exists) results.push(item);
  };

  if (q) {
    // Search Cases (all fields)
    cases.forEach(c => {
      const caseBlob = deepText(c);
      if (caseBlob.includes(q)) {
        pushResult({ type: 'Case', title: c.name, sub: c.type, action: () => navigate('case', c.id, 'info') });
      }

      // Search Tasks
      c.tasks?.forEach(t => {
        if (deepText(t).includes(q)) {
          pushResult({ type: 'Task', title: t.desc || '(No Title)', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'tasks') });
        }
      });

      // Search Logs
      c.logs?.forEach(l => {
        if (deepText(l).includes(q)) {
          const title = (l.content || '').trim();
          pushResult({ type: 'Log', title: title ? `${title.substring(0, 50)}...` : '(Empty Log)', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'logs') });
        }
      });

      // Search Case Parties (Clients & Opponents)
      [...(c.clients || []), ...(c.opponents || [])].forEach(p => {
        if (deepText(p).includes(q)) {
           pushResult({ type: 'Party', title: p.name || '(No Name)', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'info') });
        }
      });

      // Search Proceedings
      if (c.litigation && c.litigation.proceedings) {
        c.litigation.proceedings.forEach(proc => {
          if (deepText(proc).includes(q)) {
            pushResult({ type: 'Proceeding', title: `${proc.stageName || 'Stage'} - ${proc.caseNo || 'No Case No'}`, sub: `in ${c.name}`, action: () => navigate('case', c.id, 'procedure') });
          }
        });
      }

      // Search Property Preservation
      c.litigation?.propertyPreservations?.forEach(item => {
        if (deepText(item).includes(q)) {
          pushResult({ type: 'Preserve', title: item.caseNo || item.courtName || 'Property Preservation', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'procedure') });
        }
      });

      // Search Schedule
      c.reminders?.forEach(r => {
        if (deepText(r).includes(q)) {
          pushResult({ type: 'Schedule', title: r.title || '(No Title)', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'schedule') });
        }
      });

      // Search Deadlines
      c.deadlines?.forEach(d => {
        if (deepText(d).includes(q)) {
          pushResult({ type: 'Deadline', title: d.title || '(No Title)', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'deadlines') });
        }
      });

      // Search Action Reminders
      c.actionReminders?.forEach(r => {
        if (deepText(r).includes(q)) {
          pushResult({ type: 'Reminder', title: r.title || '(No Title)', sub: `in ${c.name}`, action: () => navigate('case', c.id, 'reminders') });
        }
      });
    });

    // Search Global Parties
    parties.forEach(p => {
       if (deepText(p).includes(q)) {
         pushResult({ type: 'Party', title: p.name || '(No Name)', sub: p.idCode || '', action: () => navigate('parties') });
       }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-start justify-center pt-[10vh] px-3" onClick={onClose}>
      <div className="bg-white/90 w-[640px] max-w-[95vw] rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-white backdrop-blur-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <Search className="text-gray-400 mr-3" size={20} />
          <input 
            ref={inputRef}
            className="flex-1 text-lg outline-none placeholder-gray-300" 
            placeholder={`${t('nav.search')} cases, tasks, people...`} 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[65vh] overflow-y-auto bg-[#f8fafc]">
          {results.length > 0 ? (
            <div className="py-2">
              {results.slice(0, 10).map((r, i) => (
                <div 
                  key={i} 
                  onClick={() => { r.action(); onClose(); }}
                  className="px-4 py-2 mx-2 rounded hover:bg-white hover:shadow-sm cursor-pointer border border-transparent hover:border-gray-200 transition-all flex items-center gap-3"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 w-12 text-right">{r.type}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{r.title}</div>
                    <div className="text-xs text-gray-500">{r.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : query ? (
            <div className="p-8 text-center text-gray-400">No results found.</div>
          ) : (
            <div className="p-4 text-xs text-gray-400 text-center">Type to search...</div>
          )}
        </div>
      </div>
    </div>
  );
};
