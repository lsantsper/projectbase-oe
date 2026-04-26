import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import i18n from '@/i18n'
import {
  Project, Phase, Entry, Risk, ActionTask, DelayLogEntry, TeamMember, Link, EntryComment,
  AppSettings, ProjectTemplate, AppLanguage, EntryStatus, RiskFlag, Workdays,
} from '@/types'
import { applyDateChange } from '@/utils/dateEngine'
import { applyIsCritical } from '@/utils/criticalPath'
import { workdaysBetween, parseHolidays } from '@/utils/businessDays'
import { applyAutoStatus } from '@/utils/statusCalc'
import { parseISO } from 'date-fns'

const TEMPLATES_VERSION = 2

// ─── default templates ───────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'nova_conta',
    name: 'Nova Conta',
    type: 'nova_conta',
    phases: [
      {
        id: 'p1', nameKey: 'tpl.nc.p1', name: 'Kickoff & Planejamento', order: 0,
        entries: [
          { id: 'e1', type: 'meeting', nameKey: 'tpl.nc.e1', name: 'Reunião de Kickoff', responsible: 'PM', dependsOn: [], order: 0, durationHours: 2, subtasks: [] },
          { id: 'e2', type: 'task', nameKey: 'tpl.nc.e2', name: 'Levantamento de requisitos', responsible: 'PM', dependsOn: ['e1'], durationDays: 5, order: 1, subtasks: [] },
          { id: 'e3', type: 'milestone', nameKey: 'tpl.nc.e3', name: 'Aprovação do escopo', responsible: 'PM', dependsOn: ['e2'], order: 2, subtasks: [] },
        ],
      },
      {
        id: 'p2', nameKey: 'tpl.nc.p2', name: 'Configuração', order: 1,
        entries: [
          { id: 'e4', type: 'task', nameKey: 'tpl.nc.e4', name: 'Configuração base do CRM', responsible: 'Dev', dependsOn: ['e3'], durationDays: 10, order: 0, subtasks: [] },
          { id: 'e5', type: 'task', nameKey: 'tpl.nc.e5', name: 'Importação de dados', responsible: 'Dev', dependsOn: ['e4'], durationDays: 5, order: 1, subtasks: [] },
          { id: 'e6', type: 'task', nameKey: 'tpl.nc.e6', name: 'Parametrização de workflows', responsible: 'Dev', dependsOn: ['e4'], durationDays: 8, order: 2, subtasks: [] },
        ],
      },
      {
        id: 'p3', nameKey: 'tpl.nc.p3', name: 'Treinamento & Homologação', order: 2,
        entries: [
          { id: 'e7', type: 'task', nameKey: 'tpl.nc.e7', name: 'Treinamento da equipe', responsible: 'PM', dependsOn: ['e5', 'e6'], durationDays: 3, order: 0, subtasks: [] },
          { id: 'e8', type: 'task', nameKey: 'tpl.nc.e8', name: 'Homologação pelo cliente', responsible: 'Cliente', dependsOn: ['e7'], durationDays: 5, order: 1, subtasks: [] },
          { id: 'e9', type: 'milestone', nameKey: 'tpl.nc.e9', name: 'Go-live', responsible: 'PM', dependsOn: ['e8'], order: 2, subtasks: [] },
        ],
      },
    ],
  },
  {
    id: 'novo_projeto',
    name: 'Novo Projeto',
    type: 'novo_projeto',
    phases: [
      {
        id: 'pp1', nameKey: 'tpl.np.p1', name: 'Planejamento', order: 0,
        entries: [
          { id: 'pe1', type: 'task', nameKey: 'tpl.np.e1', name: 'Levantamento de requisitos', responsible: 'Cliente', dependsOn: [], durationDays: 5, order: 0, subtasks: [] },
          { id: 'pe2', type: 'task', nameKey: 'tpl.np.e2', name: 'Análise de requisitos e arquitetura', responsible: 'OE', dependsOn: ['pe1'], durationDays: 5, order: 1, subtasks: [] },
          { id: 'pe3', type: 'milestone', nameKey: 'tpl.np.e3', name: 'Aprovação do escopo/arquitetura', responsible: 'Cliente', dependsOn: ['pe2'], order: 2, subtasks: [] },
          { id: 'pe4', type: 'task', nameKey: 'tpl.np.e4', name: 'Elaboração da proposta', responsible: 'OE', dependsOn: ['pe3'], durationDays: 3, order: 3, subtasks: [] },
          { id: 'pe5', type: 'milestone', nameKey: 'tpl.np.e5', name: 'Aprovação da proposta', responsible: 'Cliente', dependsOn: ['pe4'], order: 4, subtasks: [] },
        ],
      },
      {
        id: 'pp2', nameKey: 'tpl.np.p2', name: 'Desenvolvimento', order: 1,
        entries: [
          { id: 'pe6', type: 'task', nameKey: 'tpl.np.e6', name: 'Desenvolvimento/configurações', responsible: 'Dev', dependsOn: ['pe5'], durationDays: 15, order: 0, subtasks: [] },
          { id: 'pe7', type: 'task', nameKey: 'tpl.np.e7', name: 'Testes unitários + ajustes', responsible: 'Dev', dependsOn: ['pe5'], durationDays: 5, order: 1, subtasks: [] },
          { id: 'pe8', type: 'task', nameKey: 'tpl.np.e8', name: 'Testes integrados (UAT) + ajustes', responsible: 'Dev+Cliente', dependsOn: ['pe6', 'pe7'], durationDays: 5, order: 2, subtasks: [] },
        ],
      },
      {
        id: 'pp3', nameKey: 'tpl.np.p3', name: 'Entrega', order: 2,
        entries: [
          { id: 'pe9', type: 'task', nameKey: 'tpl.np.e9', name: 'Treinamento', responsible: 'OE', dependsOn: ['pe5'], durationDays: 3, order: 0, subtasks: [] },
          { id: 'pe10', type: 'task', nameKey: 'tpl.np.e10', name: 'Deploy', responsible: 'Dev', dependsOn: ['pe8'], durationDays: 2, order: 1, subtasks: [] },
          { id: 'pe11', type: 'task', nameKey: 'tpl.np.e11', name: 'Documentação', responsible: 'OE', dependsOn: ['pe5'], durationDays: 3, order: 2, subtasks: [] },
          { id: 'pe12', type: 'milestone', nameKey: 'tpl.np.e12', name: 'Go live', responsible: 'OE', dependsOn: ['pe8', 'pe9', 'pe10', 'pe11'], order: 3, subtasks: [] },
        ],
      },
      {
        id: 'pp4', nameKey: 'tpl.np.p4', name: 'Estabilização', order: 3,
        entries: [
          { id: 'pe13', type: 'task', nameKey: 'tpl.np.e13', name: 'Operação Assistida', responsible: 'OE', dependsOn: ['pe12'], durationDays: 10, order: 0, subtasks: [] },
        ],
      },
    ],
  },
]

