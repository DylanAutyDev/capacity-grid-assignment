import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CapacityGrid } from './CapacityGrid'

const payload = {
  from: '2025-12-29',
  to: '2026-01-16',
  weeks: [
    { start: '2025-12-29', end: '2026-01-04' },
    { start: '2026-01-05', end: '2026-01-11' },
    { start: '2026-01-12', end: '2026-01-18' },
  ],
  people: [
    {
      id: 1,
      name: 'Ana Ferreira',
      weeklyHours: 40,
      allocations: { '2025-12-29': 8, '2026-01-12': 6 },
    },
    {
      id: 5,
      name: 'Eli Nakamura',
      weeklyHours: 0,
      allocations: { '2026-01-05': 4 },
    },
  ],
}

function mockFetch(ok = true, response: unknown = payload) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: async () => response,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CapacityGrid', () => {
  it('renders people, week columns and allocation cells', async () => {
    mockFetch()
    render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)

    await waitFor(() => expect(screen.getAllByText('Ana Ferreira').length).toBeGreaterThan(0))
    expect(screen.getByText('Week 1')).toBeInTheDocument()
    expect(screen.getByText('29 Dec 2025')).toBeInTheDocument()
    expect(screen.getByText('Eli Nakamura')).toBeInTheDocument()
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
  })

  it('filters people by name search', async () => {
    mockFetch()
    render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)

    await waitFor(() => expect(screen.getAllByText('Ana Ferreira').length).toBeGreaterThan(0))
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'eli' } })

    await waitFor(() => expect(screen.queryByText('Ana Ferreira')).not.toBeInTheDocument())
    expect(screen.getByText('Eli Nakamura')).toBeInTheDocument()
  })

  it('filters to only over-capacity people when checked', async () => {
    mockFetch()
    render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)

    await waitFor(() => expect(screen.getAllByText('Ana Ferreira').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByLabelText('Only over capacity'))

    await waitFor(() => expect(screen.queryByText('Ana Ferreira')).not.toBeInTheDocument())
    expect(screen.getByText('Eli Nakamura')).toBeInTheDocument()
  })

  it('shows a fix action when the range is inverted and recovers when applied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<CapacityGrid from="2026-01-16" to="2025-12-29" />)

    await waitFor(() =>
      expect(screen.getByText(/The 'from' date is after the 'to' date/)).toBeInTheDocument(),
    )
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("Move 'to' after 'from'"))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/capacity?from=2026-01-16&to=2026-02-13')
  })

  it('shows a retry toast and rolls back when a save fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<CapacityGrid from="2025-12-29" to="2026-01-16" />)

    await waitFor(() => expect(screen.getAllByText('Ana Ferreira').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByTitle("Edit Ana Ferreira's weekly hours"))
    const input = screen.getByLabelText('Weekly hours for Ana Ferreira')
    fireEvent.change(input, { target: { value: '36' } })
    fireEvent.blur(input)

    await waitFor(() => expect(screen.getByText(/Couldn't save/)).toBeInTheDocument())
    expect(screen.getByText('Retry')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTitle("Edit Ana Ferreira's weekly hours")).toHaveTextContent('40h/w'),
    )
  })
})
