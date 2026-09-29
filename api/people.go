package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

// handleUpdatePerson serves PATCH /api/people/{id}.
//
// Body: {"weeklyHours": 32}. Weekly hours must be a finite number >= 0 and
// <= 168. Returns the updated person; 404 if the id doesn't exist.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		http.Error(w, "invalid person id", http.StatusBadRequest)
		return
	}

	var body struct {
		WeeklyHours *float64 `json:"weeklyHours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if body.WeeklyHours == nil {
		http.Error(w, "weeklyHours is required", http.StatusBadRequest)
		return
	}
	if *body.WeeklyHours < 0 || *body.WeeklyHours > 168 {
		http.Error(w, "weeklyHours must be between 0 and 168", http.StatusBadRequest)
		return
	}

	var name string
	var weeklyHours float64
	err = s.db.QueryRow(r.Context(), `
		UPDATE people SET weekly_hours = $2 WHERE id = $1
		RETURNING name, weekly_hours`,
		id, *body.WeeklyHours,
	).Scan(&name, &weeklyHours)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "person not found", http.StatusNotFound)
			return
		}
		log.Printf("update person %d: %v", id, err)
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":          id,
		"name":        name,
		"weeklyHours": weeklyHours,
	})
}
