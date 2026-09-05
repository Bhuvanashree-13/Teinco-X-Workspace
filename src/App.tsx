import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Expenses from './components/Expenses'
import Vendors from './components/Vendors'
import Subscriptions from './components/Subscriptions'
import Analytics from './components/Analytics'
import Settings from './components/Settings'
import People from './components/People'
import Schedule from './components/Schedule'
import Flow from './components/Flow'
import Login from './components/Login'
import Payslips from './components/Payslips'
import Deposits from './components/Deposits'
import { RoleProvider, useRole } from './context/RoleContext'
import { ToastProvider } from './components/Toast'

function AppRoutes() {
  const { user, loading } = useRole()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1E3A8A]/20 border-t-[#1E3A8A]" />
          <div className="text-sm font-medium text-[#1E3A8A] dark:text-blue-300">Loading Teinco-X Workspace…</div>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="deposits" element={<Deposits />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="people" element={<People />} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="flow" element={<Flow />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <RoleProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </RoleProvider>
  )
}

export default App
