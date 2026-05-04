import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { Entry, EntryOwner, EntryType, EntryStatus, RiskFlag, Phase, Link, TeamMember } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Field } from '@/components/ui/Input'
import OwnersField from '@/components/plan/OwnersField'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  projectId: string
  phases: Phase[]
  teamMembers?: TeamMember[]
  // create mode
  defaultType?: EntryType
  defaultPhaseId?: string
  parentId?: string
  parentEntryId?: string
  // edit mode
  entry?: Entry
  entryPhaseId?: string
  // callbacks
  onClose: () => void
  onRequestDateChange?: (
    originalEntry: Entry,
    field: 'plannedStart' | 'plannedEnd' | 'plannedDate',
    value: string,
  ) => void
}

type Form = {
  name: string
  type: EntryType
  phaseId: string
  owners: EntryOwner[]
  status: EntryStatus
  riskFlag: RiskFlag
  plannedStart: string
  plannedEnd: string
  plannedDate: string
  durationDays: number
  durationHours: number
  dependsOn: string[]
  linkedParentId: string
  links: Link[]
  hiddenFromPlan: boolean
}

const TYPE_ICONS: Record<EntryType, string> = { task: '✅', milestone: '🏁', meeting: '📅' }

function emptyForm(type: EntryType, phaseId: string, parentEntryId?: string): Form {
  return {
    name: '',
    type,
    phaseId,
    owners: [],
    status: 'pending',
    riskFlag: 'none',
    plannedStart: '',
    plannedEnd: '',
    plannedDate: '',
    durationDays: 1,
    durationHours: 1,
    dependsOn: [],
    linkedParentId: parentEntryId ?? '',
    links: [],
    hiddenFromPlan: false,
  }
}

function entryToForm(entry: Entry, phaseId: string): Form {
  const owners: EntryOwner[] = entry.owners && entry.owners.length > 0
    ? entry.owners.map((o) => ({ ...o }))
    : entry.responsible
      ? [{ id: entry.responsibleMemberId ?? entry.responsible, type: entry.responsibleMemberId ? 'member' : 'text', memberId: entry.responsibleMemberId, name: entry.responsible }]
      : []

  return {
    name: entry.name,
    type: entry.type,
    phaseId,
    owners,
    status: entry.status,
    riskFlag: entry.riskFlag,
    plannedStart: entry.plannedStart ?? '',
    plannedEnd: entry.plannedEnd ?? '',
    plannedDate: entry.plannedDate ?? '',
    durationDays: entry.durationDays ?? 1,
    durationHours: entry.durationHours ?? 1,
    dependsOn: [...entry.dependsOn],
    linkedParentId: entry.parentEntryId ?? '',
    links: entry.links.map((l) => ({ ...l })),
    hiddenFromPlan: entry.hiddenFromPlan ?? false,
  }
}

