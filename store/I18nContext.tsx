import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Lang = 'en' | 'zh';

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const dictionaries: Record<Lang, Record<string, string>> = {
  en: {
    'nav.search': 'Search',
    'nav.dashboard': 'Dashboard',
    'nav.parties': 'Parties',
    'nav.archives': 'Archives',
    'nav.settings': 'Settings',
    'nav.activeCases': 'Active Cases',
    'nav.newCase': 'New Case',
    'footer.linked': 'Linked to Disk',
    'footer.link': 'Link Local File',
    'footer.backup': 'Backup Data',
    'footer.import': 'Import Data',
    'sync.online': 'Cloud Sync Connected',
    'sync.syncing': 'Syncing data...',
    'sync.error': 'Sync unavailable',
    'sync.offlineMode': 'Offline mode',
    'sync.lastSynced': 'Last Sync',

    'status.active': 'Active',
    'status.dormant': 'Dormant',
    'status.archived': 'Archived',

    'case.create.title': 'Create New Case',
    'case.create.name': 'Case Name',
    'case.create.type': 'Type',
    'case.type.litigation': 'Litigation (诉讼)',
    'case.type.arbitration': 'Arbitration (仲裁)',
    'case.type.special': 'Advisory (专项)',
    'case.type.retainer': 'Retainer (常法)',
    'case.type.dispute': 'Dispute (争议解决)',
    'actions.cancel': 'Cancel',
    'actions.create': 'Create',

    'breadcrumbs.dashboard': 'Dashboard',
    'breadcrumbs.cases': 'Cases',
    'actions.edit': 'Edit',
    'actions.saveChanges': 'Save Changes',
    'actions.deleteCase': 'Delete',

    'tabs.info': 'Info',
    'tabs.tasks': 'Tasks',
    'tabs.schedule': 'Schedule',
    'tabs.deadlines': 'Deadlines',
    'tabs.logs': 'Logs',
    'tabs.trash': 'Recycle Bin',

    'info.client': 'Client Information',
    'info.opponent': 'Opponent Information',
    'info.addClient': '+ Add Client',
    'info.addOpponent': '+ Add Opponent',
    'info.contactPerson': 'Contact Person',
    'info.contactInfo': 'Contact Info',
    'info.idCode': 'ID/Credit Code',
    'info.address': 'Address',
    'info.remarks': 'Remarks / Notes',

    'proceedings.title': 'Proceedings',
    'proceedings.addStage': '+ Add Stage',
    'proceedings.stage': 'Trial Level',
    'proceedings.caseNo': 'Case No.',
    'proceedings.institution': 'Institution',
    'proceedings.court': 'Court / Arbitration Comm.',
    'proceedings.address': 'Address',
    'proceedings.myRole': 'Role',
    'proceedings.personnel': 'Personnel',
    'proceedings.noPersonnel': 'No personnel added.',
    'proceedings.stageAndRole': 'Trial Level / Role',

    'tasks.title': 'Tasks',
    'tasks.add': 'Add Task',
    'tasks.export': 'Export',
    'tasks.taskDescription': 'Task description...',
    'tasks.assignee': 'Assignee',
    'tasks.notes': 'Notes...',
    'tasks.manualSession': 'Add Manual Session',
    'tasks.startTime': 'Start Time',
    'tasks.endTime': 'End Time',
    'tasks.addSession': 'Add Session',
    'tasks.sessions': 'Sessions',
    'tasks.noSessions': 'No sessions yet.',
    'tasks.endNow': 'End Now',
    'tasks.delete': 'Delete',
    'tasks.done': 'Done',
    'tasks.reopen': 'Reopen',
    'tasks.noTasksYet': 'No tasks yet. Create one!',

    'logs.placeholder': 'Log a new event or note...',
    'logs.post': 'Post',

    'schedule.newEvent': 'NEW EVENT',
    'schedule.eventPlaceholder': 'Event (e.g. Court Hearing, Client Meeting)',
    'schedule.dateTime': 'DATE & TIME',
    'schedule.add': 'Add',

    'deadlines.new': 'NEW DEADLINE',
    'deadlines.add': 'Add',
    'preservation.title': 'Property Preservation',
    'preservation.add': '+ Add Preservation',
    'preservation.caseNo': 'Preservation Case No.',
    'preservation.court': 'Preservation Court',
    'preservation.assets': 'Preserved Assets',
    'preservation.deadline': 'Preservation Deadline',
    'preservation.judge': 'Judge',
    'preservation.judgeContact': 'Judge Contact',
    'preservation.noItems': 'No preservation items yet.',
    'preservation.deadlinePrefix': 'Property Preservation Deadline',

    'delete.confirm.title': 'Confirm Delete Case',
    'delete.confirm.message': 'This will remove the case and return to dashboard. Confirm?',
    'delete.confirm.ok': 'Delete',
    'delete.confirm.cancel': 'Cancel',
    'timer.start': 'Start',
    'timer.pause': 'Pause',
    'timer.minimize': 'Minimize',
    'timer.restore': 'Restore',
    'timer.noTask': 'No Task',
    'detail.noClients': 'No clients added.',
    'detail.noOpponents': 'No opponents added.',
    'detail.projectScope': 'Project Scope',
    'detail.caseNotFound': 'Case not found.'
  },
  zh: {
    'nav.search': '搜索',
    'nav.dashboard': '仪表盘',
    'nav.parties': '当事人库',
    'nav.archives': '归档',
    'nav.settings': '设置',
    'nav.activeCases': '进行中案件',
    'nav.newCase': '新建案件',
    'footer.linked': '已链接磁盘',
    'footer.link': '链接本地文件',
    'footer.backup': '备份数据',
    'footer.import': '导入数据',
    'sync.online': '云端同步已连接',
    'sync.syncing': '正在同步数据...',
    'sync.error': '同步不可用',
    'sync.offlineMode': '离线模式',
    'sync.lastSynced': '最后同步',

    'status.active': '进行中',
    'status.dormant': '休眠',
    'status.archived': '已归档',

    'case.create.title': '创建新案件',
    'case.create.name': '案件名称',
    'case.create.type': '类型',
    'case.type.litigation': '诉讼',
    'case.type.arbitration': '仲裁',
    'case.type.special': '专项法律服务',
    'case.type.retainer': '常年法律顾问',
    'case.type.dispute': '争议解决',
    'actions.cancel': '取消',
    'actions.create': '创建',

    'breadcrumbs.dashboard': '仪表盘',
    'breadcrumbs.cases': '案件',
    'actions.edit': '编辑',
    'actions.saveChanges': '保存修改',
    'actions.deleteCase': '删除',

    'tabs.info': '信息',
    'tabs.tasks': '任务',
    'tabs.schedule': '日程',
    'tabs.deadlines': '期限',
    'tabs.logs': '日志',
    'tabs.trash': '回收站',

    'info.client': '客户信息',
    'info.opponent': '对手信息',
    'info.addClient': '+ 增加客户',
    'info.addOpponent': '+ 增加对手',
    'info.contactPerson': '联系人',
    'info.contactInfo': '联系方式',
    'info.idCode': '统一社会信用代码/证件号',
    'info.address': '地址',
    'info.remarks': '备注',

    'proceedings.title': '程序阶段',
    'proceedings.addStage': '+ 增加阶段',
    'proceedings.stage': '审级',
    'proceedings.caseNo': '案号',
    'proceedings.institution': '机构',
    'proceedings.court': '法院/仲裁委',
    'proceedings.address': '地址',
    'proceedings.myRole': '地位',
    'proceedings.personnel': '人员',
    'proceedings.noPersonnel': '暂无人员。',
    'proceedings.stageAndRole': '审级 / 地位',

    'tasks.title': '任务',
    'tasks.add': '新增任务',
    'tasks.export': '导出',
    'tasks.taskDescription': '任务描述...',
    'tasks.assignee': '负责人',
    'tasks.notes': '备注...',
    'tasks.manualSession': '添加手动计时',
    'tasks.startTime': '开始时间',
    'tasks.endTime': '结束时间',
    'tasks.addSession': '添加时段',
    'tasks.sessions': '时段',
    'tasks.noSessions': '暂无时段。',
    'tasks.endNow': '立即结束',
    'tasks.delete': '删除',
    'tasks.done': '已完成',
    'tasks.reopen': '重新打开',
    'tasks.noTasksYet': '暂无任务，先创建一个吧！',

    'logs.placeholder': '记录事件或备注...',
    'logs.post': '发布',

    'schedule.newEvent': '新事件',
    'schedule.eventPlaceholder': '事件（如庭审、客户会议）',
    'schedule.dateTime': '日期与时间',
    'schedule.add': '添加',

    'deadlines.new': '新增期限',
    'deadlines.add': '添加',
    'preservation.title': '财产保全',
    'preservation.add': '+ 增加保全',
    'preservation.caseNo': '保全案号',
    'preservation.court': '保全法院',
    'preservation.assets': '保全财产情况',
    'preservation.deadline': '保全期限',
    'preservation.judge': '保全法官',
    'preservation.judgeContact': '法官联系方式',
    'preservation.noItems': '暂无财产保全记录。',
    'preservation.deadlinePrefix': '财产保全期限',

    'delete.confirm.title': '确认删除案件',
    'delete.confirm.message': '此操作将移除案件并返回仪表盘，请确认。',
    'delete.confirm.ok': '确认删除',
    'delete.confirm.cancel': '取消',
    'timer.start': '开始',
    'timer.pause': '暂停',
    'timer.minimize': '最小化',
    'timer.restore': '还原',
    'timer.noTask': '无任务',
    'detail.noClients': '暂无客户。',
    'detail.noOpponents': '暂无对手方。',
    'detail.projectScope': '项目范围',
    'detail.caseNotFound': '未找到案件。'
  }
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('zh');
  useEffect(() => {
    const saved = localStorage.getItem('lawyerLang');
    if (saved === 'en' || saved === 'zh') setLang(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('lawyerLang', lang);
  }, [lang]);
  const t = useMemo(() => {
    return (key: string) => {
      const dict = dictionaries[lang];
      return dict[key] || key;
    };
  }, [lang]);
  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
