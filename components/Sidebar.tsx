import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { 
  Home, Users, Archive, Plus, Search, FileJson, 
  Briefcase, Scale, MessageSquare, Shield, Folder
} from 'lucide-react';
import { cn } from '../utils';

export const Sidebar: React.FC<{ onSearch: () => void, onCreateCase: () => void }> = ({ onSearch, onCreateCase }) => {
  const { cases, activeView, activeCaseId, navigate, appTitle, setAppTitle, exportData, connectLocalFile, fileHandle } = useData();
  const [editingTitle, setEditingTitle] = useState(false);

  const activeCases = cases.filter(c => c.status !== 'archived');
  const groupedCases = {
    'Litigation': activeCases.filter(c => c.type === '诉讼'),
    'Arbitration': activeCases.filter(c => c.type === '仲裁'),
    'Advisory': activeCases.filter(c => c.type === '常年法律顾问'),
    'Special': activeCases.filter(c => c.type === '专项法律服务'),
    'Dispute': activeCases.filter(c => c.type === '争议解决'),
  };

  const NavItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 my-0.5 text-sm rounded-md cursor-pointer transition-colors text-[#5f5e5b] hover:bg-[#efefed]",
        active && "bg-[#e0e0e0] text-[#37352f] font-medium"
      )}
    >
      <Icon size={16} />
      <span className="flex-1 truncate">{label}</span>
      {badge && <span className="text-xs bg-[#e0e0e0] px-1.5 rounded-sm">{badge}</span>}
    </div>
  );

  const Section = ({ title, children }: any) => (
    <div className="mb-4">
      <h3 className="px-3 mb-1 text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="w-[260px] h-screen bg-[#f7f7f5] border-r border-[#e9e9e7] flex flex-col flex-shrink-0">
      {/* App Title */}
      <div className="p-3 h-12 flex items-center group">
        {editingTitle ? (
          <input 
            autoFocus
            className="w-full bg-white px-2 py-1 text-sm rounded border border-blue-500 outline-none"
            value={appTitle}
            onChange={(e) => setAppTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
          />
        ) : (
          <div 
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-2 px-2 py-1 w-full rounded hover:bg-[#efefed] cursor-pointer text-sm font-semibold text-[#37352f] truncate"
          >
            <div className="w-5 h-5 bg-orange-400 rounded flex items-center justify-center text-white text-xs">L</div>
            {appTitle}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
        {/* Core Nav */}
        <div className="mb-6">
          <div onClick={onSearch} className="flex items-center gap-2 px-3 py-1.5 my-0.5 text-sm rounded-md cursor-pointer text-[#5f5e5b] hover:bg-[#efefed]">
            <Search size={16} />
            <span>Search</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-[#efefed] px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘K</span>
            </kbd>
          </div>
          <NavItem 
            icon={Home} 
            label="Dashboard" 
            active={activeView === 'dashboard'} 
            onClick={() => navigate('dashboard')} 
          />
          <NavItem 
            icon={Users} 
            label="Parties" 
            active={activeView === 'parties'} 
            onClick={() => navigate('parties')} 
          />
          <NavItem 
            icon={Archive} 
            label="Archives" 
            active={activeView === 'archives'} 
            onClick={() => navigate('archives')} 
          />
        </div>

        {/* Case Lists */}
        <Section title="Active Cases">
          {Object.entries(groupedCases).map(([key, list]) => {
            if (list.length === 0) return null;
            let Icon = Briefcase;
            if (key === 'Litigation') Icon = Scale;
            if (key === 'Arbitration') Icon = Shield;
            if (key === 'Advisory') Icon = MessageSquare;
            
            return (
              <div key={key} className="mb-2">
                <div className="px-3 py-1 text-xs text-[#787774] flex items-center gap-2">
                  <Icon size={12} /> {key}
                </div>
                {list.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => navigate('case', c.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 ml-2 text-sm rounded-md cursor-pointer transition-colors text-[#5f5e5b] hover:bg-[#efefed] truncate",
                      activeCaseId === c.id && "bg-[#e0e0e0] text-[#37352f] font-medium"
                    )}
                  >
                    <span className="truncate">📄 {c.name}</span>
                    {c.status === 'dormant' && <span className="text-[10px] opacity-50">💤</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </Section>
        
        <div 
          onClick={onCreateCase}
          className="flex items-center gap-2 px-3 py-1.5 my-2 text-sm rounded-md cursor-pointer text-[#787774] hover:bg-[#efefed] hover:text-[#37352f]"
        >
          <Plus size={16} />
          <span>New Case</span>
        </div>
      </div>

      {/* Footer / System */}
      <div className="p-3 border-t border-[#e9e9e7]">
        <div className="flex flex-col gap-1">
          <button 
            onClick={connectLocalFile}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#efefed] text-[#787774] w-full text-left transition-colors",
              fileHandle && "text-green-600 bg-green-50 hover:bg-green-100"
            )}
          >
            <Folder size={14} />
            {fileHandle ? "Linked to Disk" : "Link Local File"}
          </button>
          <button 
            onClick={exportData}
            className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#efefed] text-[#787774] w-full text-left"
          >
            <FileJson size={14} />
            Backup Data
          </button>
        </div>
      </div>
    </div>
  );
};
