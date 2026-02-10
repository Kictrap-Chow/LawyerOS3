import React from 'react';
import { useData } from '../store/DataContext';
import { 
  Home, Users, Archive, Plus, Search,
  Scale, Cloud, CloudOff, AlertTriangle, Settings, PanelLeftClose
} from 'lucide-react';
import { cn } from '../utils';
import { useI18n } from '../store/I18nContext';
import { Case } from '../types';

interface SidebarProps {
  onSearch: () => void;
  onCreateCase: () => void;
  className?: string;
  onAfterNavigate?: () => void;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSearch, onCreateCase, className, onAfterNavigate, onToggleCollapse }) => {
  const { cases, activeView, activeCaseId, navigate, appTitle, syncStatus, syncError, lastSyncedAt, isSupabaseEnabled } = useData();
  const { t } = useI18n();
  const activeCases = cases
    .filter(c => c.status !== 'archived')
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  const caseTypeToken = (c: Case) => {
    const raw = String(c.type);
    if (raw === '诉讼' || raw === 'Litigation') return 'litigation';
    if (raw === '仲裁' || raw === 'Arbitration') return 'arbitration';
    if (raw === '常年法律顾问' || raw === 'Retainer') return 'retainer';
    if (raw === '专项法律服务' || raw === 'Advisory') return 'special';
    if (raw === '争议解决' || raw === 'Dispute') return 'dispute';
    return 'other';
  };
  const caseTypeSections: Array<{ key: string; title: string; items: Case[] }> = [
    { key: 'litigation', title: t('case.type.litigation'), items: activeCases.filter((c) => caseTypeToken(c) === 'litigation') },
    { key: 'arbitration', title: t('case.type.arbitration'), items: activeCases.filter((c) => caseTypeToken(c) === 'arbitration') },
    { key: 'retainer', title: t('case.type.retainer'), items: activeCases.filter((c) => caseTypeToken(c) === 'retainer') },
    { key: 'special', title: t('case.type.special'), items: activeCases.filter((c) => caseTypeToken(c) === 'special') },
    { key: 'dispute', title: t('case.type.dispute'), items: activeCases.filter((c) => caseTypeToken(c) === 'dispute') },
  ];

  const NavItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 my-0.5 text-sm rounded-xl cursor-pointer transition-colors text-[#4b5563] hover:bg-white/80",
        active && "bg-white text-strong-theme font-medium shadow-sm"
      )}
    >
      <Icon size={16} />
      <span className="flex-1 truncate">{label}</span>
      {badge && <span className="text-xs bg-[#e0e0e0] px-1.5 rounded-sm">{badge}</span>}
    </div>
  );

  const Section = ({ title, children }: any) => (
    <div className="mb-4">
      <h3 className="px-3 mb-1 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );

  const syncBadge = () => {
    if (!isSupabaseEnabled) {
      return { icon: CloudOff, text: t('sync.offlineMode'), className: 'text-gray-500' };
    }
    if (syncStatus === 'online') {
      return { icon: Cloud, text: t('sync.online'), className: 'text-[#6a5b75]' };
    }
    if (syncStatus === 'syncing') {
      return { icon: Cloud, text: t('sync.syncing'), className: 'text-[#6b5a8b]' };
    }
    return { icon: AlertTriangle, text: t('sync.error'), className: 'text-[#7a4f69]' };
  };

  const currentSync = syncBadge();
  const SyncIcon = currentSync.icon;
  const syncedTimeLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '-';
  const friendlySyncError = (syncError || '')
    .replace('Supabase load failed', '加载失败')
    .replace('Supabase sync failed', '同步失败')
    .replace('Please sign in to Supabase', '请先登录后同步');

  return (
    <div className={cn("w-[292px] h-full craft-surface flex flex-col flex-shrink-0", className)}>
      {/* App Title */}
      <div className="p-3 h-14 flex items-center justify-between group border-b border-[#e3e9f3]">
        <div className="flex items-center gap-2 px-2 py-1.5 w-full rounded-xl text-sm font-semibold text-strong-theme truncate">
          {appTitle}
        </div>
        {!!onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="ml-2 p-1.5 rounded-lg hover:bg-white/80 text-gray-500 hover:text-gray-700"
            title="Hide Sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-hide">
        {/* Core Nav */}
        <div className="mb-6 craft-panel p-1.5">
          <div onClick={onSearch} className="flex items-center gap-2 px-3 py-2 my-0.5 text-sm rounded-xl cursor-pointer text-[#4b5563] hover:bg-white">
            <Search size={16} />
            <span>{t('nav.search')}</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-[#efefed] px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘K</span>
            </kbd>
          </div>
          <NavItem 
            icon={Home} 
            label={t('nav.dashboard')} 
            active={activeView === 'dashboard'} 
            onClick={() => {
              navigate('dashboard');
              onAfterNavigate?.();
            }} 
          />
          <NavItem 
            icon={Users} 
            label={t('nav.parties')} 
            active={activeView === 'parties'} 
            onClick={() => {
              navigate('parties');
              onAfterNavigate?.();
            }} 
          />
          <NavItem 
            icon={Archive} 
            label={t('nav.archives')} 
            active={activeView === 'archives'} 
            onClick={() => {
              navigate('archives');
              onAfterNavigate?.();
            }} 
          />
          <NavItem
            icon={Settings}
            label={t('nav.settings')}
            active={activeView === 'settings'}
            onClick={() => {
              navigate('settings');
              onAfterNavigate?.();
            }}
          />
        </div>

        {/* Case Lists */}
        <Section title={t('nav.activeCases')}>
          <div className="craft-panel p-1.5">
            {caseTypeSections.map((section) => (
              <div key={section.key} className="mb-2 last:mb-0">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[#8f95a3] uppercase tracking-wide">{section.title}</div>
                {section.items.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      navigate('case', c.id);
                      onAfterNavigate?.();
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 ml-1 text-sm rounded-xl cursor-pointer transition-colors text-[#4b5563] hover:bg-white truncate",
                      activeCaseId === c.id && "bg-white text-strong-theme font-medium shadow-sm"
                    )}
                  >
                    <Scale size={13} className="text-gray-400 shrink-0" />
                    <span className="truncate flex-1">{c.name}</span>
                    {c.updatedAt && <span className="text-[10px] text-gray-400 shrink-0">{new Date(c.updatedAt).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            ))}
            {activeCases.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No active cases.</div>
            )}
          </div>
        </Section>
        
        <div 
          onClick={() => {
            onCreateCase();
            onAfterNavigate?.();
          }}
          className="flex items-center gap-2 px-3 py-2 my-2 text-sm rounded-xl cursor-pointer text-[#6b7280] hover:bg-white/80"
        >
          <Plus size={16} />
          <span>{t('nav.newCase')}</span>
        </div>
      </div>

      {/* Footer / System */}
      <div className="p-3 border-t border-[#e2e8f0] bg-white/40">
        <div className="flex flex-col gap-1">
          <div className={cn("flex items-center gap-2 px-2 py-1.5 text-xs rounded bg-white border border-[#e9e9e7]", currentSync.className)}>
            <SyncIcon size={14} />
            <span>{currentSync.text}</span>
          </div>
          <div className="px-2 text-[10px] text-[#9b9a97]">
            {t('sync.lastSynced')}: {syncedTimeLabel}
          </div>
          {syncError && <div className="px-2 text-[10px] text-[#7a4f69] truncate">{friendlySyncError}</div>}
        </div>
      </div>
    </div>
  );
};
