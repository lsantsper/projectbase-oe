import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import SettingsPage from '@/pages/SettingsPage'
import TemplateEditorPage from '@/pages/TemplateEditorPage'
import TasksPage from '@/pages/TasksPage'
import LoginPage from '@/pages/LoginPage'
import AuthCallback from '@/pages/AuthCallback'

export default function App() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        useAuthStore.getState().loadProfile().then(() => {
          useAppStore.getState().loadProjects()
        })
      } else {
        useAuthStore.getState().setUser(null)
        useAuthStore.setState({ loading: false })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/templates/:templateId" element={<TemplateEditorPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
