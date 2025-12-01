import React, { useState } from 'react';
import { DataProvider, useData } from './store/DataContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { CaseDetail } from './pages/CaseDetail';
import { PartyManager } from './pages/PartyManager';
import { CaseForm } from './components/CaseForm';
import { GlobalSearch } from './components/GlobalSearch';

const MainLayout: React.FC = () => {
  const { activeView, navigate, addCase } = useData();
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex h-screen w-full bg-white text-[#37352f] font-sans antialiased overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      <Sidebar 
        onSearch={() => setShowSearch(true)} 
        onCreateCase={() => setShowCaseForm(true)} 
      />
      <main className="flex-1 h-full overflow-hidden relative bg-white">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'case' && <CaseDetail />}
        {activeView === 'parties' && <PartyManager />}
        {activeView === 'archives' && (
           <div className="p-8">
             <h1 className="text-2xl font-bold mb-4">Archived Cases</h1>
             <p className="text-gray-500">Archived cases are read-only. Restore them to edit.</p>
             {/* Simple archive list implemented inline for brevity */}
             <div className="mt-6 space-y-2">
                {/* Cases filter logic is in sidebar, this is just a placeholder view */}
                <button onClick={() => navigate('dashboard')} className="text-blue-600 hover:underline">Return to Dashboard</button>
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
    <DataProvider>
      <MainLayout />
    </DataProvider>
  );
}
