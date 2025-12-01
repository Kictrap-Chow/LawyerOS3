import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppData, Case, Party } from '../types';
import { uuid } from '../utils';

interface DataContextType {
  cases: Case[];
  parties: Party[];
  appTitle: string;
  setAppTitle: (title: string) => void;
  updateCase: (updatedCase: Case) => void;
  addCase: (newCase: Case) => void;
  deleteCase: (id: string) => void;
  updateParty: (updatedParty: Party) => void;
  addParty: (newParty: Party) => void;
  deleteParty: (id: string) => void;
  importData: (json: string) => void;
  exportData: () => void;
  fileHandle: FileSystemFileHandle | null;
  connectLocalFile: () => Promise<void>;
  saveToDisk: () => Promise<void>;
  // Navigation State
  activeView: 'dashboard' | 'parties' | 'archives' | 'case';
  activeCaseId: string | null;
  navigate: (view: 'dashboard' | 'parties' | 'archives' | 'case', caseId?: string | null) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const APP_KEY_CASES = 'lawyerCases_v18';
const APP_KEY_PARTIES = 'lawyerParties_v18';
const APP_KEY_TITLE = 'lawyerAppTitle_v18';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [appTitle, setAppTitleState] = useState('⚖️ LawyerOS');
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

  // Navigation State
  const [activeView, setActiveView] = useState<'dashboard' | 'parties' | 'archives' | 'case'>('dashboard');
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    try {
      const savedCases = JSON.parse(localStorage.getItem(APP_KEY_CASES) || '[]');
      const savedParties = JSON.parse(localStorage.getItem(APP_KEY_PARTIES) || '[]');
      const savedTitle = localStorage.getItem(APP_KEY_TITLE);
      setCases(savedCases);
      setParties(savedParties);
      if (savedTitle) setAppTitleState(savedTitle);
    } catch (e) {
      console.error("Failed to load local storage", e);
    }
  }, []);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem(APP_KEY_CASES, JSON.stringify(cases));
  }, [cases]);

  useEffect(() => {
    localStorage.setItem(APP_KEY_PARTIES, JSON.stringify(parties));
  }, [parties]);

  useEffect(() => {
    localStorage.setItem(APP_KEY_TITLE, appTitle);
  }, [appTitle]);

  const setAppTitle = (t: string) => setAppTitleState(t);

  const navigate = (view: 'dashboard' | 'parties' | 'archives' | 'case', caseId: string | null = null) => {
    setActiveView(view);
    setActiveCaseId(caseId);
  };

  const updateCase = (updatedCase: Case) => {
    setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
  };

  const addCase = (newCase: Case) => {
    setCases(prev => [newCase, ...prev]);
  };

  const deleteCase = (id: string) => {
    setCases(prev => prev.filter(c => c.id !== id));
    if (activeCaseId === id) navigate('dashboard');
  };

  const updateParty = (updatedParty: Party) => {
    setParties(prev => prev.map(p => p.id === updatedParty.id ? updatedParty : p));
  };

  const addParty = (newParty: Party) => {
    setParties(prev => [newParty, ...prev]);
  };

  const deleteParty = (id: string) => {
    setParties(prev => prev.filter(p => p.id !== id));
  };

  const connectLocalFile = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'JSON Database', accept: { 'application/json': ['.json'] } }]
        });
        setFileHandle(handle);
        const file = await handle.getFile();
        const text = await file.text();
        importData(text);
        alert(`✅ Connected: ${file.name}`);
      } catch (err: any) {
        if (err.name !== 'AbortError') alert("Connection failed.");
      }
    } else {
      alert("Browser not supported. Use Chrome/Edge.");
    }
  };

  const saveToDisk = async () => {
    if (fileHandle) {
      try {
        const writable = await (fileHandle as any).createWritable();
        await writable.write(JSON.stringify({ cases, parties }, null, 2));
        await writable.close();
      } catch (e) {
        console.error(e);
        alert("Failed to write to file.");
      }
    }
  };

  const importData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const importedCases = Array.isArray(data) ? data : (data.cases || []);
      const importedParties = Array.isArray(data) ? [] : (data.parties || []);
      
      // Simple migration check
      importedCases.forEach((c: any) => {
          if(!c.litigation) c.litigation = { proceedings: [] };
          if(!c.tasks) c.tasks = [];
      });

      setCases(importedCases);
      setParties(importedParties);
    } catch (e) {
      alert("Invalid JSON format");
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ cases, parties }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LawyerOS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <DataContext.Provider value={{
      cases, parties, appTitle, setAppTitle,
      updateCase, addCase, deleteCase,
      updateParty, addParty, deleteParty,
      importData, exportData,
      fileHandle, connectLocalFile, saveToDisk,
      activeView, activeCaseId, navigate
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};
