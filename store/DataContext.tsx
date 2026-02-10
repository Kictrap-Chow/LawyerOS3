import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Case, Party } from '../types';
import { nowISO } from '../utils';
import { isSupabaseConfigured, supabase } from './supabase';
import { User } from '@supabase/supabase-js';

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
  syncStatus: 'offline' | 'syncing' | 'online' | 'error';
  syncError: string | null;
  lastSyncedAt: string | null;
  isSupabaseEnabled: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  activeView: 'dashboard' | 'parties' | 'archives' | 'case' | 'settings';
  activeCaseId: string | null;
  activeCaseTab: 'info' | 'procedure' | 'tasks' | 'deadlines' | 'logs' | 'schedule' | 'trash';
  navigate: (
    view: 'dashboard' | 'parties' | 'archives' | 'case' | 'settings',
    caseId?: string | null,
    caseTab?: 'info' | 'procedure' | 'tasks' | 'deadlines' | 'logs' | 'schedule' | 'trash'
  ) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const APP_KEY_CASES = 'lawyerCases_v18';
const APP_KEY_PARTIES = 'lawyerParties_v18';
const APP_KEY_TITLE = 'lawyerAppTitle_v18';

const normalizeCase = (item: any): Case => ({
  ...item,
  updatedAt: item?.updatedAt || '',
  litigation: {
    proceedings: Array.isArray(item?.litigation?.proceedings) ? item.litigation.proceedings : [],
    propertyPreservations: Array.isArray(item?.litigation?.propertyPreservations) ? item.litigation.propertyPreservations : [],
  },
  tasks: Array.isArray(item?.tasks) ? item.tasks : [],
  logs: Array.isArray(item?.logs) ? item.logs : [],
  reminders: Array.isArray(item?.reminders) ? item.reminders : [],
  deadlines: Array.isArray(item?.deadlines) ? item.deadlines : [],
  clients: Array.isArray(item?.clients) ? item.clients : [],
  opponents: Array.isArray(item?.opponents) ? item.opponents : [],
});

