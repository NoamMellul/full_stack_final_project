# Phase 3: Doctor Discovery — Search & Public Profiles

**Goal**: Patients can find a doctor matching their criteria and review enough public information to decide whether to book, entirely from patient-facing pages.

**Depends on**: Phase 2

**Requirements covered**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08, SEARCH-09, PROFILE-01, PROFILE-02, PROFILE-03

## Tasks

### 1. `GET /api/doctors` — search endpoint
- [ ] Query params: `q` (name), `specialty`, `language`, `neighborhood`, `availableFrom`
- [ ] Combine filters with AND logic
- [ ] Join `doctors` with `specialties`, `locations`, `doctor_languages`/`languages`
- [ ] Subquery/join to compute each doctor's next available slot (`availability_slots` where `status = 'available'` and `start_at > now()`, `ORDER BY start_at LIMIT 1`)
- [ ] Sort results by soonest next available slot
- [ ] Only return doctors with `is_active = true`
- [ ] Pagination (limit/offset)

### 2. `GET /api/doctors/[id]` — public profile endpoint
- [ ] Return doctor details, specialty, location, languages, photo, bio, `is_demo` flag
- [ ] Return the doctor's upcoming available slots (next N days)

### 3. `/search` page
- [ ] Filter form: name, specialty (select), language (select), neighborhood (select), availability (date/range picker)
- [ ] Results list: doctor card with photo, name, specialty, neighborhood, next available slot
- [ ] Empty state: clear "no doctor found" message
- [ ] Loading state while fetching

### 4. `/doctors/[id]` page
- [ ] Full profile display (photo, bio, specialty, address, neighborhood, languages)
- [ ] Visible "demo profile" badge
- [ ] List of upcoming available slots, grouped by day, displayed in `Asia/Jerusalem` time
- [ ] "Book" call-to-action per slot (wired up in Phase 5)

## Playwright Tests

- [ ] Search by name
- [ ] Filter by specialty alone
- [ ] Filter by language (Hebrew/English)
- [ ] Filter by neighborhood
- [ ] Filter by availability
- [ ] Combination of multiple filters
- [ ] Search with no results
- [ ] Results correctly sorted by soonest availability
- [ ] "Demo profile" badge visible on the profile page