// ─── store interface ─────────────────────────────────────────────────────────

interface AppStore {
  projects: Project[]
  settings: AppSettings

  // Projects
  createProject: (data: Omit<Project, 'id' | 'phases' | 'risks' | 'delayLog' | 'team' | 'links' | 'status'>) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  importProject: (project: Project) => void

  // Phases
  addPhase: (projectId: string, name: string) => void
  updatePhase: (projectId: string, phaseId: string, patch: Partial<Phase>) => void
  deletePhase: (projectId: string, phaseId: string) => void
  reorderPhases: (projectId: string, phases: Phase[]) => void

  // Entries
  addEntry: (projectId: string, phaseId: string, entry: Omit<Entry, 'id' | 'isCritical' | 'comments' | 'links' | 'subtasks'>) => void
  addSubtask: (projectId: string, phaseId: string, parentId: string, entry: Omit<Entry, 'id' | 'isCritical' | 'comments' | 'links' | 'subtasks'>) => void
  updateEntry: (projectId: string, entryId: string, patch: Partial<Entry>) => void
  deleteEntry: (projectId: string, phaseId: string, entryId: string) => void
  updateEntryStatus: (projectId: string, entryId: string, status: EntryStatus) => void
  resetStatusOverride: (projectId: string, entryId: string) => void
  recalculateStatuses: (projectId: string) => void
  updateEntryRisk: (projectId: string, entryId: string, flag: RiskFlag) => void