const parseLocalList = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [appTitle, setAppTitleState] = useState('⚖️ LawyerOS');

  const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'online' | 'error'>(
    isSupabaseConfigured ? 'syncing' : 'offline'
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const skipNextSyncRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const reloadTimerRef = useRef<number | null>(null);

  const [activeView, setActiveView] = useState<'dashboard' | 'parties' | 'archives' | 'case' | 'settings'>('dashboard');
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeCaseTab, setActiveCaseTab] = useState<'info' | 'procedure' | 'tasks' | 'deadlines' | 'logs' | 'schedule' | 'trash'>('info');

  const navigate = (
    view: 'dashboard' | 'parties' | 'archives' | 'case' | 'settings',
    caseId: string | null = null,
    caseTab: 'info' | 'procedure' | 'tasks' | 'deadlines' | 'logs' | 'schedule' | 'trash' = 'info'
  ) => {
    setActiveView(view);
    setActiveCaseId(caseId);
    if (view === 'case') {
      setActiveCaseTab(caseTab);
    } else {
      setActiveCaseTab('info');
    }
  };

  const applyDataset = (nextCases: Case[], nextParties: Party[], fromRemote: boolean) => {
    if (fromRemote) {
      skipNextSyncRef.current = true;
    }
    setCases(nextCases.map(normalizeCase));
    setParties(nextParties);
  };

  const loadFromSupabase = useCallback(async (ownerId: string) => {
    if (!supabase || !ownerId) return false;
    try {
      setSyncStatus('syncing');
      const [casesRes, partiesRes] = await Promise.all([
        supabase.from('cases').select('id,data').eq('owner_id', ownerId).order('updated_at', { ascending: false }),
        supabase.from('parties').select('id,data').eq('owner_id', ownerId).order('updated_at', { ascending: false }),
      ]);

      if (casesRes.error) throw casesRes.error;
      if (partiesRes.error) throw partiesRes.error;

      const nextCases = (casesRes.data || []).map((row: any) => normalizeCase({ ...(row.data || {}), id: row.id }));
      const nextParties = (partiesRes.data || []).map((row: any) => ({ ...(row.data || {}), id: row.id } as Party));

      applyDataset(nextCases, nextParties, true);
      setSyncStatus('online');
      setSyncError(null);
      setLastSyncedAt(nowISO());
      return true;
    } catch (error: any) {
      setSyncStatus('error');
      setSyncError(error?.message || 'Supabase load failed');
      return false;
    }
  }, []);

  const loadFromServerFile = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return false;
      const data = await res.json();
      const nextCases = Array.isArray(data?.cases) ? data.cases.map(normalizeCase) : [];
      const nextParties = Array.isArray(data?.parties) ? data.parties : [];
      applyDataset(nextCases, nextParties, false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadFromLocal = useCallback(() => {
    const savedCases = parseLocalList<Case>(APP_KEY_CASES).map(normalizeCase);
    const savedParties = parseLocalList<Party>(APP_KEY_PARTIES);
    const savedTitle = localStorage.getItem(APP_KEY_TITLE);
    setCases(savedCases);
    setParties(savedParties);
    if (savedTitle) setAppTitleState(savedTitle);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthUser(data.session?.user ?? null);
      setAuthLoading(false);
    };
    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const savedTitle = localStorage.getItem(APP_KEY_TITLE);
      if (savedTitle) setAppTitleState(savedTitle);

      if (isSupabaseConfigured && supabase) {
        if (authLoading) return;
        if (!authUser?.id) {
          applyDataset([], [], false);
          setSyncStatus('offline');
          setSyncError('请先在设置页登录后再同步');
          setIsBootstrapped(true);
          return;
        }
        const loaded = await loadFromSupabase(authUser.id);
        if (loaded) {
          setIsBootstrapped(true);
          return;
        }
      }

      const serverLoaded = await loadFromServerFile();
      if (!serverLoaded) {
        loadFromLocal();
      }
      setIsBootstrapped(true);
      return;
    };

    void bootstrap();
  }, [authLoading, authUser?.id, loadFromLocal, loadFromServerFile, loadFromSupabase]);

  const saveToServerFile = useCallback(async (nextCases: Case[], nextParties: Party[]) => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cases: nextCases, parties: nextParties }),
      });
    } catch {
      // keep local mode silent
    }
  }, []);

  const syncToSupabase = useCallback(async (nextCases: Case[], nextParties: Party[], ownerId: string | null) => {
    if (!supabase || !isSupabaseConfigured) {
      await saveToServerFile(nextCases, nextParties);
      return;
    }
    if (!ownerId) return;

    try {
      setSyncStatus('syncing');

      const { error: caseUpsertError } = await supabase.from('cases').upsert(
        nextCases.map((item) => ({ id: item.id, owner_id: ownerId, data: item })),
        { onConflict: 'id' }
      );
      if (caseUpsertError) throw caseUpsertError;

      const { error: partyUpsertError } = await supabase.from('parties').upsert(
        nextParties.map((item) => ({ id: item.id, owner_id: ownerId, data: item })),
        { onConflict: 'id' }
      );
      if (partyUpsertError) throw partyUpsertError;

      const [caseIdsRes, partyIdsRes] = await Promise.all([
        supabase.from('cases').select('id').eq('owner_id', ownerId),
        supabase.from('parties').select('id').eq('owner_id', ownerId),
      ]);

      if (caseIdsRes.error) throw caseIdsRes.error;
      if (partyIdsRes.error) throw partyIdsRes.error;

      const caseIdSet = new Set(nextCases.map((item) => item.id));
      const partyIdSet = new Set(nextParties.map((item) => item.id));

      const staleCaseIds = (caseIdsRes.data || []).map((row) => row.id).filter((id) => !caseIdSet.has(id));
      const stalePartyIds = (partyIdsRes.data || []).map((row) => row.id).filter((id) => !partyIdSet.has(id));

      if (staleCaseIds.length > 0) {
        const { error } = await supabase.from('cases').delete().eq('owner_id', ownerId).in('id', staleCaseIds);
        if (error) throw error;
      }

      if (stalePartyIds.length > 0) {
        const { error } = await supabase.from('parties').delete().eq('owner_id', ownerId).in('id', stalePartyIds);
        if (error) throw error;
      }

      setSyncStatus('online');
      setSyncError(null);
      setLastSyncedAt(nowISO());
    } catch (error: any) {
      setSyncStatus('error');
      setSyncError(error?.message || 'Supabase sync failed');
    }
  }, [saveToServerFile]);

  useEffect(() => {
    localStorage.setItem(APP_KEY_CASES, JSON.stringify(cases));
    localStorage.setItem(APP_KEY_PARTIES, JSON.stringify(parties));

    if (!isBootstrapped) return;

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void syncToSupabase(cases, parties, authUser?.id || null);
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [cases, parties, syncToSupabase, isBootstrapped, authUser?.id]);

  useEffect(() => {
    localStorage.setItem(APP_KEY_TITLE, appTitle);
  }, [appTitle]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    if (!authUser?.id) return;

    const refreshFromRemote = () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        void loadFromSupabase(authUser.id);
      }, 300);
    };

    const channel = supabase
      .channel('lawyeros-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases', filter: `owner_id=eq.${authUser.id}` }, refreshFromRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties', filter: `owner_id=eq.${authUser.id}` }, refreshFromRemote)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [authUser?.id, loadFromSupabase]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { ok: false, message: '云端同步未配置。' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { ok: false, message: '云端同步未配置。' };
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCases([]);
    setParties([]);
  };

  const setAppTitle = (title: string) => setAppTitleState(title);

  const updateCase = (updatedCase: Case) => {
    setCases((prev) => prev.map((item) => (item.id === updatedCase.id ? normalizeCase({ ...updatedCase, updatedAt: nowISO() }) : item)));
  };

  const addCase = (newCase: Case) => {
    setCases((prev) => [normalizeCase({ ...newCase, updatedAt: nowISO() }), ...prev]);
  };

  const deleteCase = (id: string) => {
    setCases((prev) => prev.filter((item) => item.id !== id));
    if (activeCaseId === id) navigate('dashboard');
  };

  const updateParty = (updatedParty: Party) => {
    setParties((prev) => prev.map((item) => (item.id === updatedParty.id ? updatedParty : item)));
  };

  const addParty = (newParty: Party) => {
    setParties((prev) => [newParty, ...prev]);
  };

  const deleteParty = (id: string) => {
    setParties((prev) => prev.filter((item) => item.id !== id));
  };

  const importData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const importedCases = (Array.isArray(data) ? data : (data.cases || [])).map(normalizeCase);
      const importedParties = Array.isArray(data) ? [] : (data.parties || []);
      setCases(importedCases);
      setParties(importedParties);
    } catch {
      alert('Invalid JSON format');
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ cases, parties }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LawyerOS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <DataContext.Provider
      value={{
        cases,
        parties,
        appTitle,
        setAppTitle,
        updateCase,
        addCase,
        deleteCase,
        updateParty,
        addParty,
        deleteParty,
        importData,
        exportData,
        syncStatus,
        syncError,
        lastSyncedAt,
        isSupabaseEnabled: isSupabaseConfigured,
        authLoading,
        isAuthenticated: Boolean(authUser),
        userEmail: authUser?.email || null,
        signIn,
        signUp,
        signOut,
        activeView,
        activeCaseId,
        activeCaseTab,
        navigate,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
