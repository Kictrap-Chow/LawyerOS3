import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeFont = 'chatgpt' | 'system' | 'serif';
export type ThemePreset = 'liquid-glass' | 'craft-light' | 'obsidian-primary';

interface ThemeContextType {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
  accent: string;
  setAccent: (hex: string) => void;
  textColor: string;
  setTextColor: (hex: string) => void;
  font: ThemeFont;
  setFont: (font: ThemeFont) => void;
}

const ACCENT_KEY = 'lawyerThemeAccent';
const TEXT_KEY = 'lawyerThemeTextColor';
const FONT_KEY = 'lawyerThemeFont';
const PRESET_KEY = 'lawyerThemePreset';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const hexToRgb = (hex: string): [number, number, number] | null => {
  const cleaned = hex.trim().replace('#', '');
  if (!/^[\da-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
};

const darkenHex = (hex: string, factor = 0.18) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#11588f';
  const [r, g, b] = rgb;
  const d = (x: number) => Math.round(x * (1 - factor));
  return `#${d(r).toString(16).padStart(2, '0')}${d(g).toString(16).padStart(2, '0')}${d(b).toString(16).padStart(2, '0')}`;
};

const withAlpha = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'rgba(27, 117, 187, 0.14)';
  const [r, g, b] = rgb;
  const a = clamp(alpha, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const fontFamilyByType: Record<ThemeFont, string> = {
  chatgpt:
    '"PingFang SC", "SF Pro Text", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif',
  system:
    '"SF Pro Text", "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif',
  serif:
    '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "Times New Roman", serif',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preset, setPresetState] = useState<ThemePreset>('obsidian-primary');
  const [accent, setAccentState] = useState('#1b75bb');
  const [textColor, setTextColorState] = useState('#1f2937');
  const [font, setFontState] = useState<ThemeFont>('system');

  useEffect(() => {
    const savedPreset = localStorage.getItem(PRESET_KEY) as ThemePreset | null;
    const savedAccent = localStorage.getItem(ACCENT_KEY);
    const savedText = localStorage.getItem(TEXT_KEY);
    const savedFont = localStorage.getItem(FONT_KEY) as ThemeFont | null;
    if (savedPreset === 'liquid-glass' || savedPreset === 'craft-light' || savedPreset === 'obsidian-primary') setPresetState(savedPreset);
    if (savedAccent && /^#[\da-fA-F]{6}$/.test(savedAccent)) setAccentState(savedAccent);
    if (savedText && /^#[\da-fA-F]{6}$/.test(savedText)) setTextColorState(savedText);
    if (savedFont === 'chatgpt' || savedFont === 'system' || savedFont === 'serif') setFontState(savedFont);
  }, []);

  useEffect(() => {
    localStorage.setItem(PRESET_KEY, preset);
    document.documentElement.setAttribute('data-theme', preset);
  }, [preset]);

  useEffect(() => {
    localStorage.setItem(ACCENT_KEY, accent);
    const root = document.documentElement;
    const accent2 = darkenHex(accent, 0.15);
    root.style.setProperty('--ui-accent', accent);
    root.style.setProperty('--ui-accent-2', accent2);
    root.style.setProperty('--ui-accent-soft', withAlpha(accent, 0.12));
    root.style.setProperty('--ui-accent-soft-2', withAlpha(accent, 0.2));
    root.style.setProperty('--ui-tint-bg', withAlpha(accent, 0.08));
    root.style.setProperty('--ui-tint-bg-strong', withAlpha(accent, 0.14));
    root.style.setProperty('--ui-tint-border', withAlpha(accent, 0.28));
    root.style.setProperty('--ui-tint-text', darkenHex(accent, 0.32));
    root.style.setProperty('--ui-muted', darkenHex(accent, 0.45));
    root.style.setProperty('--ui-text-soft', darkenHex(accent, 0.36));
  }, [accent]);

  useEffect(() => {
    localStorage.setItem(TEXT_KEY, textColor);
    document.documentElement.style.setProperty('--ui-text-strong', textColor);
  }, [textColor]);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, font);
    document.documentElement.style.setProperty('--app-font-family', fontFamilyByType[font]);
  }, [font]);

  const value = useMemo(
    () => ({
      preset,
      setPreset: setPresetState,
      accent,
      setAccent: setAccentState,
      textColor,
      setTextColor: setTextColorState,
      font,
      setFont: setFontState,
    }),
    [preset, accent, textColor, font]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
