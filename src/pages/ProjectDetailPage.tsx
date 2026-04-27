import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import StatusBadge from '@/components/StatusBadge'
import { ProjectStatus, Project, Entry } from '@/types'
import { generateStatusReport, ReportConfig } from '@/utils/statusReport'
import { useSmartPosition } from '@/hooks/useSmartPosition'
import ReportConfigModal from '@/components/report/ReportConfigModal'
import ImportJsonModal from '@/components/import/ImportJsonModal'
import { exportProjectCsv } from '@/utils/exportCsv'
import { projectDurationDays } from '@/utils/projectStats'
import PlanPage from './PlanPage'
import KanbanPage from './KanbanPage'
import RisksPage from './RisksPage'
import DelayLogPage from './DelayLogPage'
import OverviewTab from './tabs/OverviewTab'
import CharterTab from './tabs/CharterTab'
import TeamTab from './tabs/TeamTab'

const TAB_IDS = ['overview', 'charter', 'team', 'plan', 'kanban', 'risks', 'delayLog'] as const
type TabId = typeof TAB_IDS[number]

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function findGoLive(project: Project): string | undefined {
  const milestones: Entry[] = []
  for (const ph of project.phases) {
    for (const e of ph.entries) {
      if (e.type === 'milestone') milestones.push(e)
    }
  }
  const goLive = milestones.find((e) => e.name.toLowerCase().includes('go live') || e.name.toLowerCase().includes('go-live'))
  const target = goLive ?? milestones[milestones.length - 1]
  return target?.plannedDate
}

function findCurrentPhase(project: Project): string | undefined {
  let bestPhase: string | undefined
  let bestCount = 0
  for (const ph of project.phases) {
    const count = ph.entries.filter((e) => e.status === 'in_progress').length
    if (count > bestCount) { bestCount = count; bestPhase = ph.name }
  }
  if (bestPhase) return bestPhase
  for (const ph of project.phases) {
    if (ph.entries.some((e) => e.status === 'pending')) return ph.name
  }
  return undefined
}

// ─── InfoChip ─────────────────────────────────────────────────────────────────

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }}>{value}</span>
    </span>
  )
}

function ChipSep() {
  return <span style={{ color: 'var(--border-strong)', padding: '0 6px', fontSize: 11 }}>·</span>
}

// ─── GhostBtn ─────────────────────────────────────────────────────────────────

function GhostBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ color: 'var(--text-tertiary)', padding: '4px 8px', borderRadius: 'var(--radius-md)' }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface-subtle)' } }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = '' }}
    >
      {children}
    </button>
  )
}

// ─── MoreMenu ─────────────────────────────────────────────────────────────────

