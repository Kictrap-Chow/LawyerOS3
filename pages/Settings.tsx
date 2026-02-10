import React, { useRef, useState } from 'react';
import { useI18n } from '../store/I18nContext';
import { useTheme } from '../store/ThemeContext';
import { cn } from '../utils';
import { useData } from '../store/DataContext';
import { FileJson, FileUp } from 'lucide-react';

export const Settings: React.FC = () => {
  const { lang, setLang } = useI18n();
  const { accent, setAccent, textColor, setTextColor, font, setFont } = useTheme();
  const { appTitle, setAppTitle, isSupabaseEnabled, authLoading, isAuthenticated, userEmail, signIn, signUp, signOut, exportData, importData } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="max-w-3xl mx-auto p-3 md:p-6 animate-fade-in">
      <div className="craft-surface p-4 md:p-6 mb-4">
        <h1 className="text-2xl font-bold text-strong-theme">设置</h1>
        <p className="text-sm text-gray-500 mt-1">语言、强调色、文字颜色和字体都在这里调整。</p>
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#6f6377] uppercase mb-3">系统</h2>
        <label className="block text-xs text-[#8a8092] mb-1">系统名称</label>
        <input
          className="w-full text-sm bg-white border border-[#ddd2e3] rounded px-3 py-2 outline-none"
          value={appTitle}
          onChange={(e) => setAppTitle(e.target.value)}
          placeholder="请输入系统名称"
        />
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#6f6377] uppercase mb-3">账号与同步</h2>
        {!isSupabaseEnabled && (
          <div className="text-sm text-gray-500">当前未配置云端同步环境变量，在线同步不可用。</div>
        )}
        {isSupabaseEnabled && authLoading && (
          <div className="text-sm text-gray-500">正在检查登录状态...</div>
        )}
        {isSupabaseEnabled && !authLoading && !isAuthenticated && (
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
                className="w-full text-sm bg-white border border-[#ddd2e3] rounded px-3 py-2 outline-none"
              />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm bg-white border border-[#ddd2e3] rounded px-3 py-2 outline-none"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={authBusy} className="accent-bg accent-bg-hover text-white px-3 py-1.5 rounded text-sm disabled:opacity-60">登录</button>
                <button type="button" disabled={authBusy} onClick={handleSignUp} className="px-3 py-1.5 rounded text-sm border border-[#ddd2e3] hover:bg-white disabled:opacity-60">注册</button>
              </div>
            </form>
            {authMessage && <div className="text-xs text-gray-500">{authMessage}</div>}
          </div>
        )}
        {isSupabaseEnabled && !authLoading && isAuthenticated && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">当前登录：<span className="font-medium text-strong-theme">{userEmail}</span></div>
            <button disabled={authBusy} onClick={handleSignOut} className="px-3 py-1.5 rounded text-sm border border-[#ddd2e3] hover:bg-white disabled:opacity-60">退出登录</button>
            {authMessage && <div className="text-xs text-gray-500">{authMessage}</div>}
          </div>
        )}
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#6f6377] uppercase mb-3">语言</h2>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "min-w-[64px] px-3 py-1.5 text-sm rounded-lg border",
              lang === 'zh' ? 'accent-bg text-white accent-border' : 'bg-white/80 border-gray-200'
            )}
            onClick={() => setLang('zh')}
          >
            中文
          </button>
          <button
            className={cn(
              "min-w-[64px] px-3 py-1.5 text-sm rounded-lg border",
              lang === 'en' ? 'accent-bg text-white accent-border' : 'bg-white/80 border-gray-200'
            )}
            onClick={() => setLang('en')}
          >
            English
          </button>
        </div>
      </div>

      <div className="craft-panel p-4 md:p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#6f6377] uppercase mb-3">外观</h2>
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
        <h2 className="text-sm font-semibold text-[#6f6377] uppercase mb-3">数据管理</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={exportData}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border border-[#ddd2e3] hover:bg-white text-[#5f5568]"
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
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border border-[#ddd2e3] hover:bg-white text-[#5f5568]"
          >
            <FileUp size={14} />
            导入数据
          </button>
        </div>
      </div>
    </div>
  );
};
