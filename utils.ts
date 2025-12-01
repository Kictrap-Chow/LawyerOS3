import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const formatTimeDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const formatDateTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().split('T')[0];

export const calculateTaskDuration = (task: any): number => {
  let d = 0;
  (task.sessions || []).forEach((s: any) => {
    if (s.end) {
      d += (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000;
    } else if (task.isRunning) {
      d += (new Date().getTime() - new Date(s.start).getTime()) / 1000;
    }
  });
  return Math.floor(d);
};
