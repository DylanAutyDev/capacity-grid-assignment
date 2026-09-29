import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  addDays,
  formatHours,
  formatWeekStart,
  isOverAllocated,
  isRangeInverted,
  parseWeeklyHoursInput,
  type CapacityResponse,
  type Person,
} from './capacity'

type Props = {
  from: string
  to: string
}

type Toast = {
  id: number
  personId: number
  name: string
  desired: number
  message: string
  canRetry: boolean
}

let toastSeq = 0

type LoadError = {
  message: string
  fixable: boolean
}

export function CapacityGrid({ from, to }: Props) {
  const [range, setRange] = useState({ from, to })
  const [weeks, setWeeks] = useState<string[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<LoadError | null>(null)
  const [editing, setEditing] = useState<{ personId: number; draft: string } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    if (isRangeInverted(range.from, range.to)) {
      setLoading(false)
      setLoadError({
        message: "The 'from' date is after the 'to' date.",
        fixable: true,
      })
      return
    }

    const url = `/api/capacity?from=${range.from}&to=${range.to}`
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          return res.text().then((body) => {
            throw new Error(body || `request failed (${res.status})`)
          })
        }
        return res.json() as Promise<CapacityResponse>
      })
      .then((data) => {
        if (cancelled) return
        setWeeks(data.weeks.map((w) => w.start))
        setPeople(data.people)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError({
          message: err instanceof Error ? err.message : 'request failed',
          fixable: false,
        })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, reloadKey])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = (p: Person) => {
    setEditing({ personId: p.id, draft: String(p.weeklyHours) })
  }

  const cancelEditing = () => setEditing(null)

  const saveWeeklyHours = useCallback(
    (personId: number, desired: number) => {
      const before = people.find((p) => p.id === personId)?.weeklyHours
      setPeople((prev) =>
        prev.map((p) => (p.id === personId ? { ...p, weeklyHours: desired } : p)),
      )
      fetch(`/api/people/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyHours: desired }),
      }).then((res) => {
        if (!res.ok) {
          setPeople((prev) =>
            prev.map((p) =>
              p.id === personId && p.weeklyHours === desired
                ? { ...p, weeklyHours: before ?? desired }
                : p,
            ),
          )
          const name = people.find((p) => p.id === personId)?.name ?? `Person ${personId}`
          setToast({
            id: ++toastSeq,
            personId,
            name,
            desired,
            message: `Couldn't save ${name}'s weekly hours.`,
            canRetry: true,
          })
        } else {
          setToast(null)
        }
      })
      .catch(() => {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === personId && p.weeklyHours === desired
              ? { ...p, weeklyHours: before ?? desired }
              : p,
          ),
        )
        const name = people.find((p) => p.id === personId)?.name ?? `Person ${personId}`
        setToast({
          id: ++toastSeq,
          personId,
          name,
          desired,
          message: `Couldn't save ${name}'s weekly hours.`,
          canRetry: true,
        })
      })
    },
    [people],
  )

  const commitEditing = () => {
    if (!editing) return
    const value = parseWeeklyHoursInput(editing.draft)
    if (value === null) {
      setToast({
        id: ++toastSeq,
        personId: editing.personId,
        name: people.find((p) => p.id === editing.personId)?.name ?? 'Person',
        desired: 0,
        message: 'Weekly hours must be a number between 0 and 168.',
        canRetry: false,
      })
      setEditing(null)
      return
    }
    setEditing(null)
    saveWeeklyHours(editing.personId, value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitEditing()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const moveBy = (days: number) => {
    setRange((r) => ({
      from: addDays(r.from, days),
      to: addDays(r.to, days),
    }))
  }

  return (
    <div className="grid-wrap">
      <div className="grid-toolbar">
        <button type="button" onClick={() => moveBy(-7)}>
          ← Prev week
        </button>
        <label>
          From{' '}
          <input
            type="date"
            value={range.from}
            onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            value={range.to}
            onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <button type="button" onClick={() => moveBy(7)}>
          Next week →
        </button>
      </div>

      {loadError && (
        <p className="notice notice-error">
          {loadError.message}{' '}
          {loadError.fixable ? (
            <button
              type="button"
              onClick={() => {
                setLoadError(null)
                setRange((r) => ({ ...r, to: addDays(r.from, 28) }))
              }}
            >
              Move 'to' after 'from'
            </button>
          ) : (
            <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          )}
        </p>
      )}
      {loading && <p className="notice">Loading…</p>}

      {!loading && !loadError && (
        <table className="capacity-grid">
          <thead>
            <tr>
              <th className="sticky-col sticky-head">Person</th>
              {weeks.map((w) => (
                <th key={w} title={`${w} to ${addDays(w, 6)}`}>
                  w/c {formatWeekStart(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="sticky-col person-cell">
                  <span className="person-name">{p.name}</span>
                  {editing?.personId === p.id ? (
                    <input
                      ref={inputRef}
                      className="hours-input"
                      type="number"
                      min={0}
                      max={168}
                      step="any"
                      value={editing.draft}
                      onChange={(e) =>
                        setEditing({ personId: p.id, draft: e.target.value })
                      }
                      onBlur={commitEditing}
                      onKeyDown={onKeyDown}
                      aria-label={`Weekly hours for ${p.name}`}
                    />
                  ) : (
                    <button
                      type="button"
                      className="hours-button"
                      onClick={() => startEditing(p)}
                      title={`Edit ${p.name}'s weekly hours`}
                    >
                      {formatHours(p.weeklyHours)}h/w
                    </button>
                  )}
                </th>
                {weeks.map((w) => {
                  const allocated = p.allocations[w] ?? 0
                  const over = isOverAllocated(allocated, p.weeklyHours)
                  return (
                    <td key={w} className={over ? 'cell-over' : ''}>
                      <span className="cell-alloc">{formatHours(allocated)}</span>
                      <span className="cell-cap">/ {formatHours(p.weeklyHours)}</span>
                      {over && <span className="over-badge" title="Over allocated">▲</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {toast && (
        <div className="toast" role="alert">
          <span>{toast.message}</span>
          {toast.canRetry && (
            <button
              type="button"
              className="toast-retry"
              onClick={() => {
                setToast(null)
                saveWeeklyHours(toast.personId, toast.desired)
              }}
            >
              Retry
            </button>
          )}
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