  // Date changes (triggers cascade + delay log)
  changeEntryDate: (
    projectId: string,
    entryId: string,
    field: 'plannedStart' | 'plannedEnd' | 'plannedDate' | 'actualStart' | 'actualEnd',
    value: string,
    justification?: { description: string; responsibility: DelayLogEntry['responsibility']; type: DelayLogEntry['type'] },
  ) => void

  // Baseline
  setBaseline: (projectId: string) => void
  clearBaseline: (projectId: string) => void

  // Risks
  addRisk: (projectId: string, risk: Omit<Risk, 'id'>) => void
  updateRisk: (projectId: string, riskId: string, patch: Partial<Risk>) => void
  deleteRisk: (projectId: string, riskId: string) => void

  // Action Tasks (on risks)
  addActionTask: (projectId: string, riskId: string, task: Omit<ActionTask, 'id'>) => void
  updateActionTask: (projectId: string, riskId: string, taskId: string, patch: Partial<ActionTask>) => void
  toggleActionTask: (projectId: string, riskId: string, taskId: string) => void
  deleteActionTask: (projectId: string, riskId: string, taskId: string) => void

  // Manual delay log entry
  addDelayLogEntry: (projectId: string, entry: Omit<DelayLogEntry, 'id'>) => void
  updateDelayLogEntry: (projectId: string, entryId: string, patch: Partial<Omit<DelayLogEntry, 'id'>>) => void
  deleteDelayLogEntry: (projectId: string, entryId: string) => void

  // Column visibility
  setColumnVisibility: (projectId: string, visibility: Record<string, boolean>) => void

  // Team
  addTeamMember: (projectId: string, member: Omit<TeamMember, 'id'>) => void
  updateTeamMember: (projectId: string, memberId: string, patch: Partial<TeamMember>) => void
  removeTeamMember: (projectId: string, memberId: string) => void

  // Project links
  addProjectLink: (projectId: string, link: Omit<Link, 'id'>) => void
  removeProjectLink: (projectId: string, linkId: string) => void

  // Entry links
  addEntryLink: (projectId: string, entryId: string, link: Omit<Link, 'id'>) => void
  removeEntryLink: (projectId: string, entryId: string, linkId: string) => void

  // Comments
  addComment: (projectId: string, entryId: string, comment: Omit<EntryComment, 'id'>) => void
  removeComment: (projectId: string, entryId: string, commentId: string) => void

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void
  updateTemplate: (template: ProjectTemplate) => void
  addHoliday: (date: string, name?: string) => void
  removeHoliday: (date: string) => void
  addClient: (name: string) => void
  removeClient: (name: string) => void
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function mutateProject(projects: Project[], id: string, fn: (p: Project) => Project): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p))
}

function findEntryDeep(phases: Phase[], entryId: string): Entry | undefined {
  for (const phase of phases) {
    for (const entry of phase.entries) {
      if (entry.id === entryId) return entry
      const sub = entry.subtasks.find((s) => s.id === entryId)
      if (sub) return sub
    }
  }
}

function refreshCriticalPath(project: Project): Project {
  return { ...project, phases: applyIsCritical(project.phases) }
}

