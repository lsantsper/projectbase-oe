import { Project, Phase } from '@/types'
import { workdaysBetween, parseHolidays } from './businessDays'
import { parseISO } from 'date-fns'

function cell(v: string | number | undefined | null): string {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function variance(planned: string | undefined, baseline: string | undefined, holidays: string[]): string {
  if (!planned || !baseline) return ''
  const v = workdaysBetween(parseISO(baseline), parseISO(planned), parseHolidays(holidays))
  return v === 0 ? '0' : (v > 0 ? '+' : '') + v
}

function buildEntryNameMap(phases: Phase[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const ph of phases) {
    for (const e of ph.entries) {
      map.set(e.id, e.name)
      for (const sub of e.subtasks) map.set(sub.id, sub.name)
    }
  }
  return map
}

export function exportProjectCsv(project: Project, holidays: string[]) {
  const nameMap = buildEntryNameMap(project.phases)

  const headers = [
    'Fase', 'Nível', 'Tipo', 'Nome', 'Tarefa pai', 'Responsável', 'Dependências',
    'Início Plan.', 'Fim Plan.', 'BL Início', 'BL Fim',
    'Início Real', 'Fim Real', 'Variação (d úteis)', 'Duração',
    'Status', 'Risco', 'Caminho Crítico',
  ]

  // Build child meetings map: parentEntryId → entries
  const childMeetingsByParent = new Map<string, typeof project.phases[0]['entries']>()
  for (const phase of project.phases) {
    for (const e of phase.entries) {
      if (e.parentEntryId) {
        const list = childMeetingsByParent.get(e.parentEntryId) ?? []
        list.push(e)
        childMeetingsByParent.set(e.parentEntryId, list)
      }
    }
  }

  const rows: string[][] = [headers]

  for (const phase of project.phases) {
    for (const entry of phase.entries) {
      if (entry.parentEntryId) continue  // rendered under parent below

      // Entry row (level 0)
      const entryBlEnd = entry.type === 'task' ? entry.baselineEnd : entry.baselineDate
      const entryPlanned = entry.type === 'task' ? entry.plannedEnd : entry.plannedDate
      const entryDeps = entry.dependsOn.map((id) => nameMap.get(id) ?? id).join('; ')

      rows.push([
        cell(phase.name),
        cell('Entrada'),
        cell(entry.type),
        cell(entry.name),
        cell(''),
        cell(entry.responsible),
        cell(entryDeps),
        cell(fmtDate(entry.plannedStart ?? entry.plannedDate)),
        cell(fmtDate(entry.plannedEnd ?? entry.plannedDate)),
        cell(fmtDate(entry.baselineStart ?? entry.baselineDate)),
        cell(fmtDate(entry.baselineEnd ?? entry.baselineDate)),
        cell(fmtDate(entry.actualStart)),
        cell(fmtDate(entry.actualEnd)),
        cell(variance(entryPlanned, entryBlEnd, holidays)),
        cell(entry.type === 'task'
          ? (entry.durationDays ? `${entry.durationDays}d` : '')
          : (entry.durationHours ? `${entry.durationHours}h` : '')),
        cell(entry.status),
        cell(entry.riskFlag),
        cell(entry.isCritical ? 'Sim' : 'Não'),
      ])

      // Subtask rows (level 1)
      for (const sub of entry.subtasks) {
        const subBlEnd = sub.type === 'task' ? sub.baselineEnd : sub.baselineDate
        const subPlanned = sub.type === 'task' ? sub.plannedEnd : sub.plannedDate
        const subDeps = sub.dependsOn.map((id) => nameMap.get(id) ?? id).join('; ')

        rows.push([
          cell(phase.name),
          cell('Subtarefa'),
          cell(sub.type),
          cell(`    ↳ ${sub.name}`),
          cell(entry.name),
          cell(sub.responsible),
          cell(subDeps),
          cell(fmtDate(sub.plannedStart ?? sub.plannedDate)),
          cell(fmtDate(sub.plannedEnd ?? sub.plannedDate)),
          cell(fmtDate(sub.baselineStart ?? sub.baselineDate)),
          cell(fmtDate(sub.baselineEnd ?? sub.baselineDate)),
          cell(fmtDate(sub.actualStart)),
          cell(fmtDate(sub.actualEnd)),
          cell(variance(subPlanned, subBlEnd, holidays)),
          cell(sub.type === 'task'
            ? (sub.durationDays ? `${sub.durationDays}d` : '')
            : (sub.durationHours ? `${sub.durationHours}h` : '')),
          cell(sub.status),
          cell(sub.riskFlag),
          cell(sub.isCritical ? 'Sim' : 'Não'),
        ])
      }

      // Child meeting rows (level 1)
      const childMeetings = childMeetingsByParent.get(entry.id) ?? []
      for (const cm of childMeetings) {
        const cmDeps = cm.dependsOn.map((id) => nameMap.get(id) ?? id).join('; ')

        rows.push([
          cell(phase.name),
          cell('Reunião vinculada'),
          cell(cm.type),
          cell(`    📅 ${cm.name}`),
          cell(entry.name),
          cell(cm.responsible),
          cell(cmDeps),
          cell(fmtDate(cm.plannedDate)),
          cell(fmtDate(cm.plannedDate)),
          cell(fmtDate(cm.baselineDate)),
          cell(fmtDate(cm.baselineDate)),
          cell(fmtDate(cm.actualStart)),
          cell(fmtDate(cm.actualEnd)),
          cell(variance(cm.plannedDate, cm.baselineDate, holidays)),
          cell(cm.durationHours ? `${cm.durationHours}h` : ''),
          cell(cm.status),
          cell(cm.riskFlag),
          cell('Não'),
        ])
      }
    }
  }

  const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_plano.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
