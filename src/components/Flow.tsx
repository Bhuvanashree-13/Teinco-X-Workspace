import { useState, type FormEvent } from 'react'
import {
  BarChart3,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
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
  { id: 'command', label: 'Command', icon: Gauge },
  { id: 'automation', label: 'Automation', icon: Bot },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
  { id: 'insights', label: 'Insights', icon: BrainCircuit },
]

const priorityTone: Record<string, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-700',
  standard: 'border-slate-200 bg-slate-50 text-slate-700',
  informational: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  open: 'border-slate-200 bg-slate-50 text-slate-700',
  acknowledged: 'border-amber-200 bg-amber-50 text-amber-700',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const labelize = (value?: string | null) => (value || 'unassigned').replace(/_/g, ' ')

function Pill({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize ${priorityTone[value] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      {labelize(value)}
    </span>
  )
}

function Metric({ icon: Icon, label, value, caption }: { icon: any; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#64748B]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#1E3A8A] dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
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

  const { data: overview, refetch: refetchOverview } = useApi<Overview>('/flow/overview')
  const { data: rules, refetch: refetchRules } = useApi<AutomationRule[]>('/flow/automation-rules')
  const { data: forecast, refetch: refetchForecast } = useApi<Forecast>('/flow/forecast')
  const { data: insights, refetch: refetchInsights } = useApi<Insight[]>('/flow/insights')

  const ruleList = rules || []
  const insightList = insights || []
  const scenarioList = forecast?.scenarios || []
  const modules = overview?.modules

  const refreshFlow = async () => {
    await Promise.all([refetchOverview(), refetchRules(), refetchForecast(), refetchInsights()])
  }

  const submitAutomation = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('automation')
    setMessage('')
    try {
      await apiPost('/flow/automation-rules', automationForm)
      setAutomationForm(automationDefaults)
      setMessage('Automation rule created.')
      await refreshFlow()
    } catch (error: any) {
      setMessage(error.message || 'Could not create automation rule.')
    } finally {
      setSaving('')
    }
  }

  const updateRuleStatus = async (id: number, status: string) => {
    setSaving(`rule-${id}`)
    setMessage('')
    try {
      await apiPut(`/flow/automation-rules/${id}/status`, { status })
      setMessage(`Automation rule ${status}.`)
      await refreshFlow()
    } catch (error: any) {
      setMessage(error.message || 'Could not update automation rule.')
    } finally {
      setSaving('')
    }
  }

  const submitScenario = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('scenario')
    setMessage('')
    try {
      await apiPost('/flow/forecast-scenarios', scenarioForm)
      setScenarioForm(scenarioDefaults)
      setMessage('Forecast scenario saved.')
      await refreshFlow()
    } catch (error: any) {
      setMessage(error.message || 'Could not save forecast scenario.')
    } finally {
      setSaving('')
    }
  }

  const submitInsight = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('insight')
    setMessage('')
    try {
      await apiPost('/flow/insights', insightForm)
      setInsightForm(insightDefaults)
      setMessage('Executive insight added.')
      await refreshFlow()
    } catch (error: any) {
      setMessage(error.message || 'Could not add executive insight.')
    } finally {
      setSaving('')
    }
  }

  const updateInsightStatus = async (insight: Insight, status: string) => {
    if (!insight.id) return
    setSaving(`insight-${insight.id}`)
    setMessage('')
    try {
      await apiPut(`/flow/insights/${insight.id}/status`, { status })
      setMessage('Executive insight updated.')
      await refreshFlow()
    } catch (error: any) {
      setMessage(error.message || 'Could not update executive insight.')
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Teinco-X Flow</p>
          <h2 className="mt-1 text-[32px] font-semibold leading-tight text-[#1E3A8A] dark:text-white">Executive Command</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Unified ERP view across Ledger, People, and Schedule with automation, forecasting, and root-cause operating insights.
          </p>
        </div>
        <button
          onClick={refreshFlow}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#1E3A8A] shadow-sm hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Gauge} label="Enterprise risk" value={`${overview?.riskScore || 0}/100`} caption="Computed from open risks" />
        <Metric icon={WalletCards} label="Operating burn" value={formatCurrency(modules?.ledger.operatingBurn || 0)} caption="Ledger plus People commitments" />
        <Metric icon={Users} label="Headcount" value={String(modules?.people.activeEmployees || 0)} caption={`${modules?.people.pendingLeave || 0} leave requests pending`} />
        <Metric icon={CalendarDays} label="Execution load" value={String((modules?.schedule.openMilestones || 0) + (modules?.schedule.upcomingEvents || 0))} caption="Milestones plus upcoming events" />
        <Metric icon={Bot} label="Active automations" value={String(modules?.flow.activeRules || 0)} caption={`${modules?.flow.openInsights || 0} stored insights open`} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-[#1E3A8A] text-[#1E3A8A] dark:border-white dark:text-white'
                : 'border-transparent text-slate-500 hover:text-[#1E3A8A] dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" strokeWidth={1.5} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'command' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_430px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Cross-Module Synthesis</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-gray-700/50">
                  <tr><th className="px-4 py-3 font-medium">Module</th><th className="px-4 py-3 font-medium">Primary signal</th><th className="px-4 py-3 font-medium">Secondary signal</th><th className="px-4 py-3 font-medium">Strategic read</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  <tr><td className="px-4 py-3 font-semibold text-[#1E3A8A] dark:text-white">Ledger</td><td className="px-4 py-3">{formatCurrency(modules?.ledger.currentMonthSpend || 0)} month spend</td><td className="px-4 py-3">{formatCurrency(modules?.ledger.recurringMonthlyCommitment || 0)} recurring</td><td className="px-4 py-3">Burn baseline for runway planning</td></tr>
                  <tr><td className="px-4 py-3 font-semibold text-[#1E3A8A] dark:text-white">People</td><td className="px-4 py-3">{modules?.people.activeEmployees || 0} active employees</td><td className="px-4 py-3">{formatCurrency(modules?.people.monthlyPeopleCost || 0)} monthly people cost</td><td className="px-4 py-3">Capacity and cost center pressure</td></tr>
                  <tr><td className="px-4 py-3 font-semibold text-[#1E3A8A] dark:text-white">Schedule</td><td className="px-4 py-3">{modules?.schedule.openMilestones || 0} open milestones</td><td className="px-4 py-3">{modules?.schedule.upcomingEvents || 0} upcoming events</td><td className="px-4 py-3">Execution timing and deadline risk</td></tr>
                  <tr><td className="px-4 py-3 font-semibold text-[#1E3A8A] dark:text-white">Flow</td><td className="px-4 py-3">{ruleList.length} automation rules</td><td className="px-4 py-3">{insightList.length} total insights</td><td className="px-4 py-3">Management system maturity</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Prioritized Actions</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {(overview?.executiveActions || []).map((item, index) => (
                <div key={`${item.action}-${index}`} className="p-4">
                  <div className="flex items-center gap-2"><Pill value={item.priority} /><span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{item.source}</span></div>
                  <p className="mt-2 text-sm text-[#1E3A8A] dark:text-white">{item.action}</p>
                </div>
              ))}
              {(overview?.executiveActions || []).length === 0 && <p className="p-8 text-center text-sm text-slate-500">No priority actions detected.</p>}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'automation' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Process Automation Rules</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {ruleList.map(rule => (
                <div key={rule.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{rule.name}</p>
                    <p className="mt-1 text-sm text-slate-500">When {labelize(rule.triggerModule)}: {rule.triggerEvent} - then {labelize(rule.actionModule)}: {rule.actionSummary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill value={rule.priority} />
                    <Pill value={rule.status} />
                    <button onClick={() => updateRuleStatus(rule.id, rule.status === 'active' ? 'paused' : 'active')} disabled={saving === `rule-${rule.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-[#1E3A8A] dark:border-gray-700 dark:text-white">{rule.status === 'active' ? 'Pause' : 'Activate'}</button>
                  </div>
                </div>
              ))}
              {ruleList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No automation rules yet.</p>}
            </div>
          </div>

          <form onSubmit={submitAutomation} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Create Rule</h3>
            <div className="mt-4 space-y-3">
              <input required value={automationForm.name} onChange={event => setAutomationForm({ ...automationForm, name: event.target.value })} placeholder="Rule name" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={automationForm.triggerModule} onChange={event => setAutomationForm({ ...automationForm, triggerModule: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="ledger">Ledger</option><option value="people">People</option><option value="schedule">Schedule</option><option value="flow">Flow</option><option value="crm">CRM</option></select>
                <select value={automationForm.actionModule} onChange={event => setAutomationForm({ ...automationForm, actionModule: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="schedule">Schedule</option><option value="people">People</option><option value="ledger">Ledger</option><option value="flow">Flow</option></select>
              </div>
              <input required value={automationForm.triggerEvent} onChange={event => setAutomationForm({ ...automationForm, triggerEvent: event.target.value })} placeholder="Trigger event" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <textarea required value={automationForm.actionSummary} onChange={event => setAutomationForm({ ...automationForm, actionSummary: event.target.value })} placeholder="Action summary" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <select value={automationForm.priority} onChange={event => setAutomationForm({ ...automationForm, priority: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="informational">Informational</option></select>
              <button disabled={saving === 'automation'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Save rule</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'forecast' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Baseline Forecast</h3>
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
                    <div><p className="font-semibold text-[#1E3A8A] dark:text-white">{scenario.name}</p><p className="text-sm text-slate-500">{scenario.horizonMonths} months - {scenario.plannedHeadcountChange >= 0 ? '+' : ''}{scenario.plannedHeadcountChange} headcount</p></div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{formatCurrency(Number(scenario.projectedNetBurn) || 0)}</p>
                    <Pill value={scenario.confidence} />
                  </div>
                ))}
                {scenarioList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No forecast scenarios yet.</p>}
              </div>
            </div>
          </div>

          <form onSubmit={submitScenario} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Model Scenario</h3>
            <div className="mt-4 space-y-3">
              <input required value={scenarioForm.name} onChange={event => setScenarioForm({ ...scenarioForm, name: event.target.value })} placeholder="Scenario name" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <input min="1" max="36" type="number" value={scenarioForm.horizonMonths} onChange={event => setScenarioForm({ ...scenarioForm, horizonMonths: event.target.value })} placeholder="Horizon months" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <input min="0" step="0.01" type="number" value={scenarioForm.assumedMonthlyRevenue} onChange={event => setScenarioForm({ ...scenarioForm, assumedMonthlyRevenue: event.target.value })} placeholder="Assumed monthly revenue" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <input min="0" step="0.01" type="number" value={scenarioForm.assumedMonthlyBurn} onChange={event => setScenarioForm({ ...scenarioForm, assumedMonthlyBurn: event.target.value })} placeholder="Assumed monthly burn" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <input step="1" type="number" value={scenarioForm.plannedHeadcountChange} onChange={event => setScenarioForm({ ...scenarioForm, plannedHeadcountChange: event.target.value })} placeholder="Planned headcount change" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <select value={scenarioForm.confidence} onChange={event => setScenarioForm({ ...scenarioForm, confidence: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="low">Low confidence</option><option value="medium">Medium confidence</option><option value="high">High confidence</option></select>
              <button disabled={saving === 'scenario'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><TrendingUp className="h-4 w-4" /> Save scenario</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'insights' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Executive Insights & Anomalies</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {insightList.map(insight => (
                <div key={insight.insightId} className="p-4">
                  <div className="flex flex-wrap items-center gap-2"><Pill value={insight.severity} /><span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{insight.sourceModule}</span>{insight.id && <Pill value={insight.status} />}</div>
                  <p className="mt-2 font-semibold text-[#1E3A8A] dark:text-white">{insight.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Root cause: {insight.rootCause}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Action: {insight.recommendedAction}</p>
                  {insight.id && insight.status !== 'resolved' && <button onClick={() => updateInsightStatus(insight, 'resolved')} disabled={saving === `insight-${insight.id}`} className="mt-3 flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> Resolve</button>}
                </div>
              ))}
              {insightList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No insights detected.</p>}
            </div>
          </div>

          <form onSubmit={submitInsight} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Add Strategic Insight</h3>
            <div className="mt-4 space-y-3">
              <input required value={insightForm.title} onChange={event => setInsightForm({ ...insightForm, title: event.target.value })} placeholder="Insight title" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={insightForm.severity} onChange={event => setInsightForm({ ...insightForm, severity: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="informational">Informational</option></select>
                <select value={insightForm.sourceModule} onChange={event => setInsightForm({ ...insightForm, sourceModule: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="ledger">Ledger</option><option value="people">People</option><option value="schedule">Schedule</option><option value="flow">Flow</option></select>
              </div>
              <textarea required value={insightForm.rootCause} onChange={event => setInsightForm({ ...insightForm, rootCause: event.target.value })} placeholder="Root cause" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <textarea required value={insightForm.recommendedAction} onChange={event => setInsightForm({ ...insightForm, recommendedAction: event.target.value })} placeholder="Recommended action" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <button disabled={saving === 'insight'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> Add insight</button>
            </div>
          </form>
        </section>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex items-start gap-3">
          <BriefcaseBusiness className="mt-0.5 h-4 w-4 text-[#64748B]" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-[#1E3A8A] dark:text-white">Executive operating model</p>
            <p className="mt-1 text-sm text-slate-500">Flow links finance cost, workforce capacity, and schedule risk so leadership can see cause and effect across departments.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

