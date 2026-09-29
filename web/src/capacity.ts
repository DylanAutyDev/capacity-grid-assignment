export type Person = {
  id: number
  name: string
  weeklyHours: number
  allocations: Record<string, number>
}

export type Week = {
  start: string
  end: string
}

export type CapacityResponse = {
  from: string
  to: string
  weeks: Week[]
  people: Person[]
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return formatISODate(d)
}

export function formatWeekStart(iso: string): string {
  const d = parseISODate(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isoWeekNumber(iso: string): number {
  const d = parseISODate(iso)
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function isRangeInverted(from: string, to: string): boolean {
  return parseISODate(from).getTime() > parseISODate(to).getTime()
}

export function previousWeek(from: string, to: string): { from: string; to: string } {
  return { from: addDays(from, -7), to: addDays(to, -7) }
}

export function nextWeek(from: string, to: string): { from: string; to: string } {
  return { from: addDays(from, 7), to: addDays(to, 7) }
}

export function formatHours(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export function isOverAllocated(allocated: number, weeklyHours: number): boolean {
  return allocated > weeklyHours
}

export function parseWeeklyHoursInput(raw: string): number | null {
  const v = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(v) || v < 0 || v > 168) {
    return null
  }
  return Math.round(v * 100) / 100
}
