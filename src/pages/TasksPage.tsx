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
import { Entry, EntryOwner, EntryStatus, EntryType, Phase, Project } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Field } from '@/components/ui/Input'

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

function entryOwners(entry: Entry): EntryOwner[] {
  if (entry.owners && entry.owners.length > 0) return entry.owners
  if (entry.responsible) return [{ id: entry.responsible, type: 'text', name: entry.responsible }]
  return []
}

function buildCards(projects: Project[]): GlobalCard[] {
  const cards: GlobalCard[] = []
  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i]
    if (proj.archived) continue
    const color = projectColor(proj, i)
    for (const ph of proj.phases) {
      for (const entry of ph.entries) {
        if (entry.hiddenFromPlan) continue
        const owners = entryOwners(entry)
        if ((entry.type === 'task' || entry.type === 'meeting') && owners.length > 0) {
          cards.push({ ...entry, _projectId: proj.id, _projectName: proj.name, _projectColor: color })
        }
        for (const sub of entry.subtasks) {
          const subOwners = entryOwners(sub)
          if ((sub.type === 'task' || sub.type === 'meeting') && subOwners.length > 0) {
            cards.push({ ...sub, _projectId: proj.id, _projectName: proj.name, _projectColor: color })
          }
        }
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
  const tooltip = owners.map((o) => o.name).join(', ')

  return (
    <div className="flex items-center" title={tooltip}>
      {visible.map((owner, i) => (
        <span
          key={owner.id}
          className="flex items-center justify-center"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--oe-primary)', color: 'white',
            fontSize: 9, fontWeight: 600,
            marginLeft: i > 0 ? -7 : 0,
            border: '1.5px solid var(--surface-card)',
            zIndex: MAX - i,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {initials(owner.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="ml-1" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{overflow}</span>
      )}
    </div>
  )
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
  const hasLinks = card.links.length > 0
  const hasComments = card.comments.length > 0

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
        {hasComments && (
          <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>💬{card.comments.length}</span>
        )}
        {hasLinks && (
          <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>🔗{card.links.length}</span>
        )}
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

      {/* Footer: owner avatars + date */}
      <div className="flex items-center justify-between gap-2">
        <OwnerAvatars entry={card} />
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

function EmptyState({ onNew }: { onNew: () => void }) {
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
      <button
        onClick={onNew}
        className="mt-6 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
        style={{ background: 'var(--oe-primary)', color: 'white' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {t('tasks.newTask')}
      </button>
    </div>
  )
}

// ─── FilterSelect ─────────────────────────────────────────────────────────────

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

// ─── NewTaskModal ─────────────────────────────────────────────────────────────

type NewTaskForm = {
  name: string
  projectId: string
  phaseId: string
  parentTaskId: string
  plannedStart: string
  plannedEnd: string
  showInPlan: boolean
}

function NewTaskModal({ open, projects, onClose }: {
  open: boolean
  projects: Project[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { addEntry, addSubtask } = useAppStore()

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects])

  const [form, setForm] = useState<NewTaskForm>({
    name: '',
    projectId: activeProjects[0]?.id ?? '',
    phaseId: '',
    parentTaskId: '',
    plannedStart: '',
    plannedEnd: '',
    showInPlan: true,
  })
  const [endError, setEndError] = useState('')

  function set<K extends keyof NewTaskForm>(k: K, v: NewTaskForm[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v }
      if (k === 'projectId') {
        const proj = projects.find((p) => p.id === v)
        next.phaseId = proj?.phases[0]?.id ?? ''
        next.parentTaskId = ''
      }
      if (k === 'phaseId') next.parentTaskId = ''
      return next
    })
  }

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId),
    [projects, form.projectId],
  )

  const selectedPhase = useMemo(
    () => selectedProject?.phases.find((ph) => ph.id === form.phaseId),
    [selectedProject, form.phaseId],
  )

  const parentTasks = useMemo(
    () => (selectedPhase?.entries ?? []).filter((e) => e.type === 'task'),
    [selectedPhase],
  )

  // Reset when modal opens
  useState(() => {
    if (!open) return
    const proj = activeProjects[0]
    setForm({
      name: '',
      projectId: proj?.id ?? '',
      phaseId: proj?.phases[0]?.id ?? '',
      parentTaskId: '',
      plannedStart: '',
      plannedEnd: '',
      showInPlan: true,
    })
    setEndError('')
  })

  function handleSave() {
    if (!form.name.trim() || !form.projectId || !form.phaseId) return
    if (form.plannedStart && form.plannedEnd && form.plannedEnd < form.plannedStart) {
      setEndError(t('errors.endBeforeStart'))
      return
    }
    setEndError('')

    const base: Omit<Entry, 'id' | 'isCritical' | 'comments' | 'links' | 'subtasks'> = {
      name: form.name.trim(),
      type: 'task',
      responsible: '',
      owners: [],
      dependsOn: [],
      riskFlag: 'none',
      status: 'pending',
      order: 0,
      plannedStart: form.plannedStart || undefined,
      plannedEnd: form.plannedEnd || undefined,
      hiddenFromPlan: !form.showInPlan || undefined,
    }

    if (form.parentTaskId) {
      addSubtask(form.projectId, form.phaseId, form.parentTaskId, base)
    } else {
      addEntry(form.projectId, form.phaseId, base)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t('tasks.newTask')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || !form.phaseId}>
            {t('actions.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('entry.name')} required>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </Field>

        <Field label={t('tasks.selectProject')} required>
          <Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        <Field label={t('tasks.selectPhase')} required>
          <Select
            value={form.phaseId}
            onChange={(e) => set('phaseId', e.target.value)}
            disabled={!selectedProject}
          >
            <option value="">—</option>
            {(selectedProject?.phases ?? []).map((ph: Phase) => (
              <option key={ph.id} value={ph.id}>{ph.name}</option>
            ))}
          </Select>
        </Field>

        {parentTasks.length > 0 && (
          <Field label={t('entry.subtaskOf')}>
            <Select value={form.parentTaskId} onChange={(e) => set('parentTaskId', e.target.value)}>
              <option value="">— {t('plan.linkedTaskNone')} —</option>
              {parentTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('entry.plannedStart')}>
            <Input type="date" value={form.plannedStart} onChange={(e) => set('plannedStart', e.target.value)} />
          </Field>
          <Field label={t('entry.plannedEnd')}>
            <Input
              type="date"
              value={form.plannedEnd}
              onChange={(e) => { set('plannedEnd', e.target.value); setEndError('') }}
              className={endError ? 'border-red-500' : ''}
            />
            {endError && <p className="text-xs text-red-500 mt-1">{endError}</p>}
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.showInPlan}
            onChange={(e) => set('showInPlan', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('entry.showInPlan')}
          </span>
        </label>
      </div>
    </Modal>
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
  const [newTaskOpen, setNewTaskOpen] = useState(false)

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
      if (filterMember) {
        const owners = entryOwners(c)
        if (!owners.some((o) => o.name === filterMember)) return false
      }
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

        <Button size="sm" onClick={() => setNewTaskOpen(true)}>
          {t('tasks.newTask')}
        </Button>

        <div className="flex-1" />

        <FilterSelect value={filterProject} onChange={setFilterProject}>
          <option value="">{t('tasks.filterProject')}</option>
          {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
        <EmptyState onNew={() => setNewTaskOpen(true)} />
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

      <NewTaskModal
        open={newTaskOpen}
        projects={projects}
        onClose={() => setNewTaskOpen(false)}
      />
    </div>
  )
}
