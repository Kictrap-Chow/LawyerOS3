import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Case, Party } from '../types';
import { nowISO } from '../utils';
import { isSupabaseConfigured, supabase, supabaseSyncBucket } from './supabase';
import { User } from '@supabase/supabase-js';
import {
  canReadWriteTarget,
  clearBoundSyncTarget,
  createAndPickJsonFile,
  getBoundSyncTarget,
  getLocalFileSyncEnabled,
  getTargetName,
  isLocalFileSyncSupported,
  pickExistingJsonFile,
  pickSyncDirectory,
  readPayloadFromTarget,
  setBoundSyncDirectoryTarget,
  setBoundSyncFileTarget,
  setLocalFileSyncEnabled,
  writePayloadToTarget,
  type LocalSyncTarget,
} from './localFileSync';
import {
  pullSupabaseSegmented,
  pushSupabaseSegmented,
  readSupabaseSegmentedManifestMeta,
} from './supabaseSegmentedSync';

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
  syncMode: 'local' | 'online';
  setSyncMode: (mode: 'local' | 'online') => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  forceUploadToSupabaseNow: () => Promise<{ ok: boolean; message: string }>;
  forceDownloadFromSupabaseNow: () => Promise<{ ok: boolean; message: string }>;
  localFileSyncSupported: boolean;
  localFileSyncEnabled: boolean;
  localFileSyncFileName: string | null;
  localFileSyncMessage: string | null;
  localFileSyncKind: 'file' | 'directory' | null;
  setupLocalFileSyncByFolder: () => Promise<{ ok: boolean; message: string }>;
  setupLocalFileSyncByExport: () => Promise<{ ok: boolean; message: string }>;
  bindLocalFileSyncExisting: () => Promise<{ ok: boolean; message: string }>;
  pullFromLocalFileSync: () => Promise<{ ok: boolean; message: string }>;
  flushLocalFileSyncNow: () => Promise<{ ok: boolean; message: string }>;
  disableLocalFileSync: () => Promise<void>;
  activeView: 'dashboard' | 'parties' | 'archives' | 'case' | 'settings';
  activeCaseId: string | null;
  activeCaseTab: 'info' | 'procedure' | 'tasks' | 'schedule' | 'reminders' | 'deadlines' | 'logs' | 'trash';
  navigate: (
    view: 'dashboard' | 'parties' | 'archives' | 'case' | 'settings',
    caseId?: string | null,
    caseTab?: 'info' | 'procedure' | 'tasks' | 'schedule' | 'reminders' | 'deadlines' | 'logs' | 'trash'
  ) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const APP_KEY_CASES = 'lawyerCases_v18';
const APP_KEY_PARTIES = 'lawyerParties_v18';
const APP_KEY_SNAPSHOTS = 'lawyerDataSnapshots_v1';
const APP_KEY_SYNC_MODE = 'lawyerSyncMode_v1';
const SNAPSHOT_KEEP = 12;
const DEFAULT_APP_TITLE = 'Legal Nice OS by Disorder Tangerine';

const normalizeCaseType = (rawType: any) => {
  if (rawType === '争议解决' || rawType === 'Dispute') return '诉讼';
  if (rawType === 'Arbitration') return '仲裁';
  if (rawType === 'Advisory') return '专项法律服务';
  if (rawType === 'Retainer') return '常年法律顾问';
  return rawType || '诉讼';
};

const normalizeCase = (item: any): Case => ({
  ...item,
  type: normalizeCaseType(item?.type),
  updatedAt: item?.updatedAt || '',
  litigation: {
    proceedings: Array.isArray(item?.litigation?.proceedings) ? item.litigation.proceedings : [],
    propertyPreservations: Array.isArray(item?.litigation?.propertyPreservations) ? item.litigation.propertyPreservations : [],
  },
  tasks: Array.isArray(item?.tasks) ? item.tasks : [],
  logs: Array.isArray(item?.logs) ? item.logs : [],
  reminders: Array.isArray(item?.reminders) ? item.reminders : [],
  actionReminders: Array.isArray(item?.actionReminders) ? item.actionReminders : [],
  deadlines: Array.isArray(item?.deadlines) ? item.deadlines : [],
  clients: Array.isArray(item?.clients) ? item.clients : [],
  opponents: Array.isArray(item?.opponents) ? item.opponents : [],
});

