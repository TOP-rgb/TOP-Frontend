# Attendance System — Full Audit Document

> Generated: March 2026
> Covers: Backend (Node/Prisma) · Frontend (React/TypeScript) · Config · Gaps · Improvements

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Database Models](#2-database-models)
3. [API Endpoints — Full Map](#3-api-endpoints--full-map)
4. [Core Business Logic](#4-core-business-logic)
5. [Frontend — What's Built](#5-frontend--whats-built)
6. [Configuration System](#6-configuration-system)
7. [What Is Implemented ✅](#7-what-is-implemented-)
8. [What Is Missing / Not Yet Built ❌](#8-what-is-missing--not-yet-built-)
9. [Areas of Improvement 🔧](#9-areas-of-improvement-)
10. [Known Bugs & Edge Cases 🐛](#10-known-bugs--edge-cases-)

---

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)             │
│                                                                   │
│  Attendance.tsx         AttendanceConfig.tsx                     │
│  ├─ My Attendance tab   ├─ Shifts tab                            │
│  ├─ Calendar tab        ├─ Assignments tab                       │
│  ├─ My Leaves tab       ├─ Geofences tab                         │
│  ├─ WFH Requests tab    ├─ Holidays tab                          │
│  ├─ Regularizations tab ├─ Leave Types tab                       │
│  ├─ Team View tab       └─ Work Modes tab                        │
│  ├─ Staff History tab                                            │
│  ├─ Exceptions tab                                               │
│  ├─ Leave Approvals tab                                          │
│  └─ WFH Approvals tab                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API (JSON)
┌─────────────────────────▼───────────────────────────────────────┐
│                       Backend (Node.js / Express)                │
│                                                                   │
│  attendanceController.js       (check-in, check-out, history)   │
│  attendanceManagerController.js (team, stats, exceptions)        │
│  shiftController.js             (shift CRUD + assignments)       │
│  geofenceController.js          (geofence CRUD)                  │
│  leaveController.js             (leave types, balances, requests)│
│  regularizationController.js   (time correction requests)        │
│  wfhRequestsController.js      (WFH/travel requests)             │
│  workPoliciesController.js     (allowed work modes per user)     │
│  holidayController.js          (public holidays + import)        │
│                                                                   │
│  attendanceService.js          (shared helpers + auto-close)     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Prisma ORM
┌─────────────────────────▼───────────────────────────────────────┐
│                     PostgreSQL Database                          │
│  AttendanceRecord · ShiftTemplate · ShiftAssignment             │
│  GeofenceLocation · LeaveType · LeaveBalance · LeaveRequest     │
│  WFHRequest · PublicHoliday · AttendanceException               │
│  RegularizationRequest · AttendanceWorkPolicy                   │
└─────────────────────────────────────────────────────────────────┘
```

**Timezone:** All dates stored as midnight UTC; converted per `OrganizationSettings.timezone` (default: Asia/Kolkata for this org).

---

## 2. DATABASE MODELS

### 2.1 AttendanceRecord (Core)

| Field | Type | Notes |
|-------|------|-------|
| date | DateTime | Midnight UTC (unique per user per day) |
| checkInAt | DateTime | Latest session start (updated on re-check-in) |
| firstCheckInAt | DateTime | Original check-in (never overwritten) |
| checkOutAt | DateTime? | Null if still checked in |
| checkInLat/Lng | Float? | GPS at check-in |
| checkOutLat/Lng | Float? | GPS at check-out |
| geofenceId | String? | Which geofence boundary was nearest |
| isWithinGeofence | Boolean? | Null = no geofences configured |
| status | Enum | PRESENT, LATE, AUTO_CHECKED_OUT, ON_LEAVE, HALF_DAY, ABSENT |
| workMinutes | Int | Accumulated across multi-session days |
| minutesLate | Int | Relative to shift start + grace period |
| minutesEarly | Int | How early left before shift end |
| overtimeMinutes | Int | Minutes worked beyond shift duration |
| workMode | Enum | OFFICE, WFH, TRAVELLING |
| isRemote | Boolean | Legacy field (use workMode instead) |
| autoCheckedOut | Boolean | True if auto-closed by system |
| isHoliday | Boolean | Flagged at check-in |
| isOnLeave | Boolean | Flagged at check-in |
| shiftId | String? | Shift active at time of check-in |

### 2.2 Status Enum

| Value | When Set |
|-------|----------|
| PRESENT | Checked in on time (within grace period) |
| LATE | Checked in after grace period expired |
| AUTO_CHECKED_OUT | System auto-closed because no manual checkout |
| ON_LEAVE | Checked in on an approved leave day |
| HALF_DAY | 25–74% of shift duration worked |
| ABSENT | < 25% of shift duration worked |

### 2.3 ShiftTemplate

| Field | Notes |
|-------|-------|
| name | Unique per org |
| startTime / endTime | HH:mm format |
| gracePeriodMinutes | Default 15 min |
| workingDays | Int[] — ISO weekday (Mon=1, Sun=7) |
| isActive | Soft-delete flag |

### 2.4 ExceptionType Enum

| Type | Triggered By |
|------|-------------|
| LATE_ARRIVAL | minutesLate > 0 at check-in |
| EARLY_DEPARTURE | checkout < shift end |
| MISSED_CHECKOUT | Auto-close runs on open record |
| LOCATION_VIOLATION | isWithinGeofence === false at check-in |
| OUT_OF_SHIFT_HOURS | Entire session outside shift window |

### 2.5 Other Key Models

- **ShiftAssignment** — Links user to shift with effectiveFrom / effectiveTo date range
- **GeofenceLocation** — name, lat/lng, radiusMeters (50–5000m), isActive
- **AttendanceWorkPolicy** — Per-user allowedModes[] (empty = unrestricted)
- **PublicHoliday** — name, date, type (public/company), countryCode (null = all)
- **LeaveType** — name, color, maxDaysPerYear, carryForwardDays, isPaid, allowedEmployeeTypes[]
- **LeaveBalance** — allocated, used, pending per user per type per year
- **LeaveRequest** — startDate, endDate, days (working days), status
- **WFHRequest** — startDate, endDate, mode (WFH/TRAVELLING), status
- **RegularizationRequest** — One per AttendanceRecord; requestedCheckIn/Out, reason, status

---

## 3. API ENDPOINTS — FULL MAP

### Employee Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /attendance/checkin | Check in (with GPS + workMode) |
| PATCH | /attendance/checkout | Check out |
| GET | /attendance/today | Today's status, shift, holiday, WFH, workingDays |
| GET | /attendance/mine | Personal history with synthetic absent entries |
| GET | /attendance/regularizations/mine | Own correction requests |
| POST | /attendance/regularizations | Submit time correction |
| GET | /attendance/work-policies | Own work-mode policy |
| POST | /attendance/wfh-requests | Submit WFH / travel request |
| GET | /attendance/wfh-requests/mine | Own WFH requests |
| DELETE | /attendance/wfh-requests/:id | Cancel own pending request |
| GET | /leaves/types | Leave types eligible for employee |
| GET | /leaves/balance/mine | Leave balances for current year |
| GET | /leaves/mine | Own leave requests |
| POST | /leaves | Submit leave request |
| DELETE | /leaves/:id | Cancel own pending leave |
| GET | /holidays | Holidays relevant to employee's country |

### Manager/Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /attendance/team | Today's team status (present/late/absent/leave) |
| GET | /attendance/history | Any employee's history (userId filter) |
| GET | /attendance/stats | Analytics: rate, trend, overtime, by-employee |
| GET | /attendance/exceptions | All exceptions (with filters) |
| PATCH | /attendance/exceptions/:id/review | Mark exception reviewed |
| GET | /attendance/regularizations/pending | Pending time-correction requests |
| PATCH | /attendance/regularizations/:id | Approve / reject regularization |
| PUT | /attendance/work-policies/:userId | Set employee's work-mode policy |
| DELETE | /attendance/work-policies/:userId | Remove policy (revert to unrestricted) |
| GET | /attendance/wfh-requests/pending | All pending WFH requests |
| PATCH | /attendance/wfh-requests/:id | Approve / reject WFH request |
| GET | /leaves/balance | Team leave balances |
| GET | /leaves/pending | Pending leave requests |
| GET | /leaves | All leaves (filtered) |
| PATCH | /leaves/:id | Approve / reject leave |

### Admin-Only Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST/PUT/DELETE | /shifts | Shift CRUD |
| POST | /shifts/assign | Assign shift to employee |
| GET/PUT/DELETE | /shifts/assignments | Manage assignments |
| POST/PUT/DELETE | /geofences | Geofence CRUD |
| POST/PUT/DELETE | /leaves/types | Leave type CRUD |
| POST | /leaves/balance | Set employee leave balance |
| POST | /leaves/carry-forward | Carry forward unused days |
| POST/PUT/DELETE | /holidays | Holiday CRUD |
| POST | /holidays/import | Bulk import from Nager.Date / Calendarific API |

---

## 4. CORE BUSINESS LOGIC

### 4.1 Check-In Flow

```
checkIn()
 ├─ autoCloseStaleRecords()      ← lazy cleanup of yesterday's open records
 ├─ get org timezone
 ├─ compute today's midnight UTC
 ├─ existing record today?
 │   ├─ not checked out → 409 (already on clock)
 │   └─ checked out → RE-CHECK-IN:
 │       ├─ validate geofence again
 │       ├─ reset checkInAt, clear checkOutAt
 │       ├─ keep accumulated workMinutes
 │       └─ delete EARLY_DEPARTURE exception
 └─ no record → FRESH CHECK-IN:
     ├─ geofence validation (OFFICE mode only)
     │   ├─ no geofences → skip (opt-in)
     │   ├─ no GPS + geofences exist → 400
     │   └─ outside all geofences → 403 + distance message
     ├─ resolveShiftForUser() → null on off-days
     ├─ compute minutesLate (vs shift start + grace period)
     ├─ check approved leave → isOnLeave flag
     ├─ check public holiday → isHoliday flag
     ├─ derive workMode from approved WFH request
     ├─ create AttendanceRecord (transaction)
     └─ detectExceptions() → LATE_ARRIVAL, LOCATION_VIOLATION
```

### 4.2 Check-Out Flow

```
checkOut()
 ├─ find open record (today OR yesterday for midnight-crossing shifts)
 ├─ compute currentSessionMinutes = now - checkInAt
 ├─ workMinutes += currentSessionMinutes  ← multi-session accumulator
 ├─ if shift assigned:
 │   ├─ compute shiftDuration
 │   ├─ if checkout < shiftStart → outOfShiftHours = true
 │   ├─ if checkout < shiftEnd → minutesEarly = shiftEnd - now
 │   └─ if workMinutes > duration → overtimeMinutes = workMinutes - duration
 ├─ STATUS TIER (if shift assigned & not outOfShiftHours):
 │   ├─ < 25% of shift → ABSENT
 │   ├─ 25–74% of shift → HALF_DAY
 │   └─ ≥ 75% of shift → keep PRESENT / LATE
 └─ update record + replace EARLY_DEPARTURE / OUT_OF_SHIFT_HOURS exceptions (transaction)
```

### 4.3 Auto-Close Stale Records

```
autoCloseStaleRecords()
 ├─ find open records from PREVIOUS days (checkOutAt IS NULL)
 ├─ skip if PENDING regularization exists (manager will set times)
 ├─ for each stale record:
 │   ├─ resolve shift → compute effective checkout time
 │   ├─ if now < effectiveCheckOut → SKIP (midnight-crossing shift still ongoing)
 │   ├─ set checkOutAt = shift end (or 23:59 if no shift)
 │   ├─ status = AUTO_CHECKED_OUT
 │   ├─ create MISSED_CHECKOUT or OUT_OF_SHIFT_HOURS exception
 │   └─ email employee
 └─ triggered by: check-in, getTodayStatus, getTeamStatus
```

### 4.4 Status Tiers (Checkout + Regularization Approval)

```
shiftDuration = shift.endTime - shift.startTime (minutes)
workMinutes   = accumulated worked minutes

if workMinutes < shiftDuration * 0.25 → ABSENT
elif workMinutes < shiftDuration * 0.75 → HALF_DAY
else → keep PRESENT / LATE
```

### 4.5 Shift Resolution

- Finds assignment where `effectiveFrom ≤ date ≤ effectiveTo`
- **Returns null** if today's ISO weekday not in `workingDays` (off day)
- Midnight-crossing shifts: `getShiftEndLocalDateStr()` increments shift end date by 1 when `endTime ≤ startTime`

### 4.6 Geofence Logic

- **Opt-in:** If zero geofences exist → enforcement disabled entirely
- **OFFICE mode:** GPS required if any geofence exists; must be inside at least one
- **WFH / TRAVELLING:** Geofence validation skipped
- **Distance feedback:** Returns distance to nearest geofence if outside
- **Haversine formula** for GPS distance calculation

### 4.7 Leave Balance Mechanics

```
available = allocated - used - pending

On submit:    pending += days
On approve:   pending -= days, used += days
On reject:    pending -= days
On cancel:    pending -= days
Carry-forward: min(remaining, carryForwardDays) added to next year
```

### 4.8 Holiday Filtering (Per-User)

Each user sees:
- `type='company'` holidays (org-wide, any country)
- `countryCode = null` holidays (org-wide)
- `countryCode = user.country` holidays (their country)

### 4.9 Regularization Flow

```
Employee submits:
 ├─ for existing record → references it
 └─ for absent day → creates placeholder record first

Manager reviews:
 └─ APPROVED:
     ├─ recalculates workMinutes, overtime, minutesEarly
     ├─ computes status tier (same as checkout)
     ├─ updates record (checkInAt, checkOutAt, workMinutes, status)
     └─ marks MISSED_CHECKOUT exceptions as reviewed
```

---

## 5. FRONTEND — WHAT'S BUILT

### 5.1 Tabs & Sections

| Tab | Role | What It Shows |
|-----|------|---------------|
| My Attendance | All | Check-in/out buttons, live timer, stat cards, history table with filters, CSV export |
| Calendar | All | Monthly grid with color-coded status, day-click popover with details |
| My Leaves | All | Leave balances by type, leave request list, apply-leave modal |
| WFH Requests | All | Own WFH/travel requests, submit modal |
| Regularizations | All | Own correction requests; manager also sees pending approvals |
| Team View | Manager | Today's team bucketed by status; summary counts |
| Staff History | Manager | Per-employee history with date range filter |
| Exceptions | Manager | All exceptions with type filter; mark reviewed |
| Leave Approvals | Manager | Pending leave requests; approve/reject modal |
| WFH Approvals | Manager | Pending WFH/travel requests; approve/reject modal |

### 5.2 Admin Config Page (AttendanceConfig.tsx)

| Tab | Functionality |
|-----|--------------|
| Shifts | Create / edit / delete shift templates; set working days |
| Assignments | Assign shifts to employees with date ranges |
| Geofences | Create / edit / delete geofence boundaries |
| Holidays | Create holidays; bulk import from API (Nager.Date / Calendarific) |
| Leave Types | CRUD; set max days, carry-forward, paid/unpaid, employee type restrictions |
| Work Modes | Set per-employee allowed work modes; empty = unrestricted |

### 5.3 Key Frontend Utilities

| Helper | Purpose |
|--------|---------|
| `fmtDate(iso)` | `"Sat, 15 Mar 2026"` — UTC-safe, includes weekday |
| `fmtTime(iso)` | `"09:15 AM"` |
| `fmtMinutes(mins)` | `"8h 30m"` |
| `isOffDay(jsDay)` | Uses `todayData.workingDays` (shift-aware, not just Sat/Sun hardcode) |
| `getStatusBadge(status)` | Colored badge for all AttendanceStatus values |
| `getExceptionBadge(type)` | Colored badge for all ExceptionType values |
| `useLiveSecs()` | Precise live timer with localStorage persistence |
| `lastHistoryParamsRef` | Prevents filter-reset race condition on refetch |

---

## 6. CONFIGURATION SYSTEM

### What Admins Can Configure

| Feature | Where | Configurable Fields |
|---------|-------|---------------------|
| Shifts | AttendanceConfig > Shifts | Name, start/end time, grace period, working days |
| Shift assignments | AttendanceConfig > Assignments | User, shift, effective date range |
| Geofences | AttendanceConfig > Geofences | Name, lat/lng, radius (50–5000m) |
| Public holidays | AttendanceConfig > Holidays | Name, date, type, country code; bulk import |
| Leave types | AttendanceConfig > Leave Types | Name, color, days/year, carry-forward, paid flag, eligible employee types |
| Leave balances | AttendanceConfig > Leave Types | Set per-user allocated days per year |
| Work-mode policies | AttendanceConfig > Work Modes | Restrict which modes (OFFICE/WFH/TRAVELLING) each employee can use |

### What's NOT Configurable (Hardcoded)

| Item | Current Value | Should Be Configurable |
|------|--------------|----------------------|
| Status tier thresholds | ABSENT <25%, HALF_DAY 25–74% | Yes — per org policy |
| Overtime trigger | > shift duration | Yes — might need daily/weekly cap |
| Auto-close time (no shift) | 23:59 local | Yes — e.g., "close at end of business" |
| Geofence enforcement mode | Opt-in (any geofence = enforce) | Yes — could be warn-only |
| Holiday import provider | Nager.Date / Calendarific | Fixed |

---

## 7. WHAT IS IMPLEMENTED ✅

### Core Attendance
- [x] Daily check-in with GPS + work mode selection
- [x] Check-out with shift-based time calculations
- [x] Multi-session days (re-check-in after checkout)
- [x] Live timer (seconds precision, localStorage persistence)
- [x] Auto-close stale open records at shift end
- [x] Premature-close guard (midnight-crossing shifts not closed early)
- [x] Midnight-crossing shift support (e.g. 10PM→6AM)
- [x] Status tiers: ABSENT / HALF_DAY / PRESENT based on % of shift worked
- [x] Overtime calculation
- [x] Early departure tracking
- [x] Late arrival tracking with grace period

### Shift Management
- [x] Shift template CRUD (admin)
- [x] Shift assignments with date ranges (supports shift changes)
- [x] Soft-delete shifts
- [x] Working-days array (ISO Mon=1..Sun=7, non-standard schedules supported)
- [x] Per-employee shift history preserved

### Geofence
- [x] Multiple geofence locations per org
- [x] GPS distance validation at check-in (OFFICE mode only)
- [x] Distance feedback message when outside
- [x] Opt-in: disabled if no geofences configured
- [x] WFH/TRAVELLING bypass

### Leave Management
- [x] Multiple leave types (annual, sick, etc.) with custom colors
- [x] Per-employee-type eligibility (PERMANENT/PROBATION/INTERN/CONTRACT)
- [x] Leave balance tracking (allocated / used / pending)
- [x] Working-day calculation excludes weekends + country holidays
- [x] Submit / cancel leave requests
- [x] Manager approve / reject with note
- [x] ON_LEAVE attendance records auto-created on approval
- [x] Carry-forward logic with per-type cap
- [x] Admin can set per-user annual balance
- [x] Country-aware holiday exclusion in leave day calculation

### WFH / Travel Requests
- [x] Submit WFH or TRAVELLING requests with date range
- [x] Manager approve / reject with note
- [x] Cancel own pending request
- [x] Approved WFH overrides work-mode policy at check-in
- [x] Mode shown in history table (WFH / Travelling badges)

### Regularizations
- [x] Employee requests time correction for any day
- [x] Works for absent days (creates placeholder record)
- [x] One pending request per record enforced
- [x] Manager approves → recalculates all metrics + status
- [x] MISSED_CHECKOUT exceptions auto-reviewed on approval
- [x] Approved records show "Corrected" badge in UI

### Work-Mode Policies
- [x] Admin restricts which modes each employee can use
- [x] Empty policy = unrestricted
- [x] Approved WFH overrides policy

### Exceptions
- [x] Auto-detected: LATE_ARRIVAL, EARLY_DEPARTURE, MISSED_CHECKOUT, LOCATION_VIOLATION, OUT_OF_SHIFT_HOURS
- [x] Exceptions deduplicated (replaced on re-checkout)
- [x] Manager review with timestamp
- [x] Unreviewed exceptions shown in history table flags column

### Holidays
- [x] Manual holiday creation (company-wide or country-specific)
- [x] Bulk import from Nager.Date API (free, most countries)
- [x] Bulk import from Calendarific API (India + 230+ countries)
- [x] Per-user holiday filtering by country code
- [x] Holiday shown on calendar (muted cell + "Public Holiday" label)

### Statistics / Reporting
- [x] Per-employee attendance rate
- [x] Daily trend (present / late / on-leave counts per day)
- [x] Exception breakdown by type
- [x] Leave breakdown by type
- [x] Overtime totals
- [x] Working-day calculation (per-country holidays excluded)

### UI
- [x] Color-coded calendar with off-day aware isOffDay() (uses shift's workingDays)
- [x] Day-click popover with full record details
- [x] Off-day check-ins show "Day Off" status (not LATE/PRESENT) in history table
- [x] Scrollable tab bar (overflow hidden)
- [x] CSV export of personal attendance history
- [x] Staff History tab (manager selects any employee)
- [x] Week-by-default date filter with memory (no filter reset on refetch)

---

## 8. WHAT IS MISSING / NOT YET BUILT ❌

### High Priority

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Attendance Stats UI** | Backend `GET /attendance/stats` exists but no frontend page to display it. Admin/manager can't see org-wide charts. |
| 2 | **Geofence violation display** | `isWithinGeofence` field stored per record but never shown in any table or history. Manager can't tell who checked in outside. |
| 3 | **GPS coordinates display** | `checkInLat/Lng` stored but never surfaced in UI. No map view for managers. |
| 4 | **Multi-session breakdown** | `firstCheckInAt` ≠ `checkInAt` on multi-session days but UI only shows latest. No "Re-check-in at 1:30 PM" indication. |
| 5 | **Auto-checkout explanation** | Records with `autoCheckedOut=true` show "Auto Closed" badge but no time/reason. User confused why they were closed. |
| 6 | **Shift info on My Attendance** | Shift name and hours shown briefly but there's no "Your shift: 09:00–17:30 (Morning Shift)" visible block during the work day. |
| 7 | **Leave balance management UI** | Admin can create leave types but setting per-user balances is not fully exposed in the config UI. |
| 8 | **Attendance notes** | `notes` field exists in AttendanceRecord but no way to add/view notes in UI. |

### Medium Priority

| # | Feature | Notes |
|---|---------|-------|
| 9 | **Bulk regularization** | Employee can only regularize one day at a time. No "regularize entire week" option. |
| 10 | **Shift swap requests** | No mechanism for employees to swap shifts or request shift changes. |
| 11 | **Carry-forward UI trigger** | Carry-forward endpoint exists but no UI button/schedule to run it at year-end. |
| 12 | **Leave cancellation (approved)** | Only PENDING leaves can be cancelled. No flow for cancelling an APPROVED leave (employee plans changed). |
| 13 | **Manager leave balance view** | `/leaves/balance` endpoint exists (manager) but no corresponding UI tab in AttendanceConfig. |
| 14 | **WFH request for past dates** | No validation prevents backdating WFH requests. Should allow or disallow explicitly. |
| 15 | **Attendance proof upload** | No way to attach document (doctor's note, travel ticket) to regularization or leave request. |
| 16 | **Recurring WFH pattern** | Must submit per date range each time. No "every Friday WFH" pattern. |

### Low Priority

| # | Feature | Notes |
|---|---------|-------|
| 17 | **PDF / advanced export** | Only CSV. No PDF report, no custom column selection, no monthly summaries. |
| 18 | **Attendance forecasting** | No prediction of who is likely to be late or absent. |
| 19 | **Calendar sync** | CalendarEvent model exists but leave/WFH approvals don't sync to Google/Outlook. |
| 20 | **Real-time notifications** | Email only. No push notifications, SMS, Slack/Teams webhook. |
| 21 | **Timesheet integration** | `dailyHoursThreshold` in OrganizationSettings exists but attendance hours not connected to timesheet. |
| 22 | **IP / network proof** | Geofence only checks GPS. No IP-based office network detection as fallback. |

---

## 9. AREAS OF IMPROVEMENT 🔧

### 9.1 Backend Logic

| Area | Issue | Suggested Fix |
|------|-------|--------------|
| **Work-mode policy enforcement** | Policy `allowedModes` only partially enforced. At check-in, policy is checked for approved WFH override but a plain OFFICE check-in is not validated against the policy. | Add policy check at check-in: if employee's policy excludes OFFICE, reject. |
| **Regularization recalculation** | When regularization is approved, `minutesLate` is NOT recalculated. If employee regularizes to an earlier check-in, their late minutes should decrease. | Recompute `minutesLate` during regularization approval the same way check-in does. |
| **Auto-close timing** | When no shift assigned, auto-close uses 23:59 as checkout time. This inflates `workMinutes` and creates misleading PRESENT status. | For records with no shift, use `firstCheckInAt + 8h` or leave `workMinutes` as 0 and status AUTO_CHECKED_OUT. |
| **Leave on off-days** | Leave request computes `days` as working days. But `ON_LEAVE` attendance records are created for every day including weekends. Not a balance issue but looks wrong in history. | Only create `ON_LEAVE` records for shift's `workingDays`, not just "not a weekend". |
| **Geofence on re-check-in** | Re-check-in after lunch re-validates geofence but uses the ORIGINAL workMode from the record (which could have been set to WFH earlier). | Use the current session's intent or prompt user to confirm mode before re-check-in. |
| **Overtime calculation** | Overtime only counts time beyond shift duration regardless of time of day. Night-shift workers don't get overtime if they started late but worked long. | Consider "after shift-end time" as the overtime trigger, not just `workMinutes > duration`. |
| **Exception on ON_LEAVE days** | If an employee checks in on an approved leave day, exceptions like LATE_ARRIVAL can still fire. | Skip exception detection if `isOnLeave === true`. |
| **Status on holiday check-in** | If employee checks in on a holiday, their `status` is set to PRESENT/LATE even though it's a holiday. The `isHoliday` flag is set but status doesn't reflect it. | Consider adding HOLIDAY_WORK status or at least skip LATE detection on holidays. |

### 9.2 Frontend UX

| Area | Issue | Suggested Fix |
|------|-------|--------------|
| **History table pagination** | Table loads up to 60 records and stops. No "Load more" / pagination controls. | Add pagination or infinite scroll with `limit`/`offset` params. |
| **Regularization pre-fill** | Regularization modal has blank time fields. Employee must re-type their actual check-in time. | Pre-fill `requestedCheckIn` with `firstCheckInAt` and `requestedCheckOut` with `checkOutAt`. |
| **Review timestamps** | Regularization/Leave/WFH "Corrected/Approved" badges don't show who approved or when. | Show `reviewedBy` (manager name) + `reviewedAt` in a tooltip or sub-row. |
| **Work mode warning** | Checking in WFH without an approved request shows no warning. Employee might not realize their mode isn't approved. | Show soft warning: "No approved WFH request for today — proceeding as ad-hoc WFH". |
| **Late indicator** | "Late" badge shows but `minutesLate` is never displayed. Employee doesn't know how late they were. | Show "Late by X min" in the check-in time cell or stat card. |
| **Calendar performance** | Full calendar month re-renders on every `history` state update, even when month didn't change. | Memoize calendar grid; only recompute when `calendarMonth` or `calendarRecordMap` changes. |
| **Absence on calendar** | Synthetic ABSENT records come from `/attendance/mine` which only covers the current date range filter. If the calendar shows a month not in the filter, absent days won't appear. | When calendar month changes, trigger a history fetch for that month. |
| **Staff History employee list** | Dropdown only populated from `mgr.teamStatus` (today's data). If an employee is on leave or absent today, they still appear but their team-status record may be incomplete. Also if Team View was never visited, the list may be empty until auto-fetch fires. | Maintain a separate `/users` or `/attendance/team/members` endpoint that returns all active employees regardless of today's attendance. |
| **Manager refresh buttons** | Each manager tab has a manual "Refresh" button. Team View data goes stale without a refresh. | Add auto-refresh interval (e.g., every 5 minutes) or websocket/SSE connection for live team status. |

### 9.3 Data Integrity

| Area | Issue | Suggested Fix |
|------|-------|--------------|
| **Duplicate status fields** | `isRemote` (Boolean, legacy) and `workMode` (Enum) both indicate remote work. `isRemote = workMode !== 'OFFICE'`. | Deprecate `isRemote`. Use only `workMode`. Migrate old records during a DB migration. |
| **isOnLeave vs status** | Records have both `isOnLeave: true` AND `status: 'PRESENT'` when employee checks in on a leave day. These are contradictory signals. | Either: Don't allow check-in on approved leave days (block with message), or set `status = 'ON_LEAVE'` at check-in if `isOnLeave` is true. |
| **Missing `workingDays` on types** | Frontend `AttendanceStatus` type is missing `HALF_DAY` in some places (enum mismatch). | Ensure `AttendanceStatus` in `src/types/index.ts` includes `HALF_DAY` and `ABSENT`. |
| **Overtime on absent/half-day** | If `workMinutes` triggers ABSENT/HALF_DAY status tier, `overtimeMinutes` can still be set (if they somehow worked more than shift). | Clear `overtimeMinutes` when status is ABSENT or HALF_DAY. |

### 9.4 Configuration

| Area | Issue | Suggested Fix |
|------|-------|--------------|
| **Status tier thresholds** | Hardcoded at 25%/75% in two places (checkout + regularization approval). If org policy changes, code must be updated. | Move to `OrganizationSettings` as `absentThresholdPercent` (default 25) and `halfDayThresholdPercent` (default 75). |
| **Overtime threshold** | Overtime triggers at `workMinutes > shiftDuration`. No daily cap or weekly rollup. | Add `overtimeThresholdMinutes` to settings (default 0 = any time over shift). |
| **Geofence enforcement mode** | Currently: if outside geofence → block check-in. Some orgs want "warn but allow". | Add `geofenceEnforcement: 'block' | 'warn' | 'log'` to OrganizationSettings. |
| **Auto-close fallback time** | When no shift: closes at 23:59. When shift but no timezone: might error. | Add `defaultAutoCloseHour` to settings (e.g., 18 = 6PM) as the fallback. |

---

## 10. KNOWN BUGS & EDGE CASES 🐛

| # | Bug | Status | Description |
|---|-----|--------|-------------|
| 1 | `/ default: Sat/Sun` comment | **Active** | In `attendanceController.js` there is a single-slash comment (`/ default: Sat/Sun`) instead of `//`. While not a runtime bug, it will cause parse errors if the file is ever run through a stricter minifier. |
| 2 | Team status absent calculation | **Active** | `getTeamStatus` marks users as absent if they have no record today AND no leave. But it does NOT check if today is their off-day per their shift's `workingDays`. An employee with Sun off will show "Absent" on Sundays. |
| 3 | Stats working-day calculation | **Active** | `getAttendanceStats` computes working days by iterating days and excluding weekends (getUTCDay). It does NOT check each employee's shift `workingDays`. A Mon-Sat employee gets a different "expected days" than the system computes. |
| 4 | `minutesLate` not recalculated on regularization | **Active** | When a regularization is approved and `checkInAt` is changed, `minutesLate` in the record is NOT updated. Could show "720 min late" on a corrected record. |
| 5 | Calendar absent entries miss calendar month | **Active** | History default filter is "current week". If user opens calendar to last month, synthetic absent entries won't be there. The calendar popover shows "No record" instead of "Absent". |
| 6 | Re-check-in workMode not re-evaluated | **Potential** | When employee re-checks-in after lunch, their workMode defaults to the previous session's mode. If their approved WFH was only for morning, afternoon OFFICE check-in won't be detected as a mode change. |
| 7 | Leave day count for multi-country orgs | **Potential** | `computeLeaveDays()` uses `userCountry` to exclude country holidays. But if `user.country` is null, it falls back to org-wide holidays only. Employees without country set may get wrong leave day counts. |
| 8 | Carry-forward race condition | **Potential** | `processCarryForward` iterates and upserts balances but is not wrapped in a single DB transaction. If it fails halfway, some users get carried-forward days and others don't. |
| 9 | Staff History dropdown empty on direct tab access | **Active (UI)** | If manager navigates directly to Staff History without visiting Team View first, `mgr.teamStatus` is null. Auto-fetch fires but during the loading window the dropdown shows only "Select employee…" with no options. |
| 10 | `isOffDay` uses viewer's shift, not target employee's shift | **Active (Staff History)** | In Staff History, `rowIsOffDay` calls `isOffDay()` which uses `todayData.workingDays` — the logged-in manager's shift. If the manager has Mon–Fri and the employee has Mon–Sat, Saturday rows in Staff History will show "Day Off" incorrectly. |

---

## SUMMARY SCORECARD

| Domain | Completeness | Quality |
|--------|-------------|---------|
| Check-in / Check-out core | ✅ 95% | Good |
| Shift management | ✅ 90% | Good |
| Geofence | ✅ 80% | Works but no UI feedback |
| Leave management | ✅ 85% | Missing approved-leave cancel |
| WFH requests | ✅ 90% | Good |
| Regularizations | ✅ 85% | Missing minutesLate recalculation |
| Work-mode policies | ⚠️ 70% | Policy not fully enforced at check-in |
| Exceptions | ✅ 85% | Good, review flow works |
| Holidays | ✅ 90% | Good import support |
| Statistics / Reporting | ⚠️ 50% | Backend built, no frontend |
| Calendar display | ✅ 90% | Good, shift-aware off-days |
| Admin config UI | ✅ 80% | Missing balance management UI |
| Mobile responsiveness | ⚠️ 60% | Tables overflow on small screens |
| Email notifications | ✅ 85% | All major events covered |

**Overall: ~82% complete** — solid foundation, production-viable, with clear gaps in reporting UI, full policy enforcement, and a handful of edge-case bugs.
