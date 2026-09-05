export const colors = { primary: '#1E3A8A', accent: '#2563EB', ink: '#111827', muted: '#6B7280', subtle: '#94A3B8', background: '#F5F7FB', surface: '#FFFFFF', border: '#E5E7EB', success: '#059669', danger: '#DC2626', softBlue: '#EFF6FF' }
export const currency = (value: number, code = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value || 0)
export const shortDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not scheduled'
