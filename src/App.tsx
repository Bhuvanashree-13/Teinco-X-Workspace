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
import { RoleProvider, useRole } from './context/RoleContext'

function AppRoutes() {
  const { user, loading } = useRole()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <div className="text-sm font-medium text-[#1E3A8A]">Loading Teinco-X Workspace…</div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
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
      <AppRoutes />
    </RoleProvider>
  )
}

export default App
