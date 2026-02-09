import React, { useState } from 'react';
import { DataProvider, useData } from './store/DataContext';
import { I18nProvider } from './store/I18nContext';
import { ThemeProvider } from './store/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { CaseDetail } from './pages/CaseDetail';
import { PartyManager } from './pages/PartyManager';
import { Settings } from './pages/Settings';
import { CaseForm } from './components/CaseForm';
import { GlobalSearch } from './components/GlobalSearch';
import { FloatingTimer } from './components/FloatingTimer';
import { Archive, Briefcase, Home, Menu, PanelLeft, Plus, Search, Settings as SettingsIcon, Users } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeView, activeCaseId, navigate, addCase, cases, updateCase } = useData();
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showDesktopNav, setShowDesktopNav] = useState(true);

  const getHeaderTitle = () => {
    if (activeView === 'dashboard') return 'Dashboard';
    if (activeView === 'parties') return 'Parties';
    if (activeView === 'archives') return 'Archives';
    if (activeView === 'settings') return 'Settings';
    if (activeView === 'case') {
      return cases.find((c) => c.id === activeCaseId)?.name || 'Case';
    }
    return 'LawyerOS';
  };

  return (
    <div className="flex h-dvh w-full text-[#1f2937] font-sans antialiased overflow-hidden selection:bg-blue-100 selection:text-blue-900 p-1.5 md:p-3 gap-1.5 md:gap-3">
      {showDesktopNav && (
        <Sidebar
          className="hidden md:flex"
          onSearch={() => setShowSearch(true)}
          onCreateCase={() => setShowCaseForm(true)}
          onToggleCollapse={() => setShowDesktopNav(false)}
        />
      )}

      {showMobileNav && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setShowMobileNav(false)} />
          <Sidebar
            className="relative z-10 w-[92vw] max-w-[360px] h-full shadow-2xl"
            onSearch={() => {
              setShowSearch(true);
              setShowMobileNav(false);
            }}
            onCreateCase={() => {
              setShowCaseForm(true);
              setShowMobileNav(false);
            }}
            onAfterNavigate={() => setShowMobileNav(false)}
          />
        </div>
      )}

      <main className="flex-1 h-full overflow-y-auto relative craft-surface p-1.5 pb-24 md:pb-3 md:p-3">
        {!showDesktopNav && (
          <div className="hidden md:block fixed left-3 top-3 z-40">
            <button
              onClick={() => setShowDesktopNav(true)}
              className="p-2 rounded-xl hover:bg-gray-100 border border-gray-200 bg-white/85 backdrop-blur-sm"
              title="Show Sidebar"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        )}
        <div className="md:hidden sticky top-0 z-30 mb-2 px-2 py-2 craft-panel backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMobileNav(true)} className="p-2 rounded-xl hover:bg-gray-100">
              <Menu size={18} />
            </button>
            <div className="flex-1 truncate text-sm font-semibold">{getHeaderTitle()}</div>
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-xl hover:bg-gray-100">
              <Search size={18} />
            </button>
            <button onClick={() => setShowCaseForm(true)} className="p-2 rounded-xl hover:bg-gray-100">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'case' && <CaseDetail />}
        {activeView === 'parties' && <PartyManager />}
        {activeView === 'settings' && <Settings />}
        {activeView === 'archives' && (
           <div className="p-4 md:p-8 craft-panel">
             <h1 className="text-2xl font-bold mb-4">Archived Cases</h1>
             <p className="text-gray-500">Archived cases are read-only. You can restore to continue editing.</p>
             <div className="mt-6 space-y-2">
               {cases.filter(c => c.status === 'archived').length === 0 && (
                 <div className="text-gray-400">No archived cases.</div>
               )}
               {cases.filter(c => c.status === 'archived').map(c => (
                 <div key={c.id} className="flex items-center justify-between p-3 border rounded bg-white">
                   <div>
                     <div className="font-medium">{c.name}</div>
                     <div className="text-xs text-gray-500">{c.type}</div>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => navigate('case', c.id)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Open</button>
                     <button onClick={() => updateCase({ ...c, status: 'active' })} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Restore</button>
                   </div>
                 </div>
               ))}
               <div className="mt-4">
                 <button onClick={() => navigate('dashboard')} className="text-blue-600 hover:underline">Return to Dashboard</button>
               </div>
             </div>
           </div>
        )}
      </main>

      {showCaseForm && (
        <CaseForm 
          onClose={() => setShowCaseForm(false)} 
          onSave={(c) => {
             addCase(c);
             navigate('case', c.id);
          }} 
        />
      )}

      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
      <FloatingTimer />

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pt-1.5 pb-2 border-t border-[#e2e8f0] bg-white/90 backdrop-blur-xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="grid grid-cols-5 gap-1">
          <button
            onClick={() => navigate('dashboard')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'dashboard' ? 'accent-text bg-[var(--ui-accent-soft)]' : 'text-gray-500'}`}
          >
            <Home size={16} />
            <span>仪表盘</span>
          </button>
          <button
            onClick={() => navigate('parties')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'parties' ? 'accent-text bg-[var(--ui-accent-soft)]' : 'text-gray-500'}`}
          >
            <Users size={16} />
            <span>当事人</span>
          </button>
          <button
            onClick={() => navigate('settings')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'settings' ? 'accent-text bg-[var(--ui-accent-soft)]' : 'text-gray-500'}`}
          >
            <SettingsIcon size={16} />
            <span>设置</span>
          </button>
          <button
            onClick={() => navigate('archives')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'archives' ? 'accent-text bg-[var(--ui-accent-soft)]' : 'text-gray-500'}`}
          >
            <Archive size={16} />
            <span>归档</span>
          </button>
          <button
            onClick={() => (activeCaseId ? navigate('case', activeCaseId) : navigate('dashboard'))}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'case' ? 'accent-text bg-[var(--ui-accent-soft)]' : activeCaseId ? 'text-gray-500' : 'text-gray-300'}`}
          >
            <Briefcase size={16} />
            <span>案件</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <DataProvider>
          <MainLayout />
        </DataProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