// ─── store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      projects: [],
      settings: {
        holidays: [],
        holidayNames: {},
        templates: DEFAULT_TEMPLATES,
        defaultLanguage: 'pt',
        dateFormat: 'DD/MM/YYYY',
        workdays: 'mon-fri',
        clients: [],
      },

      // ── Projects ──────────────────────────────────────────────────────────

      createProject(data) {
        const id = uuid()
        const { settings } = get()
        const template = settings.templates.find((t) => t.type === data.type)
        const today = new Date().toISOString().split('T')[0]

        let phases: Phase[] = []

        if (template) {
          // Build phases from template with sequential dates starting today
          let cursor = today
          const idMap = new Map<string, string>() // templateEntryId → newEntryId

          phases = template.phases.map((tp) => {
            const entries: Entry[] = tp.entries.map((te) => {
              const newId = uuid()
              idMap.set(te.id, newId)
              return {
                id: newId,
                type: te.type,
                name: te.nameKey ? i18n.t(te.nameKey, { lng: data.language }) : te.name,
                responsible: te.responsible,
                dependsOn: [], // will be remapped below
                isCritical: false,
                plannedStart: te.type === 'task' ? cursor : undefined,
                plannedEnd: te.type === 'task' ? cursor : undefined,
                plannedDate: te.type !== 'task' ? cursor : undefined,
                durationDays: te.durationDays,
                durationHours: te.durationHours,
                riskFlag: 'none',
                status: 'pending',
                subtasks: [],
                comments: [],
                links: [],
                order: te.order,
              }
            })
            return { id: uuid(), name: tp.nameKey ? i18n.t(tp.nameKey, { lng: data.language }) : tp.name, order: tp.order, entries }
          })

          // Remap dependsOn IDs using idMap built during entry creation
          const allTemplateEntries = template.phases.flatMap((p) => p.entries)
          for (const phase of phases) {
            for (const entry of phase.entries) {
              // Find the original template entry by matching the new entry id via idMap
              const templateEntryId = [...idMap.entries()].find(([, newId]) => newId === entry.id)?.[0]
              const te = allTemplateEntries.find((e) => e.id === templateEntryId)
              if (te) {
                entry.dependsOn = te.dependsOn.map((oldId) => idMap.get(oldId) ?? oldId).filter(Boolean)
              }
            }
          }

          // Run cascade from beginning
          const tempProject: Project = {
            ...data,
            id,
            phases,
            risks: [],
            delayLog: [],
            team: [],
            links: [],
            status: 'planning',
          }
          phases = applyIsCritical(phases)
        }

        const palette = ['#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#EF4444','#06B6D4','#84CC16']
        const color = palette[get().projects.length % palette.length]

        const project: Project = {
          ...data,
          id,
          color,
          phases,
          risks: [],
          delayLog: [],
          team: [],
          links: [],
          status: 'planning',
        }

        set((s) => ({ projects: [...s.projects, project] }))
        return id
      },

      updateProject(id, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, id, (p) => ({ ...p, ...patch })),
        }))
      },

      deleteProject(id) {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
      },

      importProject(project) {
        set((s) => ({ projects: [...s.projects, project] }))
      },

      // ── Phases ────────────────────────────────────────────────────────────

      addPhase(projectId, name) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: [
              ...p.phases,
              { id: uuid(), name, order: p.phases.length, entries: [] },
            ],
          })),
        }))
      },

      updatePhase(projectId, phaseId, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)),
          })),
        }))
      },

      deletePhase(projectId, phaseId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.filter((ph) => ph.id !== phaseId),
          })),
        }))
      },

      reorderPhases(projectId, phases) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({ ...p, phases })),
        }))
      },

      // ── Entries ───────────────────────────────────────────────────────────

      addEntry(projectId, phaseId, entryData) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            refreshCriticalPath({
              ...p,
              phases: p.phases.map((ph) =>
                ph.id !== phaseId
                  ? ph
                  : {
                      ...ph,
                      entries: [
                        ...ph.entries,
                        {
                          ...entryData,
                          id: uuid(),
                          isCritical: false,
                          subtasks: [],
                          comments: [],
                          links: [],
                        },
                      ],
                    },
              ),
            }),
          ),
        }))
      },

      addSubtask(projectId, phaseId, parentId, entryData) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            refreshCriticalPath({
              ...p,
              phases: p.phases.map((ph) =>
                ph.id !== phaseId
                  ? ph
                  : {
                      ...ph,
                      entries: ph.entries.map((e) =>
                        e.id !== parentId
                          ? e
                          : {
                              ...e,
                              subtasks: [
                                ...e.subtasks,
                                {
                                  ...entryData,
                                  id: uuid(),
                                  isCritical: false,
                                  subtasks: [],
                                  comments: [],
                                  links: [],
                                },
                              ],
                            },
                      ),
                    },
              ),
            }),
          ),
        }))
      },

      updateEntry(projectId, entryId, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            refreshCriticalPath({
              ...p,
              phases: p.phases.map((ph) => ({
                ...ph,
                entries: ph.entries.map((e) => {
                  if (e.id === entryId) return { ...e, ...patch }
                  const hasSub = e.subtasks.some((sub) => sub.id === entryId)
                  if (!hasSub) return e
                  return { ...e, subtasks: e.subtasks.map((sub) => (sub.id === entryId ? { ...sub, ...patch } : sub)) }
                }),
              })),
            }),
          ),
        }))
      },

      deleteEntry(projectId, phaseId, entryId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) =>
            refreshCriticalPath({
              ...p,
              phases: p.phases.map((ph) =>
                ph.id !== phaseId
                  ? ph
                  : {
                      ...ph,
                      entries: ph.entries
                        .filter((e) => e.id !== entryId)
                        .map((e) => ({
                          ...e,
                          subtasks: e.subtasks.filter((sub) => sub.id !== entryId),
                        })),
                    },
              ),
            }),
          ),
        }))
      },

      updateEntryStatus(projectId, entryId, status) {
        const now = new Date().toISOString().split('T')[0]
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => {
                const update = (entry: Entry): Entry => {
                  const patch: Partial<Entry> = { status, statusOverride: true }
                  if (status === 'in_progress' && !entry.actualStart) patch.actualStart = now
                  if (status === 'done' && !entry.actualEnd) patch.actualEnd = now
                  return { ...entry, ...patch }
                }
                if (e.id === entryId) return update(e)
                return { ...e, subtasks: e.subtasks.map((sub) => (sub.id === entryId ? update(sub) : sub)) }
              }),
            })),
          })),
        }))
      },

      resetStatusOverride(projectId, entryId) {
        const today = new Date().toISOString().split('T')[0]
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => {
                const reset = (entry: Entry): Entry => {
                  const updated = { ...entry, statusOverride: false }
                  return applyAutoStatus(updated, today)
                }
                if (e.id === entryId) return reset(e)
                return { ...e, subtasks: e.subtasks.map((sub) => (sub.id === entryId ? reset(sub) : sub)) }
              }),
            })),
          })),
        }))
      },

      recalculateStatuses(projectId) {
        const today = new Date().toISOString().split('T')[0]
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => ({
                ...applyAutoStatus(e, today),
                subtasks: e.subtasks.map((sub) => applyAutoStatus(sub, today)),
              })),
            })),
          })),
        }))
      },

      updateEntryRisk(projectId, entryId, flag) {
        get().updateEntry(projectId, entryId, { riskFlag: flag })
      },

      // ── Date changes ──────────────────────────────────────────────────────

      changeEntryDate(projectId, entryId, field, value, justification) {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return

        const { settings } = get()
        const prevEntry = findEntryDeep(project.phases, entryId)

        const newPhases = applyIsCritical(
          applyDateChange(project, entryId, field, value, settings.holidays),
        )

        const updatedEntry = findEntryDeep(newPhases, entryId)

        // Calculate days shifted for delay log
        let daysDiff = 0
        if (prevEntry && updatedEntry && (field === 'plannedEnd' || field === 'plannedDate')) {
          const prevDate = field === 'plannedEnd' ? prevEntry.plannedEnd : prevEntry.plannedDate
          const newDate = field === 'plannedEnd' ? updatedEntry?.plannedEnd : updatedEntry?.plannedDate
          if (prevDate && newDate) {
            daysDiff = workdaysBetween(parseISO(prevDate), parseISO(newDate), parseHolidays(settings.holidays), settings.workdays)
          }
        }

        const delayLog = [...project.delayLog]

        if (justification && prevEntry && daysDiff !== 0 && Math.abs(daysDiff) > 0) {
          delayLog.push({
            id: uuid(),
            date: new Date().toISOString().split('T')[0],
            entryId,
            entryName: prevEntry.name,
            days: daysDiff,
            responsibility: justification.responsibility,
            type: justification.type,
            description: justification.description,
            comments: '',
            triggeredBy: 'manual',
          })
        }

        const today = new Date().toISOString().split('T')[0]
        const phasesWithAutoStatus = newPhases.map((ph) => ({
          ...ph,
          entries: ph.entries.map((e) => ({
            ...applyAutoStatus(e, today),
            subtasks: e.subtasks.map((sub) => applyAutoStatus(sub, today)),
          })),
        }))

        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: phasesWithAutoStatus,
            delayLog,
          })),
        }))
      },

      // ── Baseline ──────────────────────────────────────────────────────────

      setBaseline(projectId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            baselineSetAt: new Date().toISOString(),
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => ({
                ...e,
                baselineStart: e.plannedStart,
                baselineEnd: e.plannedEnd,
                baselineDate: e.plannedDate,
                subtasks: e.subtasks.map((sub) => ({
                  ...sub,
                  baselineStart: sub.plannedStart,
                  baselineEnd: sub.plannedEnd,
                  baselineDate: sub.plannedDate,
                })),
              })),
            })),
          })),
        }))
      },

      clearBaseline(projectId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            baselineSetAt: undefined,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => ({
                ...e,
                baselineStart: undefined,
                baselineEnd: undefined,
                baselineDate: undefined,
                subtasks: e.subtasks.map((sub) => ({
                  ...sub,
                  baselineStart: undefined,
                  baselineEnd: undefined,
                  baselineDate: undefined,
                })),
              })),
            })),
          })),
        }))
      },

      // ── Risks ─────────────────────────────────────────────────────────────

      addRisk(projectId, risk) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: [...p.risks, { ...risk, id: uuid() }],
          })),
        }))
      },

      updateRisk(projectId, riskId, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: p.risks.map((r) => (r.id === riskId ? { ...r, ...patch } : r)),
          })),
        }))
      },

      deleteRisk(projectId, riskId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: p.risks.filter((r) => r.id !== riskId),
          })),
        }))
      },

      addActionTask(projectId, riskId, task) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: p.risks.map((r) => r.id === riskId ? { ...r, actionTasks: [...r.actionTasks, { ...task, id: uuid() }] } : r),
          })),
        }))
      },

      updateActionTask(projectId, riskId, taskId, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: p.risks.map((r) => r.id === riskId ? { ...r, actionTasks: r.actionTasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) } : r),
          })),
        }))
      },

      toggleActionTask(projectId, riskId, taskId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: p.risks.map((r) => r.id === riskId ? { ...r, actionTasks: r.actionTasks.map((t) => t.id === taskId ? { ...t, done: !t.done } : t) } : r),
          })),
        }))
      },

      deleteActionTask(projectId, riskId, taskId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            risks: p.risks.map((r) => r.id === riskId ? { ...r, actionTasks: r.actionTasks.filter((t) => t.id !== taskId) } : r),
          })),
        }))
      },

      addDelayLogEntry(projectId, entry) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            delayLog: [...p.delayLog, { ...entry, id: uuid() }],
          })),
        }))
      },

      updateDelayLogEntry(projectId, entryId, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            delayLog: p.delayLog.map((e) => e.id === entryId ? { ...e, ...patch } : e),
          })),
        }))
      },

      deleteDelayLogEntry(projectId, entryId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            delayLog: p.delayLog.filter((e) => e.id !== entryId),
          })),
        }))
      },

      setColumnVisibility(projectId, visibility) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            columnVisibility: visibility,
          })),
        }))
      },

      // ── Team ──────────────────────────────────────────────────────────────

      addTeamMember(projectId, member) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            team: [...p.team, { ...member, id: uuid() }],
          })),
        }))
      },

      updateTeamMember(projectId, memberId, patch) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            team: p.team.map((m) => (m.id === memberId ? { ...m, ...patch } : m)),
          })),
        }))
      },

      removeTeamMember(projectId, memberId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            team: p.team.filter((m) => m.id !== memberId),
          })),
        }))
      },

      // ── Project links ─────────────────────────────────────────────────────

      addProjectLink(projectId, link) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            links: [...p.links, { ...link, id: uuid() }],
          })),
        }))
      },

      removeProjectLink(projectId, linkId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            links: p.links.filter((l) => l.id !== linkId),
          })),
        }))
      },

      // ── Entry links ───────────────────────────────────────────────────────

      addEntryLink(projectId, entryId, link) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => {
                if (e.id === entryId) return { ...e, links: [...e.links, { ...link, id: uuid() }] }
                const hasSub = e.subtasks.some((sub) => sub.id === entryId)
                if (!hasSub) return e
                return { ...e, subtasks: e.subtasks.map((sub) => sub.id === entryId ? { ...sub, links: [...sub.links, { ...link, id: uuid() }] } : sub) }
              }),
            })),
          })),
        }))
      },

      removeEntryLink(projectId, entryId, linkId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => {
                if (e.id === entryId) return { ...e, links: e.links.filter((l) => l.id !== linkId) }
                const hasSub = e.subtasks.some((sub) => sub.id === entryId)
                if (!hasSub) return e
                return { ...e, subtasks: e.subtasks.map((sub) => sub.id === entryId ? { ...sub, links: sub.links.filter((l) => l.id !== linkId) } : sub) }
              }),
            })),
          })),
        }))
      },

      // ── Comments ──────────────────────────────────────────────────────────

      addComment(projectId, entryId, comment) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => {
                if (e.id === entryId) return { ...e, comments: [...e.comments, { ...comment, id: uuid() }] }
                const hasSub = e.subtasks.some((sub) => sub.id === entryId)
                if (!hasSub) return e
                return { ...e, subtasks: e.subtasks.map((sub) => sub.id === entryId ? { ...sub, comments: [...sub.comments, { ...comment, id: uuid() }] } : sub) }
              }),
            })),
          })),
        }))
      },

      removeComment(projectId, entryId, commentId) {
        set((s) => ({
          projects: mutateProject(s.projects, projectId, (p) => ({
            ...p,
            phases: p.phases.map((ph) => ({
              ...ph,
              entries: ph.entries.map((e) => {
                if (e.id === entryId) return { ...e, comments: e.comments.filter((c) => c.id !== commentId) }
                const hasSub = e.subtasks.some((sub) => sub.id === entryId)
                if (!hasSub) return e
                return { ...e, subtasks: e.subtasks.map((sub) => sub.id === entryId ? { ...sub, comments: sub.comments.filter((c) => c.id !== commentId) } : sub) }
              }),
            })),
          })),
        }))
      },

      // ── Settings ──────────────────────────────────────────────────────────

      updateSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }))
      },

      updateTemplate(template) {
        set((s) => ({
          settings: {
            ...s.settings,
            templates: s.settings.templates.map((t) => (t.id === template.id ? template : t)),
          },
        }))
      },

      addHoliday(date, name) {
        set((s) => {
          if (s.settings.holidays.includes(date)) return s
          const holidayNames = name
            ? { ...s.settings.holidayNames, [date]: name }
            : s.settings.holidayNames
          return {
            settings: {
              ...s.settings,
              holidays: [...s.settings.holidays, date].sort(),
              holidayNames,
            },
          }
        })
      },

      removeHoliday(date) {
        set((s) => {
          const { [date]: _removed, ...holidayNames } = s.settings.holidayNames
          return {
            settings: {
              ...s.settings,
              holidays: s.settings.holidays.filter((h) => h !== date),
              holidayNames,
            },
          }
        })
      },

      addClient(name) {
        set((s) => {
          const trimmed = name.trim()
          if (!trimmed || s.settings.clients.includes(trimmed)) return s
          return { settings: { ...s.settings, clients: [...s.settings.clients, trimmed].sort() } }
        })
      },

      removeClient(name) {
        set((s) => ({
          settings: { ...s.settings, clients: s.settings.clients.filter((c) => c !== name) },
        }))
      },
    }),
    {
      name: 'project-base-store',
      // Deep-merge settings so new fields get their defaults when loading old persisted data.
      // Templates are always reset to DEFAULT_TEMPLATES so code-level updates take effect immediately.
      merge: (persisted, current) => {
        const persistedSettings = ((persisted as Partial<typeof current>).settings ?? {}) as Partial<typeof current.settings>
        const shouldResetTemplates = (persistedSettings.templatesVersion ?? 0) < TEMPLATES_VERSION
        return {
          ...current,
          ...(persisted as object),
          settings: {
            ...current.settings,
            ...persistedSettings,
            templatesVersion: TEMPLATES_VERSION,
            templates: shouldResetTemplates ? DEFAULT_TEMPLATES : (persistedSettings.templates ?? DEFAULT_TEMPLATES),
          },
        } as AppStore
      },
    },
  ),
)