export default function EntryModal({
  open, mode, projectId, phases, teamMembers = [],
  defaultType = 'task', defaultPhaseId, parentId, parentEntryId,
  entry, entryPhaseId,
  onClose, onRequestDateChange,
}: Props) {
  const { t } = useTranslation()
  const { addEntry, addSubtask, updateEntry, deleteEntry, moveEntryToPhase, addComment, removeComment } = useAppStore()
  const { profile } = useAuthStore()

  const fallbackPhaseId = defaultPhaseId ?? phases[0]?.id ?? ''

  const [form, setForm] = useState<Form>(() =>
    mode === 'edit' && entry
      ? entryToForm(entry, entryPhaseId ?? '')
      : emptyForm(defaultType, fallbackPhaseId, parentEntryId),
  )
  const [endDateError, setEndDateError] = useState('')
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    if (!open) return
    setEndDateError('')
    setDeleteStep('idle')
    setNewLinkLabel('')
    setNewLinkUrl('')
    setCommentText('')
    if (mode === 'edit' && entry) {
      setForm(entryToForm(entry, entryPhaseId ?? ''))
    } else {
      setForm(emptyForm(defaultType, defaultPhaseId ?? phases[0]?.id ?? '', parentEntryId))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function toggleDep(id: string) {
    setForm((f) => ({
      ...f,
      dependsOn: f.dependsOn.includes(id)
        ? f.dependsOn.filter((d) => d !== id)
        : [...f.dependsOn, id],
    }))
  }

  function addLink() {
    if (!newLinkUrl.trim()) return
    const newLink: Link = {
      id: crypto.randomUUID(),
      label: newLinkLabel.trim() || newLinkUrl.trim(),
      url: newLinkUrl.trim(),
    }
    setForm((f) => ({ ...f, links: [...f.links, newLink] }))
    setNewLinkLabel('')
    setNewLinkUrl('')
  }

  function removeLink(id: string) {
    setForm((f) => ({ ...f, links: f.links.filter((l) => l.id !== id) }))
  }

  function handleAddComment() {
    if (!commentText.trim() || !entry) return
    addComment(projectId, entry.id, {
      author: profile?.name ?? 'Usuário',
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    })
    setCommentText('')
  }

  const availableParentTasks = useMemo(() => {
    const result: { id: string; name: string }[] = []
    for (const ph of phases) {
      for (const e of ph.entries) {
        if (e.type === 'task') result.push({ id: e.id, name: e.name })
      }
    }
    return result
  }, [phases])

  const parentTask = form.type === 'meeting' && form.linkedParentId
    ? phases.flatMap((ph) => ph.entries).find((e) => e.id === form.linkedParentId)
    : undefined
  const parentEndWarning = parentTask?.plannedEnd && form.plannedDate && form.plannedDate > parentTask.plannedEnd

  const availableDeps = useMemo(() => {
    const result: { id: string; name: string; phaseId: string; phaseName: string }[] = []
    const excludeId = entry?.id
    for (const ph of phases) {
      for (const e of ph.entries) {
        if (e.id !== excludeId) {
          result.push({ id: e.id, name: e.name, phaseId: ph.id, phaseName: ph.name })
          for (const sub of e.subtasks) {
            if (sub.id !== excludeId) {
              result.push({ id: sub.id, name: `${e.name} / ${sub.name}`, phaseId: ph.id, phaseName: ph.name })
            }
          }
        }
      }
    }
    return result
  }, [phases, entry])

  const dependentCount = useMemo(() => {
    if (!entry) return 0
    let count = 0
    for (const ph of phases) {
      for (const e of ph.entries) {
        if (e.dependsOn.includes(entry.id)) count++
        for (const sub of e.subtasks) {
          if (sub.dependsOn.includes(entry.id)) count++
        }
      }
    }
    return count
  }, [phases, entry])

  const isSubtask = mode === 'create' && !!parentId
  const phaseChanged = mode === 'edit' && !!entryPhaseId && form.phaseId !== entryPhaseId

  function buildEntryPatch() {
    const firstOwner = form.owners[0]
    return {
      owners: form.owners,
      responsible: firstOwner?.name ?? '',
      responsibleMemberId: form.owners.find((o) => o.type === 'member')?.memberId,
      responsibleMode: (form.owners.find((o) => o.type === 'member') ? 'member' : 'free') as 'member' | 'free',
    }
  }

  function handleSaveCreate() {
    if (!form.name.trim() || !form.phaseId) return
    if (form.type === 'task' && form.plannedStart && form.plannedEnd && form.plannedEnd < form.plannedStart) {
      setEndDateError(t('errors.endBeforeStart'))
      return
    }
    setEndDateError('')
    const ownerPatch = buildEntryPatch()
    const base: Omit<Entry, 'id' | 'isCritical' | 'comments' | 'links' | 'subtasks'> = {
      name: form.name.trim(),
      type: form.type,
      ...ownerPatch,
      status: form.status,
      riskFlag: form.riskFlag,
      dependsOn: form.dependsOn,
      order: 0,
      plannedStart: form.type === 'task' ? form.plannedStart || undefined : undefined,
      plannedEnd: form.type === 'task' ? form.plannedEnd || undefined : undefined,
      plannedDate: form.type !== 'task' ? form.plannedDate || undefined : undefined,
      durationDays: form.type === 'task' ? form.durationDays : undefined,
      durationHours: form.type === 'meeting' ? form.durationHours : undefined,
      parentEntryId: form.type === 'meeting' && form.linkedParentId ? form.linkedParentId : undefined,
      hiddenFromPlan: form.hiddenFromPlan || undefined,
    }
    if (parentId) {
      addSubtask(projectId, form.phaseId, parentId, base)
    } else {
      addEntry(projectId, form.phaseId, base)
    }
    onClose()
  }

  function handleSaveEdit() {
    if (!entry || !form.name.trim()) return
    if (form.type === 'task' && form.plannedStart && form.plannedEnd && form.plannedEnd < form.plannedStart) {
      setEndDateError(t('errors.endBeforeStart'))
      return
    }
    setEndDateError('')

    if (phaseChanged && entryPhaseId) {
      moveEntryToPhase(projectId, entryPhaseId, form.phaseId, entry.id)
    }

    const ownerPatch = buildEntryPatch()
    updateEntry(projectId, entry.id, {
      name: form.name.trim(),
      ...ownerPatch,
      status: form.status,
      riskFlag: form.riskFlag,
      dependsOn: form.dependsOn,
      parentEntryId: form.type === 'meeting' && form.linkedParentId ? form.linkedParentId : undefined,
      durationDays: form.type === 'task' ? form.durationDays : undefined,
      durationHours: form.type === 'meeting' ? form.durationHours : undefined,
      links: form.links,
      hiddenFromPlan: form.hiddenFromPlan || undefined,
    })

    if (form.type === 'task') {
      if (form.plannedStart && form.plannedStart !== (entry.plannedStart ?? '')) {
        onRequestDateChange?.(entry, 'plannedStart', form.plannedStart)
      }
      if (form.plannedEnd && form.plannedEnd !== (entry.plannedEnd ?? '')) {
        onRequestDateChange?.(entry, 'plannedEnd', form.plannedEnd)
      }
    } else {
      if (form.plannedDate && form.plannedDate !== (entry.plannedDate ?? '')) {
        onRequestDateChange?.(entry, 'plannedDate', form.plannedDate)
      }
    }

    onClose()
  }

  function handleDelete() {
    if (!entry || !entryPhaseId) return
    deleteEntry(projectId, entryPhaseId, entry.id)
    onClose()
  }

  const typeLabel = (type: EntryType) =>
    (type.charAt(0).toUpperCase() + type.slice(1)) as 'Task' | 'Milestone' | 'Meeting'

  const title = mode === 'create'
    ? (isSubtask
        ? t('entry.addSubtask')
        : t(`entry.new${typeLabel(form.type)}` as any))
    : t(`entry.edit${typeLabel(entry?.type ?? 'task')}` as any)

  const footer = (
    <div className="flex items-center w-full gap-2">
      {mode === 'edit' && (
        <div className="flex-1 flex items-center gap-2">
          {deleteStep === 'idle' ? (
            <button
              onClick={() => setDeleteStep('confirm')}
              className="text-sm px-3 py-1.5 rounded transition-opacity"
              style={{ color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-text)' }}
            >
              {t('entry.deleteEntry')}
            </button>
          ) : (
            <>
              {dependentCount > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-warning-text)' }}>
                  ⚠ {t('entry.hasDependents', { count: dependentCount })}
                </span>
              )}
              <button
                onClick={handleDelete}
                className="text-sm px-3 py-1.5 rounded font-medium"
                style={{ color: 'white', background: 'var(--color-danger-text)' }}
              >
                {t('entry.confirmDelete')}
              </button>
              <button
                onClick={() => setDeleteStep('idle')}
                className="text-sm px-2 py-1.5 rounded"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('actions.cancel')}
              </button>
            </>
          )}
        </div>
      )}
      {mode === 'create' && <div className="flex-1" />}
      <Button variant="secondary" onClick={onClose}>{t('actions.cancel')}</Button>
      <Button
        onClick={mode === 'edit' ? handleSaveEdit : handleSaveCreate}
        disabled={!form.name.trim()}
      >
        {mode === 'edit' ? t('entry.saveChanges') : t('actions.confirm')}
      </Button>
    </div>
  )

  return (
    <Modal open={open} title={title} onClose={onClose} size="lg" footer={footer}>
      <div className="space-y-4">
        {/* Type selector (create mode only) */}
        {mode === 'create' && !isSubtask && !parentEntryId && (
          <div className="flex gap-2">
            {(['task', 'milestone', 'meeting'] as EntryType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('type', type)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  form.type === type
                    ? 'border-[var(--oe-primary)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--oe-primary)]'
                }`}
              >
                <span>{TYPE_ICONS[type]}</span>
                {t(`entry.${type}` as any)}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('entry.name')} required className="col-span-2">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') mode === 'edit' ? handleSaveEdit() : handleSaveCreate()
              }}
            />
          </Field>

          {!isSubtask && (
            <Field label={t('plan.phase')}>
              <Select value={form.phaseId} onChange={(e) => set('phaseId', e.target.value)}>
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>{ph.name}</option>
                ))}
              </Select>
              {phaseChanged && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  ↳ {t('entry.moveToPhase', { phase: phases.find((p) => p.id === form.phaseId)?.name ?? '' })}
                </p>
              )}
            </Field>
          )}

          {form.type === 'task' && (
            <>
              <Field label={t('entry.plannedStart')}>
                <Input type="date" value={form.plannedStart} onChange={(e) => set('plannedStart', e.target.value)} />
              </Field>
              <Field label={t('entry.plannedEnd')}>
                <Input
                  type="date"
                  value={form.plannedEnd}
                  onChange={(e) => { set('plannedEnd', e.target.value); setEndDateError('') }}
                  className={endDateError ? 'border-red-500' : ''}
                />
                {endDateError && <p className="text-xs text-red-500 mt-1">{endDateError}</p>}
              </Field>
              <Field label={t('entry.duration')}>
                <Input type="number" min={1} value={form.durationDays} onChange={(e) => set('durationDays', Number(e.target.value))} />
              </Field>
            </>
          )}

          {form.type !== 'task' && (
            <Field label={t('entry.plannedDate')}>
              <Input type="date" value={form.plannedDate} onChange={(e) => set('plannedDate', e.target.value)} />
            </Field>
          )}

          {form.type === 'meeting' && (
            <Field label={t('entry.durationHours')}>
              <Input type="number" min={0.5} step={0.5} value={form.durationHours} onChange={(e) => set('durationHours', Number(e.target.value))} />
            </Field>
          )}

          {form.type === 'meeting' && (
            <Field label={t('plan.linkedTask')} className="col-span-2">
              <Select
                value={form.linkedParentId}
                onChange={(e) => set('linkedParentId', e.target.value)}
                disabled={mode === 'create' && !!parentEntryId}
              >
                <option value="">— {t('plan.linkedTaskNone')} —</option>
                {availableParentTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </Select>
              {parentEndWarning && (
                <p className="text-xs text-amber-600 mt-1">⚠ {t('plan.childMeetingOutOfRange')}</p>
              )}
            </Field>
          )}

          <Field label={t('entry.riskFlag')}>
            <Select value={form.riskFlag} onChange={(e) => set('riskFlag', e.target.value as RiskFlag)}>
              <option value="none">{t('entry.none')}</option>
              <option value="warning">{t('entry.warning')}</option>
              <option value="critical">{t('entry.critical')}</option>
            </Select>
          </Field>

          <Field label={t('entry.status')}>
            <Select value={form.status} onChange={(e) => set('status', e.target.value as EntryStatus)}>
              <option value="pending">{t('entry.pending')}</option>
              <option value="in_progress">{t('entry.in_progress')}</option>
              <option value="done">{t('entry.done')}</option>
              <option value="blocked">{t('entry.blocked')}</option>
            </Select>
          </Field>
        </div>

        {/* Owners */}
        <Field label={t('entry.owners')}>
          <OwnersField
            owners={form.owners}
            onChange={(owners) => set('owners', owners)}
            teamMembers={teamMembers}
          />
        </Field>

        {/* hiddenFromPlan toggle (create mode only) */}
        {mode === 'create' && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!form.hiddenFromPlan}
              onChange={(e) => set('hiddenFromPlan', !e.target.checked)}
              className="rounded"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('entry.showInPlan')}
            </span>
          </label>
        )}

        {/* Dependencies */}
        {availableDeps.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('plan.dependencies')}
            </p>
            <div
              className="border rounded-lg max-h-36 overflow-y-auto p-2 space-y-1"
              style={{ borderColor: 'var(--border-default)' }}
            >
              {availableDeps.map((dep) => (
                <label
                  key={dep.id}
                  className="flex items-center gap-2.5 p-1.5 rounded hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.dependsOn.includes(dep.id)}
                    onChange={() => toggleDep(dep.id)}
                    className="rounded border-[var(--border-default)] text-[var(--oe-primary)]"
                  />
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>{dep.phaseName}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{dep.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Links</p>
          {form.links.length === 0 && (
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('overview.noLinks')}</p>
          )}
          {form.links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 group mb-1">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm hover:underline"
                style={{ color: 'var(--oe-primary)' }}
              >
                {l.label}
              </a>
              <button
                onClick={() => removeLink(l.id)}
                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--color-danger-text)' }}
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
              placeholder={t('overview.linkLabel')}
              className="flex-1"
            />
            <Input
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder={`${t('overview.linkUrl')} *`}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
            />
            <Button variant="secondary" onClick={addLink} disabled={!newLinkUrl.trim()}>
              {t('actions.add')}
            </Button>
          </div>
        </div>

        {/* Comments (edit mode only) */}
        {mode === 'edit' && entry && (
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('entry.comments')}
            </p>
            {entry.comments.length === 0 && (
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                {t('entry.noComments')}
              </p>
            )}
            <div className="space-y-2 mb-3">
              {entry.comments.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2 group"
                >
                  <span
                    className="flex items-center justify-center shrink-0 mt-0.5"
                    style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--oe-primary)', color: 'white', fontSize: 9, fontWeight: 600 }}
                  >
                    {c.author.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.author}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{c.text}</p>
                  </div>
                  <button
                    onClick={() => removeComment(projectId, entry.id, c.id)}
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    style={{ color: 'var(--text-disabled)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger-text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-disabled)')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() }
                }}
                rows={2}
                placeholder={t('entry.commentPlaceholder')}
                className="flex-1 rounded-md text-sm focus:outline-none focus:ring-1 px-3 py-2"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--surface-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  resize: 'none',
                }}
              />
              <Button variant="secondary" size="sm" onClick={handleAddComment} disabled={!commentText.trim()}>
                {t('actions.add')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
