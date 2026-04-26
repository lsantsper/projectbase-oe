import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Project, ProjectCharter } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { Textarea, Input, Field } from '@/components/ui/Input'

const EMPTY_CHARTER: ProjectCharter = {
  sponsor: '',
  objectives: '',
  scope: '',
  outOfScope: '',
  successCriteria: '',
  constraints: '',
  assumptions: '',
  budget: '',
}

interface Props { project: Project }

export default function CharterTab({ project }: Props) {
  const { t } = useTranslation()
  const { updateProject } = useAppStore()
  const [charter, setCharter] = useState<ProjectCharter>(project.charter ?? EMPTY_CHARTER)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { setCharter(project.charter ?? EMPTY_CHARTER) }, [project.id])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => updateProject(project.id, { charter }), 700)
    return () => clearTimeout(timer.current)
  }, [charter])

  function set(field: keyof ProjectCharter, value: string) {
    setCharter((c) => ({ ...c, [field]: value }))
  }

  const textareaFields: { key: keyof ProjectCharter; rows?: number }[] = [
    { key: 'objectives', rows: 4 },
    { key: 'scope', rows: 4 },
    { key: 'outOfScope', rows: 3 },
    { key: 'successCriteria', rows: 3 },
    { key: 'constraints', rows: 3 },
    { key: 'assumptions', rows: 3 },
  ]

  return (
    <div className="p-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t('charter.title')}</h2>
          <span className="text-xs text-gray-400">Salvo automaticamente</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label={t('charter.sponsor')}>
            <Input
              value={charter.sponsor}
              onChange={(e) => set('sponsor', e.target.value)}
              placeholder="Nome do sponsor executivo"
            />
          </Field>
          <Field label={t('charter.budget')}>
            <Input
              value={charter.budget ?? ''}
              onChange={(e) => set('budget', e.target.value)}
              placeholder="Ex: R$ 50.000"
            />
          </Field>
        </div>

        <div className="border-t border-gray-100 pt-5 grid grid-cols-1 gap-5">
          {textareaFields.map(({ key, rows }) => (
            <Field key={key} label={t(`charter.${key}`)}>
              <Textarea
                value={charter[key] ?? ''}
                onChange={(e) => set(key, e.target.value)}
                rows={rows ?? 3}
                placeholder={`Descreva ${t(`charter.${key}`).toLowerCase()}...`}
              />
            </Field>
          ))}
        </div>
      </div>
    </div>
  )
}
