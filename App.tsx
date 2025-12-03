import React, { useState } from 'react';
import { DataProvider, useData } from './store/DataContext';
import { I18nProvider } from './store/I18nContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { CaseDetail } from './pages/CaseDetail';
import { PartyManager } from './pages/PartyManager';
import { CaseForm } from './components/CaseForm';
import { GlobalSearch } from './components/GlobalSearch';

const MainLayout: React.FC = () => {
  const { activeView, navigate, addCase, cases, updateCase } = useData();
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex h-screen w-full bg-white text-[#37352f] font-sans antialiased overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      <Sidebar 
        onSearch={() => setShowSearch(true)} 
        onCreateCase={() => setShowCaseForm(true)} 
      />
      <main className="flex-1 h-full overflow-y-auto relative bg-white">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'case' && <CaseDetail />}
        {activeView === 'parties' && <PartyManager />}
        {activeView === 'archives' && (
           <div className="p-8">
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
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <DataProvider>
        <MainLayout />
      </DataProvider>
    </I18nProvider>
  );
}
