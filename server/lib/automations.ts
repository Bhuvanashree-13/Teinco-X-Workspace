import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { format, isSameDay, startOfDay } from 'date-fns'
import { prisma } from '../db.js'

const publicUrl = () => (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '')
const tokenSecret = () => process.env.JWT_SECRET || 'teinco-finance-local-secret-key'
const smtpReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM && publicUrl())
const mailer = () => nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })

export const payslipDownloadToken = (lineId: number) => jwt.sign({ kind: 'payslip-download', lineId }, tokenSecret(), { expiresIn: '90d' })
export const verifyPayslipDownloadToken = (token: string, lineId: number) => {
  const payload = jwt.verify(token, tokenSecret()) as { kind?: string; lineId?: number }
  return payload.kind === 'payslip-download' && payload.lineId === lineId
}

const seedRule = async (name: string, triggerEvent: string, actionSummary: string) => prisma.flowAutomationRule.upsert({
  where: { ruleId: `SYSTEM-${name === 'Payslip email delivery' ? 'PAYSLIP' : 'SUBSCRIPTIONS'}` },
  update: { triggerModule: name === 'Payslip email delivery' ? 'people' : 'ledger', triggerEvent, actionModule: 'automation', actionSummary, status: 'active', priority: 'standard' },
  create: { ruleId: `SYSTEM-${name === 'Payslip email delivery' ? 'PAYSLIP' : 'SUBSCRIPTIONS'}`, name, triggerModule: name === 'Payslip email delivery' ? 'people' : 'ledger', triggerEvent, actionModule: 'automation', actionSummary, status: 'active', priority: 'standard' },
})

const deliver = async (ruleId: number, deliveryKey: string, recipient: string, subject: string, text: string) => {
  if (!smtpReady()) return false
  const previous = await prisma.automationDelivery.findUnique({ where: { deliveryKey } })
  if (previous) return false
  await mailer().sendMail({ from: process.env.SMTP_FROM, to: recipient, subject, text })
  await prisma.automationDelivery.create({ data: { ruleId, deliveryKey, recipient, subject } })
  return true
}

export async function runAutomations() {
  // Railway deploys application code separately from database migrations. Keep this
  // idempotent bootstrap so enabling SMTP cannot fail because its delivery ledger
  // has not been created yet.
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS \`AutomationDelivery\` (\`id\` INT NOT NULL AUTO_INCREMENT, \`ruleId\` INT NOT NULL, \`deliveryKey\` VARCHAR(191) NOT NULL, \`recipient\` VARCHAR(191) NOT NULL, \`subject\` VARCHAR(191) NOT NULL, \`sentAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`AutomationDelivery_deliveryKey_key\`(\`deliveryKey\`), INDEX \`AutomationDelivery_ruleId_idx\`(\`ruleId\`), INDEX \`AutomationDelivery_sentAt_idx\`(\`sentAt\`), PRIMARY KEY (\`id\`))`)
  const [payslipRule, subscriptionRule] = await Promise.all([
    seedRule('Payslip email delivery', 'Payroll batch approved or paid', 'Email each employee a secure payslip download link.'),
    seedRule('Subscription due reminder', 'Subscription due in two days', 'Email all active admins with the due subscription details.'),
  ])
  if (!smtpReady()) return { configured: false, sent: 0 }
  let sent = 0
  if (payslipRule.status === 'active') {
    const lines = await prisma.payrollBatchEmployee.findMany({ where: { payrollBatch: { status: { in: ['approved', 'paid'] } }, employee: { email: { not: null } } }, include: { employee: true, payrollBatch: true } })
    for (const line of lines) {
      const key = `payslip:${line.id}:${line.payrollBatch.updatedAt.toISOString()}`
      const link = `${publicUrl()}/api/employees/payslips/${line.id}/download?token=${encodeURIComponent(payslipDownloadToken(line.id))}`
      const month = format(line.payrollBatch.periodEnd, 'MMMM yyyy')
      const subject = `Your Teinco-X salary slip for ${month}`
      const text = `Hello ${line.employee.name},\n\nYour salary slip for ${month} is ready. Download it securely here:\n${link}\n\nThis link expires in 90 days.\n\nTeinco-X Workspace`
      if (line.employee.email && await deliver(payslipRule.id, key, line.employee.email, subject, text)) sent += 1
    }
  }
  if (subscriptionRule.status === 'active') {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 2)
    const subscriptions = await prisma.subscription.findMany({ where: { isArchived: false, status: { in: ['active', 'trial'] }, nextBillingDate: { not: null } }, include: { vendor: { select: { name: true } } } })
    const due = subscriptions.filter(subscription => subscription.nextBillingDate && isSameDay(startOfDay(subscription.nextBillingDate), startOfDay(dueDate)))
    const admins = await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true, name: true } })
    for (const subscription of due) for (const admin of admins) {
      const subject = `Subscription due in 2 days: ${subscription.productName}`
      const text = `Hello ${admin.name || 'Admin'},\n\n${subscription.productName}${subscription.vendor?.name ? ` (${subscription.vendor.name})` : ''} is due on ${format(subscription.nextBillingDate!, 'dd MMMM yyyy')}.\nAmount: ${subscription.currency} ${Number(subscription.cost).toFixed(2)}\nBilling cycle: ${subscription.billingCycle}\nAutomatic renewal: ${subscription.autoRenewal ? 'Yes' : 'No'}\n\nPlease review it in Teinco-X.\n\nTeinco-X Workspace`
      if (await deliver(subscriptionRule.id, `subscription:${subscription.id}:${format(subscription.nextBillingDate!, 'yyyy-MM-dd')}:${admin.email}`, admin.email, subject, text)) sent += 1
    }
  }
  await prisma.flowAutomationRule.updateMany({ where: { id: { in: [payslipRule.id, subscriptionRule.id] }, status: 'active' }, data: { lastRunAt: new Date() } })
  return { configured: true, sent }
}

export function startAutomations() {
  void runAutomations().catch(error => console.error('Automation run failed:', error))
  setInterval(() => void runAutomations().catch(error => console.error('Automation run failed:', error)), 15 * 60 * 1000).unref()
}
