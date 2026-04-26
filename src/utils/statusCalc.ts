import { Entry, EntryStatus } from '@/types'

export function computeAutoStatus(entry: Entry, today: string): EntryStatus {
  if (entry.actualEnd) return 'done'
  const end = entry.type === 'task' ? entry.plannedEnd : entry.plannedDate
  const start = entry.type === 'task' ? entry.plannedStart : entry.plannedDate
  if (!end) return 'pending'
  if (today > end) return 'overdue'
  if (start && today >= start) return 'in_progress'
  return 'pending'
}

export function applyAutoStatus(entry: Entry, today: string): Entry {
  if (entry.statusOverride) return entry
  if (entry.status === 'blocked') return entry
  const newStatus = computeAutoStatus(entry, today)
  if (newStatus === entry.status) return entry
  return { ...entry, status: newStatus }
}
