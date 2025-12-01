import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { Search } from 'lucide-react';

export const GlobalSearch: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { cases, parties, navigate } = useData();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if(e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const results = [];
  const q = query.toLowerCase();

  if (q) {
    // Search Cases
    cases.forEach(c => {
      if (c.name.toLowerCase().includes(q)) results.push({ type: 'Case', title: c.name, sub: c.type, action: () => navigate('case', c.id) });
      c.tasks.forEach(t => {
        if (t.desc.toLowerCase().includes(q)) results.push({ type: 'Task', title: t.desc, sub: `in ${c.name}`, action: () => navigate('case', c.id) });
      });
    });

    // Search Parties
    parties.forEach(p => {
       if (p.name.toLowerCase().includes(q) || p.idCode.includes(q)) {
         results.push({ type: 'Party', title: p.name, sub: p.idCode, action: () => navigate('parties') });
       }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="bg-white w-[600px] max-w-[90vw] rounded-xl shadow-2xl overflow-hidden animate-fade-in border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <Search className="text-gray-400 mr-3" size={20} />
          <input 
            ref={inputRef}
            className="flex-1 text-lg outline-none placeholder-gray-300" 
            placeholder="Search cases, tasks, people..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto bg-[#fafafa]">
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
