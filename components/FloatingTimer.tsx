import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { useI18n } from '../store/I18nContext';
import { Case, Task } from '../types';
import { calculateTaskDuration, formatTimeDuration, nowISO } from '../utils';

type CaseTaskRef = { caseId: string; taskId: string };

const LAST_KEY = 'lawyer_last_timer_ref';
const MIN_KEY = 'lawyer_timer_minimized';

const findRunningTask = (cases: Case[]): { c: Case; t: Task } | null => {
  let best: { c: Case; t: Task; startTs: number } | null = null;
  cases.forEach((c) => {
    (c.tasks || []).forEach((t) => {
      if (!t.isRunning) return;
      const open = (t.sessions || []).filter((s) => !s.end);
      if (open.length === 0) return;
      const last = open[open.length - 1];
      const ts = new Date(last.start).getTime();
      if (!best || ts > best.startTs) best = { c, t, startTs: ts };
    });
  });
  return best ? { c: best.c, t: best.t } : null;
};

const findByRef = (cases: Case[], ref: CaseTaskRef | null): { c: Case; t: Task } | null => {
  if (!ref) return null;
  const c = cases.find((x) => x.id === ref.caseId);
  if (!c) return null;
  const t = (c.tasks || []).find((y) => y.id === ref.taskId);
  return t ? { c, t } : null;
};

export const FloatingTimer: React.FC = () => {
  const { cases, updateCase } = useData();
  const { t } = useI18n();
  const [minimized, setMinimized] = useState<boolean>(() => {
    const saved = localStorage.getItem(MIN_KEY);
    return saved === '1';
  });

  const [ref, setRef] = useState<CaseTaskRef | null>(() => {
    const raw = localStorage.getItem(LAST_KEY);
    try { return raw ? JSON.parse(raw) as CaseTaskRef : null; } catch { return null; }
  });

  const current = useMemo(() => {
    const running = findRunningTask(cases);
    if (running) {
      const newRef = { caseId: running.c.id, taskId: running.t.id };
      setRef(newRef);
      localStorage.setItem(LAST_KEY, JSON.stringify(newRef));
      return running;
    }
    return findByRef(cases, ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases]);

  const [displaySeconds, setDisplaySeconds] = useState<number>(() => {
    return current ? calculateTaskDuration(current.t) : 0;
  });

  useEffect(() => {
    setDisplaySeconds(current ? calculateTaskDuration(current.t) : 0);
  }, [current]);

  useEffect(() => {
    if (!current || !current.t.isRunning) return;
    const id = setInterval(() => {
      setDisplaySeconds(calculateTaskDuration(current.t));
    }, 1000);
    return () => clearInterval(id);
  }, [current]);

  const pause = () => {
    if (!current) return;
    const { c, t } = current;
    if (!t.isRunning) return;
    const updated: Case = { ...c, tasks: (c.tasks || []).map((x) => {
      if (x.id !== t.id) return x;
      const copy = { ...x } as Task;
      copy.isRunning = false;
      const sessions = [...(copy.sessions || [])];
      for (let i = sessions.length - 1; i >= 0; i--) {
        if (!sessions[i].end) { sessions[i] = { ...sessions[i], end: nowISO() }; break; }
      }
      copy.sessions = sessions;
      return copy;
    }) };
    updateCase(updated);
  };

  const start = () => {
    const target = current;
    if (!target) return;
    const { c, t } = target;
    if (t.isRunning) return;
    const updated: Case = { ...c, tasks: (c.tasks || []).map((x) => {
      if (x.id !== t.id) return x;
      const copy = { ...x } as Task;
      copy.isRunning = true;
      const sessions = [...(copy.sessions || [])];
      sessions.push({ start: nowISO(), end: null });
      copy.sessions = sessions;
      return copy;
    }) };
    updateCase(updated);
  };

  const toggleMin = () => {
    const next = !minimized;
    setMinimized(next);
    localStorage.setItem(MIN_KEY, next ? '1' : '0');
  };

  if (!current) return null;

  const durationStr = formatTimeDuration(displaySeconds);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!minimized ? (
        <div className="flex items-center gap-3 px-4 py-3 shadow-lg rounded-lg border bg-white min-w-[280px]">
          <div className="flex-1">
            <div className="text-sm font-semibold truncate">{current.t.desc || t('timer.noTask')}</div>
            <div className="text-xs text-gray-500 truncate">{current.c.name}</div>
            <div className="mt-1 text-lg font-mono">{durationStr}</div>
          </div>
          <div className="flex items-center gap-2">
            {!current.t.isRunning ? (
              <button onClick={start} className="px-3 py-1 text-sm rounded border bg-green-50 text-green-700 hover:bg-green-100">{t('timer.start')}</button>
            ) : (
              <button onClick={pause} className="px-3 py-1 text-sm rounded border bg-yellow-50 text-yellow-700 hover:bg-yellow-100">{t('timer.pause')}</button>
            )}
            <button onClick={toggleMin} className="px-2 py-1 text-xs rounded border hover:bg-gray-50">{t('timer.minimize')}</button>
          </div>
        </div>
      ) : (
        <button onClick={toggleMin} className="px-3 py-2 shadow-lg rounded-full border bg-white font-mono text-sm hover:bg-gray-50" aria-label="Restore Timer">
          {durationStr}
        </button>
      )}
    </div>
  );
};

