import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useAppStore } from '@/store/useAppStore'
import { Entry, EntryOwner, EntryStatus, Phase } from '@/types'
import EntryModal from '@/components/plan/EntryModal'

// ─── constants ────────────────────────────────────────────────────────────────

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

type KanbanCard = Entry & {
  _phaseId: string
  _phaseName: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function cardInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function entryOwners(entry: Entry): EntryOwner[] {
  if (entry.owners && entry.owners.length > 0) return entry.owners
  if (entry.responsible) return [{ id: entry.responsible, type: 'text', name: entry.responsible }]
  return []
}

function buildCards(phases: Phase[]): KanbanCard[] {
  const cards: KanbanCard[] = []
  for (const ph of phases) {
    for (const e of ph.entries) {
      cards.push({ ...e, _phaseId: ph.id, _phaseName: ph.name })
      for (const sub of e.subtasks) {
        cards.push({ ...sub, _phaseId: ph.id, _phaseName: ph.name })
      }
    }
  }
  return cards
}

// ─── OwnerAvatars ─────────────────────────────────────────────────────────────

function OwnerAvatars({ entry }: { entry: Entry }) {
  const owners = entryOwners(entry)
  if (owners.length === 0) return null
  const MAX = 3
  const visible = owners.slice(0, MAX)
  const overflow = owners.length - MAX
  const tooltip = owners.map(o => o.name).join(', ')
  return (
    <div style={{ display: 'flex', alignItems: 'center' }} title={tooltip}>
      {visible.map((owner, i) => (
        <span
          key={owner.id}
          style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--oe-primary)', color: 'white',
            fontSize: 8, fontWeight: 600, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            marginLeft: i > 0 ? -6 : 0,
            border: '1.5px solid var(--surface-card)',
            zIndex: MAX - i, position: 'relative', flexShrink: 0,
          }}
        >
          {cardInitials(owner.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>+{overflow}</span>
      )}
    </div>
  )
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: Entry['type'] }) {
  const { t } = useTranslation()
  const styles = {
    task:      { bg: '#EFF6FF', color: '#1E3A8A' },
    milestone: { bg: '#FFFBEB', color: '#78350F' },
    meeting:   { bg: '#F5F3FF', color: '#5B21B6' },
  }
  const s = styles[type]
  return (
    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 'var(--radius-pill)', background: s.bg, color: s.color, fontWeight: 500, border: '0.5px solid var(--border-default)', flexShrink: 0, whiteSpace: 'nowrap' }}>
      {t(`entry.${type}` as any)}
    </span>
  )
}

// ─── ProjectCard ─────────────────────────────────────────────────────────────

