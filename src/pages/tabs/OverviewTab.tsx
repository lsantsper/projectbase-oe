import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Project } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Field } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface Props {
  project: Project
}

export default function OverviewTab({ project }: Props) {
  const { t } = useTranslation()
  const { updateProject, addProjectLink, removeProjectLink } = useAppStore()
  const [overview, setOverview] = useState(project.overview ?? '')
  const [linkModal, setLinkModal] = useState(false)
  const [linkForm, setLinkForm] = useState({ label: '', url: '' })
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // Sync from store when project changes externally
  useEffect(() => { setOverview(project.overview ?? '') }, [project.id])

  // Autosave with debounce
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => updateProject(project.id, { overview }), 700)
    return () => clearTimeout(timer.current)
  }, [overview])

  function handleAddLink() {
    if (!linkForm.url) return
    addProjectLink(project.id, { label: linkForm.label || linkForm.url, url: linkForm.url })
    setLinkForm({ label: '', url: '' })
    setLinkModal(false)
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('overview.notes')}</h3>
        <Textarea
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          rows={10}
          placeholder={t('overview.notesPlaceholder')}
        />
        <p className="text-xs text-gray-400 mt-2">{t('overview.autosaved')}</p>
      </div>

      {/* External links */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">{t('overview.links')}</h3>
          <Button size="sm" variant="secondary" onClick={() => setLinkModal(true)}>
            + {t('overview.addLink')}
          </Button>
        </div>

        {project.links.length === 0 ? (
          <p className="text-sm text-gray-400">{t('overview.noLinks')}</p>
        ) : (
          <ul className="space-y-2">
            {project.links.map((link) => (
              <li key={link.id} className="flex items-center gap-3 group">
                <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1 truncate"
                >
                  {link.label}
                </a>
                <span className="text-xs text-gray-300 truncate max-w-[200px] hidden sm:block">{link.url}</span>
                <button
                  onClick={() => removeProjectLink(project.id, link.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Project metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('overview.information')}</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            [t('project.client'), project.client],
            [t('project.pm'), project.pm],
            [t('project.devLead'), project.devLead || '—'],
            [t('overview.devType'), project.devType ? t(`project.${project.devType}`) : '—'],
            [t('project.devIntegration'), project.devIntegration || '—'],
            [t('overview.baseline'), project.baselineSetAt ? new Date(project.baselineSetAt).toLocaleDateString() : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-gray-400 text-xs">{label}</dt>
              <dd className="font-medium text-gray-800 mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Add link modal */}
      <Modal
        open={linkModal}
        title={t('overview.addLink')}
        onClose={() => setLinkModal(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkModal(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleAddLink} disabled={!linkForm.url}>{t('actions.confirm')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('overview.linkLabel')}>
            <Input
              value={linkForm.label}
              onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Ex: SharePoint do projeto"
            />
          </Field>
          <Field label={t('overview.linkUrl')} required>
            <Input
              value={linkForm.url}
              onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
