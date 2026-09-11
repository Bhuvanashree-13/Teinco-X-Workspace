export const colors = { primary: '#315CF3', accent: '#4169F7', ink: '#101828', muted: '#667085', subtle: '#98A2B3', background: '#F7F8FC', surface: '#FFFFFF', border: '#EAECF0', success: '#12A06A', danger: '#D64555', softBlue: '#EEF2FF', softGreen: '#EAFBF3', amber: '#B26A11' }
export const currency = (value: number, code = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value) || 0) }
  catch { return `${code} ${(Number(value) || 0).toFixed(2)}` }
}
export const shortDate = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not scheduled'