function ProjectCard({ card, onClick, ghost = false }: {
  card: KanbanCard
  onClick?: () => void
  ghost?: boolean
}) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const endDate = card.type === 'task' ? card.plannedEnd : card.plannedDate
  const isOverdue = endDate && endDate < today && card.status !== 'done'
  const hasLinks = card.links.length > 0
  const hasComments = card.comments.length > 0

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        boxShadow: ghost ? '0 4px 16px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: ghost ? 'grabbing' : 'pointer',
        opacity: ghost ? 0.95 : 1,
        userSelect: 'none',
      }}
    >
      {/* Top row: type + phase + indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <TypeBadge type={card.type} />
        <span style={{ flex: 1, fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card._phaseName}
        </span>
        {hasComments && (
          <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>💬{card.comments.length}</span>
        )}
        {hasLinks && (
          <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>🔗{card.links.length}</span>
        )}
        {card.riskFlag !== 'none' && (
          <span style={{
            width: 7, height: 7, borderRadius: 1, flexShrink: 0, display: 'inline-block',
            background: card.riskFlag === 'critical' ? 'var(--color-danger-text)' : 'var(--color-warning-text)',
          }} />
        )}
      </div>

      {/* Title */}
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 10 }}>
        {card.name}
      </p>

      {/* Footer: owners + date + hidden badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <OwnerAvatars entry={card} />
          {card.hiddenFromPlan && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-subtle)', color: 'var(--text-disabled)', border: '0.5px solid var(--border-default)', whiteSpace: 'nowrap' }}>
              {t('entry.hiddenBadge')}
            </span>
          )}
        </div>
        {endDate && (
          <span style={{ fontSize: 11, color: isOverdue ? 'var(--color-danger-text)' : 'var(--text-tertiary)', flexShrink: 0 }}>
            {fmtDate(endDate)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── DraggableCard ────────────────────────────────────────────────────────────

function DraggableCard({ card, onEdit }: { card: KanbanCard; onEdit: (c: KanbanCard) => void }) {
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
      <ProjectCard card={card} onClick={isDragging ? undefined : () => onEdit(card)} />
    </div>
  )
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({ status, cards, onEdit, droppableId }: {
  status: EntryStatus
  cards: KanbanCard[]
  onEdit: (c: KanbanCard) => void
  droppableId?: string
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: droppableId ?? status })
  const colStyle = COL_STYLE[status]

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', minHeight: '30vh',
        background: colStyle.bg,
        borderRadius: 'var(--radius-lg)',
        outline: isOver ? `2px solid ${colStyle.header}` : '2px solid transparent',
        transition: 'outline 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: colStyle.header }}>
          {t(KANBAN_COLS.find(c => c.status === status)?.labelKey as any)}
        </span>
        <span style={{ minWidth: 20, height: 20, borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cards.length}
        </span>
      </div>
      <div ref={setNodeRef} style={{ flex: 1, padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cards.map(card => (
          <DraggableCard key={card.id} card={card} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

// ─── InternalTasksSection ─────────────────────────────────────────────────────

function InternalTasksSection({ cards, onEdit }: {
  cards: KanbanCard[]
  onEdit: (c: KanbanCard) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (cards.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ height: 1, background: 'var(--border-default)', marginBottom: 12 }} />
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}
      >
        {open ? '▾' : '▸'} {t('entry.internalTasks', { count: cards.length })}
      </button>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
          {KANBAN_COLS.map(col => {
            const colCards = cards.filter(c => c.status === col.status)
            if (colCards.length === 0) return (
              <div
                key={col.status}
                style={{
                  minHeight: 60, borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-subtle)', border: '1px dashed var(--border-default)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>0</span>
              </div>
            )
            return (
              <div key={col.status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colCards.map(card => (
                  <ProjectCard key={card.id} card={card} onClick={() => onEdit(card)} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── KanbanPage ───────────────────────────────────────────────────────────────

export default function KanbanPage({ projectId }: { projectId: string }) {
  const { projects, updateEntryStatus } = useAppStore()
  const project = projects.find((p) => p.id === projectId)!

  const [activeId, setActiveId] = useState<string | null>(null)
  const [editCard, setEditCard] = useState<KanbanCard | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const allCards = useMemo(() => buildCards(project.phases), [project.phases])
  const normalCards = useMemo(() => allCards.filter(c => !c.hiddenFromPlan), [allCards])
  const internalCards = useMemo(() => allCards.filter(c => c.hiddenFromPlan), [allCards])

  const activeCard = activeId ? normalCards.find((c) => c.id === activeId) : null
  const validStatuses = new Set<string>(KANBAN_COLS.map(c => c.status))

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const newStatus = String(over.id) as EntryStatus
    if (!validStatuses.has(newStatus)) return
    const card = normalCards.find(c => c.id === active.id)
    if (card && card.status !== newStatus) {
      updateEntryStatus(projectId, String(active.id), newStatus)
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div style={{ padding: 24 }}>
          {/* Normal columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {KANBAN_COLS.map(col => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                cards={normalCards.filter(c => c.status === col.status)}
                onEdit={setEditCard}
              />
            ))}
          </div>

          {/* Internal tasks section */}
          <InternalTasksSection cards={internalCards} onEdit={setEditCard} />
        </div>

        <DragOverlay>
          {activeCard && <ProjectCard card={activeCard} ghost />}
        </DragOverlay>
      </DndContext>

      {editCard && (
        <EntryModal
          open
          mode="edit"
          entry={editCard}
          entryProjectId={projectId}
          entryPhaseId={editCard._phaseId}
          onClose={() => setEditCard(null)}
        />
      )}
    </>
  )
}
