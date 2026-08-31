import { useMemo, useState } from 'react'
import { BadgeIndianRupee, CalendarDays, FileText, Printer, ShieldCheck } from 'lucide-react'
import { formatCurrency, formatDate, useApi } from '../hooks/useApi'
import { useRole } from '../context/RoleContext'

type PayslipLine = {
  label: string
  amount: number
}

type Payslip = {
  id: number
  slipId: string
  batchId: string
  periodStart: string
  periodEnd: string
  status: string
  issueDate: string
  notes?: string | null
  employee: {
    employeeId: string
    name: string
    email?: string | null
    role?: string | null
    department?: string | null
    workLocation?: string | null
    employmentType: string
    startDate?: string | null
  }
  earnings: PayslipLine[]
  deductions: PayslipLine[]
  totalEarnings: number
  totalDeductions: number
  netPay: number
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigitsToWords = (value: number) => {
  if (value < 20) return ones[value]
  return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`
}

const amountToWords = (amount: number) => {
  const rounded = Math.round(amount)
  if (rounded === 0) return 'Zero rupees'

  const parts: string[] = []
  const crore = Math.floor(rounded / 10000000)
  const lakh = Math.floor((rounded % 10000000) / 100000)
  const thousand = Math.floor((rounded % 100000) / 1000)
  const hundred = Math.floor((rounded % 1000) / 100)
  const rest = rounded % 100

  if (crore) parts.push(`${twoDigitsToWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`)
  if (hundred) parts.push(`${ones[hundred]} Hundred`)
  if (rest) parts.push(twoDigitsToWords(rest))

  return `${parts.join(' ')} rupees`
}

const periodLabel = (start: string) => new Date(start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

const templatePlaceholder: Payslip = {
  id: 0,
  slipId: 'PAY-YYYY-000001-EMP-000001',
  batchId: 'PAY-YYYY-000001',
  periodStart: new Date().toISOString(),
  periodEnd: new Date().toISOString(),
  status: 'template',
  issueDate: new Date().toISOString(),
  employee: {
    employeeId: 'EMP-000001',
    name: 'Employee Name',
    email: 'employee@teinco-x.ai',
    role: 'Designation',
    department: 'Department',
    workLocation: 'Work Location',
    employmentType: 'full_time',
    startDate: new Date().toISOString(),
  },
  earnings: [
    { label: 'Base pay', amount: 0 },
    { label: 'Expense reimbursement', amount: 0 },
    { label: 'Bonus', amount: 0 },
  ],
  deductions: [{ label: 'Payroll deductions', amount: 0 }],
  totalEarnings: 0,
  totalDeductions: 0,
  netPay: 0,
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2">
      <span className="font-semibold text-[#1E3A8A]">{label}</span>
      <span className="font-semibold">: {value}</span>
    </div>
  )
}

function PayslipTemplate({ payslip, isPlaceholder = false }: { payslip: Payslip; isPlaceholder?: boolean }) {
  const periodStart = new Date(payslip.periodStart)
  const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate()

  return (
    <div className="payslip-print-surface rounded-lg border border-slate-300 bg-white p-6 text-slate-950 shadow-sm">
      <div className="border-b-4 border-[#1E3A8A] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-lg bg-[#1E3A8A] text-white">
              <span className="absolute h-0.5 w-6 rotate-45 rounded-full bg-white" />
              <span className="absolute h-0.5 w-6 -rotate-45 rounded-full bg-white" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
              <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1E3A8A]">Teinco-X Workspace</h2>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Employee Pay Slip</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-semibold text-slate-900">{payslip.slipId}</p>
            <p>Generated: {formatDate(payslip.issueDate)}</p>
          </div>
        </div>
        <p className="mt-3 rounded bg-slate-100 py-1 text-center text-sm font-semibold">
          Payslip for the month of {periodLabel(payslip.periodStart)}
        </p>
      </div>

      <div className="grid gap-4 py-5 text-sm md:grid-cols-2">
        <div className="space-y-2">
          <InfoRow label="Employee Code" value={payslip.employee.employeeId} />
          <InfoRow label="Name" value={payslip.employee.name} />
          <InfoRow label="DOJ" value={payslip.employee.startDate ? formatDate(payslip.employee.startDate) : '-'} />
          <InfoRow label="Location" value={payslip.employee.workLocation || '-'} />
          <InfoRow label="Workdays" value={String(daysInMonth)} />
          <InfoRow label="Days In Month" value={String(daysInMonth)} />
        </div>
        <div className="space-y-2">
          <InfoRow label="Email" value={payslip.employee.email || '-'} />
          <InfoRow label="Department" value={payslip.employee.department || '-'} />
          <InfoRow label="Designation" value={payslip.employee.role || '-'} />
          <InfoRow label="Employment Type" value={payslip.employee.employmentType.replace(/_/g, ' ')} />
          <InfoRow label="Payroll Batch" value={payslip.batchId} />
          <InfoRow label="Status" value={payslip.status} />
        </div>
      </div>

      <div className="overflow-hidden border border-slate-400 text-sm">
        <div className="grid grid-cols-4 bg-slate-200 text-center font-semibold">
          <div className="border-r border-slate-400 px-3 py-2">Earnings</div>
          <div className="border-r border-slate-400 px-3 py-2">Rs.</div>
          <div className="border-r border-slate-400 px-3 py-2">Deduction</div>
          <div className="px-3 py-2">Rs.</div>
        </div>
        {Array.from({ length: Math.max(payslip.earnings.length, payslip.deductions.length, 1) }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 border-t border-slate-300">
            <div className="border-r border-slate-300 px-3 py-2">{payslip.earnings[index]?.label || ''}</div>
            <div className="border-r border-slate-300 px-3 py-2 text-right">{formatCurrency(payslip.earnings[index]?.amount || 0).replace('₹', '')}</div>
            <div className="border-r border-slate-300 px-3 py-2">{payslip.deductions[index]?.label || ''}</div>
            <div className="px-3 py-2 text-right">{formatCurrency(payslip.deductions[index]?.amount || 0).replace('₹', '')}</div>
          </div>
        ))}
        <div className="grid grid-cols-4 border-t border-slate-400 bg-slate-100 font-bold">
          <div className="border-r border-slate-400 px-3 py-2">Total Earnings</div>
          <div className="border-r border-slate-400 px-3 py-2 text-right">{formatCurrency(payslip.totalEarnings).replace('₹', '')}</div>
          <div className="border-r border-slate-400 px-3 py-2">Total Deduction</div>
          <div className="px-3 py-2 text-right">{formatCurrency(payslip.totalDeductions).replace('₹', '')}</div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-400">
          <div className="border-r border-slate-400 px-3 py-3 font-bold text-[#1E3A8A]">Net Pay:</div>
          <div className="px-3 py-3 text-right font-bold">{formatCurrency(payslip.netPay).replace('₹', '')}</div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-400">
          <div className="border-r border-slate-400 px-3 py-3 font-bold text-[#1E3A8A]">In Words:</div>
          <div className="px-3 py-3 text-right font-bold">{amountToWords(payslip.netPay)}</div>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-xs leading-relaxed text-slate-700">
        <p>Dear {isPlaceholder ? 'Employee' : payslip.employee.name},</p>
        <p>This payslip is generated from Teinco-X People payroll records for the selected period. Please contact HR if any earning, deduction, or employee detail requires correction.</p>
        {payslip.notes && <p className="rounded border border-slate-200 bg-slate-50 p-2">Payroll note: {payslip.notes}</p>}
        <p className="pt-8 text-center text-slate-500">This is a system generated payslip hence no signature is required.</p>
      </div>
    </div>
  )
}

export default function Payslips() {
  const { isAdmin } = useRole()
  const { data, loading, error } = useApi<Payslip[]>('/employees/payslips')
  const payslips = data || []
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selectedPayslip = useMemo(
    () => payslips.find(payslip => payslip.id === selectedId) || payslips[0] || templatePlaceholder,
    [payslips, selectedId]
  )
  const hasRealPayslip = payslips.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="brand-heading">Employee Payslips</h2>
          <p className="brand-caption mt-1">
            {isAdmin ? 'Review printable payslip templates generated from payroll batches.' : 'View and print your own payroll slips.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="brand-primary-button no-print flex items-center gap-2"
        >
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="no-print space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#EFF6FF] p-2 text-[#1E3A8A]"><FileText className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Payslip template</h3>
                <p className="mt-1 text-sm text-slate-500">Modeled after your reference: profile fields, earnings/deductions, net pay, words, and system footer.</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">{isAdmin ? 'Generated payslips' : 'My payslips'}</h3>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Loading payslips...</p>
            ) : payslips.length ? (
              <div className="divide-y divide-slate-100 dark:divide-gray-700">
                {payslips.map(payslip => (
                  <button
                    key={payslip.id}
                    type="button"
                    onClick={() => setSelectedId(payslip.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-gray-700/40 ${selectedPayslip.id === payslip.id ? 'bg-[#EFF6FF]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[#1E3A8A] dark:text-white">{periodLabel(payslip.periodStart)}</p>
                      <span className="rounded border border-slate-200 px-2 py-0.5 text-xs capitalize text-slate-600">{payslip.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{payslip.employee.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{payslip.slipId}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A]">
                      <BadgeIndianRupee className="h-4 w-4" /> {formatCurrency(payslip.netPay)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-500">
                <CalendarDays className="mb-3 h-8 w-8 text-slate-300" />
                <p>No payslips generated yet.</p>
                <p className="mt-2">{isAdmin ? 'Create a payroll batch from People → Payroll to generate employee payslips.' : 'Your payslip will appear here once HR creates a payroll batch.'}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-[#1E3A8A]"><ShieldCheck className="h-4 w-4" /> Privacy rule</div>
            <p className="mt-2">Admins can review all payslips. Employees can only see payslips linked to their own employee login.</p>
          </div>
        </aside>

        <section>
          {!hasRealPayslip && (
            <div className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Showing the blank Teinco-X payslip template. It will fill with real employee payroll data after a payroll batch is created.
            </div>
          )}
          <PayslipTemplate payslip={selectedPayslip} isPlaceholder={!hasRealPayslip} />
        </section>
      </div>
    </div>
  )
}
