export type CaseType = '诉讼' | '仲裁' | '专项法律服务' | '常年法律顾问' | '争议解决';
export type CaseStatus = 'active' | 'dormant' | 'archived';
export type PartyType = 'company' | 'individual';

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  idCode: string; // Credit code or ID card
  address: string;
  note?: string;
}

export interface Personnel {
  id: string;
  role: string;
  name: string;
  contact: string;
  note: string;
}

export interface Proceeding {
  id: string;
  stageName: string; // e.g., "First Instance"
  myRole: string; // e.g., "Plaintiff"
  caseNo: string;
  courtName: string;
  courtAddress: string;
  personnel: Personnel[];
  // Legacy fields for backward compatibility
  judgeName?: string;
  judgeContact?: string;
  judgeNote?: string;
  assistantName?: string;
  assistantContact?: string;
  assistantNote?: string;
  clerkName?: string;
  clerkContact?: string;
  clerkNote?: string;
  chiefArb?: string;
  chiefNote?: string;
  myArb?: string;
  myArbNote?: string;
  oppArb?: string;
  oppArbNote?: string;
  secName?: string;
  secContact?: string;
  secNote?: string;
}

export interface TaskSession {
  start: string; // ISO Date
  end: string | null; // ISO Date
}

export interface Task {
  id: string;
  type: '文书' | '会议' | '咨询' | '其他';
  customType?: string;
  desc: string;
  assignee: string;
  notes: string;
  createdAt: string;
  completedAt: string | null;
  sessions: TaskSession[];
  manualTime?: number; // Manual added duration in seconds
  isRunning: boolean;
  isCompleted: boolean;
}

export interface Log {
  id: string;
  date: string;
  content: string;
}

export interface Reminder {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
}

export interface Deadline {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  completed: boolean;
}

export interface Trash {
  tasks: Task[];
  logs: Log[];
  reminders: Reminder[];
  deadlines: Deadline[];
}

export interface Case {
  id: string;
  name: string;
  type: CaseType;
  status: CaseStatus;
  clientContactName: string;
  clientContactInfo: string;
  specialProjectRemarks: string;
  clients: Party[];
  opponents: Party[];
  litigation: {
    proceedings: Proceeding[];
  };
  tasks: Task[];
  logs: Log[];
  reminders: Reminder[];
  deadlines: Deadline[];
  trash?: Trash;
}

export interface AppData {
  cases: Case[];
  parties: Party[];
  appTitle: string;
}
