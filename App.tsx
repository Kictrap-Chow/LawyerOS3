import React, { useEffect, useRef, useState } from 'react';
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
import { Archive, Briefcase, ClipboardPlus, Download, Home, PanelLeft, Plus, Search, Settings as SettingsIcon, Users, X } from 'lucide-react';
import { nowISO, uuid } from './utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const MainLayout: React.FC = () => {
  const { activeView, activeCaseId, navigate, addCase, cases, updateCase } = useData();
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDesktopNav, setShowDesktopNav] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lawyerSidebarWidth'));
    return Number.isFinite(saved) ? Math.min(420, Math.max(248, saved)) : 292;
  });
  const [showMobileCases, setShowMobileCases] = useState(false);
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [quickCaseId, setQuickCaseId] = useState('');
  const [quickTaskDesc, setQuickTaskDesc] = useState('');
  const [quickTaskType, setQuickTaskType] = useState<'文书' | '会议' | '咨询' | '其他'>('文书');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('lawyerSidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = event.clientX - resizeRef.current.startX;
      const nextWidth = Math.min(420, Math.max(248, resizeRef.current.startWidth + delta));
      setSidebarWidth(nextWidth);
    };
    const onMouseUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone || localStorage.getItem('lawyerPwaInstallDismissed') === '1') return;
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIOS && isSafari) {
      setShowIosInstallHint(true);
      setShowInstallBanner(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowIosInstallHint(false);
      setShowInstallBanner(true);
    };
    const onAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
      localStorage.removeItem('lawyerPwaInstallDismissed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const startSidebarResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

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
  const mobileCases = cases
    .filter((c) => c.status !== 'archived')
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  const openQuickTask = () => {
    if (mobileCases.length === 0) {
      alert('请先新建案件');
      return;
    }
    setQuickCaseId((prev) => prev || mobileCases[0].id);
    setQuickTaskDesc('');
    setQuickTaskType('文书');
    setShowQuickTask(true);
  };

  const createQuickTask = () => {
    const target = cases.find((c) => c.id === quickCaseId);
    if (!target) {
      alert('请选择案件');
      return;
    }
    if (!quickTaskDesc.trim()) {
      alert('请填写任务内容');
      return;
    }
    updateCase({
      ...target,
      tasks: [
        {
          id: uuid(),
          type: quickTaskType,
          desc: quickTaskDesc.trim(),
          assignee: '',
          notes: '',
          createdAt: nowISO(),
          completedAt: null,
          sessions: [],
          isRunning: false,
          isCompleted: false
        },
        ...(target.tasks || [])
      ]
    });
    setShowQuickTask(false);
    navigate('case', target.id, 'tasks');
  };

  const installPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
      return;
    }
    setShowInstallBanner(true);
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('lawyerPwaInstallDismissed', '1');
    setShowIosInstallHint(false);
  };

  return (
    <div className="flex h-dvh w-full max-w-full text-[#1f2937] font-sans antialiased overflow-hidden overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 p-1.5 md:p-3 gap-1.5 md:gap-3">
      {showDesktopNav && (
        <div className="hidden md:flex h-full relative shrink-0" style={{ width: `${sidebarWidth}px` }}>
          <Sidebar
            className="flex w-full"
            onSearch={() => setShowSearch(true)}
            onCreateCase={() => setShowCaseForm(true)}
            onToggleCollapse={() => setShowDesktopNav(false)}
          />
          <button
            type="button"
            onMouseDown={startSidebarResize}
            className="absolute top-5 -right-1.5 bottom-5 w-3 cursor-col-resize group"
            aria-label="Resize sidebar"
            title="Resize sidebar"
          >
            <span className="block mx-auto h-full w-1 rounded-full bg-transparent group-hover:bg-[#cfd8e6] group-active:bg-[#b8c3d8] transition-colors" />
          </button>
        </div>
      )}

      <main className="flex-1 h-full max-w-full overflow-y-auto overflow-x-hidden relative craft-surface p-1.5 pb-24 md:pb-3 md:p-3">
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
        <div className="md:hidden sticky top-0 z-30 mb-2 px-2 py-2.5 craft-panel backdrop-blur supports-[backdrop-filter]:bg-white/75 shadow-[0_10px_24px_rgba(17,36,74,0.12)]">
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ui-muted)]">LawyerOS</div>
              <div className="truncate text-sm font-semibold text-[var(--ui-text-strong)]">{getHeaderTitle()}</div>
            </div>
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-xl hover:bg-gray-100">
              <Search size={18} />
            </button>
            <button onClick={openQuickTask} className="p-2 rounded-xl hover:bg-gray-100">
              <ClipboardPlus size={18} />
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

      {showInstallBanner && (installPrompt || showIosInstallHint) && (
        <div className="md:hidden fixed left-2 right-2 z-50" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.8rem)' }}>
          <div className="craft-panel px-3 py-2.5 border border-[var(--ui-tint-border)] shadow-[0_12px_28px_rgba(10,37,64,0.2)]">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl accent-gradient-bg text-white flex items-center justify-center shrink-0 mt-0.5">
                <Download size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--ui-text-strong)]">安装到手机主屏</div>
                <div className="text-[11px] text-[var(--ui-muted)] mt-0.5">
                  {showIosInstallHint ? 'iPhone：点 Safari 分享按钮，再点“添加到主屏幕”。' : '离线可用，打开更快，像原生 App 一样使用。'}
                </div>
                {installPrompt && (
                  <button onClick={installPwa} className="mt-2 px-3 py-1.5 text-xs rounded-lg accent-bg text-white">立即安装</button>
                )}
              </div>
              <button onClick={dismissInstallBanner} className="p-1 rounded-md text-[var(--ui-muted)] hover:bg-white/80">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pb-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="grid grid-cols-5 gap-1 craft-panel border border-white/70 p-1 shadow-[0_14px_26px_rgba(13,35,64,0.16)]">
          <button
            onClick={() => navigate('dashboard')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'dashboard' ? 'accent-text bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-tint-border)]' : 'text-gray-500'}`}
          >
            <Home size={16} />
            <span>仪表盘</span>
          </button>
          <button
            onClick={() => navigate('parties')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'parties' ? 'accent-text bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-tint-border)]' : 'text-gray-500'}`}
          >
            <Users size={16} />
            <span>当事人</span>
          </button>
          <button
            onClick={() => navigate('settings')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'settings' ? 'accent-text bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-tint-border)]' : 'text-gray-500'}`}
          >
            <SettingsIcon size={16} />
            <span>设置</span>
          </button>
          <button
            onClick={() => setShowMobileCases(true)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'case' || showMobileCases ? 'accent-text bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-tint-border)]' : 'text-gray-500'}`}
          >
            <Briefcase size={16} />
            <span>案件</span>
          </button>
          <button
            onClick={() => navigate('archives')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] ${activeView === 'archives' ? 'accent-text bg-[var(--ui-accent-soft)] ring-1 ring-[var(--ui-tint-border)]' : 'text-gray-500'}`}
          >
            <Archive size={16} />
            <span>归档</span>
          </button>
        </div>
      </div>

      {showMobileCases && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowMobileCases(false)} />
          <div className="relative w-full rounded-t-3xl bg-white/95 border-t border-[#dce7f5] max-h-[80vh] overflow-y-auto p-3 shadow-[0_-18px_36px_rgba(13,35,64,0.22)]">
            <div className="w-10 h-1 rounded-full bg-[#d2dceb] mx-auto mb-2" />
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">案件</div>
              <button onClick={() => setShowCaseForm(true)} className="text-xs px-2 py-1 rounded border tint-border">新建</button>
            </div>
            <div className="space-y-1">
              {mobileCases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    navigate('case', c.id);
                    setShowMobileCases(false);
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-[#e6edf6] bg-white/90"
                >
                  <div className="text-sm font-medium text-[#243247] truncate">{c.name}</div>
                  <div className="text-[11px] text-[#7b8798] mt-0.5">{c.type}</div>
                </button>
              ))}
              {mobileCases.length === 0 && <div className="text-xs text-gray-400 p-2">暂无进行中案件</div>}
            </div>
          </div>
        </div>
      )}

      {showQuickTask && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowQuickTask(false)} />
          <div className="relative w-full rounded-t-3xl bg-white/95 border-t border-[#dce7f5] p-3 shadow-[0_-18px_36px_rgba(13,35,64,0.22)]">
            <div className="w-10 h-1 rounded-full bg-[#d2dceb] mx-auto mb-2" />
            <div className="text-sm font-semibold mb-2">快速创建任务</div>
            <div className="space-y-2">
              <select
                className="w-full text-sm border tint-border rounded px-3 py-2 bg-white outline-none"
                value={quickCaseId}
                onChange={(e) => setQuickCaseId(e.target.value)}
              >
                {mobileCases.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                className="w-full text-sm border tint-border rounded px-3 py-2 bg-white outline-none"
                value={quickTaskType}
                onChange={(e) => setQuickTaskType(e.target.value as any)}
              >
                <option value="文书">文书</option>
                <option value="会议">会议</option>
                <option value="咨询">咨询</option>
                <option value="其他">其他</option>
              </select>
              <input
                className="w-full text-sm border tint-border rounded px-3 py-2 outline-none"
                placeholder="任务内容"
                value={quickTaskDesc}
                onChange={(e) => setQuickTaskDesc(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowQuickTask(false)} className="px-3 py-1.5 text-sm rounded border tint-border">取消</button>
                <button onClick={createQuickTask} className="px-3 py-1.5 text-sm rounded accent-bg text-white">创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
