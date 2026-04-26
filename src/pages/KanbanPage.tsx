import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { parseISO } from 'date-fns'
import { useAppStore } from '@/store/useAppStore'
import { Entry, EntryStatus, Phase } from '@/types'
import { workdaysBetween, parseHolidays } from '@/utils/businessDays'

// ─── constants ────────────────────────────────────────────────────────────────

const COLUMNS: { status: EntryStatus; label: string; headerCls: string; bgCls: string; overCls: string }[] = [
  { status: 'pending',     label: 'Pendente',      headerCls: 'text-gray-600',  bgCls: 'bg-gray-100',  overCls: 'ring-2 ring-gray-400' },
  { status: 'in_progress', label: 'Em andamento',  headerCls: 'text-blue-700',  bgCls: 'bg-blue-50',   overCls: 'ring-2 ring-blue-400' },
  { status: 'done',        label: 'Concluído',     headerCls: 'text-green-700', bgCls: 'bg-green-50',  overCls: 'ring-2 ring-green-400' },
  { status: 'blocked',     label: 'Bloqueado',     headerCls: 'text-red-700',   bgCls: 'bg-red-50',    overCls: 'ring-2 ring-red-400' },
]

// ─── types ────────────────────────────────────────────────────────────────────

type KanbanCard = Entry & {
  _phaseId: string
  _phaseName: string
  _isSubtask: boolean
  _parentName?: string
}

function buildCards(phases: Phase[]): KanbanCard[] {
  const cards: KanbanCard[] = []
  for (const ph of phases) {
    for (const e of ph.entries) {
      cards.push({ ...e, _phaseId: ph.id, _phaseName: ph.name, _isSubtask: false })
      for (const sub of e.subtasks) {
        cards.push({ ...sub, _phaseId: ph.id, _phaseName: ph.name, _isSubtask: true, _parentName: e.name })
      }
    }
  }
  return cards
}

function variance(card: KanbanCard, holidays: string[]): { diff: number } | null {
  const hl = parseHolidays(holidays)
  const date = card.type === 'task' ? card.plannedEnd : card.plannedDate
  const baseline = card.type === 'task' ? card.baselineEnd : card.baselineDate
  if (!date || !baseline || date === baseline) return null
  const diff = workdaysBetween(parseISO(baseline), parseISO(date), hl)
  if (diff === 0) return null
  return { diff }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ card, holidays, ghost = false }: { card: KanbanCard; holidays: string[]; ghost?: boolean }) {
  const v = variance(card, holidays)
  const riskCls = card.riskFlag === 'critical'
    ? 'bg-red-500'
    : card.riskFlag === 'warning'
    ? 'bg-orange-400'
    : 'bg-green-400'

  return (
    <div className={`bg-white rounded-lg p-3 border border-gray-100 select-none ${ghost ? 'shadow-xl opacity-90' : 'shadow-sm'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-800 leading-snug">
          {card._isSubtask && <span className="text-gray-400 mr-1 font-normal">↳</span>}
          {card.name}
        </p>
        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${riskCls}`} />
      </div>

      <p className="text-xs text-gray-400 mb-2">{card._phaseName}</p>

      {card.responsible && (
        <p className="text-xs text-gray-500 mb-2">
          <span className="mr-1">👤</span>{card.responsible}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {card.isCritical && (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
            crítico
          </span>
        )}
        {v && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${v.diff > 0 ? 'text-red-600 bg-red-50 border border-red-100' : 'text-green-600 bg-green-50 border border-green-100'}`}>
            {v.diff > 0 ? '+' : ''}{v.diff}d vs BL
          </span>
        )}
        {card.dependsOn.length > 0 && (
          <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
            {card.dependsOn.length} dep.
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Draggable Card wrapper ───────────────────────────────────────────────────

function DraggableCard({ card, holidays }: { card: KanbanCard; holidays: string[] }) {
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
      <Card card={card} holidays={holidays} />
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({ status, label, headerCls, bgCls, overCls, cards, holidays }: {
  status: EntryStatus
  label: string
  headerCls: string
  bgCls: string
  overCls: string
  cards: KanbanCard[]
  holidays: string[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className={`flex flex-col rounded-xl ${bgCls} ${isOver ? overCls : ''} min-h-[60vh] transition-shadow`}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${headerCls}`}>{label}</span>
        <span className="bg-white text-gray-500 rounded-full text-xs px-2 py-0.5 font-medium shadow-sm">{cards.length}</span>
      </div>
      <div ref={setNodeRef} className="flex-1 px-3 pb-3 space-y-2">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} holidays={holidays} />
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function KanbanPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { projects, settings, updateEntryStatus } = useAppStore()
  const project = projects.find((p) => p.id === projectId)!
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const cards = buildCards(project.phases)
  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null
  const validStatuses = new Set<string>(COLUMNS.map((c) => c.status))

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const newStatus = String(over.id) as EntryStatus
    if (!validStatuses.has(newStatus)) return
    const card = cards.find((c) => c.id === active.id)
    if (card && card.status !== newStatus) {
      updateEntryStatus(projectId, String(active.id), newStatus)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              {...col}
              label={t(`entry.${col.status}` as any)}
              cards={cards.filter((c) => c.status === col.status)}
              holidays={settings.holidays}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeCard && <Card card={activeCard} holidays={settings.holidays} ghost />}
      </DragOverlay>
    </DndContext>
  )
}
