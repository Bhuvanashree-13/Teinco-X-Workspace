export const colors = { primary: '#173B64', accent: '#3278E6', ink: '#14283F', muted: '#697C91', subtle: '#9AAABD', background: '#F4F7FB', surface: '#FFFFFF', border: '#E2E9F2', success: '#12816F', danger: '#CB4251', softBlue: '#EAF1FF', softGreen: '#E6F5EE', amber: '#AC6B16' }
export const currency = (value: number, code = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value) || 0) }
  catch { return `${code} ${(Number(value) || 0).toFixed(2)}` }
}
export const shortDate = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not scheduled'
