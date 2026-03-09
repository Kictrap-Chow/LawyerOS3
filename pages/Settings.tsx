import React, { useMemo, useRef, useState } from 'react';
import { useI18n } from '../store/I18nContext';
import { ThemePreset, useTheme } from '../store/ThemeContext';
import { cn } from '../utils';
import { useData } from '../store/DataContext';
import { FileJson, FileUp } from 'lucide-react';

export const Settings: React.FC = () => {
  const { lang, setLang } = useI18n();
  const { preset, setPreset, accent, setAccent, textColor, setTextColor, font, setFont } = useTheme();
  const {
    isSupabaseEnabled, authLoading, isAuthenticated, userEmail, syncMode, setSyncMode, signIn, signUp, signOut,
    forceUploadToSupabaseNow, forceDownloadFromSupabaseNow,
    exportData, importData,
    localFileSyncSupported, localFileSyncEnabled, localFileSyncKind, localFileSyncFileName, localFileSyncMessage,
    setupLocalFileSyncByFolder, setupLocalFileSyncByExport, bindLocalFileSyncExisting, pullFromLocalFileSync, flushLocalFileSyncNow, disableLocalFileSync
  } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [onlineSyncActionMessage, setOnlineSyncActionMessage] = useState('');
  const [localSyncActionMessage, setLocalSyncActionMessage] = useState('');
  const [localSyncBusy, setLocalSyncBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [calendarToken, setCalendarToken] = useState(() => localStorage.getItem('calendarFeedToken') || '');

  const calendarFeedUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}/api/calendar.ics`;
    return calendarToken.trim() ? `${base}?token=${encodeURIComponent(calendarToken.trim())}` : base;
  }, [calendarToken]);

  const toFriendlyAuthMessage = (raw?: string) => {
    const msg = (raw || '').toLowerCase();
    if (msg.includes('email not confirmed')) return '邮箱尚未验证，请先到邮箱点击确认链接。';
    if (msg.includes('invalid login credentials')) return '邮箱或密码错误，请检查后重试。';
    if (msg.includes('user already registered')) return '该邮箱已注册，请直接登录。';
    if (msg.includes('password should be')) return '密码强度不足，请使用更复杂的密码。';
    if (msg.includes('network')) return '网络连接异常，请稍后重试。';
    return raw || '操作失败，请稍后再试。';
  };

  const handleSignIn = async () => {
    setAuthBusy(true);
    const res = await signIn(email.trim(), password);
    setAuthBusy(false);
    setAuthMessage(res.ok ? '登录成功。' : toFriendlyAuthMessage(res.message));
  };

  const handleSignUp = async () => {
    setAuthBusy(true);
    const res = await signUp(email.trim(), password);
    setAuthBusy(false);
    setAuthMessage(res.ok ? '注册成功，请返回登录。' : toFriendlyAuthMessage(res.message));
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    await signOut();
    setAuthBusy(false);
    setAuthMessage('已退出登录。');
  };

  const handleForceUploadNow = async () => {
    setAuthBusy(true);
    const res = await forceUploadToSupabaseNow();
    setAuthBusy(false);
    setOnlineSyncActionMessage(res.message);
  };

  const handleForceDownloadNow = async () => {
    setAuthBusy(true);
    const res = await forceDownloadFromSupabaseNow();
    setAuthBusy(false);
    setOnlineSyncActionMessage(res.message);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importData(text);
      alert('数据导入成功');
    } catch {
      alert('读取文件失败，请重试');
    } finally {
      e.target.value = '';
    }
  };

  const handleSetupLocalSync = async () => {
    setLocalSyncBusy(true);
    const res = await setupLocalFileSyncByFolder();
    setLocalSyncBusy(false);
    setLocalSyncActionMessage(res.message);
  };

  const handleSetupLegacyFileSync = async () => {
    setLocalSyncBusy(true);
    const res = await setupLocalFileSyncByExport();
    setLocalSyncBusy(false);
    setLocalSyncActionMessage(res.message);
  };

  const handleBindExisting = async () => {
    setLocalSyncBusy(true);
    const res = await bindLocalFileSyncExisting();
    setLocalSyncBusy(false);
    setLocalSyncActionMessage(res.message);
  };

  const handlePullNow = async () => {
    setLocalSyncBusy(true);
    const res = await pullFromLocalFileSync();
    setLocalSyncBusy(false);
    setLocalSyncActionMessage(res.message);
  };

  const handleDisableLocalSync = async () => {
    setLocalSyncBusy(true);
    await disableLocalFileSync();
    setLocalSyncBusy(false);
    setLocalSyncActionMessage('已关闭自动同步。');
  };

  const handleFlushNow = async () => {
    setLocalSyncBusy(true);
    const res = await flushLocalFileSyncNow();
    setLocalSyncBusy(false);
    setLocalSyncActionMessage(res.message);
  };

  const copyCalendarUrl = async () => {
    if (!calendarFeedUrl) return;
    try {
      await navigator.clipboard.writeText(calendarFeedUrl);
      alert('日历订阅链接已复制');
    } catch {
      alert('复制失败，请手动复制');
    }
  };

  const saveCalendarToken = (value: string) => {
    setCalendarToken(value);
    localStorage.setItem('calendarFeedToken', value);
  };

  const presetOptions: Array<{ key: ThemePreset; title: string; desc: string }> = [
    { key: 'liquid-glass', title: 'Liquid Glass', desc: '高透光玻璃、柔光氛围' },
    { key: 'craft-light', title: 'Craft Light', desc: '浅色卡片、清爽文档感' },
    { key: 'obsidian-primary', title: 'Obsidian Primary', desc: '暖棕低饱和、专注阅读感' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-3 md:p-6 animate-fade-in">
      <div className="craft-surface p-4 md:p-6 mb-4">
        <h1 className="text-2xl font-bold text-strong-theme">设置</h1>
        <p className="text-sm text-gray-500 mt-1">Legal Nice OS by Disorder Tangerine</p>
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold tint-text uppercase mb-3">登录方式</h2>
        <div className="flex items-center gap-2 mb-3">
          <button
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border",
              syncMode === 'local' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white/80 border-gray-200 text-[var(--ui-text-strong)]'
            )}
            onClick={() => setSyncMode('local')}
          >
            本地（iCloud）
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border",
              syncMode === 'online' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white/80 border-gray-200 text-[var(--ui-text-strong)]'
            )}
            onClick={() => setSyncMode('online')}
          >
            联网（Supabase）
          </button>
        </div>
        {syncMode === 'local' && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              当前为本地优先模式：自动使用 iCloud JSON，同步时暂不走 Supabase。
            </div>
            <div className="rounded-xl border border-[var(--ui-line)] bg-white/50 p-3">
              <div className="text-xs text-gray-500 mb-2">
                推荐先“绑定 iCloud 文件夹（分模块）”：系统会按 `manifest + cases + parties` 分文件同步。每次打开页面自动拉取，每次修改自动写回。
              </div>
              {!localFileSyncSupported && (
                <div className="text-xs text-[#8b6b4e] mb-2">
                  当前浏览器不支持自动本地同步。请改用最新版 Chrome / Edge / Safari（iOS 17+）。
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSetupLocalSync}
                  disabled={syncMode !== 'local' || !localFileSyncSupported || localSyncBusy}
                  className="px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text disabled:opacity-60"
                >
                  绑定 iCloud 文件夹（推荐）
                </button>
                <button
                  onClick={handleSetupLegacyFileSync}
                  disabled={syncMode !== 'local' || !localFileSyncSupported || localSyncBusy}
                  className="px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text disabled:opacity-60"
                >
                  绑定单文件 JSON（兼容）
                </button>
                <button
                  onClick={handleBindExisting}
                  disabled={syncMode !== 'local' || !localFileSyncSupported || localSyncBusy}
                  className="px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text disabled:opacity-60"
                >
                  绑定已有 iCloud 目标
                </button>
                <button
                  onClick={handlePullNow}
                  disabled={syncMode !== 'local' || !localFileSyncEnabled || localSyncBusy}
                  className="px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text disabled:opacity-60"
                >
                  立即拉取一次
                </button>
                <button
                  onClick={handleFlushNow}
                  disabled={syncMode !== 'local' || !localFileSyncEnabled || localSyncBusy}
                  className="px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text disabled:opacity-60"
                >
                  立即同步
                </button>
                <button
                  onClick={handleDisableLocalSync}
                  disabled={syncMode !== 'local' || !localFileSyncEnabled || localSyncBusy}
                  className="px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text disabled:opacity-60"
                >
                  关闭自动同步
                </button>
              </div>
              <div className="mt-2 text-xs text-[#6a7d93]">
                状态：{syncMode === 'local' ? (localFileSyncEnabled ? `已启用（${localFileSyncKind === 'directory' ? '分模块' : '单文件'} · ${localFileSyncFileName || '未命名目标'}）` : '未启用') : '当前为联网模式'}
              </div>
              {(localSyncActionMessage || localFileSyncMessage) && (
                <div className="mt-1 text-xs text-[#6a7d93]">{localSyncActionMessage || localFileSyncMessage}</div>
              )}
            </div>
          </div>
        )}
        {syncMode === 'online' && !isSupabaseEnabled && (
          <div className="text-sm text-gray-500">当前未配置云端同步环境变量，在线同步不可用。</div>
        )}
        {syncMode === 'online' && isSupabaseEnabled && (
          <div className="text-xs text-[#6a7d93] mb-2">
            联网模式使用 Supabase 分模块同步：`manifest + cases + parties`（Storage 文件结构）。
          </div>
        )}
        {syncMode === 'online' && isSupabaseEnabled && authLoading && (
          <div className="text-sm text-gray-500">正在检查登录状态...</div>
        )}
        {syncMode === 'online' && isSupabaseEnabled && !authLoading && !isAuthenticated && (
          <div className="space-y-2">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSignIn();
              }}
            >
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm bg-white border tint-border rounded px-3 py-2 outline-none"
              />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm bg-white border tint-border rounded px-3 py-2 outline-none"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={authBusy} className="accent-bg accent-bg-hover text-white px-3 py-1.5 rounded text-sm disabled:opacity-60">登录</button>
                <button type="button" disabled={authBusy} onClick={handleSignUp} className="px-3 py-1.5 rounded text-sm border tint-border hover:bg-white disabled:opacity-60">注册</button>
              </div>
            </form>
            {authMessage && <div className="text-xs text-gray-500">{authMessage}</div>}
          </div>
        )}
        {syncMode === 'online' && isSupabaseEnabled && !authLoading && isAuthenticated && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">当前登录：<span className="font-medium text-strong-theme">{userEmail}</span></div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={authBusy}
                onClick={handleForceUploadNow}
                className="px-3 py-1.5 rounded text-sm border tint-border hover:bg-white disabled:opacity-60"
              >
                立即上传（覆盖云端）
              </button>
              <button
                disabled={authBusy}
                onClick={handleForceDownloadNow}
                className="px-3 py-1.5 rounded text-sm border tint-border hover:bg-white disabled:opacity-60"
              >
                立即下载（覆盖本地）
              </button>
              <button disabled={authBusy} onClick={handleSignOut} className="px-3 py-1.5 rounded text-sm border tint-border hover:bg-white disabled:opacity-60">退出登录</button>
            </div>
            {onlineSyncActionMessage && <div className="text-xs text-[#6a7d93]">{onlineSyncActionMessage}</div>}
            {authMessage && <div className="text-xs text-gray-500">{authMessage}</div>}
          </div>
        )}
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold tint-text uppercase mb-3">语言</h2>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "min-w-[64px] px-3 py-1.5 text-sm rounded-lg border",
              lang === 'zh' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white/80 border-gray-200 text-[var(--ui-text-strong)]'
            )}
            onClick={() => setLang('zh')}
          >
            中文
          </button>
          <button
            className={cn(
              "min-w-[64px] px-3 py-1.5 text-sm rounded-lg border",
              lang === 'en' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white/80 border-gray-200 text-[var(--ui-text-strong)]'
            )}
            onClick={() => setLang('en')}
          >
            English
          </button>
        </div>
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold tint-text uppercase mb-3">外观</h2>
        <div className="mb-3">
          <div className="text-xs text-[#787774] mb-2">主题预设</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {presetOptions.map((item) => (
              <button
                key={item.key}
                onClick={() => setPreset(item.key)}
                className={cn(
                  "text-left rounded-xl border px-3 py-2 transition-colors",
                  preset === item.key ? 'accent-border accent-soft-bg' : 'bg-white/80 border-gray-200 hover:bg-white'
                )}
              >
                <div className="text-sm font-semibold text-strong-theme">{item.title}</div>
                <div className="text-xs text-[#787774] mt-1">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm bg-white/80 border border-[#e9e9e7] rounded-xl px-3 py-2">
            <span className="text-[#787774] min-w-[72px]">强调色</span>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-10 p-0 border rounded cursor-pointer bg-transparent" />
            <span className="ml-auto text-xs text-[#9b9a97] uppercase">{accent}</span>
          </label>
          <label className="flex items-center gap-2 text-sm bg-white/80 border border-[#e9e9e7] rounded-xl px-3 py-2">
            <span className="text-[#787774] min-w-[72px]">文字颜色</span>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-7 w-10 p-0 border rounded cursor-pointer bg-transparent" />
            <span className="ml-auto text-xs text-[#9b9a97] uppercase">{textColor}</span>
          </label>
          <label className="flex items-center gap-2 text-sm bg-white/80 border border-[#e9e9e7] rounded-xl px-3 py-2 md:col-span-2">
            <span className="text-[#787774] min-w-[72px]">字体</span>
            <select
              className="ml-auto text-sm border rounded px-2 py-1 bg-white outline-none accent-border-soft"
              value={font}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'chatgpt' || value === 'system' || value === 'serif') setFont(value);
              }}
            >
              <option value="chatgpt">ChatGPT</option>
              <option value="system">System</option>
              <option value="serif">Serif</option>
            </select>
          </label>
        </div>
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold tint-text uppercase mb-3">数据管理</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={exportData}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text"
          >
            <FileJson size={14} />
            备份数据
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border tint-border hover:bg-white tint-text"
          >
            <FileUp size={14} />
            导入数据
          </button>
        </div>
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold tint-text uppercase mb-3">日历同步（只读订阅）</h2>
        <div className="text-xs text-gray-500 mb-2">将下方链接添加到 macOS / iPhone 日历，可自动查看系统中的日程与期限（单向同步）。</div>
        <input
          value={calendarFeedUrl}
          readOnly
          className="w-full text-xs bg-white border tint-border rounded px-3 py-2 outline-none"
        />
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={copyCalendarUrl} className="px-3 py-2 text-sm rounded border tint-border hover:bg-white">复制订阅链接</button>
          <a href={calendarFeedUrl} target="_blank" rel="noreferrer" className="px-3 py-2 text-sm rounded border tint-border hover:bg-white text-center">打开订阅地址</a>
          <a href="https://support.apple.com/zh-cn/guide/calendar/icl1022/mac" target="_blank" rel="noreferrer" className="px-3 py-2 text-sm rounded border tint-border hover:bg-white text-center">Apple 日历帮助</a>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="block text-xs tint-text mb-1">订阅密钥（可选）</label>
          <input
            value={calendarToken}
            onChange={(e) => saveCalendarToken(e.target.value)}
            placeholder="如果配置了 CALENDAR_FEED_TOKEN，请在这里填同一串字符"
            className="w-full text-xs bg-white border tint-border rounded px-3 py-2 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
