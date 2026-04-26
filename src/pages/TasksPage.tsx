import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useAppStore } from '@/store/useAppStore'
import { Entry, EntryStatus, Project } from '@/types'

// ─── constants ────────────────────────────────────────────────────────────────

const PALETTE = ['#E8590C', '#7443F6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

const KANBAN_COLS: { status: EntryStatus; labelKey: string }[] = [
  { status: 'pending',     labelKey: 'entry.pending' },
  { status: 'in_progress', labelKey: 'entry.in_progress' },
  { status: 'done',        labelKey: 'entry.done' },
  { status: 'blocked',     labelKey: 'entry.blocked' },
]

const COL_STYLE: Record<string, { header: string; bg: string }> = {
  pending:     { header: 'var(--text-secondary)',     bg: 'var(--surface-subtle)' },
  in_progress: { header: 'var(--oe-primary)',         bg: 'var(--oe-primary-light)' },
  done:        { header: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  blocked:     { header: 'var(--color-danger-text)',  bg: 'var(--color-danger-bg)' },
}

// ─── types ────────────────────────────────────────────────────────────────────

type GlobalCard = Entry & {
  _projectId: string
  _projectName: string
  _projectColor: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function projectColor(project: Project, index: number): string {
  return project.color ?? PALETTE[index % PALETTE.length]
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function buildCards(projects: Project[]): GlobalCard[] {
  const cards: GlobalCard[] = []
  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i]
    const color = projectColor(proj, i)
    for (const ph of proj.phases) {
      for (const entry of ph.entries) {
        if ((entry.type === 'task' || entry.type === 'meeting') && entry.responsibleMemberId) {
          cards.push({ ...entry, _projectId: proj.id, _projectName: proj.name, _projectColor: color })
        }
        for (const sub of entry.subtasks) {
          if ((sub.type === 'task' || sub.type === 'meeting') && sub.responsibleMemberId) {
            cards.push({ ...sub, _projectId: proj.id, _projectName: proj.name, _projectColor: color })
          }
        }
      }
    }
  }
  return cards
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ card, onClick, ghost = false }: {
  card: GlobalCard
  onClick?: () => void
  ghost?: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const endDate = card.type === 'task' ? card.plannedEnd : card.plannedDate
  const isOverdue = endDate && endDate < today && card.status !== 'done'

  return (
    <div
      onClick={onClick}
      className="rounded-[var(--radius-md)] p-3 select-none"
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderLeft: `3px solid ${card._projectColor}`,
        boxShadow: ghost ? '0 4px 16px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: ghost ? 'grabbing' : 'pointer',
        opacity: ghost ? 0.95 : 1,
      }}
    >
      {/* Project badge + risk */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: card._projectColor, flexShrink: 0 }} />
        <span className="truncate flex-1" style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
          {card._projectName}
        </span>
        {card.riskFlag !== 'none' && (
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: 1, flexShrink: 0,
            background: card.riskFlag === 'critical' ? 'var(--color-danger-text)' : 'var(--color-warning-text)',
          }} />
        )}
      </div>

      {/* Name */}
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 10 }}>
        {card.name}
      </p>

      {/* Footer: avatar + date */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 24, height: 24, borderRadius: 'var(--radius-pill)', background: 'var(--oe-primary)', color: 'white', fontSize: 9, fontWeight: 600 }}
        >
          {initials(card.responsible)}
        </div>
        {endDate && (
          <span style={{ fontSize: 11, color: isOverdue ? 'var(--color-danger-text)' : 'var(--text-tertiary)' }}>
            {fmtDate(endDate)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── DraggableCard ────────────────────────────────────────────────────────────

function DraggableCard({ card, onCardClick }: { card: GlobalCard; onCardClick: (c: GlobalCard) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <TaskCard card={card} onClick={isDragging ? undefined : () => onCardClick(card)} />
    </div>
  )
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({ status, labelKey, cards, onCardClick }: {
  status: EntryStatus
  labelKey: string
  cards: GlobalCard[]
  onCardClick: (c: GlobalCard) => void
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const style = COL_STYLE[status]

  return (
    <div
      className="flex flex-col min-h-[60vh] transition-all"
      style={{
        background: style.bg,
        borderRadius: 'var(--radius-lg)',
        outline: isOver ? `2px solid ${style.header}` : '2px solid transparent',
      }}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: style.header }}>
          {t(labelKey as any)}
        </span>
        <span
          className="flex items-center justify-center"
          style={{ minWidth: 20, height: 20, borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500, padding: '0 6px' }}
        >
          {cards.length}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 px-3 pb-3 space-y-2">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24">
      <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25} style={{ color: 'var(--border-strong)' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </svg>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {t('tasks.emptyTitle')}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 320 }}>
        {t('tasks.emptySubtitle')}
      </p>
    </div>
  )
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, children }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="focus:outline-none transition-colors"
      style={{ fontSize: 12, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '4px 8px', background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
    >
      {children}
    </select>
  )
}

// ─── TasksPage ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { projects, updateEntryStatus } = useAppStore()

  const [filterProject, setFilterProject] = useState('')
  const [filterMember, setFilterMember] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const allCards = useMemo(() => buildCards(projects), [projects])

  const allMembers = useMemo(() => {
    const names = new Set<string>()
    for (const proj of projects) {
      for (const m of proj.team) names.add(m.name)
    }
    return Array.from(names).sort()
  }, [projects])

  const filteredCards = useMemo(() => {
    return allCards.filter((c) => {
      if (filterProject && c._projectId !== filterProject) return false
      if (filterMember && c.responsible !== filterMember) return false
      if (filterStatus && c.status !== filterStatus) return false
      return true
    })
  }, [allCards, filterProject, filterMember, filterStatus])

  const activeCard = activeId ? allCards.find((c) => c.id === activeId) : null
  const validStatuses = new Set(KANBAN_COLS.map((c) => c.status))

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const newStatus = String(over.id) as EntryStatus
    if (!validStatuses.has(newStatus)) return
    const card = allCards.find((c) => c.id === active.id)
    if (card && card.status !== newStatus) {
      updateEntryStatus(card._projectId, String(active.id), newStatus)
    }
  }

  function handleCardClick(card: GlobalCard) {
    navigate(`/projects/${card._projectId}?tab=plan`)
  }

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--surface-page)' }}>
      {/* Topbar */}
      <div
        className="flex items-center gap-3 px-5 shrink-0"
        style={{ height: 52, background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          {t('tasks.title')}
        </span>
        <div className="flex-1" />

        <FilterSelect value={filterProject} onChange={setFilterProject}>
          <option value="">{t('tasks.filterProject')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FilterSelect>

        <FilterSelect value={filterMember} onChange={setFilterMember}>
          <option value="">{t('tasks.filterMember')}</option>
          {allMembers.map((m) => <option key={m} value={m}>{m}</option>)}
        </FilterSelect>

        <FilterSelect value={filterStatus} onChange={setFilterStatus}>
          <option value="">{t('tasks.filterStatus')}</option>
          {KANBAN_COLS.map((col) => (
            <option key={col.status} value={col.status}>{t(col.labelKey as any)}</option>
          ))}
        </FilterSelect>
      </div>

      {/* Content */}
      {allCards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-4 gap-4">
              {KANBAN_COLS.map((col) => (
                <KanbanColumn
                  key={col.status}
                  status={col.status}
                  labelKey={col.labelKey}
                  cards={filteredCards.filter((c) => c.status === col.status)}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
            <DragOverlay>
              {activeCard && <TaskCard card={activeCard} ghost />}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}
