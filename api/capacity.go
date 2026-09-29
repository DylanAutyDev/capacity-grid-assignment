package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

const maxRangeDays = 366 * 2

type weekSlot struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type personCapacity struct {
	ID          int               `json:"id"`
	Name        string            `json:"name"`
	WeeklyHours float64           `json:"weeklyHours"`
	Allocations map[string]float64 `json:"allocations"`
}

type capacityResponse struct {
	From   string           `json:"from"`
	To     string           `json:"to"`
	Weeks  []weekSlot       `json:"weeks"`
	People []personCapacity `json:"people"`
}

type allocationRow struct {
	PersonID int
	Week     time.Time
	Hours    float64
}

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD.
//
// For every person and every week overlapping [from, to], it returns how
// many hours they are allocated and how much weekly capacity they have.
//
// Semantics:
//   - Weeks run Monday to Sunday.
//   - An assignment contributes hours_per_day for each Mon-Fri that falls
//     inside both the assignment's dates and the week; hours are prorated
//     against the assignment's total working days so long assignments split
//     fairly across weeks.
//   - Every person in the roster is returned, even with zero allocations.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	from, err := parseDate(r.URL.Query().Get("from"))
	if err != nil {
		http.Error(w, "invalid 'from' date, want YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	to, err := parseDate(r.URL.Query().Get("to"))
	if err != nil {
		http.Error(w, "invalid 'to' date, want YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if to.Before(from) {
		http.Error(w, "'to' must not be before 'from'", http.StatusBadRequest)
		return
	}
	if to.Sub(from) > maxRangeDays*24*time.Hour {
		http.Error(w, "range too large (max 2 years)", http.StatusBadRequest)
		return
	}

	first := startOfWeek(from)
	last := startOfWeek(to)

	rows, err := s.db.Query(r.Context(), `
		SELECT a.person_id, w.week, w.hours
		FROM assignments a
		JOIN LATERAL (
			SELECT w.week, SUM(a.hours_per_day * w.workdays / total.workdays) AS hours
			FROM (
				SELECT week::date AS week,
				       COUNT(*) FILTER (WHERE d >= a.start_date AND d <= a.end_date) AS workdays
				FROM generate_series(
					date_trunc('week', $1::date)::date,
					date_trunc('week', $2::date)::date,
					interval '1 week'
				) AS week,
				LATERAL generate_series(
					week::date,
					week::date + interval '6 days',
					interval '1 day'
				) AS d
				WHERE EXTRACT(ISODOW FROM d) < 6
				  AND d >= a.start_date
				  AND d <= a.end_date
				GROUP BY week
			) w,
			LATERAL (
				SELECT COUNT(*) AS workdays
				FROM generate_series(a.start_date, a.end_date, interval '1 day') AS d
				WHERE EXTRACT(ISODOW FROM d) < 6
			) total
			WHERE w.workdays > 0
			GROUP BY w.week, total.workdays
		) w ON TRUE
		WHERE a.start_date <= $2 AND a.end_date >= $1
		ORDER BY a.person_id, w.week`,
		from, to,
	)
	if err != nil {
		log.Printf("capacity query: %v", err)
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type alloc struct {
		week  time.Time
		hours float64
	}
	byPerson := map[int][]alloc{}
	for rows.Next() {
		var r allocationRow
		if err := rows.Scan(&r.PersonID, &r.Week, &r.Hours); err != nil {
			log.Printf("capacity scan: %v", err)
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		byPerson[r.PersonID] = append(byPerson[r.PersonID], alloc{r.Week, r.Hours})
	}
	if err := rows.Err(); err != nil {
		log.Printf("capacity rows: %v", err)
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}

	peopleRows, err := s.db.Query(r.Context(), `
		SELECT id, name, weekly_hours FROM people ORDER BY name`,
	)
	if err != nil {
		log.Printf("people query: %v", err)
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer peopleRows.Close()

	var resp capacityResponse
	resp.From = from.Format("2006-01-02")
	resp.To = to.Format("2006-01-02")
	for w := first; !w.After(last); w = w.AddDate(0, 0, 7) {
		resp.Weeks = append(resp.Weeks, weekSlot{
			Start: w.Format("2006-01-02"),
			End:   w.AddDate(0, 0, 6).Format("2006-01-02"),
		})
	}

	for peopleRows.Next() {
		var p personCapacity
		if err := peopleRows.Scan(&p.ID, &p.Name, &p.WeeklyHours); err != nil {
			log.Printf("people scan: %v", err)
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		p.Allocations = map[string]float64{}
		for _, a := range byPerson[p.ID] {
			key := a.week.Format("2006-01-02")
			p.Allocations[key] += a.hours
		}
		for k := range p.Allocations {
			p.Allocations[k] = round2(p.Allocations[k])
		}
		resp.People = append(resp.People, p)
	}
	if err := peopleRows.Err(); err != nil {
		log.Printf("people rows: %v", err)
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("capacity encode: %v", err)
	}
}

func parseDate(s string) (time.Time, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date %q", s)
	}
	return t, nil
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

func startOfWeek(t time.Time) time.Time {
	d := t.Weekday()
	if d == time.Sunday {
		d = 7
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).AddDate(0, 0, -int(d)+1)
}
