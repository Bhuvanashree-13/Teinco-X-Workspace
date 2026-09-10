import AskAI from './AskAI'
import { useState, type FormEvent } from 'react'
import FlowIntelligence from './FlowIntelligence'
import { Link } from 'react-router-dom'
import { StatCardsSkeleton } from './Skeleton'
import {
  BarChart3,
  Bot,
  BrainCircuit,
  ArrowUpRight,
  CalendarDays,
  Check,
  Gauge,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react'
import { apiPost, apiPut, formatCurrency, useApi } from '../hooks/useApi'

type Overview = {
  generatedAt: string
  riskScore: number
  modules: {
    ledger: {
      currentMonthSpend: number
      previousMonthSpend: number
      spendDelta: number
      recurringMonthlyCommitment: number
      operatingBurn: number
    }
    people: {
      activeEmployees: number
      pendingLeave: number
      monthlyPeopleCost: number
      costPerEmployee: number
    }
    schedule: {
      activeProjects: number
      openMilestones: number
      urgentMilestones: number
      upcomingEvents: number
    }
    flow: {
      activeRules: number
      openInsights: number
    }
  }
  topInsights: Insight[]
  executiveActions: Array<{ priority: string; action: string; source: string }>
}

type AutomationRule = {
  id: number
  ruleId: string
  name: string
  triggerModule: string
  triggerEvent: string
  actionModule: string
  actionSummary: string
  priority: string
  status: string
  lastRunAt?: string | null
}

type Insight = {
  id?: number
  insightId: string
  title: string
  severity: string
  sourceModule: string
  rootCause: string
  recommendedAction: string
  status: string
}

type Forecast = {
  baseline: {
    horizonMonths: number
    monthlyBurn: number
    projectedBurn: number
    projectedHeadcount: number
    staffingPressure: string
    confidence: string
    method?: string
    historyCount?: number
  }
  scenarios: Array<{
    id: number
    scenarioId: string
    name: string
    horizonMonths: number
    assumedMonthlyRevenue: number
    assumedMonthlyBurn: number
    plannedHeadcountChange: number
    confidence: string
    projectedNetBurn: number
    projectedHeadcount: number
  }>
}

const automationDefaults = {
  name: '',
  triggerModule: 'ledger',
  triggerEvent: '',
  actionModule: 'schedule',
  actionSummary: '',
  priority: 'standard',
  notes: '',
}

const scenarioDefaults = {
  name: '',
  horizonMonths: '6',
  assumedMonthlyRevenue: '0',
  assumedMonthlyBurn: '0',
  plannedHeadcountChange: '0',
  confidence: 'medium',
  notes: '',
}

const insightDefaults = {
  title: '',
  severity: 'standard',
  sourceModule: 'flow',
  rootCause: '',
  recommendedAction: '',
}

const tabs = [
  { id: 'command', label: 'Overview', icon: Gauge },
  { id: 'intelligence', label: 'Checks', icon: ShieldCheck },
  { id: 'ask', label: 'Vyom', icon: Bot },
  { id: 'automation', label: 'Automation', icon: Bot },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
  { id: 'insights', label: 'Insights', icon: BrainCircuit },
]

const priorityTone: Record<string, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
  standard: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200',
  informational: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  paused: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  open: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200',
  acknowledged: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
}

const labelize = (value?: string | null) => (value || 'unassigned').replace(/_/g, ' ')

