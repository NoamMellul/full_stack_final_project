# Phase 6: Dashboards, Notifications & Localization

**Goal**: Patients and doctors have a personalized home base summarizing their activity with real-time in-app updates, favorites, and the entire interface is fully usable in either Hebrew or English with correct RTL mirroring.

**Depends on**: Phase 5

**Requirements covered**: PATIENT-01, PATIENT-02, PATIENT-03, PATIENT-04, DOCTOR-01, DOCTOR-02, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, I18N-01, I18N-02

## Tasks

### 1. `POST /api/patient/favorites` / `DELETE /api/patient/favorites/[id]`
- [ ] Insert/delete a `favorites` row for the authenticated patient
- [ ] Enforce the `(patient_id, doctor_id)` unique constraint (idempotent add)

### 2. `GET /api/patient/favorites`
- [ ] Return the patient's favorite doctors with basic profile info (name, specialty, next slot)

### 3. `GET /api/notifications`
- [ ] Return the authenticated user's notifications, most recent first

### 4. `PATCH /api/notifications/[id]/read`
- [ ] Mark a notification as read (`read_at = now()`)

### 5. Notification creation wiring (verification pass)
- [ ] Confirm booking, cancellation, and reschedule flows from Phase 5 correctly insert `notifications` rows for both parties (patient and doctor where relevant)
- [ ] Add a small notification bell/dropdown component reused across patient and doctor layouts

### 6. `/patient/dashboard` page
- [ ] Summary of upcoming appointments (next 1-3)
- [ ] Quick links to search, favorites, appointment history

### 7. `/doctor/dashboard` page
- [ ] Count of upcoming appointments
- [ ] Count of remaining available slots
- [ ] Quick link to schedule management

### 8. `/patient/favorites` page
- [ ] List of favorited doctors with remove action and "next available slot"

### 9. Hebrew/English translation dictionaries
- [ ] `dictionaries/en.json`, `dictionaries/he.json` covering all UI strings across the app (retroactively covering phases 1-5 pages)
- [ ] React context (`LocaleProvider`) exposing the current locale and a `t()` translation helper

### 10. Global language switcher + RTL layout
- [ ] Switcher component available from every page (header)
- [ ] Sets `dir="rtl"` on the root layout when Hebrew is active, `dir="ltr"` for English
- [ ] Verify Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, etc.) are used consistently so spacing/alignment mirrors correctly

## Playwright Tests

- [ ] Adding and removing a favorite doctor
- [ ] Favorites list displays correctly
- [ ] Patient dashboard shows the correct summary
- [ ] Doctor dashboard shows the correct counts
- [ ] Notification created on booking confirmation, cancellation, and reschedule
- [ ] Switching language between Hebrew and English changes displayed text
- [ ] Layout correctly switches to RTL when Hebrew is selected
