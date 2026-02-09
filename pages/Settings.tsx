import React from 'react';
import { useI18n } from '../store/I18nContext';
import { useTheme } from '../store/ThemeContext';
import { cn } from '../utils';

export const Settings: React.FC = () => {
  const { lang, setLang } = useI18n();
  const { accent, setAccent, textColor, setTextColor, font, setFont } = useTheme();

  return (
    <div className="max-w-3xl mx-auto p-3 md:p-6 animate-fade-in">
      <div className="craft-surface p-4 md:p-6 mb-4">
        <h1 className="text-2xl font-bold text-strong-theme">设置</h1>
        <p className="text-sm text-gray-500 mt-1">语言、强调色、文字颜色和字体都在这里调整。</p>
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
    </div>
  );
};