function MoreMenu({ onImportUpdate, onArchive }: { onImportUpdate: () => void; onArchive: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { triggerRef, popoverRef, position } = useSmartPosition(open)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef as any}
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center transition-colors"
        style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', color: 'var(--text-tertiary)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--surface-subtle)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = '' }}
        title="Mais opções"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={popoverRef as any}
          className="py-1 w-48"
          style={{ position: 'fixed', ...position, zIndex: 1000, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}
        >
          <button
            onClick={() => { setOpen(false); onImportUpdate() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {t('import.importUpdate')}
          </button>
          <div style={{ height: '0.5px', background: 'var(--border-default)', margin: '2px 8px' }} />
          <button
            onClick={() => { setOpen(false); onArchive() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors"
            style={{ color: 'var(--color-danger-text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {t('project.archiveTitle')}
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── ProjectDetailPage ────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { projects, settings, updateProject, archiveProject } = useAppStore()
  const initialTab = (TAB_IDS as readonly string[]).includes(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as TabId)
    : 'overview'
  const [tab, setTab] = useState<TabId>(initialTab)
  const [focusRiskId, setFocusRiskId] = useState<string | null>(null)
  const [exportingReport, setExportingReport] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)

  const project = projects.find((p) => p.id === id)

  const duration = useMemo(
    () => (project ? projectDurationDays(project, settings.holidays) : undefined),
    [project, settings.holidays],
  )
  const goLiveDate = useMemo(() => (project ? findGoLive(project) : undefined), [project])
  const currentPhase = useMemo(() => (project ? findCurrentPhase(project) : undefined), [project])

  async function handleGenerateReport(config: ReportConfig) {
    if (!project || exportingReport) return
    setExportingReport(true)
    try { await generateStatusReport(project, settings, config) }
    finally { setExportingReport(false) }
  }

  if (!project) {
    return (
      <div className="p-8 text-center py-24" style={{ color: 'var(--text-tertiary)' }}>
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-[13px]">{t('project.notFound')}</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/')}>← {t('nav.portfolio')}</Button>
      </div>
    )
  }

  // ── Subheader chips ────────────────────────────────────────────────────────

  const chips: { label: string; value: string }[] = []
  chips.push({ label: t('project.client'), value: project.client })
  chips.push({ label: t('project.pm'), value: project.pm })
  if (project.devLead) chips.push({ label: t('project.devLead'), value: project.devLead })
  if (project.devType) {
    const devVal = t(`project.${project.devType}`) + (project.devIntegration ? ` · ${project.devIntegration}` : '')
    chips.push({ label: 'Dev', value: devVal })
  }
  if (duration !== undefined) chips.push({ label: t('overview.baseline'), value: `${duration} ${t('project.workingDays')}` })
  if (goLiveDate) chips.push({ label: 'Go live', value: fmtDate(goLiveDate) })
  if (currentPhase) chips.push({ label: t('plan.phase'), value: currentPhase })

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Topbar ── */}
      <div
        className="flex items-center gap-3 px-5 shrink-0"
        style={{ height: 52, background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
      >
        {/* Breadcrumb + project name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="text-[11px] transition-colors whitespace-nowrap shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            ← {t('nav.portfolio')}
          </button>
          <span style={{ color: 'var(--border-strong)', fontSize: 11 }}>·</span>
          <span className="text-[15px] font-[500] truncate" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status badge (clickable dropdown) */}
        <StatusBadge
          value={project.status}
          onChange={(s) => updateProject(project.id, { status: s as ProjectStatus })}
          options={[
            { value: 'planning', label: t('status.planning') },
            { value: 'in_progress', label: t('status.in_progress') },
            { value: 'delayed', label: t('status.delayed') },
            { value: 'done', label: t('status.done') },
          ]}
        />

        {/* Export report */}
        <GhostBtn onClick={() => setShowReportModal(true)} disabled={exportingReport}>
          {exportingReport ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          )}
          {exportingReport ? t('report.generating') : t('report.exportBtn')}
        </GhostBtn>

        {/* Export CSV — only on plan tab */}
        {tab === 'plan' && (
          <GhostBtn onClick={() => exportProjectCsv(project, settings.holidays)}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('plan.exportCsv')}
          </GhostBtn>
        )}

        {/* More options */}
        <MoreMenu
          onImportUpdate={() => setShowImportModal(true)}
          onArchive={() => setShowArchiveModal(true)}
        />
      </div>

      {/* ── Subheader chips ── */}
      <div
        className="flex items-center flex-wrap px-5 shrink-0"
        style={{ minHeight: 34, background: 'var(--surface-subtle)', borderBottom: '0.5px solid var(--border-default)', padding: '5px 20px' }}
      >
        {chips.map((chip, i) => (
          <span key={chip.label} className="flex items-center">
            {i > 0 && <ChipSep />}
            <InfoChip label={chip.label} value={chip.value} />
          </span>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex shrink-0"
        style={{ background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
      >
        <nav className="flex gap-0 overflow-x-auto">
          {TAB_IDS.map((tid) => (
            <button
              key={tid}
              onClick={() => setTab(tid)}
              className="px-4 py-2.5 text-[13px] font-[500] border-b-2 transition-colors whitespace-nowrap"
              style={{
                borderBottomColor: tab === tid ? 'var(--oe-primary)' : 'transparent',
                color: tab === tid ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
              onMouseEnter={e => { if (tab !== tid) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { if (tab !== tid) (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
            >
              {t(`tabs.${tid}`)}
              {tid === 'risks' && project.risks.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-subtle)', color: 'var(--text-tertiary)' }}>{project.risks.length}</span>
              )}
              {tid === 'delayLog' && project.delayLog.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' }}>{project.delayLog.length}</span>
              )}
              {tid === 'team' && project.team.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-subtle)', color: 'var(--text-tertiary)' }}>{project.team.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-auto" style={{ background: 'var(--surface-page)' }}>
        {tab === 'overview'  && <OverviewTab project={project} />}
        {tab === 'charter'   && <CharterTab project={project} />}
        {tab === 'team'      && <TeamTab project={project} />}
        {tab === 'plan'      && <PlanPage projectId={project.id} onNavigateToRisk={(riskId) => { setTab('risks'); setFocusRiskId(riskId) }} />}
        {tab === 'kanban'    && <KanbanPage projectId={project.id} />}
        {tab === 'risks'     && <RisksPage projectId={project.id} focusRiskId={focusRiskId} onFocusConsumed={() => setFocusRiskId(null)} />}
        {tab === 'delayLog'  && <DelayLogPage projectId={project.id} />}
      </div>

      {showReportModal && (
        <ReportConfigModal
          projectId={project.id}
          onGenerate={(config) => { setShowReportModal(false); handleGenerateReport(config) }}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {showImportModal && (
        <ImportJsonModal
          initialTab="update"
          projectId={project.id}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <Modal
        open={showArchiveModal}
        title={t('project.archiveTitle')}
        onClose={() => setShowArchiveModal(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowArchiveModal(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              onClick={async () => {
                setShowArchiveModal(false)
                await archiveProject(project.id)
                navigate('/')
              }}
              style={{ background: 'var(--color-danger-text)', borderColor: 'var(--color-danger-text)' }}
            >
              {t('project.archive')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('project.archiveMessage')}
        </p>
      </Modal>
    </div>
  )
}
