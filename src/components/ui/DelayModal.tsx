import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { Button } from './Button'
import { Textarea, Select, Field } from './Input'
import { DelayLogEntry } from '@/types'

type Responsibility = DelayLogEntry['responsibility']
type DelayType = DelayLogEntry['type']

interface DelayModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: { description: string; responsibility: Responsibility; type: DelayType }) => void
  onSkip: () => void
}

export function DelayModal({ open, onClose, onConfirm, onSkip }: DelayModalProps) {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')
  const [responsibility, setResponsibility] = useState<Responsibility>('internal')
  const [type, setType] = useState<DelayType>('execution')

  function handleConfirm() {
    onConfirm({ description, responsibility, type })
    setDescription('')
  }

  return (
    <Modal
      open={open}
      title={t('delay.title')}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onSkip}>{t('delay.skip')}</Button>
          <Button onClick={handleConfirm}>{t('delay.confirm')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('delay.responsibility')}>
          <Select value={responsibility} onChange={(e) => setResponsibility(e.target.value as Responsibility)}>
            <option value="internal">{t('delay.internal')}</option>
            <option value="client_business">{t('delay.client_business')}</option>
            <option value="client_it">{t('delay.client_it')}</option>
            <option value="client_provider">{t('delay.client_provider')}</option>
          </Select>
        </Field>
        <Field label={t('delay.type')}>
          <Select value={type} onChange={(e) => setType(e.target.value as DelayType)}>
            <option value="execution">{t('delay.execution')}</option>
            <option value="definition">{t('delay.definition')}</option>
            <option value="planning">{t('delay.planning')}</option>
          </Select>
        </Field>
        <Field label={t('delay.description')}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o motivo da alteração..." />
        </Field>
      </div>
    </Modal>
  )
}