const isBucketNotFoundError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('bucket not found') || msg.includes('not found');
};

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
  const localFileSyncSupported = isLocalFileSyncSupported();
  const [cases, setCases] = useState<Case[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [appTitle, setAppTitleState] = useState(DEFAULT_APP_TITLE);

  const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'online' | 'error'>(
    isSupabaseConfigured ? 'syncing' : 'offline'
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [syncMode, setSyncModeState] = useState<'local' | 'online'>(() => {
    const saved = localStorage.getItem(APP_KEY_SYNC_MODE);
    if (saved === 'local' || saved === 'online') return saved;
    return 'local';
  });
  const [localFileSyncEnabled, setLocalFileSyncEnabledState] = useState(getLocalFileSyncEnabled());
  const [localFileSyncFileName, setLocalFileSyncFileName] = useState<string | null>(null);
  const [localFileSyncMessage, setLocalFileSyncMessage] = useState<string | null>(null);
  const [localFileSyncKind, setLocalFileSyncKind] = useState<'file' | 'directory' | null>(null);

  const skipNextSyncRef = useRef(false);
  const skipNextLocalSyncPushRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const localFileSaveTimerRef = useRef<number | null>(null);
  const reloadTimerRef = useRef<number | null>(null);
  const remotePollTimerRef = useRef<number | null>(null);
  const lastAutoSnapshotAtRef = useRef(0);
  const localSyncTargetRef = useRef<LocalSyncTarget | null>(null);
  const mutationDuringBootstrapRef = useRef(false);

  const [activeView, setActiveView] = useState<'dashboard' | 'parties' | 'archives' | 'case' | 'settings'>('dashboard');
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeCaseTab, setActiveCaseTab] = useState<'info' | 'procedure' | 'tasks' | 'schedule' | 'reminders' | 'deadlines' | 'logs' | 'trash'>('info');

  const setSyncMode = (mode: 'local' | 'online') => {
    setSyncModeState(mode);
    localStorage.setItem(APP_KEY_SYNC_MODE, mode);
    mutationDuringBootstrapRef.current = false;
    setIsBootstrapped(false);
    if (mode === 'local') {
      setSyncError(null);
    }
  };

  useEffect(() => {
    if (syncMode === 'local') {
      setSyncStatus(localFileSyncEnabled ? 'online' : 'offline');
      setSyncError(null);
    }
  }, [localFileSyncEnabled, syncMode]);

  const navigate = (
    view: 'dashboard' | 'parties' | 'archives' | 'case' | 'settings',
    caseId: string | null = null,
    caseTab: 'info' | 'procedure' | 'tasks' | 'schedule' | 'reminders' | 'deadlines' | 'logs' | 'trash' = 'info'
  ) => {
    setActiveView(view);
    setActiveCaseId(caseId);
    if (view === 'case') {
      setActiveCaseTab(caseTab);
    } else {
      setActiveCaseTab('info');
    }
  };

  const hasAnyData = (nextCases: Case[], nextParties: Party[]) => nextCases.length > 0 || nextParties.length > 0;
  const latestLocalDataTs = (nextCases: Case[], nextParties: Party[]) => {
    let latest = 0;
    for (const item of nextCases) {
      const ts = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (Number.isFinite(ts) && ts > latest) latest = ts;
    }
    for (const item of nextParties) {
      const ts = (item as any)?.updatedAt ? new Date((item as any).updatedAt).getTime() : 0;
      if (Number.isFinite(ts) && ts > latest) latest = ts;
    }
    return latest;
  };

  const createSnapshot = useCallback((reason: string, nextCases: Case[], nextParties: Party[]) => {
    if (!hasAnyData(nextCases, nextParties)) return;
    try {
      const current = localStorage.getItem(APP_KEY_SNAPSHOTS);
      const list = current ? JSON.parse(current) : [];
      const snapshots = Array.isArray(list) ? list : [];
      snapshots.unshift({
        createdAt: nowISO(),
        reason,
        cases: nextCases,
        parties: nextParties,
      });
      localStorage.setItem(APP_KEY_SNAPSHOTS, JSON.stringify(snapshots.slice(0, SNAPSHOT_KEEP)));
    } catch {
      // keep snapshot best-effort
    }
  }, []);

  const applyDataset = (nextCases: Case[], nextParties: Party[], fromRemote: boolean) => {
    if (fromRemote) {
      skipNextSyncRef.current = true;
    }
    setCases(nextCases.map(normalizeCase));
    setParties(nextParties);
  };

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
    setCases(savedCases);
    setParties(savedParties);
    setAppTitleState(DEFAULT_APP_TITLE);
  }, []);

  const pullFromBoundLocalFile = useCallback(async () => {
    if (!localFileSyncSupported) return { ok: false, message: '当前浏览器不支持自动本地同步。' };
    const target = localSyncTargetRef.current ?? (await getBoundSyncTarget());
    if (!target) return { ok: false, message: '未绑定 iCloud 同步目标。' };
    const allowed = await canReadWriteTarget(target);
    if (!allowed) return { ok: false, message: '未获得本地文件访问权限。' };
    const payload = await readPayloadFromTarget(target);
    const nextCases = Array.isArray(payload.cases) ? payload.cases.map(normalizeCase) : [];
    const nextParties = Array.isArray(payload.parties) ? payload.parties : [];
    const remoteEmpty = nextCases.length === 0 && nextParties.length === 0;
    const localHasData = cases.length > 0 || parties.length > 0;
    if (remoteEmpty && localHasData) {
      return { ok: false, message: '检测到 iCloud 文件为空，已阻止覆盖当前本地数据。' };
    }
    skipNextLocalSyncPushRef.current = true;
    applyDataset(nextCases, nextParties, false);
    localSyncTargetRef.current = target;
    setLocalFileSyncKind(target.kind);
    setLocalFileSyncFileName(getTargetName(target));
    setLocalFileSyncMessage(`已从 ${getTargetName(target) || 'iCloud 目标'} 自动拉取`);
    setLastSyncedAt(nowISO());
    return { ok: true, message: '已从 iCloud 同步目标拉取最新数据。' };
  }, [cases.length, localFileSyncSupported, parties.length]);

  const bindTarget = useCallback(async (target: LocalSyncTarget) => {
    const allowed = await canReadWriteTarget(target);
    if (!allowed) return { ok: false, message: '未授予读写权限，无法启用自动同步。' };
    if (target.kind === 'directory') await setBoundSyncDirectoryTarget(target.handle);
    else await setBoundSyncFileTarget(target.handle);
    setLocalFileSyncEnabled(true);
    setLocalFileSyncEnabledState(true);
    setLocalFileSyncKind(target.kind);
    setLocalFileSyncFileName(getTargetName(target));
    localSyncTargetRef.current = target;
    setLocalFileSyncMessage(`已绑定 ${getTargetName(target) || 'iCloud 目标'}，后续将自动同步`);
    if (syncMode === 'local') {
      setSyncStatus('online');
      setSyncError(null);
    }
    return { ok: true, message: '本地自动同步已启用。' };
  }, [syncMode]);

  const flushLocalFileSyncNow = useCallback(async () => {
    if (!localFileSyncEnabled || !localFileSyncSupported) {
      return { ok: false, message: '本地自动同步未启用。' };
    }
    const target = localSyncTargetRef.current ?? (await getBoundSyncTarget());
    if (!target) return { ok: false, message: '未绑定 iCloud 同步目标。' };
    const allowed = await canReadWriteTarget(target);
    if (!allowed) return { ok: false, message: '同步权限失效，请重新绑定。' };
    await writePayloadToTarget(target, { cases, parties });
    localSyncTargetRef.current = target;
    setLocalFileSyncKind(target.kind);
    setLocalFileSyncFileName(getTargetName(target));
    setLocalFileSyncMessage(`已同步到 ${getTargetName(target) || 'iCloud 目标'} · ${new Date().toLocaleTimeString()}`);
    setLastSyncedAt(nowISO());
    return { ok: true, message: '已立即同步。' };
  }, [cases, localFileSyncEnabled, localFileSyncSupported, parties]);

  const setupLocalFileSyncByFolder = useCallback(async () => {
    if (!localFileSyncSupported) return { ok: false, message: '当前浏览器不支持自动本地同步。' };
    try {
      const target = await pickSyncDirectory();
      await writePayloadToTarget(target, { cases, parties });
      const bound = await bindTarget(target);
      setLastSyncedAt(nowISO());
      return bound.ok ? { ok: true, message: `已初始化并绑定 ${getTargetName(target)}` } : bound;
    } catch {
      return { ok: false, message: '已取消目录绑定或初始化失败。' };
    }
  }, [bindTarget, cases, localFileSyncSupported, parties]);

  const setupLocalFileSyncByExport = useCallback(async () => {
    if (!localFileSyncSupported) return { ok: false, message: '当前浏览器不支持自动本地同步。' };
    try {
      const target = await createAndPickJsonFile(`LawyerOS_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      await writePayloadToTarget(target, { cases, parties });
      const bound = await bindTarget(target);
      setLastSyncedAt(nowISO());
      return bound.ok ? { ok: true, message: `已导出并绑定 ${getTargetName(target)}` } : bound;
    } catch {
      return { ok: false, message: '已取消导出或导出失败。' };
    }
  }, [bindTarget, cases, localFileSyncSupported, parties]);

  const bindLocalFileSyncExisting = useCallback(async () => {
    if (!localFileSyncSupported) return { ok: false, message: '当前浏览器不支持自动本地同步。' };
    try {
      let target: LocalSyncTarget;
      if ('showDirectoryPicker' in window) {
        target = await pickSyncDirectory();
      } else {
        target = await pickExistingJsonFile();
      }
      const bound = await bindTarget(target);
      if (!bound.ok) return bound;
      const pulled = await pullFromBoundLocalFile();
      return pulled.ok ? { ok: true, message: `已绑定并拉取 ${getTargetName(target)}` } : pulled;
    } catch {
      return { ok: false, message: '已取消绑定。' };
    }
  }, [bindTarget, localFileSyncSupported, pullFromBoundLocalFile]);

  const disableLocalFileSync = useCallback(async () => {
    setLocalFileSyncEnabled(false);
    setLocalFileSyncEnabledState(false);
    setLocalFileSyncKind(null);
    setLocalFileSyncFileName(null);
    setLocalFileSyncMessage('已关闭本地自动同步。');
    localSyncTargetRef.current = null;
    await clearBoundSyncTarget();
    if (syncMode === 'local') {
      setSyncStatus('offline');
    }
  }, [syncMode]);

  const pullSupabaseLegacyTables = useCallback(async (ownerId: string) => {
    if (!supabase) return { cases: [] as Case[], parties: [] as Party[] };
    const [casesRes, partiesRes] = await Promise.all([
      supabase.from('cases').select('id,data').eq('owner_id', ownerId).order('updated_at', { ascending: false }),
      supabase.from('parties').select('id,data').eq('owner_id', ownerId).order('updated_at', { ascending: false }),
    ]);
    if (casesRes.error) throw casesRes.error;
    if (partiesRes.error) throw partiesRes.error;
    const nextCases = (casesRes.data || []).map((row: any) => normalizeCase({ ...(row.data || {}), id: row.id }));
    const nextParties = (partiesRes.data || []).map((row: any) => ({ ...(row.data || {}), id: row.id } as Party));
    return { cases: nextCases, parties: nextParties };
  }, []);

  const getSupabaseLegacyRemoteMeta = useCallback(async (ownerId: string) => {
    if (!supabase) return { count: 0, latestTs: 0 };
    const [caseCountRes, partyCountRes] = await Promise.all([
      supabase.from('cases').select('id', { head: true, count: 'exact' }).eq('owner_id', ownerId),
      supabase.from('parties').select('id', { head: true, count: 'exact' }).eq('owner_id', ownerId),
    ]);
    if (caseCountRes.error) throw caseCountRes.error;
    if (partyCountRes.error) throw partyCountRes.error;
    const [remoteCaseLatestRes, remotePartyLatestRes] = await Promise.all([
      supabase.from('cases').select('updated_at').eq('owner_id', ownerId).order('updated_at', { ascending: false }).limit(1),
      supabase.from('parties').select('updated_at').eq('owner_id', ownerId).order('updated_at', { ascending: false }).limit(1),
    ]);
    if (remoteCaseLatestRes.error) throw remoteCaseLatestRes.error;
    if (remotePartyLatestRes.error) throw remotePartyLatestRes.error;
    const remoteCaseTs = remoteCaseLatestRes.data?.[0]?.updated_at ? new Date(remoteCaseLatestRes.data[0].updated_at).getTime() : 0;
    const remotePartyTs = remotePartyLatestRes.data?.[0]?.updated_at ? new Date(remotePartyLatestRes.data[0].updated_at).getTime() : 0;
    return {
      count: (caseCountRes.count || 0) + (partyCountRes.count || 0),
      latestTs: Math.max(remoteCaseTs || 0, remotePartyTs || 0),
    };
  }, []);

  const pushSupabaseLegacyTables = useCallback(async (nextCases: Case[], nextParties: Party[], ownerId: string) => {
    if (!supabase) return;
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
  }, []);

  const pullSupabaseData = useCallback(async (ownerId: string) => {
    if (!supabase || !ownerId) return { cases: [] as Case[], parties: [] as Party[] };
    try {
      let nextCases: Case[] = [];
      let nextParties: Party[] = [];
      const segmented = await pullSupabaseSegmented(supabase, supabaseSyncBucket, ownerId);
      nextCases = segmented.cases.map(normalizeCase);
      nextParties = segmented.parties as Party[];

      if (nextCases.length === 0 && nextParties.length === 0 && !segmented.hasRemoteData) {
        const legacy = await pullSupabaseLegacyTables(ownerId);
        nextCases = legacy.cases;
        nextParties = legacy.parties;
        if (nextCases.length > 0 || nextParties.length > 0) {
          await pushSupabaseSegmented(supabase, supabaseSyncBucket, ownerId, {
            cases: nextCases,
            parties: nextParties,
          });
        }
      }
      return { cases: nextCases, parties: nextParties };
    } catch (error: any) {
      if (!isBucketNotFoundError(error)) throw error;
      return pullSupabaseLegacyTables(ownerId);
    }
  }, [pullSupabaseLegacyTables]);

  const loadFromSupabase = useCallback(async (ownerId: string) => {
    if (!supabase || !ownerId) return false;
    try {
      setSyncStatus('syncing');
      const { cases: nextCases, parties: nextParties } = await pullSupabaseData(ownerId);

      const localCaseCount = parseLocalList<Case>(APP_KEY_CASES).length;
      const localPartyCount = parseLocalList<Party>(APP_KEY_PARTIES).length;
      const remoteEmpty = nextCases.length === 0 && nextParties.length === 0;
      const localHasData = localCaseCount > 0 || localPartyCount > 0;
      if (remoteEmpty && localHasData) {
        loadFromLocal();
        setSyncStatus('error');
        setSyncError('检测到云端为空，已保留本地数据并阻止覆盖。请确认登录账号后再同步。');
        return false;
      }

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
  }, [loadFromLocal, pullSupabaseData]);

  useEffect(() => {
    if (syncMode !== 'online') {
      setAuthLoading(false);
      setAuthUser(null);
      return;
    }
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
  }, [syncMode]);

  useEffect(() => {
    if (isBootstrapped) return;
    const bootstrap = async () => {
      const shouldAbortBootstrapApply = () => mutationDuringBootstrapRef.current;
      setAppTitleState(DEFAULT_APP_TITLE);
      localStorage.removeItem('lawyerAppTitle_v18');

      if (syncMode === 'local') {
        if (localFileSyncSupported && getLocalFileSyncEnabled()) {
          const target = await getBoundSyncTarget();
          if (shouldAbortBootstrapApply()) {
            setIsBootstrapped(true);
            return;
          }
          if (target) {
            localSyncTargetRef.current = target;
            setLocalFileSyncKind(target.kind);
            setLocalFileSyncEnabledState(true);
            setLocalFileSyncFileName(getTargetName(target));
            const pulled = await pullFromBoundLocalFile();
            if (shouldAbortBootstrapApply()) {
              setIsBootstrapped(true);
              return;
            }
            if (pulled.ok) {
              setSyncStatus('online');
              setSyncError(null);
              setIsBootstrapped(true);
              return;
            }
            setSyncStatus('error');
            setSyncError(pulled.message);
          } else {
            setLocalFileSyncEnabled(false);
            setLocalFileSyncEnabledState(false);
            setLocalFileSyncKind(null);
          }
        }
        loadFromLocal();
        setSyncStatus(localFileSyncEnabled ? 'online' : 'offline');
        setIsBootstrapped(true);
        return;
      }

      if (isSupabaseConfigured && supabase && syncMode === 'online') {
        if (authLoading) return;
        if (!authUser?.id) {
          if (shouldAbortBootstrapApply()) {
            setIsBootstrapped(true);
            return;
          }
          // Keep local data visible when signed out; only disable cloud sync.
          loadFromLocal();
          setSyncStatus('offline');
          setSyncError('请先在设置页登录后再同步');
          setIsBootstrapped(true);
          return;
        }
        const loaded = await loadFromSupabase(authUser.id);
        if (shouldAbortBootstrapApply()) {
          setIsBootstrapped(true);
          return;
        }
        if (loaded) {
          setIsBootstrapped(true);
          return;
        }
      }

      const serverLoaded = await loadFromServerFile();
      if (shouldAbortBootstrapApply()) {
        setIsBootstrapped(true);
        return;
      }
      if (!serverLoaded) {
        loadFromLocal();
      }
      setIsBootstrapped(true);
      return;
    };

    void bootstrap();
  }, [authLoading, authUser?.id, isBootstrapped, loadFromLocal, loadFromServerFile, loadFromSupabase, localFileSyncEnabled, localFileSyncSupported, pullFromBoundLocalFile, syncMode]);

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
      let useLegacy = false;
      let remoteCount = 0;
      let remoteLatest = 0;

      // Safety guard: never let empty local data erase non-empty cloud data automatically.
      if (nextCases.length === 0 && nextParties.length === 0) {
        try {
          const manifestMeta = await readSupabaseSegmentedManifestMeta(supabase, supabaseSyncBucket, ownerId);
          remoteCount = (manifestMeta?.caseCount || 0) + (manifestMeta?.partyCount || 0);
        } catch (error: any) {
          if (!isBucketNotFoundError(error)) throw error;
          useLegacy = true;
          const legacyMeta = await getSupabaseLegacyRemoteMeta(ownerId);
          remoteCount = legacyMeta.count;
        }
        if (remoteCount > 0) {
          setSyncStatus('error');
          setSyncError('已阻止空数据覆盖云端。请先从备份恢复或确认账号后再操作。');
          return;
        }
      }

      // Freshness guard: do not allow older local data to overwrite newer cloud data.
      if (!useLegacy) {
        try {
          const manifestMeta = await readSupabaseSegmentedManifestMeta(supabase, supabaseSyncBucket, ownerId);
          remoteLatest = manifestMeta?.updatedAt ? new Date(manifestMeta.updatedAt).getTime() : 0;
        } catch (error: any) {
          if (!isBucketNotFoundError(error)) throw error;
          useLegacy = true;
          const legacyMeta = await getSupabaseLegacyRemoteMeta(ownerId);
          remoteLatest = legacyMeta.latestTs;
        }
      } else {
        const legacyMeta = await getSupabaseLegacyRemoteMeta(ownerId);
        remoteLatest = legacyMeta.latestTs;
      }
      const localLatest = latestLocalDataTs(nextCases, nextParties);

      if (remoteLatest > 0 && localLatest > 0 && localLatest + 1000 < remoteLatest) {
        setSyncStatus('error');
        setSyncError('已阻止旧本地数据覆盖较新的云端数据。请先从云端拉取或确认后再处理。');
        return;
      }

      if (useLegacy) {
        await pushSupabaseLegacyTables(nextCases, nextParties, ownerId);
      } else {
        await pushSupabaseSegmented(supabase, supabaseSyncBucket, ownerId, {
          cases: nextCases,
          parties: nextParties,
        });
      }

      setSyncStatus('online');
      setSyncError(null);
      setLastSyncedAt(nowISO());
    } catch (error: any) {
      setSyncStatus('error');
      setSyncError(error?.message || 'Supabase sync failed');
    }
  }, [getSupabaseLegacyRemoteMeta, pushSupabaseLegacyTables, saveToServerFile]);

  const forceUploadToSupabaseNow = useCallback(async () => {
    if (syncMode !== 'online') return { ok: false, message: '当前为本地模式，请先切换到联网模式。' };
    if (!supabase || !isSupabaseConfigured) return { ok: false, message: '云端同步未配置。' };
    if (!authUser?.id) return { ok: false, message: '请先登录 Supabase。' };
    try {
      setSyncStatus('syncing');
      try {
        await pushSupabaseSegmented(supabase, supabaseSyncBucket, authUser.id, { cases, parties });
      } catch (error: any) {
        if (!isBucketNotFoundError(error)) throw error;
        await pushSupabaseLegacyTables(cases, parties, authUser.id);
      }
      setSyncStatus('online');
      setSyncError(null);
      setLastSyncedAt(nowISO());
      return { ok: true, message: '已立即上传：本地已强制覆盖云端。' };
    } catch (error: any) {
      setSyncStatus('error');
      setSyncError(error?.message || 'Supabase 强制上传失败');
      return { ok: false, message: error?.message || '强制上传失败。' };
    }
  }, [authUser?.id, cases, parties, pushSupabaseLegacyTables, syncMode]);

  const forceDownloadFromSupabaseNow = useCallback(async () => {
    if (syncMode !== 'online') return { ok: false, message: '当前为本地模式，请先切换到联网模式。' };
    if (!supabase || !isSupabaseConfigured) return { ok: false, message: '云端同步未配置。' };
    if (!authUser?.id) return { ok: false, message: '请先登录 Supabase。' };
    try {
      setSyncStatus('syncing');
      const { cases: remoteCases, parties: remoteParties } = await pullSupabaseData(authUser.id);
      applyDataset(remoteCases, remoteParties, true);
      setSyncStatus('online');
      setSyncError(null);
      setLastSyncedAt(nowISO());
      return { ok: true, message: '已立即下载：云端已强制覆盖本地。' };
    } catch (error: any) {
      setSyncStatus('error');
      setSyncError(error?.message || 'Supabase 强制下载失败');
      return { ok: false, message: error?.message || '强制下载失败。' };
    }
  }, [authUser?.id, pullSupabaseData, syncMode]);

  useEffect(() => {
    localStorage.setItem(APP_KEY_CASES, JSON.stringify(cases));
    localStorage.setItem(APP_KEY_PARTIES, JSON.stringify(parties));

    const now = Date.now();
    if (hasAnyData(cases, parties) && now - lastAutoSnapshotAtRef.current > 5 * 60 * 1000) {
      createSnapshot('auto', cases, parties);
      lastAutoSnapshotAtRef.current = now;
    }

    if (!isBootstrapped) return;

    const skipCloudSyncThisRound = skipNextSyncRef.current;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
    }

    if (localFileSyncEnabled && localFileSyncSupported) {
      if (skipNextLocalSyncPushRef.current) {
        skipNextLocalSyncPushRef.current = false;
      } else {
        if (localFileSaveTimerRef.current) window.clearTimeout(localFileSaveTimerRef.current);
        localFileSaveTimerRef.current = window.setTimeout(async () => {
          const target = localSyncTargetRef.current ?? (await getBoundSyncTarget());
          if (!target) return;
          const allowed = await canReadWriteTarget(target);
          if (!allowed) {
            setLocalFileSyncMessage('本地同步权限失效，请在设置页重新绑定文件。');
            return;
          }
          await writePayloadToTarget(target, { cases, parties });
          localSyncTargetRef.current = target;
          setLocalFileSyncKind(target.kind);
          setLocalFileSyncFileName(getTargetName(target));
          setLocalFileSyncMessage(`已自动同步到 ${getTargetName(target) || 'iCloud 目标'}`);
          setLastSyncedAt(nowISO());
        }, 500);
      }
    }

    if (syncMode === 'online' && !skipCloudSyncThisRound) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void syncToSupabase(cases, parties, authUser?.id || null);
      }, 450);
    } else if (syncMode !== 'online') {
      void saveToServerFile(cases, parties);
    }

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (localFileSaveTimerRef.current) window.clearTimeout(localFileSaveTimerRef.current);
    };
  }, [cases, parties, syncToSupabase, isBootstrapped, authUser?.id, createSnapshot, localFileSyncEnabled, localFileSyncSupported, saveToServerFile, syncMode]);

  useEffect(() => {
    if (syncMode !== 'online') return;
    if (!supabase || !isSupabaseConfigured) return;

    if (!authUser?.id) return;

    const refreshFromRemote = async () => {
      let remoteTs = 0;
      try {
        const meta = await readSupabaseSegmentedManifestMeta(supabase, supabaseSyncBucket, authUser.id);
        remoteTs = meta?.updatedAt ? new Date(meta.updatedAt).getTime() : 0;
      } catch (error: any) {
        if (!isBucketNotFoundError(error)) return;
        const legacyMeta = await getSupabaseLegacyRemoteMeta(authUser.id);
        remoteTs = legacyMeta.latestTs;
      }
      if (!remoteTs) return;
      const localTs = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
      if (remoteTs > localTs + 500) {
        if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = window.setTimeout(() => {
          void loadFromSupabase(authUser.id);
        }, 300);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshFromRemote();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    remotePollTimerRef.current = window.setInterval(() => {
      void refreshFromRemote();
    }, 15000);

    return () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      if (remotePollTimerRef.current) window.clearInterval(remotePollTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [authUser?.id, getSupabaseLegacyRemoteMeta, lastSyncedAt, loadFromSupabase, syncMode]);

  useEffect(() => {
    if (!localFileSyncEnabled || !localFileSyncSupported || !isBootstrapped) return;
    const flushLocalNow = async () => {
      const target = localSyncTargetRef.current ?? (await getBoundSyncTarget());
      if (!target) return;
      const allowed = await canReadWriteTarget(target);
      if (!allowed) return;
      await writePayloadToTarget(target, { cases, parties });
      localSyncTargetRef.current = target;
      setLocalFileSyncKind(target.kind);
      setLocalFileSyncFileName(getTargetName(target));
      setLocalFileSyncMessage(`已同步到 ${getTargetName(target) || 'iCloud 目标'} · ${new Date().toLocaleTimeString()}`);
      setLastSyncedAt(nowISO());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushLocalNow();
      }
    };
    const onPageHide = () => {
      void flushLocalNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [cases, parties, isBootstrapped, localFileSyncEnabled, localFileSyncSupported]);

  const signIn = async (email: string, password: string) => {
    if (syncMode !== 'online') return { ok: false, message: '当前为本地模式，请切换到联网模式后登录。' };
    if (!supabase) return { ok: false, message: '云端同步未配置。' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  };

  const signUp = async (email: string, password: string) => {
    if (syncMode !== 'online') return { ok: false, message: '当前为本地模式，请切换到联网模式后注册。' };
    if (!supabase) return { ok: false, message: '云端同步未配置。' };
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  };

  const signOut = async () => {
    if (syncMode !== 'online') return;
    if (!supabase) return;
    await supabase.auth.signOut();
    // Do not wipe local data on sign out; user can still view/edit locally.
    setSyncStatus('offline');
    setSyncError('请先在设置页登录后再同步');
  };

  const setAppTitle = (title: string) => {
    setAppTitleState(DEFAULT_APP_TITLE);
  };

  const updateCase = (updatedCase: Case) => {
    if (!isBootstrapped) mutationDuringBootstrapRef.current = true;
    setCases((prev) => prev.map((item) => (item.id === updatedCase.id ? normalizeCase({ ...updatedCase, updatedAt: nowISO() }) : item)));
  };

  const addCase = (newCase: Case) => {
    if (!isBootstrapped) mutationDuringBootstrapRef.current = true;
    setCases((prev) => [normalizeCase({ ...newCase, updatedAt: nowISO() }), ...prev]);
  };

  const deleteCase = (id: string) => {
    if (!isBootstrapped) mutationDuringBootstrapRef.current = true;
    setCases((prev) => prev.filter((item) => item.id !== id));
    if (activeCaseId === id) navigate('dashboard');
  };

  const updateParty = (updatedParty: Party) => {
    if (!isBootstrapped) mutationDuringBootstrapRef.current = true;
    setParties((prev) => prev.map((item) => (item.id === updatedParty.id ? updatedParty : item)));
  };

  const addParty = (newParty: Party) => {
    if (!isBootstrapped) mutationDuringBootstrapRef.current = true;
    setParties((prev) => [newParty, ...prev]);
  };

  const deleteParty = (id: string) => {
    if (!isBootstrapped) mutationDuringBootstrapRef.current = true;
    setParties((prev) => prev.filter((item) => item.id !== id));
  };

  const importData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const importedCases = (Array.isArray(data) ? data : (data.cases || [])).map(normalizeCase);
      const importedParties = Array.isArray(data) ? [] : (data.parties || []);
      createSnapshot('before-import', cases, parties);
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

  const pullFromLocalFileSync = useCallback(async () => {
    try {
      return await pullFromBoundLocalFile();
    } catch (error: any) {
      return { ok: false, message: error?.message || '本地拉取失败，请重试。' };
    }
  }, [pullFromBoundLocalFile]);

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
        isSupabaseEnabled: isSupabaseConfigured && syncMode === 'online',
        authLoading,
        isAuthenticated: Boolean(authUser),
        userEmail: authUser?.email || null,
        syncMode,
        setSyncMode,
        signIn,
        signUp,
        signOut,
        forceUploadToSupabaseNow,
        forceDownloadFromSupabaseNow,
        localFileSyncSupported,
        localFileSyncEnabled,
        localFileSyncKind,
        localFileSyncFileName,
        localFileSyncMessage,
        setupLocalFileSyncByFolder,
        setupLocalFileSyncByExport,
        bindLocalFileSyncExisting,
        pullFromLocalFileSync,
        flushLocalFileSyncNow,
        disableLocalFileSync,
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
