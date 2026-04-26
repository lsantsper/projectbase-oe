import * as XLSX from 'xlsx'
import { Project } from '@/types'
import { computeVariance } from './dateEngine'

function entryDate(e: { plannedEnd?: string; plannedDate?: string; type: string }): string {
  return (e.type === 'task' ? e.plannedEnd : e.plannedDate) ?? ''
}

export function exportProjectXlsx(project: Project, holidays: string[]) {
  const rows: unknown[][] = [
    ['Fase', 'Tipo', 'Tarefa', 'Responsável', 'Data Início', 'Data Fim', 'Status', 'Variação (dias úteis)', 'Caminho Crítico'],
  ]

  for (const phase of project.phases) {
    for (const entry of phase.entries) {
      const variance = computeVariance(entry, holidays)
      rows.push([
        phase.name,
        entry.type,
        entry.name,
        entry.responsible,
        entry.plannedStart ?? entry.plannedDate ?? '',
        entry.plannedEnd ?? entry.plannedDate ?? '',
        entry.status,
        variance !== undefined ? variance : '',
        entry.isCritical ? 'Sim' : 'Não',
      ])
      for (const sub of entry.subtasks) {
        const subVariance = computeVariance(sub, holidays)
        rows.push([
          phase.name,
          sub.type,
          `  └ ${sub.name}`,
          sub.responsible,
          sub.plannedStart ?? sub.plannedDate ?? '',
          sub.plannedEnd ?? sub.plannedDate ?? '',
          sub.status,
          subVariance !== undefined ? subVariance : '',
          sub.isCritical ? 'Sim' : 'Não',
        ])
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plano')

  XLSX.writeFile(wb, `${project.name}_plano.xlsx`)
}
