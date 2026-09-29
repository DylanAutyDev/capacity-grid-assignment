import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatHours,
  formatWeekStart,
  isOverAllocated,
  isRangeInverted,
  isoWeekNumber,
  nextWeek,
  parseWeeklyHoursInput,
  previousWeek,
} from './capacity'

describe('week navigation', () => {
  it('moves a whole week backward', () => {
    expect(previousWeek('2025-12-29', '2026-01-16')).toEqual({
      from: '2025-12-22',
      to: '2026-01-09',
    })
  })

  it('moves a whole week forward across a month boundary', () => {
    expect(nextWeek('2025-12-29', '2026-01-16')).toEqual({
      from: '2026-01-05',
      to: '2026-01-23',
    })
  })

  it('addDays crosses year and leap boundaries', () => {
    expect(addDays('2026-02-25', 7)).toBe('2026-03-04')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('detects an inverted range', () => {
    expect(isRangeInverted('2026-01-16', '2025-12-29')).toBe(true)
    expect(isRangeInverted('2025-12-29', '2026-01-16')).toBe(false)
    expect(isRangeInverted('2026-01-16', '2026-01-16')).toBe(false)
  })

  it('formats week start labels for headers', () => {
    expect(formatWeekStart('2025-12-29')).toBe('29 Dec 2025')
    expect(formatWeekStart('2026-01-05')).toBe('5 Jan 2026')
  })

  it('computes ISO week numbers', () => {
    expect(isoWeekNumber('2025-12-29')).toBe(1)
    expect(isoWeekNumber('2026-01-05')).toBe(2)
    expect(isoWeekNumber('2026-01-12')).toBe(3)
  })
})

describe('allocation display', () => {
  it('flags over-allocation only when allocated exceeds capacity', () => {
    expect(isOverAllocated(41, 40)).toBe(true)
    expect(isOverAllocated(40, 40)).toBe(false)
    expect(isOverAllocated(4, 0)).toBe(true)
    expect(isOverAllocated(0, 0)).toBe(false)
  })

  it('formats fractional hours without floating point noise', () => {
    expect(formatHours(8)).toBe('8')
    expect(formatHours(1.25)).toBe('1.25')
    expect(formatHours(2.666666666666)).toBe('2.67')
  })
})

describe('weekly hours input', () => {
  it('accepts plain numbers and rejects garbage', () => {
    expect(parseWeeklyHoursInput('32')).toBe(32)
    expect(parseWeeklyHoursInput('36.5')).toBe(36.5)
    expect(parseWeeklyHoursInput('abc')).toBeNull()
    expect(parseWeeklyHoursInput('')).toBeNull()
  })

  it('rejects out-of-range and negative values', () => {
    expect(parseWeeklyHoursInput('-1')).toBeNull()
    expect(parseWeeklyHoursInput('169')).toBeNull()
    expect(parseWeeklyHoursInput('0')).toBe(0)
  })
})
