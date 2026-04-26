import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import SettingsPage from '@/pages/SettingsPage'
import TemplateEditorPage from '@/pages/TemplateEditorPage'
import TasksPage from '@/pages/TasksPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/templates/:templateId" element={<TemplateEditorPage />} />
      </Route>
    </Routes>
  )
}
