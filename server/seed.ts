import { prisma } from './db.js'
import { format, addMonths, addDays, subMonths } from 'date-fns'

function generateId(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`
}

export async function seedData() {
  const now = new Date()
  const year = now.getFullYear()

  // Settings
  await prisma.settings.create({
    data: {
      companyName: 'Teinco-X Workspace',
      country: 'India',
      baseCurrency: 'INR',
      reportingYear: 'calendar',
      financialYearStart: 4,
      financialYearEnd: 3,
      backupPath: './backups',
      autoBackup: true,
      autoBackupInterval: 24,
    }
  })

  // Categories
  const categories = [
    { code: 'PEOPLE', name: 'People', color: '#ef4444', children: [
      { code: 'SALARIES', name: 'Salaries' },
      { code: 'CONTRACTORS', name: 'Contractor Payments' },
      { code: 'FREELANCERS', name: 'Freelancer Payments' },
      { code: 'BENEFITS', name: 'Employee Benefits' },
      { code: 'RECRUITMENT', name: 'Recruitment' },
      { code: 'TRAINING', name: 'Training' },
    ]},
    { code: 'SOFTWARE', name: 'Software & SaaS', color: '#3b82f6', children: [
      { code: 'MICROSOFT', name: 'Microsoft' },
      { code: 'GOOGLE', name: 'Google' },
      { code: 'ADOBE', name: 'Adobe' },
      { code: 'GITHUB', name: 'GitHub' },
      { code: 'ATLASSIAN', name: 'Atlassian' },
      { code: 'CANVA', name: 'Canva' },
      { code: 'FIGMA', name: 'Figma' },
      { code: 'NOTION', name: 'Notion' },
      { code: 'SLACK', name: 'Slack' },
      { code: 'OTHER_SAAS', name: 'Other SaaS' },
    ]},
    { code: 'AI_APIS', name: 'AI & APIs', color: '#8b5cf6', children: [
      { code: 'OPENAI', name: 'OpenAI' },
      { code: 'ANTHROPIC', name: 'Anthropic' },
      { code: 'GOOGLE_AI', name: 'Google AI' },
      { code: 'AZURE_AI', name: 'Azure AI' },
      { code: 'API_USAGE', name: 'API Usage' },
      { code: 'LLM_TOKENS', name: 'LLM Tokens' },
    ]},
    { code: 'CLOUD', name: 'Cloud & Infrastructure', color: '#06b6d4', children: [
      { code: 'AWS', name: 'AWS' },
      { code: 'AZURE', name: 'Microsoft Azure' },
      { code: 'GCP', name: 'Google Cloud' },
      { code: 'GPU_COMPUTE', name: 'GPU Compute' },
      { code: 'STORAGE', name: 'Storage' },
      { code: 'CDN', name: 'CDN' },
      { code: 'HOSTING', name: 'Hosting' },
    ]},
    { code: 'HARDWARE', name: 'Hardware', color: '#f59e0b', children: [
      { code: 'COMPUTERS', name: 'Computers' },
      { code: 'GPUS', name: 'GPUs' },
      { code: 'SERVERS', name: 'Servers' },
      { code: 'MONITORS', name: 'Monitors' },
      { code: 'NETWORKING', name: 'Networking' },
      { code: 'PERIPHERALS', name: 'Peripherals' },
    ]},
    { code: 'OPERATIONS', name: 'Business Operations', color: '#10b981', children: [
      { code: 'OFFICE', name: 'Office' },
      { code: 'INTERNET', name: 'Internet' },
      { code: 'MOBILE', name: 'Mobile' },
      { code: 'UTILITIES', name: 'Utilities' },
      { code: 'TRAVEL', name: 'Travel' },
      { code: 'MEALS', name: 'Meals' },
    ]},
    { code: 'PROF_SERVICES', name: 'Professional Services', color: '#6366f1', children: [
      { code: 'LEGAL', name: 'Legal' },
      { code: 'ACCOUNTING', name: 'Accounting' },
      { code: 'CONSULTING', name: 'Consulting' },
      { code: 'COMPLIANCE', name: 'Compliance' },
      { code: 'CS', name: 'Company Secretary' },
    ]},
    { code: 'MARKETING', name: 'Marketing', color: '#ec4899', children: [
      { code: 'ADVERTISING', name: 'Advertising' },
      { code: 'SOCIAL_MEDIA', name: 'Social Media' },
      { code: 'EVENTS', name: 'Events' },
      { code: 'BRANDING', name: 'Branding' },
      { code: 'CONTENT', name: 'Content' },
    ]},
    { code: 'STATUTORY', name: 'Company & Statutory', color: '#78716c', children: [
      { code: 'GOVT_FEES', name: 'Government Fees' },
      { code: 'REGISTRATIONS', name: 'Registrations' },
      { code: 'LICENSES', name: 'Licenses' },
      { code: 'TAXES', name: 'Taxes' },
      { code: 'GST_EXP', name: 'GST-related expenses' },
      { code: 'BANKING_FEES', name: 'Banking Fees' },
    ]},
    { code: 'MISC', name: 'Miscellaneous', color: '#6b7280', children: [
      { code: 'MISC_EXP', name: 'Miscellaneous' },
      { code: 'OTHER', name: 'Other' },
    ]},
  ]

  for (const cat of categories) {
    const parent = await prisma.expenseCategory.create({
      data: { code: cat.code, name: cat.name, color: cat.color, sortOrder: categories.indexOf(cat) }
    })
    for (const child of cat.children || []) {
      await prisma.expenseCategory.create({
        data: {
          code: child.code,
          name: child.name,
          parentId: parent.id,
          color: cat.color,
          sortOrder: cat.children.indexOf(child)
        }
      })
    }
  }

  // Vendors
  const vendorData = [
    { code: 'VEN-000001', name: 'Microsoft India', type: 'software', email: 'billing@microsoft.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000002', name: 'Amazon Web Services', type: 'cloud', email: 'aws@amazon.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000003', name: 'Google Cloud India', type: 'cloud', email: 'cloud@google.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000004', name: 'GitHub Inc', type: 'software', email: 'billing@github.com', country: 'USA', currency: 'USD' },
    { code: 'VEN-000005', name: 'Adobe Systems', type: 'software', email: 'billing@adobe.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000006', name: 'OpenAI', type: 'software', email: 'billing@openai.com', country: 'USA', currency: 'USD' },
    { code: 'VEN-000007', name: 'Anthropic', type: 'software', email: 'billing@anthropic.com', country: 'USA', currency: 'USD' },
    { code: 'VEN-000008', name: 'Canva', type: 'software', email: 'billing@canva.com', country: 'Australia', currency: 'USD' },
    { code: 'VEN-000009', name: 'Figma', type: 'software', email: 'billing@figma.com', country: 'USA', currency: 'USD' },
    { code: 'VEN-000010', name: 'Notion Labs', type: 'software', email: 'billing@notion.so', country: 'USA', currency: 'USD' },
    { code: 'VEN-000011', name: 'Slack Technologies', type: 'software', email: 'billing@slack.com', country: 'USA', currency: 'USD' },
    { code: 'VEN-000012', name: 'Atlassian', type: 'software', email: 'billing@atlassian.com', country: 'Australia', currency: 'USD' },
    { code: 'VEN-000013', name: 'Airtel Business', type: 'service', email: 'enterprise@airtel.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000014', name: 'Jio Business', type: 'service', email: 'business@jio.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000015', name: 'NVIDIA India', type: 'hardware', email: 'enterprise@nvidia.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000016', name: 'Dell India', type: 'hardware', email: 'enterprise@dell.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000017', name: 'Lenovo India', type: 'hardware', email: 'enterprise@lenovo.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000018', name: 'GoDaddy India', type: 'service', email: 'billing@godaddy.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000019', name: 'Razorpay', type: 'service', email: 'support@razorpay.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000020', name: 'Cleartax', type: 'service', email: 'support@cleartax.in', country: 'India', currency: 'INR' },
    { code: 'VEN-000021', name: 'WeWork India', type: 'service', email: 'billing@wework.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000022', name: 'Zoho Corporation', type: 'software', email: 'billing@zoho.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000023', name: 'Tally Solutions', type: 'software', email: 'support@tallysolutions.com', country: 'India', currency: 'INR' },
    { code: 'VEN-000024', name: 'LinkedIn Marketing', type: 'service', email: 'billing@linkedin.com', country: 'USA', currency: 'USD' },
    { code: 'VEN-000025', name: 'Meta Ads', type: 'service', email: 'billing@meta.com', country: 'USA', currency: 'USD' },
  ]

  for (const v of vendorData) {
    await prisma.vendor.create({ data: v })
  }

  // Projects
  const projectData = [
    { code: 'PRJ-CORP', name: 'Corporate', description: 'Corporate overhead and shared costs', color: '#6b7280' },
    { code: 'PRJ-SPAN', name: 'Spandana', description: 'AI-powered News Intelligence & Digital Distribution', color: '#3b82f6' },
    { code: 'PRJ-VYOM', name: 'Vyom', description: 'AI assistant platform', color: '#8b5cf6' },
    { code: 'PRJ-INFRA', name: 'AI Infrastructure', description: 'Cloud/GPU/AI infrastructure', color: '#06b6d4' },
    { code: 'PRJ-RND', name: 'R&D', description: 'Research and Development', color: '#10b981' },
    { code: 'PRJ-MKT', name: 'Marketing', description: 'Marketing and growth initiatives', color: '#ec4899' },
    { code: 'PRJ-OPS', name: 'Operations', description: 'Business operations', color: '#f59e0b' },
  ]

  for (const p of projectData) {
    await prisma.project.create({ data: p })
  }

  // Cost Centers
  const ccData = [
    { code: 'CC-ENG', name: 'Engineering' },
    { code: 'CC-PROD', name: 'Product' },
    { code: 'CC-OPS', name: 'Operations' },
    { code: 'CC-MKT', name: 'Marketing' },
    { code: 'CC-FIN', name: 'Finance' },
    { code: 'CC-CORP', name: 'Corporate' },
    { code: 'CC-RND', name: 'R&D' },
  ]

  for (const cc of ccData) {
    await prisma.costCenter.create({ data: cc })
  }

  // Payment Methods
  const pmData = [
    { name: 'HDFC Corporate Card', type: 'corporate_card' },
    { name: 'ICICI Bank Transfer', type: 'bank_transfer' },
    { name: 'SBI Credit Card', type: 'credit_card' },
    { name: 'Razorpay UPI', type: 'upi' },
    { name: 'Cash', type: 'cash' },
    { name: 'Personal Card Reimbursement', type: 'personal_card' },
  ]

  for (const pm of pmData) {
    await prisma.paymentMethod.create({ data: pm })
  }

  // Currencies
  const currData = [
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', isActive: true, isBase: true },
    { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true, isBase: false },
    { code: 'EUR', name: 'Euro', symbol: '€', isActive: true, isBase: false },
    { code: 'GBP', name: 'British Pound', symbol: '£', isActive: true, isBase: false },
  ]

  for (const c of currData) {
    await prisma.currency.create({ data: c })
  }

  // Exchange Rates
  await prisma.exchangeRate.createMany({
    data: [
      { fromCurrency: 'USD', toCurrency: 'INR', rate: 83.5, source: 'manual' },
      { fromCurrency: 'EUR', toCurrency: 'INR', rate: 90.2, source: 'manual' },
      { fromCurrency: 'GBP', toCurrency: 'INR', rate: 105.8, source: 'manual' },
    ]
  })

  // Get references
  const allCategories = await prisma.expenseCategory.findMany()
  const allVendors = await prisma.vendor.findMany()
  const allProjects = await prisma.project.findMany()
  const allCCs = await prisma.costCenter.findMany()
  const allPMs = await prisma.paymentMethod.findMany()

  const catMap = new Map(allCategories.map(c => [c.code, c.id]))
  const venMap = new Map(allVendors.map(v => [v.name, v.id]))
  const projMap = new Map(allProjects.map(p => [p.name, p.id]))
  const ccMap = new Map(allCCs.map(c => [c.name, c.id]))
  const pmMap = new Map(allPMs.map(p => [p.name, p.id]))

  // Demo Expenses
  const expenses = [
    // Software subscriptions
    { date: new Date(year, 0, 5), vendor: 'Microsoft India', cat: 'MICROSOFT', desc: 'Microsoft 365 Business Premium', amount: 18500, type: 'recurring', freq: 'yearly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 12), vendor: 'GitHub Inc', cat: 'GITHUB', desc: 'GitHub Team Subscription', amount: 48, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 15), vendor: 'Adobe Systems', cat: 'ADOBE', desc: 'Adobe Creative Cloud', amount: 4200, type: 'recurring', freq: 'monthly', recurring: true, project: 'Marketing', cc: 'Marketing', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 18), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 250, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 20), vendor: 'Anthropic', cat: 'ANTHROPIC', desc: 'Claude API Usage', amount: 180, type: 'recurring', freq: 'monthly', recurring: true, project: 'Vyom', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 22), vendor: 'Canva', cat: 'CANVA', desc: 'Canva Pro Team', amount: 120, type: 'recurring', freq: 'yearly', recurring: true, project: 'Marketing', cc: 'Marketing', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 25), vendor: 'Figma', cat: 'FIGMA', desc: 'Figma Professional', amount: 45, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Product', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 28), vendor: 'Notion Labs', cat: 'NOTION', desc: 'Notion Team Plan', amount: 96, type: 'recurring', freq: 'yearly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 3), vendor: 'Slack Technologies', cat: 'SLACK', desc: 'Slack Pro', amount: 87, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 8), vendor: 'Atlassian', cat: 'ATLASSIAN', desc: 'Jira + Confluence', amount: 75, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 10), vendor: 'Zoho Corporation', cat: 'OTHER_SAAS', desc: 'Zoho One Suite', amount: 8500, type: 'recurring', freq: 'yearly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 14), vendor: 'Tally Solutions', cat: 'OTHER_SAAS', desc: 'Tally Prime', amount: 18000, type: 'recurring', freq: 'yearly', recurring: true, project: 'Corporate', cc: 'Finance', pm: 'ICICI Bank Transfer', curr: 'INR' },

    // Cloud
    { date: new Date(year, 0, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 10), vendor: 'Google Cloud India', cat: 'GCP', desc: 'GCP Compute + Vertex AI', amount: 35000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 15), vendor: 'Google Cloud India', cat: 'GCP', desc: 'GCP Storage + BigQuery', amount: 18000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Vyom', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },

    // Hardware
    { date: new Date(year, 0, 8), vendor: 'NVIDIA India', cat: 'GPUS', desc: 'NVIDIA A100 40GB GPU x2', amount: 2800000, type: 'capex', freq: null, recurring: false, project: 'AI Infrastructure', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 12), vendor: 'Dell India', cat: 'COMPUTERS', desc: 'Dell Precision Workstations x3', amount: 450000, type: 'capex', freq: null, recurring: false, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 18), vendor: 'Lenovo India', cat: 'COMPUTERS', desc: 'ThinkPad P1 Gen 6 Laptops x2', amount: 320000, type: 'capex', freq: null, recurring: false, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 22), vendor: 'Dell India', cat: 'MONITORS', desc: 'Dell UltraSharp 27" Monitors x4', amount: 180000, type: 'capex', freq: null, recurring: false, project: 'Corporate', cc: 'Operations', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 25), vendor: 'NVIDIA India', cat: 'NETWORKING', desc: 'NVIDIA Networking Switches', amount: 145000, type: 'capex', freq: null, recurring: false, project: 'AI Infrastructure', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },

    // People
    { date: new Date(year, 0, 1), vendor: null, cat: 'SALARIES', desc: 'January Salaries', amount: 450000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 15), vendor: null, cat: 'CONTRACTORS', desc: 'AI Contractor - Model Training', amount: 120000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 20), vendor: null, cat: 'FREELANCERS', desc: 'Content Freelancer - Spandana', amount: 35000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Marketing', pm: 'Razorpay UPI', curr: 'INR' },

    // Operations
    { date: new Date(year, 0, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 10), vendor: 'Airtel Business', cat: 'INTERNET', desc: 'Enterprise Internet - 1Gbps', amount: 12500, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 12), vendor: 'Jio Business', cat: 'MOBILE', desc: 'Team Mobile Plans x8', amount: 6400, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 0, 15), vendor: 'GoDaddy India', cat: 'HOSTING', desc: 'Domain renewals + Hosting', amount: 18500, type: 'recurring', freq: 'yearly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'SBI Credit Card', curr: 'INR' },

    // Professional Services
    { date: new Date(year, 0, 5), vendor: null, cat: 'ACCOUNTING', desc: 'Monthly Accounting Retainer', amount: 25000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Finance', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 10), vendor: null, cat: 'LEGAL', desc: 'Legal Retainer - Contract Review', amount: 35000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Corporate', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 15), vendor: null, cat: 'COMPLIANCE', desc: 'ROC Compliance Filing', amount: 15000, type: 'one_time', freq: null, recurring: false, project: 'Corporate', cc: 'Corporate', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 20), vendor: null, cat: 'CS', desc: 'Company Secretary - Annual', amount: 45000, type: 'recurring', freq: 'yearly', recurring: true, project: 'Corporate', cc: 'Corporate', pm: 'ICICI Bank Transfer', curr: 'INR' },

    // Marketing
    { date: new Date(year, 0, 5), vendor: 'LinkedIn Marketing', cat: 'ADVERTISING', desc: 'LinkedIn Ads - Spandana Launch', amount: 850, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Marketing', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 10), vendor: 'Meta Ads', cat: 'ADVERTISING', desc: 'Meta Ads - Vyom Campaign', amount: 620, type: 'recurring', freq: 'monthly', recurring: true, project: 'Vyom', cc: 'Marketing', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 0, 15), vendor: null, cat: 'CONTENT', desc: 'Content Creation - Blog + Social', amount: 45000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Marketing', cc: 'Marketing', pm: 'Razorpay UPI', curr: 'INR' },
    { date: new Date(year, 0, 20), vendor: null, cat: 'EVENTS', desc: 'AI Conference Booth - Bangalore', amount: 125000, type: 'one_time', freq: null, recurring: false, project: 'Marketing', cc: 'Marketing', pm: 'ICICI Bank Transfer', curr: 'INR' },

    // Statutory
    { date: new Date(year, 0, 7), vendor: null, cat: 'GST_EXP', desc: 'GST Filing Fees', amount: 5000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Finance', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 0, 15), vendor: 'Razorpay', cat: 'BANKING_FEES', desc: 'Payment Gateway Charges', amount: 8500, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Finance', pm: 'Auto-deduct', curr: 'INR' },
    { date: new Date(year, 0, 25), vendor: null, cat: 'GOVT_FEES', desc: 'Professional Tax Payment', amount: 2500, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Corporate', pm: 'ICICI Bank Transfer', curr: 'INR' },

    // More months data (Feb-Jul)
    { date: new Date(year, 1, 1), vendor: null, cat: 'SALARIES', desc: 'February Salaries', amount: 450000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 1, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 92000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 1, 12), vendor: 'GitHub Inc', cat: 'GITHUB', desc: 'GitHub Team Subscription', amount: 48, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 1, 15), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 320, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 1, 18), vendor: 'Anthropic', cat: 'ANTHROPIC', desc: 'Claude API Usage', amount: 210, type: 'recurring', freq: 'monthly', recurring: true, project: 'Vyom', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 1, 20), vendor: 'Google Cloud India', cat: 'GCP', desc: 'GCP Compute + Vertex AI', amount: 38000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 1, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 1, 15), vendor: null, cat: 'CONTRACTORS', desc: 'AI Contractor - Model Training', amount: 120000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 1, 25), vendor: 'NVIDIA India', cat: 'GPUS', desc: 'NVIDIA H100 80GB GPU x1', amount: 1850000, type: 'capex', freq: null, recurring: false, project: 'AI Infrastructure', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },

    { date: new Date(year, 2, 1), vendor: null, cat: 'SALARIES', desc: 'March Salaries', amount: 475000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 2, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 98000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 2, 10), vendor: 'Google Cloud India', cat: 'GCP', desc: 'GCP Compute + Vertex AI', amount: 42000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 2, 15), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 380, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 2, 20), vendor: 'Dell India', cat: 'SERVERS', desc: 'Dell PowerEdge Server R760', amount: 650000, type: 'capex', freq: null, recurring: false, project: 'AI Infrastructure', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 2, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },

    { date: new Date(year, 3, 1), vendor: null, cat: 'SALARIES', desc: 'April Salaries', amount: 475000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 3, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 105000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 3, 12), vendor: 'GitHub Inc', cat: 'GITHUB', desc: 'GitHub Team Subscription', amount: 48, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 3, 15), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 420, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 3, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 3, 20), vendor: null, cat: 'TRAVEL', desc: 'Team offsite - Goa', amount: 125000, type: 'one_time', freq: null, recurring: false, project: 'Corporate', cc: 'Operations', pm: 'HDFC Corporate Card', curr: 'INR' },

    { date: new Date(year, 4, 1), vendor: null, cat: 'SALARIES', desc: 'May Salaries', amount: 500000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 4, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 112000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 4, 10), vendor: 'Google Cloud India', cat: 'GCP', desc: 'GCP Compute + Vertex AI', amount: 45000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 4, 15), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 480, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 4, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 4, 25), vendor: null, cat: 'TRAINING', desc: 'AI/ML Team Training - Upgrad', amount: 85000, type: 'one_time', freq: null, recurring: false, project: 'R&D', cc: 'R&D', pm: 'ICICI Bank Transfer', curr: 'INR' },

    { date: new Date(year, 5, 1), vendor: null, cat: 'SALARIES', desc: 'June Salaries', amount: 500000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 5, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 118000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 5, 15), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 520, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 5, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 5, 20), vendor: null, cat: 'RECRUITMENT', desc: 'Senior ML Engineer - Hiring', amount: 150000, type: 'one_time', freq: null, recurring: false, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },

    { date: new Date(year, 6, 1), vendor: null, cat: 'SALARIES', desc: 'July Salaries', amount: 525000, type: 'salary', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 6, 5), vendor: 'Amazon Web Services', cat: 'AWS', desc: 'AWS EC2 + S3 + RDS', amount: 125000, type: 'recurring', freq: 'monthly', recurring: true, project: 'AI Infrastructure', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 6, 10), vendor: 'Google Cloud India', cat: 'GCP', desc: 'GCP Compute + Vertex AI', amount: 48000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'Engineering', pm: 'HDFC Corporate Card', curr: 'INR' },
    { date: new Date(year, 6, 15), vendor: 'OpenAI', cat: 'OPENAI', desc: 'OpenAI API Credits', amount: 580, type: 'recurring', freq: 'monthly', recurring: true, project: 'Spandana', cc: 'R&D', pm: 'SBI Credit Card', curr: 'USD', rate: 83.5 },
    { date: new Date(year, 6, 5), vendor: 'WeWork India', cat: 'OFFICE', desc: 'Office Rent - WeWork MG Road', amount: 85000, type: 'recurring', freq: 'monthly', recurring: true, project: 'Corporate', cc: 'Operations', pm: 'ICICI Bank Transfer', curr: 'INR' },
    { date: new Date(year, 6, 25), vendor: 'NVIDIA India', cat: 'GPUS', desc: 'NVIDIA DGX Station A100', amount: 4500000, type: 'capex', freq: null, recurring: false, project: 'AI Infrastructure', cc: 'Engineering', pm: 'ICICI Bank Transfer', curr: 'INR' },
  ]

  let expenseSeq = 1
  for (const exp of expenses) {
    const vendorId = exp.vendor ? venMap.get(exp.vendor) : null
    const categoryId = catMap.get(exp.cat)
    const projectId = exp.project ? projMap.get(exp.project) : null
    const costCenterId = exp.cc ? ccMap.get(exp.cc) : null
    const paymentMethodId = exp.pm && exp.pm !== 'Auto-deduct' ? pmMap.get(exp.pm) : null

    const rate = exp.rate || 1
    const originalAmount = exp.amount
    const baseAmount = exp.curr === 'INR' ? originalAmount : Math.round(originalAmount * rate)

    // Calculate GST (18% for most services)
    const gstRate = 0.18
    const baseAmt = baseAmount / (1 + gstRate)
    const gstAmt = baseAmount - baseAmt

    await prisma.expense.create({
      data: {
        expenseId: generateId('EXP', year, expenseSeq++),
        expenseDate: exp.date,
        vendorId,
        description: exp.desc,
        categoryId: categoryId!,
        expenseType: exp.type,
        baseAmount: baseAmt,
        gstAmount: gstAmt,
        cgstAmount: gstAmt / 2,
        sgstAmount: gstAmt / 2,
        igstAmount: 0,
        totalAmount: baseAmount,
        originalCurrency: exp.curr,
        originalAmount,
        exchangeRate: rate,
        baseCurrency: 'INR',
        baseCurrencyAmount: baseAmount,
        paymentMethodId,
        paidBy: 'Finance Team',
        businessPurpose: exp.desc,
        projectId,
        costCenterId,
        isRecurring: exp.recurring,
        frequency: exp.freq,
        startDate: exp.recurring ? exp.date : null,
        nextDueDate: exp.recurring ? addMonths(exp.date, exp.freq === 'monthly' ? 1 : exp.freq === 'yearly' ? 12 : 1) : null,
        taxDeductible: true,
        gstInputCredit: 'yes',
        isCapitalExpense: exp.type === 'capex',
        status: 'active',
        notes: 'DEMO DATA - Generated for testing',
      }
    })
  }

  // Subscriptions
  const subs = [
    { id: 'SUB-2026-000001', vendor: 'Microsoft India', product: 'Microsoft 365 Business Premium', cost: 18500, cycle: 'yearly', start: new Date(year, 0, 5), next: new Date(year+1, 0, 5), project: 'Corporate' },
    { id: 'SUB-2026-000002', vendor: 'GitHub Inc', product: 'GitHub Team', cost: 4008, cycle: 'yearly', start: new Date(year, 0, 12), next: new Date(year+1, 0, 12), project: 'Corporate' },
    { id: 'SUB-2026-000003', vendor: 'Adobe Systems', product: 'Adobe Creative Cloud', cost: 50400, cycle: 'yearly', start: new Date(year, 0, 15), next: new Date(year+1, 0, 15), project: 'Marketing' },
    { id: 'SUB-2026-000004', vendor: 'OpenAI', product: 'OpenAI API Credits', cost: 250200, cycle: 'yearly', start: new Date(year, 0, 18), next: new Date(year+1, 0, 18), project: 'Spandana' },
    { id: 'SUB-2026-000005', vendor: 'Anthropic', product: 'Claude API', cost: 180180, cycle: 'yearly', start: new Date(year, 0, 20), next: new Date(year+1, 0, 20), project: 'Vyom' },
    { id: 'SUB-2026-000006', vendor: 'Canva', product: 'Canva Pro Team', cost: 10020, cycle: 'yearly', start: new Date(year, 0, 22), next: new Date(year+1, 0, 22), project: 'Marketing' },
    { id: 'SUB-2026-000007', vendor: 'Figma', product: 'Figma Professional', cost: 45075, cycle: 'yearly', start: new Date(year, 0, 25), next: new Date(year+1, 0, 25), project: 'Corporate' },
    { id: 'SUB-2026-000008', vendor: 'Notion Labs', product: 'Notion Team', cost: 8016, cycle: 'yearly', start: new Date(year, 0, 28), next: new Date(year+1, 0, 28), project: 'Corporate' },
    { id: 'SUB-2026-000009', vendor: 'Slack Technologies', product: 'Slack Pro', cost: 72645, cycle: 'yearly', start: new Date(year, 0, 3), next: new Date(year+1, 0, 3), project: 'Corporate' },
    { id: 'SUB-2026-000010', vendor: 'Atlassian', product: 'Jira + Confluence', cost: 62625, cycle: 'yearly', start: new Date(year, 0, 8), next: new Date(year+1, 0, 8), project: 'Corporate' },
    { id: 'SUB-2026-000011', vendor: 'Zoho Corporation', product: 'Zoho One', cost: 8500, cycle: 'yearly', start: new Date(year, 0, 10), next: new Date(year+1, 0, 10), project: 'Corporate' },
    { id: 'SUB-2026-000012', vendor: 'GoDaddy India', product: 'Domains + Hosting', cost: 18500, cycle: 'yearly', start: new Date(year, 0, 15), next: new Date(year+1, 0, 15), project: 'Corporate' },
    { id: 'SUB-2026-000013', vendor: 'Amazon Web Services', product: 'AWS Infrastructure', cost: 1200000, cycle: 'yearly', start: new Date(year, 0, 5), next: new Date(year+1, 0, 5), project: 'AI Infrastructure' },
    { id: 'SUB-2026-000014', vendor: 'Google Cloud India', product: 'GCP Services', cost: 756000, cycle: 'yearly', start: new Date(year, 0, 10), next: new Date(year+1, 0, 10), project: 'Spandana' },
    { id: 'SUB-2026-000015', vendor: 'LinkedIn Marketing', product: 'LinkedIn Ads', cost: 850170, cycle: 'yearly', start: new Date(year, 0, 5), next: new Date(year+1, 0, 5), project: 'Spandana' },
    { id: 'SUB-2026-000016', vendor: 'Meta Ads', product: 'Meta Advertising', cost: 620310, cycle: 'yearly', start: new Date(year, 0, 10), next: new Date(year+1, 0, 10), project: 'Vyom' },
  ]

  for (const sub of subs) {
    await prisma.subscription.create({
      data: {
        subscriptionId: sub.id,
        vendorId: venMap.get(sub.vendor)!,
        productName: sub.product,
        cost: sub.cost,
        currency: 'INR',
        billingCycle: sub.cycle,
        startDate: sub.start,
        nextBillingDate: sub.next,
        autoRenewal: true,
        status: 'active',
        notes: 'DEMO DATA',
      }
    })
  }

  // Employees
  const employees = [
    { id: 'EMP-000001', name: 'Rahul Sharma', role: 'CEO & Co-Founder', dept: 'Corporate', type: 'full_time', monthly: 150000, start: new Date(2024, 3, 1) },
    { id: 'EMP-000002', name: 'Priya Patel', role: 'CTO & Co-Founder', dept: 'Engineering', type: 'full_time', monthly: 150000, start: new Date(2024, 3, 1) },
    { id: 'EMP-000003', name: 'Arun Kumar', role: 'Lead ML Engineer', dept: 'Engineering', type: 'full_time', monthly: 120000, start: new Date(2024, 5, 15) },
    { id: 'EMP-000004', name: 'Sneha Gupta', role: 'Senior Backend Engineer', dept: 'Engineering', type: 'full_time', monthly: 95000, start: new Date(2024, 6, 1) },
    { id: 'EMP-000005', name: 'Vikram Rao', role: 'Frontend Engineer', dept: 'Engineering', type: 'full_time', monthly: 75000, start: new Date(2024, 8, 10) },
    { id: 'EMP-000006', name: 'Ananya Reddy', role: 'Product Manager', dept: 'Product', type: 'full_time', monthly: 85000, start: new Date(2024, 7, 1) },
    { id: 'EMP-000007', name: 'Karthik Iyer', role: 'AI Contractor', dept: 'R&D', type: 'contractor', monthly: 120000, start: new Date(2025, 0, 1) },
    { id: 'EMP-000008', name: 'Meera Nair', role: 'Content Strategist', dept: 'Marketing', type: 'freelancer', monthly: 35000, start: new Date(2025, 0, 1) },
  ]

  for (const emp of employees) {
    await prisma.employee.create({
      data: {
        employeeId: emp.id,
        name: emp.name,
        role: emp.role,
        department: emp.dept,
        employmentType: emp.type,
        monthlyCost: emp.monthly,
        annualCost: emp.monthly * 12,
        startDate: emp.start,
        status: 'active',
        notes: 'DEMO DATA',
      }
    })
  }

  // Assets
  const assets = [
    { id: 'AST-2026-000001', name: 'NVIDIA A100 40GB', type: 'gpu', cost: 2800000, vendor: 'NVIDIA India', date: new Date(year, 0, 8), status: 'assigned', assignee: 'Arun Kumar', loc: 'Bangalore Office' },
    { id: 'AST-2026-000002', name: 'NVIDIA A100 40GB', type: 'gpu', cost: 2800000, vendor: 'NVIDIA India', date: new Date(year, 0, 8), status: 'assigned', assignee: 'Priya Patel', loc: 'Bangalore Office' },
    { id: 'AST-2026-000003', name: 'Dell Precision 7865', type: 'computer', cost: 150000, vendor: 'Dell India', date: new Date(year, 0, 12), status: 'assigned', assignee: 'Rahul Sharma', loc: 'Bangalore Office' },
    { id: 'AST-2026-000004', name: 'Dell Precision 7865', type: 'computer', cost: 150000, vendor: 'Dell India', date: new Date(year, 0, 12), status: 'assigned', assignee: 'Priya Patel', loc: 'Bangalore Office' },
    { id: 'AST-2026-000005', name: 'Dell Precision 7865', type: 'computer', cost: 150000, vendor: 'Dell India', date: new Date(year, 0, 12), status: 'assigned', assignee: 'Arun Kumar', loc: 'Bangalore Office' },
    { id: 'AST-2026-000006', name: 'ThinkPad P1 Gen 6', type: 'computer', cost: 160000, vendor: 'Lenovo India', date: new Date(year, 0, 18), status: 'assigned', assignee: 'Sneha Gupta', loc: 'Bangalore Office' },
    { id: 'AST-2026-000007', name: 'ThinkPad P1 Gen 6', type: 'computer', cost: 160000, vendor: 'Lenovo India', date: new Date(year, 0, 18), status: 'assigned', assignee: 'Vikram Rao', loc: 'Bangalore Office' },
    { id: 'AST-2026-000008', name: 'Dell UltraSharp U2723QE', type: 'peripheral', cost: 45000, vendor: 'Dell India', date: new Date(year, 0, 22), status: 'assigned', assignee: 'Rahul Sharma', loc: 'Bangalore Office' },
    { id: 'AST-2026-000009', name: 'Dell UltraSharp U2723QE', type: 'peripheral', cost: 45000, vendor: 'Dell India', date: new Date(year, 0, 22), status: 'assigned', assignee: 'Priya Patel', loc: 'Bangalore Office' },
    { id: 'AST-2026-000010', name: 'Dell UltraSharp U2723QE', type: 'peripheral', cost: 45000, vendor: 'Dell India', date: new Date(year, 0, 22), status: 'assigned', assignee: 'Arun Kumar', loc: 'Bangalore Office' },
    { id: 'AST-2026-000011', name: 'Dell UltraSharp U2723QE', type: 'peripheral', cost: 45000, vendor: 'Dell India', date: new Date(year, 0, 22), status: 'assigned', assignee: 'Sneha Gupta', loc: 'Bangalore Office' },
    { id: 'AST-2026-000012', name: 'NVIDIA H100 80GB', type: 'gpu', cost: 1850000, vendor: 'NVIDIA India', date: new Date(year, 1, 25), status: 'assigned', assignee: 'ML Team', loc: 'Data Center' },
    { id: 'AST-2026-000013', name: 'Dell PowerEdge R760', type: 'server', cost: 650000, vendor: 'Dell India', date: new Date(year, 2, 20), status: 'assigned', assignee: 'Infrastructure Team', loc: 'Data Center' },
    { id: 'AST-2026-000014', name: 'NVIDIA DGX Station A100', type: 'gpu', cost: 4500000, vendor: 'NVIDIA India', date: new Date(year, 6, 25), status: 'in_stock', assignee: null, loc: 'Data Center' },
  ]

  for (const asset of assets) {
    await prisma.asset.create({
      data: {
        assetId: asset.id,
        name: asset.name,
        assetType: asset.type,
        purchaseCost: asset.cost,
        vendorId: venMap.get(asset.vendor)!,
        purchaseDate: asset.date,
        status: asset.status,
        assignedTo: asset.assignee,
        location: asset.loc,
        notes: 'DEMO DATA',
      }
    })
  }

  // Budgets
  const budgets = [
    { name: 'Software Budget', cat: 'SOFTWARE', amount: 50000, period: 'monthly' },
    { name: 'Cloud Infrastructure', cat: 'CLOUD', amount: 150000, period: 'monthly' },
    { name: 'Marketing Budget', cat: 'MARKETING', amount: 100000, period: 'monthly' },
    { name: 'People Costs', cat: 'PEOPLE', amount: 600000, period: 'monthly' },
    { name: 'Hardware CapEx', cat: 'HARDWARE', amount: 500000, period: 'quarterly' },
  ]

  for (const b of budgets) {
    await prisma.budget.create({
      data: {
        name: b.name,
        categoryId: catMap.get(b.cat),
        amount: b.amount,
        period: b.period,
        startDate: new Date(year, 0, 1),
        warningThreshold: 80,
        isActive: true,
      }
    })
  }

  // Audit logs
  await prisma.auditLog.create({
    data: {
      action: 'create',
      entityType: 'settings',
      entityId: '1',
      newValue: JSON.stringify({ companyName: 'Teinco-X Workspace' }),
      createdAt: new Date(),
    }
  })

  console.log('✓ Demo data seeded successfully')
}
