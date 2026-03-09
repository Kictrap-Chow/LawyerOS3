import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { Case, Party } from '../types';
import { uuid } from '../utils';
import { Search, Plus, Edit2, Trash2, X, Scale, CalendarClock, Bell, Clock3, FileClock, NotebookText } from 'lucide-react';

export const PartyManager: React.FC = () => {
  const { parties, cases, addParty, updateParty, deleteParty, navigate } = useData();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'dormant' | 'archived'>('all');
  const [caseKeyword, setCaseKeyword] = useState('');
  const [detailTab, setDetailTab] = useState<'cases' | 'tasks' | 'reminders' | 'schedule' | 'deadlines' | 'logs' | 'timeline'>('cases');

  const filteredParties = useMemo(
    () =>
      parties
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.idCode.includes(search))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [parties, search]
  );

  useEffect(() => {
    if (!filteredParties.length) {
      setSelectedPartyId(null);
      return;
    }
    if (!selectedPartyId || !filteredParties.some((p) => p.id === selectedPartyId)) {
      setSelectedPartyId(filteredParties[0].id);
    }
  }, [filteredParties, selectedPartyId]);

  const selectedParty = useMemo(
    () => (selectedPartyId ? parties.find((p) => p.id === selectedPartyId) || null : null),
    [parties, selectedPartyId]
  );

  const partyMatches = (p: Party, target: Party) => {
    if (p.id && target.id && p.id === target.id) return true;
    if (p.name && target.name && p.name === target.name) {
      if (p.idCode && target.idCode) return p.idCode === target.idCode;
      return true;
    }
    return false;
  };

  const linkedCases = useMemo(() => {
    if (!selectedParty) return [];
    return cases
      .map((c) => {
        const isClient = (c.clients || []).some((x) => partyMatches(x, selectedParty));
        const isOpponent = (c.opponents || []).some((x) => partyMatches(x, selectedParty));
        if (!isClient && !isOpponent) return null;
        const relation = isClient && isOpponent ? '双方' : isClient ? '我方' : '对方';
        return { caseItem: c, relation };
      })
      .filter((x): x is { caseItem: Case; relation: '我方' | '对方' | '双方' } => Boolean(x))
      .sort((a, b) => new Date(b.caseItem.updatedAt || 0).getTime() - new Date(a.caseItem.updatedAt || 0).getTime());
  }, [cases, selectedParty]);

  const shownCases = useMemo(() => {
    return linkedCases.filter(({ caseItem }) => {
      if (statusFilter !== 'all' && caseItem.status !== statusFilter) return false;
      if (!caseKeyword.trim()) return true;
      const kw = caseKeyword.trim().toLowerCase();
      return caseItem.name.toLowerCase().includes(kw) || caseItem.type.toLowerCase().includes(kw);
    });
  }, [caseKeyword, linkedCases, statusFilter]);

  const stats = useMemo(() => {
    const base = {
      total: linkedCases.length,
      active: 0,
      dormant: 0,
      archived: 0,
      mine: 0,
      opp: 0
    };
    linkedCases.forEach(({ caseItem, relation }) => {
      if (caseItem.status === 'active') base.active += 1;
      if (caseItem.status === 'dormant') base.dormant += 1;
      if (caseItem.status === 'archived') base.archived += 1;
      if (relation === '我方' || relation === '双方') base.mine += 1;
      if (relation === '对方' || relation === '双方') base.opp += 1;
    });
    return base;
  }, [linkedCases]);

  const taskItems = useMemo(
    () =>
      shownCases.flatMap(({ caseItem }) =>
        (caseItem.tasks || []).map((task) => ({
          id: `${caseItem.id}-${task.id}`,
          caseId: caseItem.id,
          caseName: caseItem.name,
          desc: task.desc,
          completed: task.isCompleted
        }))
      ),
    [shownCases]
  );

  const reminderItems = useMemo(
    () =>
      shownCases.flatMap(({ caseItem }) =>
        (caseItem.actionReminders || []).map((item) => ({
          id: `${caseItem.id}-${item.id}`,
          caseId: caseItem.id,
          caseName: caseItem.name,
          title: item.title,
          dueDate: item.dueDate,
          completed: item.completed
        }))
      ),
    [shownCases]
  );

  const scheduleItems = useMemo(
    () =>
      shownCases.flatMap(({ caseItem }) =>
        (caseItem.reminders || []).map((item) => ({
          id: `${caseItem.id}-${item.id}`,
          caseId: caseItem.id,
          caseName: caseItem.name,
          title: item.title,
          date: item.date,
          time: item.time
        }))
      ),
    [shownCases]
  );

  const deadlineItems = useMemo(
    () =>
      shownCases.flatMap(({ caseItem }) =>
        (caseItem.deadlines || []).map((item) => ({
          id: `${caseItem.id}-${item.id}`,
          caseId: caseItem.id,
          caseName: caseItem.name,
          title: item.title,
          date: item.date,
          completed: item.completed
        }))
      ),
    [shownCases]
  );

  const logItems = useMemo(
    () =>
      shownCases.flatMap(({ caseItem }) =>
        (caseItem.logs || []).map((item) => ({
          id: `${caseItem.id}-${item.id}`,
          caseId: caseItem.id,
          caseName: caseItem.name,
          content: item.content,
          date: item.date
        }))
      ),
    [shownCases]
  );

  const timelineItems = useMemo(() => {
    const list: Array<{ id: string; ts: number; when: string; type: string; title: string; caseId: string; caseName: string; tab: 'tasks' | 'schedule' | 'reminders' | 'deadlines' | 'logs' }> = [];
    shownCases.forEach(({ caseItem }) => {
      (caseItem.tasks || []).forEach((x) => {
        const when = x.createdAt || caseItem.updatedAt || '';
        list.push({
          id: `${caseItem.id}-task-${x.id}`,
          ts: new Date(when || 0).getTime(),
          when,
          type: '任务',
          title: x.desc || '未命名任务',
          caseId: caseItem.id,
          caseName: caseItem.name,
          tab: 'tasks'
        });
      });
      (caseItem.actionReminders || []).forEach((x) => {
        const when = x.dueDate || caseItem.updatedAt || '';
        list.push({
          id: `${caseItem.id}-rem-${x.id}`,
          ts: new Date(when || 0).getTime(),
          when,
          type: '提醒',
          title: x.title || '未命名提醒',
          caseId: caseItem.id,
          caseName: caseItem.name,
          tab: 'reminders'
        });
      });
      (caseItem.reminders || []).forEach((x) => {
        const when = `${x.date}T${x.time || '00:00'}`;
        list.push({
          id: `${caseItem.id}-sch-${x.id}`,
          ts: new Date(when || 0).getTime(),
          when: `${x.date} ${x.time}`,
          type: '日程',
          title: x.title || '未命名日程',
          caseId: caseItem.id,
          caseName: caseItem.name,
          tab: 'schedule'
        });
      });
      (caseItem.deadlines || []).forEach((x) => {
        const when = x.date || caseItem.updatedAt || '';
        list.push({
          id: `${caseItem.id}-ddl-${x.id}`,
          ts: new Date(when || 0).getTime(),
          when,
          type: '期限',
          title: x.title || '未命名期限',
          caseId: caseItem.id,
          caseName: caseItem.name,
          tab: 'deadlines'
        });
      });
      (caseItem.logs || []).forEach((x) => {
        const when = x.date || caseItem.updatedAt || '';
        list.push({
          id: `${caseItem.id}-log-${x.id}`,
          ts: new Date(when || 0).getTime(),
          when,
          type: '日志',
          title: x.content || '日志',
          caseId: caseItem.id,
          caseName: caseItem.name,
          tab: 'logs'
        });
      });
    });
    return list.sort((a, b) => b.ts - a.ts);
  }, [shownCases]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const newParty: Party = {
      id: editingParty ? editingParty.id : uuid(),
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      idCode: formData.get('idCode') as string,
      address: formData.get('address') as string,
      note: formData.get('note') as string,
    };

    if (editingParty) updateParty(newParty);
    else addParty(newParty);
    
    setModalOpen(false);
    setEditingParty(null);
  };

  const openEdit = (p: Party) => {
    setEditingParty(p);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditingParty(null);
    setModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6 h-full flex flex-col animate-fade-in">
      <div className="craft-surface p-4 md:p-6 mb-4 md:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-strong-theme">当事人数据库</h1>
          <p className="text-slate-500 text-sm">按客户维度查看关联案件、任务、提醒、日程和期限。</p>
        </div>
        <button onClick={openNew} className="accent-bg accent-bg-hover text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm text-sm font-medium w-fit">
          <Plus size={16} /> 新建当事人
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input 
          className="w-full pl-10 pr-4 py-2.5 craft-input shadow-sm focus:outline-none focus:border-[var(--ui-accent)] transition-colors"
          placeholder="搜索当事人（姓名/证件号）"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-3 flex-1 min-h-0">
        <div className="craft-surface min-h-[360px] max-h-full overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#e3ebf5] text-xs font-semibold text-[var(--ui-muted)]">客户列表</div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredParties.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-3 mb-2 cursor-pointer transition-colors ${selectedPartyId === p.id ? 'bg-white border-[var(--ui-tint-border)] shadow-sm' : 'bg-white/70 border-white hover:bg-white'}`}
                onClick={() => setSelectedPartyId(p.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-800 truncate">{p.name}</div>
                  <div className="text-sm">{p.type === 'company' ? '🏢' : '👤'}</div>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">{p.idCode || '无证件号'}</div>
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="text-gray-400 hover:tint-text"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('确认删除该当事人？')) deleteParty(p.id); }} className="text-gray-400 hover:tint-text"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {filteredParties.length === 0 && <div className="p-8 text-center text-gray-400 italic">未找到当事人。</div>}
          </div>
        </div>

        <div className="craft-surface min-h-[360px] overflow-hidden flex flex-col">
          {!selectedParty && (
            <div className="p-8 text-center text-gray-400">请选择左侧当事人查看详情。</div>
          )}
          {selectedParty && (
            <>
              <div className="p-4 border-b border-[#e3ebf5]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xl font-semibold text-[var(--ui-text-strong)]">{selectedParty.name}</div>
                    <div className="text-xs text-[var(--ui-muted)] mt-1">
                      {selectedParty.type === 'company' ? '公司' : '个人'} · {selectedParty.idCode || '无证件号'}
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-[#d8e3f0] bg-white text-xs hover:bg-gray-50"
                    onClick={() => openEdit(selectedParty)}
                  >
                    编辑信息
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                  <div className="rounded-lg bg-white border border-[#e3ebf5] px-2.5 py-2 text-xs">关联案件 <b className="text-sm text-[var(--ui-text-strong)] ml-1">{stats.total}</b></div>
                  <div className="rounded-lg bg-white border border-[#e3ebf5] px-2.5 py-2 text-xs">进行中 <b className="text-sm text-[var(--ui-text-strong)] ml-1">{stats.active}</b></div>
                  <div className="rounded-lg bg-white border border-[#e3ebf5] px-2.5 py-2 text-xs">我方关联 <b className="text-sm text-[var(--ui-text-strong)] ml-1">{stats.mine}</b></div>
                  <div className="rounded-lg bg-white border border-[#e3ebf5] px-2.5 py-2 text-xs">对方关联 <b className="text-sm text-[var(--ui-text-strong)] ml-1">{stats.opp}</b></div>
                </div>
              </div>

              <div className="px-4 py-3 border-b border-[#e3ebf5] flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setStatusFilter('all')} className={`px-2.5 py-1 text-xs rounded-full border ${statusFilter === 'all' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white text-[var(--ui-text-strong)] border-[#d8e3f0]'}`}>全部</button>
                  <button onClick={() => setStatusFilter('active')} className={`px-2.5 py-1 text-xs rounded-full border ${statusFilter === 'active' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white text-[var(--ui-text-strong)] border-[#d8e3f0]'}`}>进行中</button>
                  <button onClick={() => setStatusFilter('dormant')} className={`px-2.5 py-1 text-xs rounded-full border ${statusFilter === 'dormant' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white text-[var(--ui-text-strong)] border-[#d8e3f0]'}`}>休眠</button>
                  <button onClick={() => setStatusFilter('archived')} className={`px-2.5 py-1 text-xs rounded-full border ${statusFilter === 'archived' ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white text-[var(--ui-text-strong)] border-[#d8e3f0]'}`}>归档</button>
                </div>
                <input
                  className="md:ml-auto craft-input px-3 py-1.5 text-xs max-w-[280px] w-full"
                  value={caseKeyword}
                  onChange={(e) => setCaseKeyword(e.target.value)}
                  placeholder="筛选案件名/类型"
                />
              </div>

              <div className="px-4 py-2 border-b border-[#e3ebf5] flex flex-wrap gap-2 text-xs">
                {[
                  ['cases', '案件', Scale],
                  ['tasks', '任务', Clock3],
                  ['reminders', '提醒', Bell],
                  ['schedule', '日程', CalendarClock],
                  ['deadlines', '期限', FileClock],
                  ['logs', '日志', NotebookText],
                  ['timeline', '时间线', CalendarClock]
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    className={`px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${detailTab === key ? 'bg-[#1f293b] text-white border-[#1f293b]' : 'bg-white text-[var(--ui-text-strong)] border-[#d8e3f0]'}`}
                    onClick={() => setDetailTab(key as any)}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {detailTab === 'cases' && (
                  <div className="space-y-2">
                    {shownCases.map(({ caseItem, relation }) => (
                      <div key={caseItem.id} className="rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-[var(--ui-text-strong)] truncate">{caseItem.name}</div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ui-accent-soft)] text-[var(--ui-tint-text)] border border-[var(--ui-tint-border)]">{relation}</span>
                        </div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{caseItem.type} · {caseItem.status}</div>
                        <div className="mt-2 flex justify-end">
                          <button onClick={() => navigate('case', caseItem.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-[#d8e3f0] bg-white hover:bg-gray-50">打开案件</button>
                        </div>
                      </div>
                    ))}
                    {shownCases.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无关联案件。</div>}
                  </div>
                )}

                {detailTab === 'tasks' && (
                  <div className="space-y-2">
                    {taskItems.map((item) => (
                      <button key={item.id} onClick={() => navigate('case', item.caseId, 'tasks')} className="w-full text-left rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate">{item.desc}</div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{item.caseName} · {item.completed ? '已完成' : '进行中'}</div>
                      </button>
                    ))}
                    {taskItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无任务。</div>}
                  </div>
                )}

                {detailTab === 'reminders' && (
                  <div className="space-y-2">
                    {reminderItems.map((item) => (
                      <button key={item.id} onClick={() => navigate('case', item.caseId, 'reminders')} className="w-full text-left rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate">{item.title}</div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{item.caseName}{item.dueDate ? ` · 截止 ${item.dueDate}` : ''}{item.completed ? ' · 已完成' : ''}</div>
                      </button>
                    ))}
                    {reminderItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无提醒。</div>}
                  </div>
                )}

                {detailTab === 'schedule' && (
                  <div className="space-y-2">
                    {scheduleItems.map((item) => (
                      <button key={item.id} onClick={() => navigate('case', item.caseId, 'schedule')} className="w-full text-left rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate">{item.title}</div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{item.caseName} · {item.date} {item.time}</div>
                      </button>
                    ))}
                    {scheduleItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无日程。</div>}
                  </div>
                )}

                {detailTab === 'deadlines' && (
                  <div className="space-y-2">
                    {deadlineItems.map((item) => (
                      <button key={item.id} onClick={() => navigate('case', item.caseId, 'deadlines')} className="w-full text-left rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate">{item.title}</div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{item.caseName} · 到期 {item.date}{item.completed ? ' · 已完成' : ''}</div>
                      </button>
                    ))}
                    {deadlineItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无期限。</div>}
                  </div>
                )}

                {detailTab === 'logs' && (
                  <div className="space-y-2">
                    {logItems.map((item) => (
                      <button key={item.id} onClick={() => navigate('case', item.caseId, 'logs')} className="w-full text-left rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate">{item.content || '日志'}</div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{item.caseName} · {item.date}</div>
                      </button>
                    ))}
                    {logItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无日志。</div>}
                  </div>
                )}

                {detailTab === 'timeline' && (
                  <div className="space-y-2">
                    {timelineItems.map((item) => (
                      <button key={item.id} onClick={() => navigate('case', item.caseId, item.tab)} className="w-full text-left rounded-xl bg-white border border-[#e3ebf5] p-3">
                        <div className="text-xs text-[var(--ui-muted)]">{item.when || '-'}</div>
                        <div className="text-sm font-medium text-[var(--ui-text-strong)] truncate mt-1">{item.type} · {item.title}</div>
                        <div className="text-xs text-[var(--ui-muted)] mt-1">{item.caseName}</div>
                      </button>
                    ))}
                    {timelineItems.length === 0 && <div className="text-sm text-[var(--ui-muted)]">暂无时间线事件。</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-3">
          <div className="bg-white/90 craft-surface w-[500px] max-w-[95vw] animate-fade-in p-6 relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-4">{editingParty ? '编辑当事人' : '新建当事人'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">名称</label>
                <input required name="name" defaultValue={editingParty?.name} className="w-full craft-input p-2 text-sm outline-none focus:ring-2 ring-[#e7d9ee]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">类型</label>
                   <select name="type" defaultValue={editingParty?.type || 'company'} className="w-full craft-input p-2 text-sm outline-none bg-white">
                     <option value="company">公司</option>
                     <option value="individual">个人</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">证件号</label>
                   <input name="idCode" defaultValue={editingParty?.idCode} className="w-full craft-input p-2 text-sm outline-none focus:ring-2 ring-[#e7d9ee]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">地址</label>
                <input name="address" defaultValue={editingParty?.address} className="w-full craft-input p-2 text-sm outline-none focus:ring-2 ring-[#e7d9ee]" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded hover:bg-gray-100 text-sm">取消</button>
                <button type="submit" className="px-4 py-2 accent-bg accent-bg-hover text-white rounded-xl text-sm shadow-sm">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
