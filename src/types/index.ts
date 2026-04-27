export type EntryType = 'task' | 'milestone' | 'meeting'
export type RiskFlag = 'none' | 'warning' | 'critical'
export type EntryStatus = 'pending' | 'in_progress' | 'done' | 'blocked' | 'overdue'
export type ProjectStatus = 'planning' | 'in_progress' | 'delayed' | 'done'
export type ProjectType = 'nova_conta' | 'novo_projeto'
export type AppLanguage = 'pt' | 'en' | 'es'
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY'
export type Workdays = 'mon-fri' | 'mon-sat'
export type Probability = 'low' | 'medium' | 'high'
export type Impact = 'low' | 'medium' | 'high'
export type DelayResponsibility = 'internal' | 'client_business' | 'client_it' | 'client_provider'
export type DelayType = 'execution' | 'definition' | 'planning'

export interface EntryComment {
  id: string
  author: string
  text: string
  createdAt: string
}

export interface Link {
  id: string
  label: string
  url: string
}

export interface Entry {
  id: string
  type: EntryType
  name: string
  responsible: string
  dependsOn: string[]
  isCritical: boolean
  plannedStart?: string
  plannedEnd?: string
  baselineStart?: string
  baselineEnd?: string
  plannedDate?: string
  baselineDate?: string
  actualStart?: string
  actualEnd?: string
  durationDays?: number
  durationHours?: number
  riskFlag: RiskFlag
  status: EntryStatus
  statusOverride?: boolean
  responsibleMemberId?: string
  responsibleMode?: 'member' | 'free'
  subtasks: Entry[]
  comments: EntryComment[]
  links: Link[]
  order: number
  createdAt?: string
  updatedAt?: string
  createdById?: string
  updatedById?: string
}

export interface Phase {
  id: string
  name: string
  order: number
  entries: Entry[]
}

export interface ActionTask {
  id: string
  description: string
  responsible?: string
  dueDate?: string
  done: boolean
}

export interface Risk {
  id: string
  description: string
  probability: Probability
  impact: Impact
  score: number
  status: string
  owner: string
  dueDate?: string
  linkedEntryIds: string[]
  actionTasks: ActionTask[]
}

export interface DelayLogEntry {
  id: string
  date: string
  entryId: string
  entryName: string
  days: number
  responsibility: DelayResponsibility
  type: DelayType
  description: string
  comments: string
  triggeredBy: 'manual' | 'cascade'
}

export interface TeamMember {
  id: string
  name: string
  role: string
  email?: string
}

export interface ProjectCharter {
  sponsor: string
  objectives: string
  scope: string
  outOfScope: string
  successCriteria: string
  constraints: string
  assumptions: string
  budget?: string
}

export interface Project {
  id: string
  name: string
  client: string
  type: ProjectType
  pm: string
  color?: string
  archived?: boolean
  devLead?: string
  devType?: 'integration' | 'application'
  devIntegration?: string
  language: AppLanguage
  status: ProjectStatus
  baselineSetAt?: string
  columnVisibility?: Record<string, boolean>
  csvColumnPrefs?: Record<string, boolean>
  reportPrefs?: { sections: Record<string, boolean>; planColumns: Record<string, boolean> }
  phases: Phase[]
  risks: Risk[]
  delayLog: DelayLogEntry[]
  team: TeamMember[]
  links: Link[]
  overview?: string
  charter?: ProjectCharter
}

// Template structures
export interface TemplateEntry {
  id: string
  type: EntryType
  name: string
  nameKey?: string  // i18n key resolved at project creation using project.language
  responsible: string
  dependsOn: string[]
  durationDays?: number
  durationHours?: number
  order: number
  subtasks: TemplateEntry[]
}

export interface TemplatePhase {
  id: string
  name: string
  nameKey?: string  // i18n key resolved at project creation using project.language
  order: number
  entries: TemplateEntry[]
}

export interface ProjectTemplate {
  id: string
  name: string
  type: ProjectType
  phases: TemplatePhase[]
}

// Settings
export interface AppSettings {
  holidays: string[]                    // ISO date strings for calculations
  holidayNames: Record<string, string>  // ISO date → display name
  templates: ProjectTemplate[]
  templatesVersion?: number
  defaultLanguage: AppLanguage
  dateFormat: DateFormat
  workdays: Workdays
  clients: string[]
  sidebarCollapsed?: boolean
}