function Pill({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize ${priorityTone[value] || 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
      {labelize(value)}
    </span>
  )
}

function Metric({ icon: Icon, label, value, caption }: { icon: any; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
          <p className="finance-value mt-3 text-2xl font-semibold text-[#1E3A8A] dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{caption}</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-[#1E3A8A] dark:bg-gray-700 dark:text-white">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

export default function Flow() {
  const [activeTab, setActiveTab] = useState('command')
  const [automationForm, setAutomationForm] = useState(automationDefaults)
  const [scenarioForm, setScenarioForm] = useState(scenarioDefaults)
  const [insightForm, setInsightForm] = useState(insightDefaults)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState(false)

  const { data: overview, loading: overviewLoading, error: overviewError, refetch: refetchOverview } = useApi<Overview>('/flow/overview')
  const { data: rules, loading: rulesLoading, error: rulesError, refetch: refetchRules } = useApi<AutomationRule[]>('/flow/automation-rules')
  const { data: forecast, loading: forecastLoading, error: forecastError, refetch: refetchForecast } = useApi<Forecast>('/flow/forecast')
  const { data: insights, loading: insightsLoading, error: insightsError, refetch: refetchInsights } = useApi<Insight[]>('/flow/insights')

  const ruleList = rules || []
  const insightList = insights || []
  const scenarioList = forecast?.scenarios || []
  const modules = overview?.modules
  const refreshing = overviewLoading || rulesLoading || forecastLoading || insightsLoading
  const tabLoading = ['intelligence', 'ask'].includes(activeTab) ? false : activeTab === 'automation' ? rulesLoading : activeTab === 'forecast' ? forecastLoading : activeTab === 'insights' ? insightsLoading : overviewLoading
  const tabError = ['intelligence', 'ask'].includes(activeTab) ? null : activeTab === 'automation' ? rulesError : activeTab === 'forecast' ? forecastError : activeTab === 'insights' ? insightsError : overviewError
  const moduleCards = [
    { name: 'Finance', icon: WalletCards, to: '/expenses', tone: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/60', value: formatCurrency(modules?.ledger.currentMonthSpend || 0), label: 'Current month spending', secondary: `${formatCurrency(modules?.ledger.recurringMonthlyCommitment || 0)} recurring ledger expenses`, action: 'Review expenses' },
    { name: 'People', icon: Users, to: '/people', tone: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/60', value: String(modules?.people.activeEmployees || 0), label: 'Active employees', secondary: `${formatCurrency(modules?.people.monthlyPeopleCost || 0)} monthly people cost`, action: 'Manage people' },
    { name: 'Schedule', icon: CalendarDays, to: '/schedule', tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60', value: String(modules?.schedule.openMilestones || 0), label: 'Open milestones', secondary: `${modules?.schedule.upcomingEvents || 0} upcoming events`, action: 'Open schedule' },
  ]

  const refreshFlow = async () => {
    await Promise.all([refetchOverview(), refetchRules(), refetchForecast(), refetchInsights()])
  }

  const submitAutomation = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('automation')
    setMessage('')
    setMessageError(false)
    try {
      await apiPost('/flow/automation-rules', automationForm)
      setAutomationForm(automationDefaults)
      setMessage('Automation rule created.')
      await refreshFlow()
    } catch (error: any) {
      setMessageError(true)
      setMessage(error.message || 'Could not create automation rule.')
    } finally {
      setSaving('')
    }
  }

  const updateRuleStatus = async (id: number, status: string) => {
    setSaving(`rule-${id}`)
    setMessage('')
    setMessageError(false)
    try {
      await apiPut(`/flow/automation-rules/${id}/status`, { status })
      setMessage(`Automation rule ${status}.`)
      await refreshFlow()
    } catch (error: any) {
      setMessageError(true)
      setMessage(error.message || 'Could not update automation rule.')
    } finally {
      setSaving('')
    }
  }

  const submitScenario = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('scenario')
    setMessage('')
    setMessageError(false)
    try {
      await apiPost('/flow/forecast-scenarios', scenarioForm)
      setScenarioForm(scenarioDefaults)
      setMessage('Forecast scenario saved.')
      await refreshFlow()
    } catch (error: any) {
      setMessageError(true)
      setMessage(error.message || 'Could not save forecast scenario.')
    } finally {
      setSaving('')
    }
  }

  const submitInsight = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('insight')
    setMessage('')
    setMessageError(false)
    try {
      await apiPost('/flow/insights', insightForm)
      setInsightForm(insightDefaults)
      setMessage('Executive insight added.')
      await refreshFlow()
    } catch (error: any) {
      setMessageError(true)
      setMessage(error.message || 'Could not add executive insight.')
    } finally {
      setSaving('')
    }
  }

  const updateInsightStatus = async (insight: Insight, status: string) => {
    if (!insight.id) return
    setSaving(`insight-${insight.id}`)
    setMessage('')
    setMessageError(false)
    try {
      await apiPut(`/flow/insights/${insight.id}/status`, { status })
      setMessage('Executive insight updated.')
      await refreshFlow()
    } catch (error: any) {
      setMessageError(true)
      setMessage(error.message || 'Could not update executive insight.')
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 text-slate-800 dark:text-slate-200">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Teinco-X Flow</p>
          <h2 className="mt-1 text-[32px] font-semibold leading-tight text-[#1E3A8A] dark:text-white">Operations Overview</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Your finances, people, and upcoming work in one place.
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={refreshFlow}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#1E3A8A] shadow-sm hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {message && <div role={messageError ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${messageError ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>{message}</div>}

      {overviewLoading && !overview ? <StatCardsSkeleton count={4} /> : overviewError ? <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">The overview could not be loaded. Use Refresh to try again.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Gauge} label="Rule-based attention score" value={`${overview?.riskScore ?? 0}/100`} caption="Heuristic score; not a probability" />
        <Metric icon={Users} label="Active employees" value={String(modules?.people.activeEmployees || 0)} caption={`${modules?.people.pendingLeave || 0} leave requests pending`} />
        <Metric icon={CalendarDays} label="Upcoming work" value={String((modules?.schedule.openMilestones || 0) + (modules?.schedule.upcomingEvents || 0))} caption="Open milestones and upcoming events" />
        <Metric icon={Bot} label="Active rules" value={String(modules?.flow.activeRules || 0)} caption={`${modules?.flow.openInsights || 0} open insights`} />
      </div>}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1.5 dark:border-gray-700 dark:bg-gray-800/70">
        {tabs.map(tab => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-200' : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-gray-700'}`}><tab.icon className="h-4 w-4" />{tab.label}</button>)}
      </div>
      {tabLoading ? <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-slate-300" role="status">Loading {tabs.find(tab => tab.id === activeTab)?.label.toLowerCase()}…</div> : tabError ? <div role="alert" className="rounded-xl border border-red-200 p-5 text-red-700 dark:border-red-900 dark:text-red-300">Could not load this view. <button type="button" onClick={refreshFlow} className="underline">Try again</button></div> : null}

      {activeTab === 'ask' && <AskAI />}
      {activeTab === 'intelligence' && <FlowIntelligence />}

      {activeTab === 'command' && !tabLoading && !tabError && overview && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">
            <div><h3 className="text-lg font-semibold text-slate-900 dark:text-white">Workspace snapshot</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review the numbers, then jump into the relevant workspace.</p></div>
            <div className="grid gap-4 md:grid-cols-3">
              {moduleCards.map(card => <Link key={card.name} to={card.to} className="group min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-400">
                <div className="mb-5 flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${card.tone}`}><card.icon className="h-5 w-5" /></span><h4 className="font-semibold text-slate-900 dark:text-white">{card.name}</h4></div>
                <p className="finance-value break-words text-2xl font-semibold text-slate-900 dark:text-white">{card.value}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{card.label}</p>
                <p className="mt-4 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.secondary}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-blue-700 dark:border-gray-700 dark:text-blue-300">{card.action}<ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></div>
              </Link>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30"><div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">Plan your next step</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Create a scenario to compare spending and headcount assumptions.</p></div><button type="button" onClick={() => setActiveTab('forecast')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Create scenario</button></div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900 dark:text-white">Needs attention</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-gray-700 dark:text-slate-200">{overview.executiveActions.length}</span></div>
            {overview.executiveActions.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-gray-700">{overview.executiveActions.map((item, index) => <div key={index} className="py-4 first:pt-0"><div className="flex items-center gap-2"><Pill value={item.priority} /><span className="text-xs capitalize text-slate-500 dark:text-slate-400">{item.source}</span></div><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{item.action}</p></div>)}</div> : <div className="py-8 text-center"><span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><Check className="h-5 w-5" /></span><p className="text-sm font-medium text-slate-900 dark:text-white">No priority actions</p><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">No actions were flagged from the current workspace records.</p></div>}
            <button type="button" onClick={() => setActiveTab('insights')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-gray-700">View insights</button>
          </section>
        </div>
      )}

      {activeTab === 'automation' && !tabLoading && !tabError && (
        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Stored Workflow Rules</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {ruleList.map(rule => (
                <div key={rule.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{rule.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">When {labelize(rule.triggerModule)}: {rule.triggerEvent} - then {labelize(rule.actionModule)}: {rule.actionSummary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill value={rule.priority} />
                    <Pill value={rule.status} />
                    <button onClick={() => updateRuleStatus(rule.id, rule.status === 'active' ? 'paused' : 'active')} disabled={saving === `rule-${rule.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-[#1E3A8A] dark:border-gray-700 dark:text-white">{rule.status === 'active' ? 'Pause' : 'Activate'}</button>
                  </div>
                </div>
              ))}
              {ruleList.length === 0 && <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No workflow rules yet. Stored rules do not execute automatically.</p>}
            </div>
          </div>

          <form onSubmit={submitAutomation} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Create Rule</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Rule name<span className="mt-1.5 block"><input required value={automationForm.name} onChange={event => setAutomationForm({ ...automationForm, name: event.target.value })} placeholder="Rule name" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">Trigger module<span className="mt-1.5 block"><select value={automationForm.triggerModule} onChange={event => setAutomationForm({ ...automationForm, triggerModule: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="ledger">Ledger</option><option value="people">People</option><option value="schedule">Schedule</option><option value="flow">Flow</option><option value="crm">CRM</option></select></span></label>
                <label className="block min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">Action module<span className="mt-1.5 block"><select value={automationForm.actionModule} onChange={event => setAutomationForm({ ...automationForm, actionModule: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="schedule">Schedule</option><option value="people">People</option><option value="ledger">Ledger</option><option value="flow">Flow</option></select></span></label>
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Trigger event<span className="mt-1.5 block"><input required value={automationForm.triggerEvent} onChange={event => setAutomationForm({ ...automationForm, triggerEvent: event.target.value })} placeholder="Trigger event" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Action summary<span className="mt-1.5 block"><textarea required value={automationForm.actionSummary} onChange={event => setAutomationForm({ ...automationForm, actionSummary: event.target.value })} placeholder="Action summary" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">Priority<span className="mt-1.5 block"><select value={automationForm.priority} onChange={event => setAutomationForm({ ...automationForm, priority: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="informational">Informational</option></select></span></label>
              <button disabled={saving === 'automation'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Save rule</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'forecast' && !tabLoading && !tabError && (
        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Recorded-spend baseline</h3>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{forecast?.baseline.method} This is a simple projection, not a trained forecast. {forecast?.baseline.historyCount || 0} historical expenses available.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Metric icon={WalletCards} label="Monthly burn" value={formatCurrency(forecast?.baseline.monthlyBurn || 0)} caption={`${forecast?.baseline.horizonMonths || 6}-month baseline`} />
                <Metric icon={BarChart3} label="Projected burn" value={formatCurrency(forecast?.baseline.projectedBurn || 0)} caption={`Confidence: ${forecast?.baseline.confidence || 'low'}`} />
                <Metric icon={Users} label="Staffing pressure" value={labelize(forecast?.baseline.staffingPressure || 'low')} caption={`${forecast?.baseline.projectedHeadcount || 0} projected headcount`} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Saved Scenarios</h3></div>
              <div className="divide-y divide-slate-100 dark:divide-gray-700">
                {scenarioList.map(scenario => (
                  <div key={scenario.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                    <div><p className="font-semibold text-[#1E3A8A] dark:text-white">{scenario.name}</p><p className="text-sm text-slate-500 dark:text-slate-400">{scenario.horizonMonths} months - {scenario.plannedHeadcountChange >= 0 ? '+' : ''}{scenario.plannedHeadcountChange} headcount</p></div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{formatCurrency(Number(scenario.projectedNetBurn) || 0)}</p>
                    <Pill value={scenario.confidence} />
                  </div>
                ))}
                {scenarioList.length === 0 && <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No forecast scenarios yet.</p>}
              </div>
            </div>
          </div>

          <form onSubmit={submitScenario} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Model Scenario</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Scenario name<span className="mt-1.5 block"><input required value={scenarioForm.name} onChange={event => setScenarioForm({ ...scenarioForm, name: event.target.value })} placeholder="Scenario name" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Horizon months<span className="mt-1.5 block"><input min="1" max="36" type="number" value={scenarioForm.horizonMonths} onChange={event => setScenarioForm({ ...scenarioForm, horizonMonths: event.target.value })} placeholder="Horizon months" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Assumed monthly revenue<span className="mt-1.5 block"><input min="0" step="0.01" type="number" value={scenarioForm.assumedMonthlyRevenue} onChange={event => setScenarioForm({ ...scenarioForm, assumedMonthlyRevenue: event.target.value })} placeholder="Assumed monthly revenue" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Assumed monthly burn<span className="mt-1.5 block"><input min="0" step="0.01" type="number" value={scenarioForm.assumedMonthlyBurn} onChange={event => setScenarioForm({ ...scenarioForm, assumedMonthlyBurn: event.target.value })} placeholder="Assumed monthly burn" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Planned headcount change<span className="mt-1.5 block"><input step="1" type="number" value={scenarioForm.plannedHeadcountChange} onChange={event => setScenarioForm({ ...scenarioForm, plannedHeadcountChange: event.target.value })} placeholder="Planned headcount change" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">Confidence<span className="mt-1.5 block"><select value={scenarioForm.confidence} onChange={event => setScenarioForm({ ...scenarioForm, confidence: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="low">Low confidence</option><option value="medium">Medium confidence</option><option value="high">High confidence</option></select></span></label>
              <button disabled={saving === 'scenario'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><TrendingUp className="h-4 w-4" /> Save scenario</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'insights' && !tabLoading && !tabError && (
        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Executive Insights & Anomalies</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {insightList.map(insight => (
                <div key={insight.insightId} className="p-4">
                  <div className="flex flex-wrap items-center gap-2"><Pill value={insight.severity} /><span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{insight.sourceModule}</span>{insight.id && <Pill value={insight.status} />}</div>
                  <p className="mt-2 font-semibold text-[#1E3A8A] dark:text-white">{insight.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Observation: {insight.rootCause}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Action: {insight.recommendedAction}</p>
                  {insight.id && insight.status !== 'resolved' && <button onClick={() => updateInsightStatus(insight, 'resolved')} disabled={saving === `insight-${insight.id}`} className="mt-3 flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> Resolve</button>}
                </div>
              ))}
              {insightList.length === 0 && <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No insights detected.</p>}
            </div>
          </div>

          <form onSubmit={submitInsight} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Add Strategic Insight</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Insight title<span className="mt-1.5 block"><input required value={insightForm.title} onChange={event => setInsightForm({ ...insightForm, title: event.target.value })} placeholder="Insight title" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">Severity<span className="mt-1.5 block"><select value={insightForm.severity} onChange={event => setInsightForm({ ...insightForm, severity: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="informational">Informational</option></select></span></label>
                <label className="block min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">Source module<span className="mt-1.5 block"><select value={insightForm.sourceModule} onChange={event => setInsightForm({ ...insightForm, sourceModule: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="ledger">Ledger</option><option value="people">People</option><option value="schedule">Schedule</option><option value="flow">Flow</option></select></span></label>
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Root cause<span className="mt-1.5 block"><textarea required value={insightForm.rootCause} onChange={event => setInsightForm({ ...insightForm, rootCause: event.target.value })} placeholder="Root cause" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Recommended action<span className="mt-1.5 block"><textarea required value={insightForm.recommendedAction} onChange={event => setInsightForm({ ...insightForm, recommendedAction: event.target.value })} placeholder="Recommended action" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></span></label>
              <button disabled={saving === 'insight'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> Add insight</button>
            </div>
          </form>
        </section>
      )}

      {overview && <p className="text-xs text-slate-500 dark:text-slate-400">Last updated {new Date(overview.generatedAt).toLocaleString('en-IN')} · Based on workspace records</p>}

    </div>
  )
}

