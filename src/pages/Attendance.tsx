import { useState, useEffect, useCallback, useMemo } from 'react'
import { LogIn, LogOut, Clock, Calendar, Users, AlertTriangle, ClipboardList, CheckSquare, Loader2, ChevronRight, Download, ChevronLeft, Building2, Home, Plane, History, Search, BarChart2, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { useAttendance } from '@/hooks/useAttendance'
import { useAttendanceManager } from '@/hooks/useAttendanceManager'
import { useHolidays } from '@/hooks/useHolidays'
import { useLeaves } from '@/hooks/useLeaves'
import { useWorkPolicies } from '@/hooks/useWorkPolicies'
import { useWFHRequests } from '@/hooks/useWFHRequests'
import { toast } from 'sonner'
import type { AttendanceRecord, AttendanceException, RegularizationRequest, LeaveRequest, WFHRequest, WorkMode } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Use timeZone:'UTC' because all record dates are stored as midnight-UTC
  // of the local date (e.g. "2024-03-06T00:00:00.000Z" = local March 6).
  // Without this, UTC-offset browsers shift it to the previous day.
  return new Date(iso).toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function fmtMinutes(mins: number | null | undefined): string {
  if (mins == null || mins < 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

async function getCoords(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    )
  })
}

// ── Status helpers ────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'PRESENT':         return <Badge variant="success" dot>Present</Badge>
    case 'LATE':            return <Badge variant="warning" dot>Late</Badge>
    case 'HALF_DAY':        return <Badge variant="purple" dot>Half Day</Badge>
    case 'AUTO_CHECKED_OUT':return <Badge variant="secondary" dot>Auto Closed</Badge>
    case 'ON_LEAVE':        return <Badge variant="info" dot>On Leave</Badge>
    case 'ABSENT':          return <Badge variant="destructive" dot>Absent</Badge>
    case 'HOLIDAY':         return <Badge variant="secondary" dot>Holiday</Badge>
    default:                return <Badge variant="secondary">{status}</Badge>
  }
}

function getExceptionBadge(type: string) {
  switch (type) {
    case 'LATE_ARRIVAL':       return <Badge variant="warning">Late Arrival</Badge>
    case 'EARLY_DEPARTURE':    return <Badge variant="warning">Early Departure</Badge>
    case 'MISSED_CHECKOUT':    return <Badge variant="danger">Missed Checkout</Badge>
    case 'LOCATION_VIOLATION': return <Badge variant="danger">Location Violation</Badge>
    case 'OUT_OF_SHIFT_HOURS': return <Badge variant="danger">Out of Shift Hours</Badge>
    default:                   return <Badge variant="secondary">{type}</Badge>
  }
}

// ── Live Timer ────────────────────────────────────────────────────────────────

function useLiveMinutes(
  checkInAt?: string | null,
  checkOutAt?: string | null,
  storedMinutes?: number | null,   // accumulated minutes from previous sessions
) {
  const [mins, setMins] = useState<number | null>(null)
  useEffect(() => {
    if (!checkInAt) { setMins(null); return }
    if (checkOutAt) {
      setMins(storedMinutes ?? Math.floor((new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60000))
      return
    }
    const accumulated = storedMinutes ?? 0
    const update = () =>
      setMins(accumulated + Math.floor((Date.now() - new Date(checkInAt).getTime()) / 60000))
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [checkInAt, checkOutAt, storedMinutes])
  return mins
}

// Live second-level timer — used for the "Hours Worked" card while checked in.
//
// Problem: workMinutes is floor(minutes), so 5m 30s stores workMinutes=5, losing
// 30 s. After checkout → re-check-in OR page refresh, the timer restarts at 5:00
// instead of 5:30.
//
// Fix: at checkout we compute precise total seconds (workMinutes*60 + sub-minute
// remainder from real timestamps) and write to sessionStorage keyed by date.
// sessionStorage survives page refreshes within the same browser tab, so both
// re-check-in and refresh restore the exact value shown at checkout.
const WORK_SECS_KEY = 'attendance-precise-secs'

function useLiveSecs(
  checkInAt?: string | null,
  checkOutAt?: string | null,
  storedMinutes?: number | null,
) {
  const [secs, setSecs] = useState<number | null>(null)

  useEffect(() => {
    if (!checkInAt) { setSecs(null); return }

    const dateKey = checkInAt.slice(0, 10) // YYYY-MM-DD — invalidates on new day

    const readStorage = () => {
      try {
        const raw = sessionStorage.getItem(WORK_SECS_KEY)
        return raw ? JSON.parse(raw) as { date: string; secs: number; checkOutAt?: string } : null
      } catch { return null }
    }

    const writeStorage = (totalSecs: number, co: string) => {
      try { sessionStorage.setItem(WORK_SECS_KEY, JSON.stringify({ date: dateKey, secs: totalSecs, checkOutAt: co })) } catch {}
    }

    if (checkOutAt) {
      const stored = readStorage()

      // Idempotent: already computed for this exact checkout — just restore, no re-accumulate.
      // This prevents the growing-on-refresh bug where checkout branch keeps re-adding
      // currentSessionSecs every time the page reloads in the checked-out state.
      if (stored?.date === dateKey && stored.checkOutAt === checkOutAt) {
        setSecs(stored.secs)
        return
      }

      const currentSessionSecs = Math.floor(
        (new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 1000
      )

      // prevAccum = server's accumulated floor (storedMinutes) converted to seconds,
      // PLUS the sub-minute remainder from sessionStorage.
      // Using storedMinutes*60 as the base (not raw stored.secs) makes this immune to
      // any inflation the old buggy code may have written into sessionStorage.
      // The `% 60` extracts only the sub-minute fraction, recovering precision lost by
      // the server's floor-per-session calculation without risking accumulation errors.
      const serverPrevSecs = (storedMinutes ?? 0) * 60
      const subMinutePrev = (stored?.date === dateKey && typeof stored.secs === 'number')
        ? stored.secs % 60 : 0
      const prevAccum = serverPrevSecs + subMinutePrev

      const total = prevAccum + currentSessionSecs
      setSecs(total)
      writeStorage(total, checkOutAt)
      return
    }

    // Live session — base from server's workMinutes (reliable floor) + sub-minute
    // seconds from sessionStorage (% 60). Using % 60 makes accumulated immune to any
    // inflation in sessionStorage written by old buggy runs; it only extracts the
    // sub-minute precision the server loses when it floors minutes at each session.
    const serverSecs = (storedMinutes ?? 0) * 60
    const storedLive = readStorage()
    const subMinuteSecs = storedLive?.date === dateKey && typeof storedLive.secs === 'number'
      ? storedLive.secs % 60 : 0
    let accumulated = serverSecs + subMinuteSecs

    const update = () =>
      setSecs(accumulated + Math.floor((Date.now() - new Date(checkInAt).getTime()) / 1000))
    update()
    const t = setInterval(update, 1_000)
    return () => clearInterval(t)
  }, [checkInAt, checkOutAt, storedMinutes])

  return secs
}

function fmtLiveDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = 'my-attendance' | 'calendar' | 'my-leaves' | 'wfh-requests' | 'team' | 'staff-history' | 'exceptions' | 'regularizations' | 'leave-approvals' | 'wfh-approvals' | 'stats'

// ── CSV helpers ───────────────────────────────────────────────────────────────

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Shared dark-modal input/label/cancel classes (modal bg is #152035)
const DK_INPUT  = 'w-full rounded-lg border border-[#2d4068] bg-[#1e2d45] px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
const DK_LABEL  = 'block text-sm font-medium text-slate-300 mb-1'
const DK_CANCEL = 'px-4 py-2 text-sm rounded-lg border border-[#2d4068] text-slate-300 hover:bg-[#1e2d45] transition-colors'

// ── Main component ────────────────────────────────────────────────────────────

export function Attendance() {
  const { user } = useAuthStore()
  const role = user?.role ?? 'employee'
  const isManager = role === 'manager' || role === 'admin'

  const {
    todayData, todayRecord, history, historyTotal, calendarHistory, myRegularizations,
    compOffCredits,
    loading: attendanceLoading, checkIn, checkOut, submitRegularization,
    refetchHistory, refetchRegularizations, fetchCalendarHistory,
    loadMoreHistory,
    refetchCompOffCredits,
  } = useAttendance()

  const mgr = useAttendanceManager()
  const leaves = useLeaves()
  const { policies, hasFetched: policiesLoaded, fetchPolicies } = useWorkPolicies()
  const wfhRequests = useWFHRequests()

  // Today's approved WFH request (returned by GET /attendance/today)
  const todayApprovedWFH = todayData?.approvedWFH ?? null

  // Derive which work modes this employee is allowed to use.
  // Guard with policiesLoaded to avoid briefly showing all modes before the policy API returns.
  // An approved WFH request for today unlocks that mode even if not in the whitelist.
  const allowedModes: WorkMode[] = (() => {
    if (!policiesLoaded) return ['OFFICE']   // safe default while policy is still loading
    const myPolicy = policies.find(p => p.userId === user?.id)
    const base: WorkMode[] = myPolicy?.allowedModes.length ? myPolicy.allowedModes : ['OFFICE', 'WFH', 'TRAVELLING']
    if (todayApprovedWFH && !base.includes(todayApprovedWFH.mode)) {
      return [...base, todayApprovedWFH.mode]
    }
    return base
  })()

  const [activeTab, setActiveTab] = useState<Tab>('my-attendance')
  const [checkingIn, setCheckingIn] = useState(false)
  const [workMode, setWorkMode] = useState<WorkMode>('OFFICE')

  // History date range filter — default to current week (Mon–Sun)
  const [historyFrom, setHistoryFrom] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
  })
  const [historyTo, setHistoryTo] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + 6)
    return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`
  })

  // Fetch current week on mount
  useEffect(() => {
    if (historyFrom && historyTo) refetchHistory({ startDate: historyFrom, endDate: historyTo })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [calendarDetail, setCalendarDetail] = useState<{ date: Date; record: typeof history[0] | null } | null>(null)
  const handleCalendarDayClick = (date: Date, rec: typeof history[0] | null) => {
    setCalendarDetail({ date, record: rec })
  }


  // Fetch work-mode policy for this employee
  useEffect(() => { fetchPolicies() }, [fetchPolicies])
  // Snap workMode to first allowed when policy loads/changes
  useEffect(() => {
    if (!allowedModes.includes(workMode)) setWorkMode(allowedModes[0])
  }, [allowedModes.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Table pagination (client-side "Show more") ────────────────────────────
  const PAGE_SIZE = 10
  const [leavesShown,       setLeavesShown]       = useState(PAGE_SIZE)
  const [compOffShown,      setCompOffShown]       = useState(PAGE_SIZE)
  const [wfhShown,          setWfhShown]           = useState(PAGE_SIZE)
  const [wfhPendingShown,   setWfhPendingShown]    = useState(PAGE_SIZE)
  const [myRegShown,        setMyRegShown]         = useState(PAGE_SIZE)
  const [pendingRegShown,   setPendingRegShown]    = useState(PAGE_SIZE)
  const [pendingLeaveShown, setPendingLeaveShown]  = useState(PAGE_SIZE)
  // Reset visible rows whenever the active tab changes so stale "expanded" state
  // doesn't carry over when the user navigates between tabs.
  useEffect(() => {
    setLeavesShown(PAGE_SIZE)
    setCompOffShown(PAGE_SIZE)
    setWfhShown(PAGE_SIZE)
    setWfhPendingShown(PAGE_SIZE)
    setMyRegShown(PAGE_SIZE)
    setPendingRegShown(PAGE_SIZE)
    setPendingLeaveShown(PAGE_SIZE)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modals
  const [regModal, setRegModal] = useState<{ record: AttendanceRecord } | null>(null)
  const [leaveModal, setLeaveModal] = useState(false)
  const [reviewLeaveModal, setReviewLeaveModal] = useState<{ request: LeaveRequest } | null>(null)
  const [reviewRegModal, setReviewRegModal] = useState<{ request: RegularizationRequest } | null>(null)
  const [wfhModal, setWfhModal] = useState(false)
  const [reviewWFHModal, setReviewWFHModal] = useState<{ request: WFHRequest } | null>(null)

  // Regularization form
  const [regForm, setRegForm] = useState({ requestedCheckIn: '', requestedCheckOut: '', reason: '' })

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })

  // WFH Request form
  const [wfhForm, setWfhForm] = useState<{ startDate: string; endDate: string; mode: WorkMode; reason: string }>({ startDate: '', endDate: '', mode: 'WFH', reason: '' })
  const [wfhReviewNote, setWfhReviewNote] = useState('')

  // Review notes
  const [reviewNote, setReviewNote] = useState('')

  // Comp Off earned badge — shown in Today card after a qualifying checkout
  const [compOffJustEarned, setCompOffJustEarned] = useState(false)

  // Staff History tab — employee selector + date range
  const [staffHistoryUserId, setStaffHistoryUserId] = useState<string>('')
  const [staffHistoryStart,  setStaffHistoryStart]  = useState<string>('')
  const [staffHistoryEnd,    setStaffHistoryEnd]    = useState<string>('')

  // Stats tab date range — default: first day of current month to today
  const [statsFrom, setStatsFrom] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [statsTo, setStatsTo] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const liveMinutes = useLiveMinutes(todayRecord?.checkInAt, todayRecord?.checkOutAt, todayRecord?.workMinutes)
  const liveSecs    = useLiveSecs(todayRecord?.checkInAt, todayRecord?.checkOutAt, todayRecord?.workMinutes)

  // Derive today's display status
  const todayStatus = (() => {
    if (todayData?.isOnLeave && !todayRecord) return 'ON_LEAVE'
    if (todayData?.isHoliday && !todayRecord) return 'HOLIDAY'
    if (!todayRecord) return 'NOT_CHECKED_IN'
    if (todayRecord.checkOutAt) return 'CHECKED_OUT'
    return todayRecord.status
  })()

  const STATUS_LABELS: Record<string, string> = {
    ON_LEAVE:         'On Leave',
    HOLIDAY:          'Holiday',
    NOT_CHECKED_IN:   'Not Checked In',
    CHECKED_OUT:      'Checked Out',
    PRESENT:          'Present',
    LATE:             'Late',
    HALF_DAY:         'Half Day',
    ABSENT:           'Absent',
    AUTO_CHECKED_OUT: 'Auto Closed',
  }

  // Load manager data on tab change
  useEffect(() => {
    if (activeTab === 'team' && isManager) mgr.fetchTeamStatus()
    // Staff History needs the team member list — fetch team status if not already loaded
    if (activeTab === 'staff-history' && isManager && !mgr.teamStatus) mgr.fetchTeamStatus()
    if (activeTab === 'exceptions' && isManager) mgr.fetchExceptions({ limit: 20 })
    if (activeTab === 'regularizations') {
      if (isManager) mgr.fetchPendingRegularizations()
    }
    if (activeTab === 'leave-approvals' && isManager) leaves.fetchPendingLeaves()
    if (activeTab === 'my-leaves') refetchCompOffCredits()
    if (activeTab === 'wfh-requests') wfhRequests.fetchMyRequests()
    if (activeTab === 'wfh-approvals' && isManager) wfhRequests.fetchPending()
    if (activeTab === 'stats' && isManager) mgr.fetchStats({ startDate: statsFrom, endDate: statsTo })
  }, [activeTab]) // eslint-disable-line

  // Fetch attendance data for the full calendar month whenever the user
  // navigates to a different month or first switches to the calendar tab.
  useEffect(() => {
    if (activeTab !== 'calendar') return
    const yr = calendarMonth.getFullYear()
    const mo = calendarMonth.getMonth()
    const start = `${yr}-${String(mo + 1).padStart(2, '0')}-01`
    const lastDay = new Date(yr, mo + 1, 0).getDate()
    const end = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    fetchCalendarHistory(start, end)
  }, [calendarMonth, activeTab]) // eslint-disable-line

  const handleCheckIn = async () => {
    setCheckingIn(true)
    setCompOffJustEarned(false)   // clear comp-off banner on new check-in
    try {
      const needsGps = workMode === 'OFFICE' || workMode === 'TRAVELLING'
      const coords   = needsGps ? await getCoords() : null

      // OFFICE check-in requires GPS to enforce geofence — block early with a
      // friendly message if location access was denied or unavailable.
      if (workMode === 'OFFICE' && !coords) {
        toast.error('Location access is required for office check-in. Please enable GPS and try again.')
        return
      }

      const result   = await checkIn({
        ...(coords ?? {}),
        isRemote: workMode === 'WFH',
        workMode,
      })
      const modeLabel: Record<WorkMode, string> = {
        OFFICE:     'at the office',
        WFH:        'remotely (WFH)',
        TRAVELLING: 'while travelling',
      }
      toast.success(result.isHoliday
        ? `Checked in — today is a public holiday`
        : `Checked in ${modeLabel[workMode]} at ${fmtTime(result.checkInAt)}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Check-in failed')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingIn(true)
    try {
      const coords = await getCoords()
      const result = await checkOut(coords ?? undefined)
      if (result.compOffEarned) {
        setCompOffJustEarned(true)
        leaves.fetchMyBalance()   // refresh balance display
      }
      toast.success('Checked out successfully')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Check-out failed')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleSubmitReg = async () => {
    if (!regModal || !regForm.requestedCheckIn || !regForm.reason) return
    try {
      const isSynthetic = regModal.record.id?.startsWith('absent-')
      await submitRegularization({
        ...(isSynthetic
          ? { date: String(regModal.record.date).slice(0, 10) }
          : { recordId: regModal.record.id }),
        requestedCheckIn: regForm.requestedCheckIn,
        requestedCheckOut: regForm.requestedCheckOut || undefined,
        reason: regForm.reason,
      })
      toast.success('Regularization request submitted')
      setRegModal(null)
      setRegForm({ requestedCheckIn: '', requestedCheckOut: '', reason: '' })
      refetchRegularizations()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit')
    }
  }

  const handleSubmitLeave = async () => {
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) return
    try {
      const result = await leaves.submitLeave({
        leaveTypeId: leaveForm.leaveTypeId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason || undefined,
      })
      toast.success(`Leave request submitted for ${result.days} day${result.days !== 1 ? 's' : ''}`)
      setLeaveModal(false)
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit leave')
    }
  }

  const handleReviewLeave = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewLeaveModal) return
    try {
      await leaves.reviewLeave(reviewLeaveModal.request.id, status, reviewNote || undefined)
      toast.success(`Leave ${status.toLowerCase()}`)
      setReviewLeaveModal(null)
      setReviewNote('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const handleReviewReg = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewRegModal) return
    try {
      await mgr.reviewRegularization(reviewRegModal.request.id, status, reviewNote || undefined)
      toast.success(`Regularization ${status.toLowerCase()}`)
      setReviewRegModal(null)
      setReviewNote('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const handleSubmitWFH = async () => {
    if (!wfhForm.startDate || !wfhForm.endDate) return
    try {
      await wfhRequests.submitRequest(wfhForm.startDate, wfhForm.endDate, wfhForm.mode, wfhForm.reason || undefined)
      toast.success('WFH request submitted')
      setWfhModal(false)
      setWfhForm({ startDate: '', endDate: '', mode: 'WFH', reason: '' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit WFH request')
    }
  }

  const handleReviewWFH = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewWFHModal) return
    try {
      await wfhRequests.reviewRequest(reviewWFHModal.request.id, status, wfhReviewNote || undefined)
      toast.success(`WFH request ${status.toLowerCase()}`)
      setReviewWFHModal(null)
      setWfhReviewNote('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  // ── Status badge ────────────────────────────────────────────────────────────

  const statusBadge = (() => {
    switch (todayStatus) {
      case 'ON_LEAVE':       return <Badge variant="info" dot>On Leave</Badge>
      case 'HOLIDAY':        return <Badge variant="secondary" dot>Holiday</Badge>
      case 'NOT_CHECKED_IN': return <Badge variant="secondary" dot>Not Checked In</Badge>
      case 'CHECKED_OUT':    return <Badge variant="success" dot>Checked Out</Badge>
      case 'PRESENT':        return <Badge variant="success" dot>Present</Badge>
      case 'LATE':           return <Badge variant="warning" dot>Late</Badge>
      case 'AUTO_CHECKED_OUT':return <Badge variant="secondary" dot>Auto Closed</Badge>
      default:               return null
    }
  })()

  const canCheckIn  = todayStatus === 'NOT_CHECKED_IN' || todayStatus === 'CHECKED_OUT'
  const canCheckOut = todayStatus === 'PRESENT' || todayStatus === 'LATE'

  // Off-day helper — uses the always-present workingDays field (not todayData.shift.workingDays,
  // which is null on off days because resolveShiftForUser returns null for non-working days).
  const shiftWorkingDays = todayData?.workingDays
  const isOffDay = (jsDay: number): boolean => {
    if (shiftWorkingDays && shiftWorkingDays.length > 0) {
      const isoDay = jsDay === 0 ? 7 : jsDay  // JS Sun=0 → ISO Sun=7
      return !shiftWorkingDays.includes(isoDay)
    }
    return jsDay === 0 || jsDay === 6           // default: Sat/Sun
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
    { id: 'my-attendance',   label: 'My Attendance',   icon: <Clock size={14} /> },
    { id: 'calendar',        label: 'Calendar',         icon: <Calendar size={14} /> },
    { id: 'my-leaves',       label: 'My Leaves',        icon: <Calendar size={14} /> },
    { id: 'wfh-requests',    label: 'WFH Requests',    icon: <Home size={14} /> },
    { id: 'regularizations', label: 'Regularizations',  icon: <ClipboardList size={14} /> },
    { id: 'team',            label: 'Team View',        icon: <Users size={14} />,         managerOnly: true },
    { id: 'staff-history',  label: 'Staff History',    icon: <History size={14} />,       managerOnly: true },
    { id: 'exceptions',     label: 'Exceptions',       icon: <AlertTriangle size={14} />, managerOnly: true },
    { id: 'leave-approvals', label: 'Leave Approvals',  icon: <CheckSquare size={14} />,   managerOnly: true },
    { id: 'wfh-approvals',   label: 'WFH Approvals',   icon: <Home size={14} />,          managerOnly: true },
    { id: 'stats',           label: 'Stats',            icon: <BarChart2 size={14} />,     managerOnly: true },
  ]

  // Calendar data — built from dedicated calendarHistory (fetched per-month),
  // separate from the My Attendance history so month navigation doesn't reset the list filter.
  const calendarRecordMap = useMemo(() => {
    const m = new Map<string, typeof calendarHistory[0]>()
    calendarHistory.forEach(r => { m.set(r.date.slice(0, 10), r) })
    return m
  }, [calendarHistory])

  // Holidays relevant to this employee (filtered by their country on the backend)
  // Re-fetches automatically when the calendar year changes
  const calendarYear = calendarMonth.getFullYear()
  const { holidays: calendarHolidays } = useHolidays(calendarYear)
  const holidayDateSet = useMemo(() => {
    const s = new Set<string>()
    calendarHolidays.forEach(h => s.add(h.date.slice(0, 10)))
    return s
  }, [calendarHolidays])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {todayData?.shift && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-500 dark:text-slate-400">{todayData.shift.name}</span>
              <span>·</span>
              <span>{todayData.shift.startTime} – {todayData.shift.endTime}</span>
              {todayData.shift.gracePeriodMinutes > 0 && (
                <><span>·</span><span>{todayData.shift.gracePeriodMinutes} min grace</span></>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge}
          {/* Work mode selector — only shows modes the employee is whitelisted for */}
          {canCheckIn && allowedModes.length > 1 && (
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {allowedModes.includes('OFFICE') && (
                <button
                  onClick={() => setWorkMode('OFFICE')}
                  title="Office (geofence enforced)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    workMode === 'OFFICE'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Building2 size={12} />Office
                </button>
              )}
              {allowedModes.includes('WFH') && (
                <button
                  onClick={() => setWorkMode('WFH')}
                  title="Work from home (no GPS)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${
                    workMode === 'WFH'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Home size={12} />WFH
                </button>
              )}
              {allowedModes.includes('TRAVELLING') && (
                <button
                  onClick={() => setWorkMode('TRAVELLING')}
                  title="Travelling (GPS captured, no geofence)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${
                    workMode === 'TRAVELLING'
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Plane size={12} />Travelling
                </button>
              )}
            </div>
          )}
          {canCheckIn && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap ${
                workMode === 'WFH'        ? 'bg-purple-600 hover:bg-purple-700' :
                workMode === 'TRAVELLING' ? 'bg-amber-500 hover:bg-amber-600'   :
                                            'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {checkingIn ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              {workMode === 'WFH' ? 'Check In (WFH)' : workMode === 'TRAVELLING' ? 'Check In (Travelling)' : 'Check In'}
            </button>
          )}
          {canCheckOut && (
            <button
              onClick={handleCheckOut}
              disabled={checkingIn}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {checkingIn ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Check Out
            </button>
          )}
        </div>
      </div>

      {/* ── Holiday banner ── */}
      {todayData?.isHoliday && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-sm dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-200">
          <Calendar size={14} />
          <span>Today is a public holiday — <strong>{todayData.holiday?.name}</strong></span>
        </div>
      )}

      {/* ── Approved WFH banner ── */}
      {todayApprovedWFH && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-sm dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-200">
          {todayApprovedWFH.mode === 'TRAVELLING' ? <Plane size={14} /> : <Home size={14} />}
          <span>
            {todayApprovedWFH.mode === 'TRAVELLING'
              ? 'Travel approved for today — check in while travelling.'
              : 'WFH approved for today — you can check in remotely.'}
          </span>
        </div>
      )}

      {/* ── Comp Off earned banner ── */}
      {compOffJustEarned && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300">
          <span>🎁</span>
          <span className="font-medium">Comp Off Earned — 1 day credited to your leave balance</span>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <StatCard label="Today's Status" value={STATUS_LABELS[todayStatus] ?? todayStatus.replace(/_/g, ' ')} sub={todayRecord ? fmtDate(todayRecord.date) : 'No record yet'} />
        <StatCard
          label="Check-In Time"
          value={fmtTime(todayRecord?.firstCheckInAt ?? todayRecord?.checkInAt)}
          sub={
            todayRecord?.minutesLate
              ? `${todayRecord.minutesLate}m late`
              : (todayRecord?.firstCheckInAt ?? todayRecord?.checkInAt)
                ? (todayRecord.shiftId ? 'On time' : 'Checked in')
                : ''
          }
        />
        <StatCard
          label="Hours Worked"
          value={
            todayRecord?.checkOutAt
              ? fmtMinutes(todayRecord.workMinutes)    // server value after checkout — always matches history
              : liveSecs != null
                ? fmtLiveDuration(liveSecs)            // live HH:MM:SS tick while active
                : '—'
          }
          sub={todayRecord?.checkOutAt ? 'Completed' : todayRecord?.checkInAt ? 'In progress' : 'Not started'}
        />
        <StatCard
          label="Leave Balance"
          value={`${leaves.myBalance.reduce((s, b) => s + (b.allocated - b.used - b.pending), 0).toFixed(1)} days`}
          sub="Across all types"
        />
      </div>

      {/* ── Tabs ── */}
      <div className="overflow-x-auto hide-scrollbar border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-0.5 min-w-max">
        {TABS.filter(t => !t.managerOnly || isManager).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs sm:text-sm sm:px-3 sm:py-2.5 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-100 dark:hover:text-white'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: My Attendance */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'my-attendance' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-medium text-slate-800 dark:text-slate-200">My Attendance History</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm">
                <input
                  type="date"
                  value={historyFrom}
                  onChange={e => {
                    setHistoryFrom(e.target.value)
                    if (e.target.value && historyTo) refetchHistory({ startDate: e.target.value, endDate: historyTo })
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400 dark:text-slate-500">to</span>
                <input
                  type="date"
                  value={historyTo}
                  onChange={e => {
                    setHistoryTo(e.target.value)
                    if (historyFrom && e.target.value) refetchHistory({ startDate: historyFrom, endDate: e.target.value })
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {(historyFrom || historyTo) && (
                  <button
                    onClick={() => {
                      const now = new Date()
                      const day = now.getDay()
                      const diff = day === 0 ? -6 : 1 - day
                      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
                      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
                      const f = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
                      const t = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`
                      setHistoryFrom(f); setHistoryTo(t); refetchHistory({ startDate: f, endDate: t })
                    }}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 px-1.5"
                    title="Reset to current week"
                  >&times;</button>
                )}
              </div>
              <button
                onClick={() => {
                  const csv = toCSV(
                    ['Date','Check In','Check Out','Hours','Overtime','Status','Late (min)','Work Mode','Exceptions'],
                    history.map(r => {
                      const wm = r.workMinutes ?? (r.checkInAt && r.checkOutAt ? Math.floor((new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 60000) : null)
                      const mode = r.workMode ?? (r.isRemote ? 'WFH' : 'OFFICE')
                      return [fmtDate(r.date), fmtTime(r.firstCheckInAt ?? r.checkInAt), fmtTime(r.checkOutAt), wm != null ? fmtMinutes(wm) : '', r.overtimeMinutes ? `+${fmtMinutes(r.overtimeMinutes)}` : '', r.status, r.minutesLate ?? '', mode, r.exceptions?.map(e => e.type).join('; ') ?? '']
                    })
                  )
                  downloadCSV('my-attendance.csv', csv)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                onClick={() => setWfhModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
              >
                <Home size={13} /> Request WFH / Travel
              </button>
              <button
                onClick={() => setLeaveModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <Calendar size={13} /> Apply Leave
              </button>
            </div>
          </div>
          {attendanceLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400 dark:text-slate-500" /></div>
          ) : history.length === 0 ? (
            <EmptyState icon={<Clock size={32} />} text="No attendance records yet." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {['Date','Check In','Check Out','Hours','Overtime','Status','Flags','Regularize'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => {
                    const regPending = r.regularization?.status === 'PENDING'
                    // For today's active (checked-in, not yet checked-out) row, use the live
                    // seconds counter so Hours column stays in sync with the stat card.
                    const isTodayLive = r.id === todayRecord?.id && !r.checkOutAt && liveSecs != null
                    const wm = regPending ? null : isTodayLive
                      ? Math.floor(liveSecs! / 60)
                      : (r.workMinutes ?? (r.checkInAt && r.checkOutAt
                          ? Math.floor((new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 60000)
                          : null))
                    // Determine whether this record falls on an off day so we can
                    // replace the normal status/flags with a plain "Day Off" label.
                    const rowJsDay = new Date(String(r.date)).getUTCDay()
                    const rowIsOffDay = isOffDay(rowJsDay)
                    return (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium">{fmtDate(r.date)}</td>
                        <td className="px-4 py-3">{regPending || r.isOnLeave || r.isHoliday ? '—' : fmtTime(r.firstCheckInAt ?? r.checkInAt)}</td>
                        <td className="px-4 py-3">{regPending || r.isOnLeave || r.isHoliday ? '—' : fmtTime(r.checkOutAt)}</td>
                        <td className="px-4 py-3">{fmtMinutes(wm)}</td>
                        <td className="px-4 py-3">
                          {r.overtimeMinutes && r.overtimeMinutes > 0
                            ? <span className="text-emerald-600 font-medium text-xs">+{fmtMinutes(r.overtimeMinutes)}</span>
                            : <span className="text-slate-400 dark:text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {regPending
                            ? <Badge variant="warning">Pending</Badge>
                            : rowIsOffDay
                              ? <Badge variant="secondary" dot>Day Off</Badge>
                              : <>
                                  {getStatusBadge(r.isOnLeave ? 'ON_LEAVE' : r.isHoliday ? 'HOLIDAY' : r.status)}
                                  {r.status === 'LATE' && (r.minutesLate ?? 0) > 0 && (
                                    <span className="text-xs text-amber-600 ml-1 whitespace-nowrap">{r.minutesLate}m late</span>
                                  )}
                                </>}
                        </td>
                        <td className="px-4 py-3">
                          {/* On off-day check-ins, suppress all flags — only "Day Off" status is shown */}
                          {!rowIsOffDay && <div className="flex flex-wrap gap-1">
                            {(r.workMode === 'WFH'   || (!r.workMode && r.isRemote)) && <Badge variant="secondary"><Home size={10} className="inline mr-0.5" />WFH</Badge>}
                            {r.workMode === 'TRAVELLING' && <Badge variant="warning"><Plane size={10} className="inline mr-0.5" />Travelling</Badge>}
                            {/* Deduplicate by type — multi-session days generate one exception per session */}
                            {Array.from(new Map(
                              r.exceptions?.filter(e => !e.isReviewed).map(e => [e.type, e]) ?? []
                            ).values()).map(e => (
                              <span key={e.type}>{getExceptionBadge(e.type)}</span>
                            ))}
                            {r.isWithinGeofence === false && (
                              <Badge variant="danger">
                                <MapPin size={10} className="inline mr-0.5" />Out of zone
                              </Badge>
                            )}
                          </div>}
                        </td>
                        <td className="px-4 py-3">
                          {!r.isOnLeave && r.regularization?.status !== 'PENDING' && r.regularization?.status !== 'APPROVED' && (
                            <button
                              onClick={() => {
  const dateStr = String(r.date).slice(0, 10)
  const isAbsent = r.status === 'ABSENT' || (r as any)._synthetic
  const defaultCheckIn  = isAbsent ? `${dateStr}T09:00` : ((r.firstCheckInAt ?? r.checkInAt)?.slice(0, 16) ?? `${dateStr}T09:00`)
  const defaultCheckOut = isAbsent ? `${dateStr}T17:00` : (r.checkOutAt?.slice(0, 16) ?? '')
  setRegModal({ record: r })
  setRegForm({ requestedCheckIn: defaultCheckIn, requestedCheckOut: defaultCheckOut, reason: '' })
}}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                            >
                              <ChevronRight size={12} /> Regularize
                            </button>
                          )}
                          {r.regularization?.status === 'PENDING' && (
                            <span className="text-xs text-amber-600 font-medium">Pending</span>
                          )}
                          {r.regularization?.status === 'APPROVED' && (
                            <span className="text-xs text-emerald-600 font-medium">Corrected</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {history.length < historyTotal && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => loadMoreHistory()}
                    disabled={attendanceLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {attendanceLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Loading…</>
                      : `Load more (${historyTotal - history.length} remaining)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Calendar */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (() => {
        const year  = calendarMonth.getFullYear()
        const month = calendarMonth.getMonth()
        const firstDay = new Date(year, month, 1).getDay() // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const today = new Date()

        // Build a YYYY-MM-DD key from LOCAL date parts — never use toISOString()
        // because that converts to UTC first, shifting the date in UTC+ timezones.
        const makeKey = (y: number, m: number, d: number): string =>
          `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

        // isOffDay is defined at component scope so it's shared with the history table.

        // statusColor now receives the precomputed key to avoid a second
        // toISOString() conversion inside the function.
        const todayKey = makeKey(today.getFullYear(), today.getMonth(), today.getDate())

        const statusColor = (date: Date, key: string): string => {
          const jsDay = date.getDay()
          // Off days (weekends or shift rest days): mute only if there is no record.
          // If the employee worked on an off day, show the actual status colour.
          if (isOffDay(jsDay)) {
            const rec = calendarRecordMap.get(key)
            if (!rec) return 'bg-slate-100 dark:bg-slate-800 opacity-40'
            return 'bg-cyan-100 dark:bg-cyan-900/40 hover:bg-cyan-200'  // worked on off day
          }
          // Show holiday color for both past and future holidays
          if (holidayDateSet.has(key)) return 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
          // Today and future dates: no colour — shift may still be in progress
          if (key >= todayKey) return 'bg-transparent'
          const rec = calendarRecordMap.get(key)
          if (!rec || rec.status === 'ABSENT') return 'bg-red-100 dark:bg-red-900/40 hover:bg-red-200'
          if (rec.isOnLeave || rec.status === 'ON_LEAVE') return 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200'
          if (rec.isHoliday) return 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
          if (rec.status === 'LATE') return 'bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200'
          if (rec.status === 'HALF_DAY') return 'bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200'
          if (rec.status === 'AUTO_CHECKED_OUT') return 'bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200'
          return 'bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200'
        }

        return (
          <div>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 flex-wrap text-xs text-slate-600 dark:text-slate-400">
              {[
                { color: 'bg-emerald-300', label: 'Present' },
                { color: 'bg-amber-300', label: 'Late' },
                { color: 'bg-purple-300', label: 'Half Day' },
                { color: 'bg-orange-300', label: 'Auto Closed' },
                { color: 'bg-blue-300', label: 'On Leave' },
                { color: 'bg-red-300', label: 'Absent' },
                { color: 'bg-cyan-300', label: 'Worked on Day Off' },
                { color: 'bg-slate-300', label: 'Holiday / Day Off' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${color}`} />
                  {label}
                </div>
              ))}
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {calendarMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day  = i + 1
                const date = new Date(year, month, day)
                const key  = makeKey(year, month, day)   // local YYYY-MM-DD, no UTC shift
                const rec  = calendarRecordMap.get(key)
                const isToday = date.toDateString() === today.toDateString()
                return (
                  <button
                    key={i}
                    onClick={() => handleCalendarDayClick(date, rec ?? null)}
                    className={`relative rounded-lg p-1.5 text-xs transition-colors ${statusColor(date, key)} ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                  >
                    <span className={`font-medium ${isToday ? 'text-blue-600' : 'text-slate-700 dark:text-slate-300'}`}>{i + 1}</span>
                    {(rec?.workMode === 'TRAVELLING') && <Plane size={8} className="absolute top-0.5 right-0.5 text-amber-500" />}
                    {(rec?.workMode === 'WFH' || (!rec?.workMode && rec?.isRemote)) && <Home size={8} className="absolute top-0.5 right-0.5 text-purple-500" />}
                    {(rec?.firstCheckInAt ?? rec?.checkInAt) && !rec.checkOutAt && !rec.autoCheckedOut && (
                      <span className="block text-[9px] text-blue-500 leading-none mt-0.5">{fmtTime(rec.firstCheckInAt ?? rec.checkInAt)}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Detail popover */}
            {calendarDetail && (
              <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {calendarDetail.date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <button onClick={() => setCalendarDetail(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xs">✕ Close</button>
                </div>
                {calendarDetail.record ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-xs text-slate-500 dark:text-slate-400">Status</div><div>{getStatusBadge(calendarDetail.record.status)}</div></div>
                    <div><div className="text-xs text-slate-500 dark:text-slate-400">Check In</div><div className="font-medium">{calendarDetail.record.isOnLeave || calendarDetail.record.isHoliday ? '—' : fmtTime(calendarDetail.record.firstCheckInAt ?? calendarDetail.record.checkInAt)}</div></div>
                    <div><div className="text-xs text-slate-500 dark:text-slate-400">Check Out</div><div className="font-medium">{calendarDetail.record.isOnLeave || calendarDetail.record.isHoliday ? '—' : fmtTime(calendarDetail.record.checkOutAt)}</div></div>
                    <div><div className="text-xs text-slate-500 dark:text-slate-400">Hours</div><div className="font-medium">{fmtMinutes(calendarDetail.record.workMinutes)}</div></div>
                    {calendarDetail.record.overtimeMinutes && calendarDetail.record.overtimeMinutes > 0 && (
                      <div><div className="text-xs text-slate-500 dark:text-slate-400">Overtime</div><div className="font-medium text-emerald-600">+{fmtMinutes(calendarDetail.record.overtimeMinutes)}</div></div>
                    )}
                    {(calendarDetail.record.workMode === 'WFH' || (!calendarDetail.record.workMode && calendarDetail.record.isRemote)) && (
                      <div><div className="text-xs text-slate-500 dark:text-slate-400">Mode</div><div className="text-purple-600 flex items-center gap-1"><Home size={12} /> WFH</div></div>
                    )}
                    {calendarDetail.record.workMode === 'TRAVELLING' && (
                      <div><div className="text-xs text-slate-500 dark:text-slate-400">Mode</div><div className="text-amber-500 flex items-center gap-1"><Plane size={12} /> Travelling</div></div>
                    )}
                    {(calendarDetail.record.exceptions?.length ?? 0) > 0 && (
                      <div className="col-span-2 sm:col-span-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Exceptions</div>
                        <div className="flex flex-wrap gap-1">{Array.from(new Map(calendarDetail.record.exceptions?.map(e => [e.type, e]) ?? []).values()).map(e => <span key={e.type}>{getExceptionBadge(e.type)}</span>)}</div>
                      </div>
                    )}
                    {(calendarDetail.record.checkInLat != null && calendarDetail.record.checkInLng != null) && (
                      <div className="col-span-2 sm:col-span-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Check-in Location</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={`https://maps.google.com/?q=${calendarDetail.record.checkInLat},${calendarDetail.record.checkInLng}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <MapPin size={11} />
                            {(calendarDetail.record.checkInLat as number).toFixed(5)}, {(calendarDetail.record.checkInLng as number).toFixed(5)}
                            · View on Map
                          </a>
                          {calendarDetail.record.isWithinGeofence === false && (
                            <span className="text-xs text-red-600 font-medium">⚠ Outside geofence</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (() => {
                  const jsDay = calendarDetail.date.getDay()
                  const detailKey = makeKey(
                    calendarDetail.date.getFullYear(),
                    calendarDetail.date.getMonth(),
                    calendarDetail.date.getDate()
                  )
                  const isHolidayDay = holidayDateSet.has(detailKey)
                  const holiday = isHolidayDay
                    ? calendarHolidays.find(h => h.date.slice(0, 10) === detailKey)
                    : null
                  return (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      {isOffDay(jsDay)
                        ? 'Day Off'
                        : isHolidayDay
                          ? `🎉 Public holiday${holiday?.name ? ` — ${holiday.name}` : ''}`
                          : detailKey >= todayKey
                            ? 'No record yet'
                            : 'No attendance record — marked absent'}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })()}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: My Leaves */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'my-leaves' && (
        <div className="space-y-6">
          {/* Balance cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-slate-800 dark:text-slate-200">Leave Balances ({new Date().getFullYear()})</h2>
              <button
                onClick={() => setLeaveModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <Calendar size={13} /> Apply for Leave
              </button>
            </div>
            {leaves.myBalance.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No leave types configured.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {leaves.myBalance.map(b => {
                  const remaining = b.allocated - b.used - b.pending
                  return (
                    <div key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: b.leaveType?.color ?? '#2563eb' }} />
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{b.leaveType?.name}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                        {[['Allocated', b.allocated], ['Used', b.used], ['Pending', b.pending], ['Remaining', remaining]].map(([l, v]) => (
                          <div key={l as string}>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{(v as number).toFixed(1)}</div>
                            <div className="text-slate-500 dark:text-slate-400">{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* My leave requests */}
          <div>
            <h2 className="font-medium text-slate-800 dark:text-slate-200 mb-3">My Leave Requests</h2>
            {leaves.myLeaves.length === 0 ? (
              <EmptyState icon={<Calendar size={32} />} text="No leave requests yet." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      {['Leave Type','From','To','Days','Status','Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.myLeaves.slice(0, leavesShown).map(l => (
                      <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.leaveType?.color ?? '#2563eb' }} />
                            {l.leaveType?.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">{fmtDate(l.startDate)}</td>
                        <td className="px-4 py-3">{fmtDate(l.endDate)}</td>
                        <td className="px-4 py-3">{l.days}</td>
                        <td className="px-4 py-3">
                          <Badge variant={l.status === 'APPROVED' ? 'success' : l.status === 'REJECTED' || l.status === 'CANCELLED' ? 'danger' : 'warning'}>{l.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {l.status === 'PENDING' && (
                            <button
                              onClick={async () => { if (confirm('Cancel this leave request?')) { await leaves.cancelLeave(l.id); toast.success('Cancelled') } }}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >Cancel</button>
                          )}
                          {l.status === 'APPROVED' && new Date(l.startDate) > new Date() && (
                            <button
                              onClick={async () => {
                                if (!confirm('Cancel this approved leave? The days will be returned to your balance.')) return
                                await leaves.cancelApprovedLeave(l.id)
                                toast.success('Leave cancelled — days returned to your balance')
                              }}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >Cancel</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leaves.myLeaves.length > leavesShown && (
                  <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setLeavesShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                      Load more ({leaves.myLeaves.length - leavesShown} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comp Off Credit History — only shown when org has a comp-off leave type */}
          {leaves.myBalance.some(b => b.leaveType?.isCompOff) && (
            <div>
              <h2 className="font-medium text-slate-800 dark:text-slate-200 mb-3">Comp Off Credits</h2>
              {compOffCredits.length === 0 ? (
                <EmptyState icon={<Calendar size={32} />} text="No comp off credits yet. Credits are earned when you work on a holiday or your scheduled day off." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {['Date Worked', 'Type', 'Earned On', 'Expires', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compOffCredits.slice(0, compOffShown).map(c => (
                        <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3">{fmtDate(c.workedDate)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={c.workType === 'HOLIDAY' ? 'purple' : 'warning'}>
                              {c.workType === 'HOLIDAY' ? 'Holiday' : 'Off Day'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{fmtDate(c.earnedAt)}</td>
                          <td className="px-4 py-3">{fmtDate(c.expiresAt)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={c.status === 'AVAILABLE' ? 'success' : c.status === 'EXPIRED' ? 'danger' : 'secondary'}>
                              {c.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {compOffCredits.length > compOffShown && (
                    <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setCompOffShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Load more ({compOffCredits.length - compOffShown} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: WFH Requests */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'wfh-requests' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-800 dark:text-slate-200">My WFH / Travel Requests</h2>
            <button
              onClick={() => setWfhModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <Home size={13} /> New Request
            </button>
          </div>
          {wfhRequests.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400 dark:text-slate-500" /></div>
          ) : wfhRequests.myRequests.length === 0 ? (
            <EmptyState icon={<Home size={32} />} text="No WFH requests yet." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {['Mode','From','To','Status','Reason','Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wfhRequests.myRequests.slice(0, wfhShown).map((r: WFHRequest) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.mode === 'WFH' ? <Home size={13} className="text-purple-500" /> : <Plane size={13} className="text-amber-500" />}
                          {r.mode === 'WFH' ? 'WFH' : 'Travelling'}
                        </div>
                      </td>
                      <td className="px-4 py-3">{fmtDate(r.startDate)}</td>
                      <td className="px-4 py-3">{fmtDate(r.endDate)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{r.reason ?? '—'}</td>
                      <td className="px-4 py-3">
                        {r.status === 'PENDING' && (
                          <button
                            onClick={async () => {
                              if (confirm('Cancel this WFH request?')) {
                                await wfhRequests.cancelRequest(r.id)
                                toast.success('Cancelled')
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wfhRequests.myRequests.length > wfhShown && (
                <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setWfhShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Load more ({wfhRequests.myRequests.length - wfhShown} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: WFH Approvals */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'wfh-approvals' && isManager && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-800 dark:text-slate-200">Pending WFH / Travel Requests</h2>
            <button onClick={wfhRequests.fetchPending} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
          </div>
          {wfhRequests.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400 dark:text-slate-500" /></div>
          ) : wfhRequests.pendingRequests.length === 0 ? (
            <EmptyState icon={<CheckSquare size={32} />} text="No pending WFH requests." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {['Employee','Mode','From','To','Reason','Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wfhRequests.pendingRequests.slice(0, wfhPendingShown).map((r: WFHRequest) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium">{r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.mode === 'WFH' ? <Home size={13} className="text-purple-500" /> : <Plane size={13} className="text-amber-500" />}
                          {r.mode === 'WFH' ? 'WFH' : 'Travelling'}
                        </div>
                      </td>
                      <td className="px-4 py-3">{fmtDate(r.startDate)}</td>
                      <td className="px-4 py-3">{fmtDate(r.endDate)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{r.reason ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setReviewWFHModal({ request: r }); setWfhReviewNote('') }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wfhRequests.pendingRequests.length > wfhPendingShown && (
                <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setWfhPendingShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Load more ({wfhRequests.pendingRequests.length - wfhPendingShown} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Stats */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'stats' && isManager && (
        <div className="space-y-6">
          {/* Date range filter */}
          <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">From</label>
              <input
                type="date"
                value={statsFrom}
                onChange={e => setStatsFrom(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">To</label>
              <input
                type="date"
                value={statsTo}
                onChange={e => setStatsTo(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => mgr.fetchStats({ startDate: statsFrom, endDate: statsTo })}
              disabled={mgr.statsLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {mgr.statsLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>

          {mgr.statsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400 dark:text-slate-500" /></div>
          ) : mgr.stats ? (
            <div className="space-y-6">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Attendance Rate', value: `${mgr.stats.summary.attendanceRate}%`, color: 'text-emerald-600' },
                  { label: 'Late Days',        value: mgr.stats.summary.lateDays,             color: 'text-amber-600'  },
                  { label: 'Absent Days',      value: mgr.stats.summary.absentDays,           color: 'text-red-600'    },
                  { label: 'Leave Days',       value: mgr.stats.summary.leaveDays,            color: 'text-sky-600'    },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center bg-white dark:bg-slate-800">
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Exception breakdown */}
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">Exception Breakdown</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {['Exception Type', 'Count'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.entries(mgr.stats.exceptionBreakdown) as [string, number][]).map(([type, count]) => (
                        <tr key={type} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3">{getExceptionBadge(type)}</td>
                          <td className="px-4 py-3 font-medium">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-employee table */}
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">Per Employee</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {['Employee', 'Present', 'Late', 'Absent', 'Leave Days', 'Overtime'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mgr.stats.byEmployee.map(emp => (
                        <tr key={emp.userId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">{emp.name}</td>
                          <td className="px-4 py-3 text-emerald-600">{emp.present}</td>
                          <td className="px-4 py-3 text-amber-600">{emp.late}</td>
                          <td className="px-4 py-3 text-red-600">{emp.absent}</td>
                          <td className="px-4 py-3 text-sky-600">{emp.leaveDays}</td>
                          <td className="px-4 py-3 text-emerald-600">
                            {emp.overtimeMinutes > 0 ? `+${fmtMinutes(emp.overtimeMinutes)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<BarChart2 size={32} />} text="Set a date range and click Search to view attendance statistics." />
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Team View */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'team' && isManager && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-800 dark:text-slate-200">Team Status — Today</h2>
            <button onClick={mgr.fetchTeamStatus} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
          </div>
          {mgr.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400 dark:text-slate-500" /></div>
          ) : mgr.teamStatus ? (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: 'Present',     count: mgr.teamStatus.present.length,    color: 'text-emerald-600' },
                  { label: 'Late',        count: mgr.teamStatus.late.length,        color: 'text-amber-600' },
                  { label: 'Checked Out', count: mgr.teamStatus.checkedOut.length,  color: 'text-slate-600 dark:text-slate-400' },
                  { label: 'On Leave',    count: mgr.teamStatus.onLeave.length,     color: 'text-sky-600' },
                  { label: 'Absent',      count: mgr.teamStatus.absent.length,      color: 'text-red-600' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                    <div className={`text-2xl font-bold ${color}`}>{count}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Team grid */}
              {(
                [
                  { title: 'Present', items: mgr.teamStatus.present, variant: 'success' as const },
                  { title: 'Late', items: mgr.teamStatus.late, variant: 'warning' as const },
                  { title: 'Checked Out', items: mgr.teamStatus.checkedOut, variant: 'secondary' as const },
                  { title: 'On Leave', items: mgr.teamStatus.onLeave, variant: 'info' as const },
                  { title: 'Absent', items: mgr.teamStatus.absent, variant: 'danger' as const },
                ] as const
              ).filter(g => g.items.length > 0).map(group => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">{group.title} ({group.items.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(group.items as Array<{ user?: { id: string; firstName: string; lastName: string; email: string }; checkInAt?: string | null; leaveType?: { name: string; color: string } }>).map(item => {
                      const u = item.user
                      return (
                        <div key={u?.id ?? Math.random()} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-1">
                          <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</div>
                          <Badge variant={group.variant} dot className="w-fit text-xs">{group.title}</Badge>
                          {item.checkInAt && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{fmtTime(item.checkInAt)}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users size={32} />} text="Click refresh to load team status." />
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Staff History                             */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'staff-history' && isManager && (() => {
        // Build a deduplicated, sorted list of all team members from every status group
        const memberMap = new Map<string, { id: string; firstName: string; lastName: string }>()
        const addMember = (u?: { id: string; firstName: string; lastName: string }) => {
          if (u) memberMap.set(u.id, u)
        }
        if (mgr.teamStatus) {
          mgr.teamStatus.present.forEach(r => addMember(r.user))
          mgr.teamStatus.late.forEach(r => addMember(r.user))
          mgr.teamStatus.checkedOut.forEach(r => addMember(r.user))
          mgr.teamStatus.onLeave.forEach(r => addMember(r.user))
          mgr.teamStatus.absent.forEach(r => addMember(r.user))
        }
        const allMembers = Array.from(memberMap.values())
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))

        const handleSearch = () => {
          if (!staffHistoryUserId) return
          mgr.fetchHistory({
            userId: staffHistoryUserId,
            startDate: staffHistoryStart || undefined,
            endDate:   staffHistoryEnd   || undefined,
          })
        }

        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-slate-800 dark:text-slate-200">Staff Attendance History</h2>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Employee</label>
                <select
                  value={staffHistoryUserId}
                  onChange={e => { setStaffHistoryUserId(e.target.value) }}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select employee…</option>
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">From</label>
                <input
                  type="date"
                  value={staffHistoryStart}
                  onChange={e => setStaffHistoryStart(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={staffHistoryEnd}
                  onChange={e => setStaffHistoryEnd(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={!staffHistoryUserId || mgr.loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {mgr.loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </button>
            </div>

            {/* Results */}
            {mgr.loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400 dark:text-slate-500" /></div>
            ) : !staffHistoryUserId ? (
              <EmptyState icon={<Users size={32} />} text="Select an employee above to view their attendance history." />
            ) : mgr.historyRecords.length === 0 ? (
              <EmptyState icon={<History size={32} />} text="No attendance records found for the selected period." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      {['Date', 'Check In', 'Check Out', 'Hours', 'Overtime', 'Status', 'Flags'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mgr.historyRecords.map(r => {
                      const wm = r.workMinutes ?? (r.checkInAt && r.checkOutAt
                        ? Math.floor((new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 60000)
                        : null)
                      const rowJsDay = new Date(String(r.date)).getUTCDay()
                      // Use the fetched employee's workingDays — not the manager's own shift
                      const rowIsOffDay = (() => {
                        const wd = mgr.historyUserWorkingDays
                        if (wd && wd.length > 0) {
                          const isoDay = rowJsDay === 0 ? 7 : rowJsDay
                          return !wd.includes(isoDay)
                        }
                        return rowJsDay === 0 || rowJsDay === 6
                      })()
                      return (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">{fmtDate(r.date)}</td>
                          <td className="px-4 py-3">{fmtTime(r.firstCheckInAt ?? r.checkInAt)}</td>
                          <td className="px-4 py-3">{fmtTime(r.checkOutAt)}</td>
                          <td className="px-4 py-3">{fmtMinutes(wm)}</td>
                          <td className="px-4 py-3">
                            {r.overtimeMinutes && r.overtimeMinutes > 0
                              ? <span className="text-emerald-600 font-medium text-xs">+{fmtMinutes(r.overtimeMinutes)}</span>
                              : <span className="text-slate-400 dark:text-slate-500">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {rowIsOffDay
                              ? <Badge variant="secondary" dot>Day Off</Badge>
                              : getStatusBadge(r.isOnLeave ? 'ON_LEAVE' : r.isHoliday ? 'HOLIDAY' : r.status)}
                          </td>
                          <td className="px-4 py-3">
                            {!rowIsOffDay && <div className="flex flex-wrap gap-1">
                              {(r.workMode === 'WFH' || (!r.workMode && r.isRemote)) && <Badge variant="secondary"><Home size={10} className="inline mr-0.5" />WFH</Badge>}
                              {r.workMode === 'TRAVELLING' && <Badge variant="warning"><Plane size={10} className="inline mr-0.5" />Travelling</Badge>}
                              {Array.from(new Map(
                                r.exceptions?.filter(e => !e.isReviewed).map(e => [e.type, e]) ?? []
                              ).values()).map(e => (
                                <span key={e.type}>{getExceptionBadge(e.type)}</span>
                              ))}
                            </div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {mgr.historyTotal > mgr.historyRecords.length && (
                  <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    Showing {mgr.historyRecords.length} of {mgr.historyTotal} records
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Exceptions */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'exceptions' && isManager && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-800 dark:text-slate-200">Attendance Exceptions</h2>
            <div className="flex gap-2">
              <button onClick={() => mgr.fetchExceptions({ isReviewed: false, limit: 20 })} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Unreviewed</button>
              <button onClick={() => mgr.fetchExceptions({ limit: 20 })} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">All</button>
            </div>
          </div>
          {mgr.exceptions.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={32} />} text="No exceptions found." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {['Employee','Date','Type','Details','Status','Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Group by (recordId, type) — multi-session days generate one exception per session */}
                  {Array.from(
                    mgr.exceptions.reduce((map, e) => {
                      const key = `${e.recordId ?? e.id}:${e.type}`
                      const existing = map.get(key)
                      if (existing) { existing.ids.push(e.id) }
                      else { map.set(key, { exception: e, ids: [e.id] }) }
                      return map
                    }, new Map<string, { exception: AttendanceException; ids: string[] }>())
                    .values()
                  ).map(({ exception: e, ids }) => (
                    <tr key={`${e.recordId ?? e.id}:${e.type}`} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium">{e.user ? `${e.user.firstName} ${e.user.lastName}` : '—'}</td>
                      <td className="px-4 py-3">{fmtDate(e.record?.date)}</td>
                      <td className="px-4 py-3">{getExceptionBadge(e.type)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{e.details ?? '—'}</td>
                      <td className="px-4 py-3">
                        {e.isReviewed ? <Badge variant="success">Reviewed</Badge> : <Badge variant="warning">Pending</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {!e.isReviewed && (
                          <button
                            onClick={async () => {
                              await Promise.all(ids.map(id => mgr.reviewException(id)))
                              toast.success('Marked as reviewed')
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >Mark Reviewed</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mgr.exceptionsTotal > mgr.exceptions.length && (
                <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => mgr.loadMoreExceptions()}
                    disabled={mgr.loading}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    {mgr.loading ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : `Load more (${mgr.exceptionsTotal - mgr.exceptions.length} remaining)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Regularizations */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'regularizations' && (
        <div className="space-y-6">
          {/* Employee: own requests */}
          <div>
            <h2 className="font-medium text-slate-800 dark:text-slate-200 mb-3">My Regularization Requests</h2>
            {myRegularizations.length === 0 ? (
              <EmptyState icon={<ClipboardList size={32} />} text="No regularization requests yet." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      {['Date','Requested Check In','Requested Check Out','Reason','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myRegularizations.slice(0, myRegShown).map((r: RegularizationRequest) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">{fmtDate(r.record?.date)}</td>
                        <td className="px-4 py-3">{fmtTime(r.requestedCheckIn)}</td>
                        <td className="px-4 py-3">{fmtTime(r.requestedCheckOut)}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{r.reason}</td>
                        <td className="px-4 py-3">
                          <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>{r.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {myRegularizations.length > myRegShown && (
                  <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setMyRegShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                      Load more ({myRegularizations.length - myRegShown} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manager: pending requests */}
          {isManager && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium text-slate-800 dark:text-slate-200">Pending Approvals</h2>
                <button onClick={mgr.fetchPendingRegularizations} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
              </div>
              {mgr.pendingRegularizations.length === 0 ? (
                <EmptyState icon={<CheckSquare size={32} />} text="No pending regularizations." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {['Employee','Date','Current In/Out','Requested In/Out','Reason','Action'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mgr.pendingRegularizations.slice(0, pendingRegShown).map((r: RegularizationRequest) => (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">{r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}</td>
                          <td className="px-4 py-3">{fmtDate(r.record?.date)}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{fmtTime(r.record?.firstCheckInAt ?? r.record?.checkInAt)} / {fmtTime(r.record?.checkOutAt)}</td>
                          <td className="px-4 py-3">{fmtTime(r.requestedCheckIn)} / {fmtTime(r.requestedCheckOut)}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{r.reason}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setReviewRegModal({ request: r }); setReviewNote('') }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Review</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mgr.pendingRegularizations.length > pendingRegShown && (
                    <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setPendingRegShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Load more ({mgr.pendingRegularizations.length - pendingRegShown} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Tab: Leave Approvals */}
      {/* ─────────────────────────────────────────────── */}
      {activeTab === 'leave-approvals' && isManager && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-800 dark:text-slate-200">Pending Leave Requests</h2>
            <button onClick={leaves.fetchPendingLeaves} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
          </div>
          {leaves.pendingLeaves.length === 0 ? (
            <EmptyState icon={<CheckSquare size={32} />} text="No pending leave requests." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {['Employee','Leave Type','From','To','Days','Reason','Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaves.pendingLeaves.slice(0, pendingLeaveShown).map((l: LeaveRequest) => (
                    <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium">{l.user ? `${l.user.firstName} ${l.user.lastName}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.leaveType?.color ?? '#2563eb' }} />
                          {l.leaveType?.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">{fmtDate(l.startDate)}</td>
                      <td className="px-4 py-3">{fmtDate(l.endDate)}</td>
                      <td className="px-4 py-3">{l.days}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{l.reason ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setReviewLeaveModal({ request: l }); setReviewNote('') }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaves.pendingLeaves.length > pendingLeaveShown && (
                <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setPendingLeaveShown(n => n + PAGE_SIZE)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Load more ({leaves.pendingLeaves.length - pendingLeaveShown} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* Modals */}
      {/* ─────────────────────────────────────────────── */}

      {/* Apply Leave Modal */}
      <Modal open={leaveModal} onClose={() => setLeaveModal(false)} title="Apply for Leave">
        <div className="space-y-4">
          <div>
            <label className={DK_LABEL}>Leave Type</label>
            <select
              value={leaveForm.leaveTypeId}
              onChange={e => setLeaveForm(f => ({ ...f, leaveTypeId: e.target.value }))}
              className={DK_INPUT} style={{ colorScheme: 'dark' }}
            >
              <option value="">Select leave type…</option>
              {leaves.leaveTypes
                .filter(t => t.isActive)
                .filter(t => t.allowedEmployeeTypes.length === 0 || t.allowedEmployeeTypes.includes(user?.employeeType ?? 'PERMANENT'))
                .map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            {(() => {
              const sel = leaves.leaveTypes.find(t => t.id === leaveForm.leaveTypeId)
              if (!sel?.isCompOff) return null
              const bal = leaves.myBalance.find(b => b.leaveTypeId === sel.id)
              const available = bal ? Math.max(0, bal.allocated - bal.used - bal.pending) : 0
              return (
                <p className="text-xs mt-1.5 text-amber-700 dark:text-amber-300">
                  {available} comp off day{available !== 1 ? 's' : ''} available · Credits used oldest-first
                </p>
              )
            })()}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Start Date</label>
              <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={DK_LABEL}>End Date</label>
              <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>Reason (optional)</label>
            <textarea rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Briefly describe the reason…"
              className={DK_INPUT + ' resize-none'} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setLeaveModal(false)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleSubmitLeave} disabled={!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Submit Request</button>
          </div>
        </div>
      </Modal>

      {/* Regularization Modal */}
      <Modal open={!!regModal} onClose={() => setRegModal(null)} title="Request Time Correction">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Requested Check-In</label>
              <input type="datetime-local" value={regForm.requestedCheckIn} onChange={e => setRegForm(f => ({ ...f, requestedCheckIn: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={DK_LABEL}>Requested Check-Out</label>
              <input type="datetime-local" value={regForm.requestedCheckOut} onChange={e => setRegForm(f => ({ ...f, requestedCheckOut: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>Reason</label>
            <textarea rows={3} value={regForm.reason} onChange={e => setRegForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Explain the correction needed…"
              className={DK_INPUT + ' resize-none'} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRegModal(null)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleSubmitReg} disabled={!regForm.requestedCheckIn || !regForm.reason}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Submit</button>
          </div>
        </div>
      </Modal>

      {/* Review Leave Modal */}
      <Modal open={!!reviewLeaveModal} onClose={() => setReviewLeaveModal(null)} title="Review Leave Request">
        {reviewLeaveModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#1e2d45] p-4 space-y-2 text-sm">
              <p><span className="text-slate-400">Employee:</span> <span className="font-medium text-white">{reviewLeaveModal.request.user ? `${reviewLeaveModal.request.user.firstName} ${reviewLeaveModal.request.user.lastName}` : '—'}</span></p>
              <p><span className="text-slate-400">Leave Type:</span> <span className="font-medium text-white">{reviewLeaveModal.request.leaveType?.name}</span></p>
              <p><span className="text-slate-400">Duration:</span> <span className="font-medium text-white">{fmtDate(reviewLeaveModal.request.startDate)} — {fmtDate(reviewLeaveModal.request.endDate)} ({reviewLeaveModal.request.days} days)</span></p>
              {reviewLeaveModal.request.reason && <p><span className="text-slate-400">Reason:</span> <span className="text-slate-300">{reviewLeaveModal.request.reason}</span></p>}
            </div>
            <div>
              <label className={DK_LABEL}>Review Note (optional)</label>
              <textarea rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Add a note…"
                className={DK_INPUT + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReviewLeaveModal(null)} className={DK_CANCEL}>Cancel</button>
              <button onClick={() => handleReviewLeave('REJECTED')} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">Reject</button>
              <button onClick={() => handleReviewLeave('APPROVED')} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Approve</button>
            </div>
          </div>
        )}
      </Modal>

      {/* WFH Request Modal */}
      <Modal open={wfhModal} onClose={() => setWfhModal(false)} title="Request WFH / Travel">
        <div className="space-y-4">
          <div>
            <label className={DK_LABEL}>Mode</label>
            <div className="flex rounded-lg border border-[#2d4068] overflow-hidden">
              {(['WFH', 'TRAVELLING'] as WorkMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setWfhForm(f => ({ ...f, mode: m }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    wfhForm.mode === m
                      ? m === 'WFH' ? 'bg-purple-600 text-white' : 'bg-amber-500 text-white'
                      : 'text-slate-400 hover:bg-[#1e2d45]'
                  } ${m === 'TRAVELLING' ? 'border-l border-[#2d4068]' : ''}`}
                >
                  {m === 'WFH' ? <Home size={13} /> : <Plane size={13} />}
                  {m === 'WFH' ? 'Work from Home' : 'Travelling'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Start Date</label>
              <input type="date" value={wfhForm.startDate} onChange={e => setWfhForm(f => ({ ...f, startDate: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={DK_LABEL}>End Date</label>
              <input type="date" value={wfhForm.endDate} onChange={e => setWfhForm(f => ({ ...f, endDate: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>Reason (optional)</label>
            <textarea rows={3} value={wfhForm.reason} onChange={e => setWfhForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Briefly explain why you need to work remotely…"
              className={DK_INPUT + ' resize-none'} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setWfhModal(false)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleSubmitWFH} disabled={!wfhForm.startDate || !wfhForm.endDate}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Submit Request</button>
          </div>
        </div>
      </Modal>

      {/* WFH Review Modal */}
      <Modal open={!!reviewWFHModal} onClose={() => setReviewWFHModal(null)} title="Review WFH Request">
        {reviewWFHModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#1e2d45] p-4 space-y-2 text-sm">
              <p><span className="text-slate-400">Employee:</span> <span className="font-medium text-white">{reviewWFHModal.request.user ? `${reviewWFHModal.request.user.firstName} ${reviewWFHModal.request.user.lastName}` : '—'}</span></p>
              <p><span className="text-slate-400">Mode:</span> <span className="font-medium text-white flex items-center gap-1 inline-flex">{reviewWFHModal.request.mode === 'WFH' ? <><Home size={13} className="text-purple-400" /> WFH</> : <><Plane size={13} className="text-amber-400" /> Travelling</>}</span></p>
              <p><span className="text-slate-400">Dates:</span> <span className="font-medium text-white">{fmtDate(reviewWFHModal.request.startDate)} — {fmtDate(reviewWFHModal.request.endDate)}</span></p>
              {reviewWFHModal.request.reason && <p><span className="text-slate-400">Reason:</span> <span className="text-slate-300">{reviewWFHModal.request.reason}</span></p>}
            </div>
            <div>
              <label className={DK_LABEL}>Review Note (optional)</label>
              <textarea rows={2} value={wfhReviewNote} onChange={e => setWfhReviewNote(e.target.value)}
                placeholder="Add a note…"
                className={DK_INPUT + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReviewWFHModal(null)} className={DK_CANCEL}>Cancel</button>
              <button onClick={() => handleReviewWFH('REJECTED')} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">Reject</button>
              <button onClick={() => handleReviewWFH('APPROVED')} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Approve</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Review Regularization Modal */}
      <Modal open={!!reviewRegModal} onClose={() => setReviewRegModal(null)} title="Review Regularization">
        {reviewRegModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#1e2d45] p-4 space-y-2 text-sm">
              <p><span className="text-slate-400">Employee:</span> <span className="font-medium text-white">{reviewRegModal.request.user ? `${reviewRegModal.request.user.firstName} ${reviewRegModal.request.user.lastName}` : '—'}</span></p>
              <p><span className="text-slate-400">Date:</span> <span className="text-slate-300">{fmtDate(reviewRegModal.request.record?.date)}</span></p>
              <p><span className="text-slate-400">Current:</span> <span className="text-slate-300">
                {(!reviewRegModal.request.record || reviewRegModal.request.record.status === 'ABSENT')
                  ? 'Absent (no check-in)'
                  : `${fmtTime(reviewRegModal.request.record.firstCheckInAt ?? reviewRegModal.request.record.checkInAt)} → ${fmtTime(reviewRegModal.request.record.checkOutAt)}`}
              </span></p>
              <p><span className="text-slate-400">Requested:</span> <span className="text-slate-300">{fmtTime(reviewRegModal.request.requestedCheckIn)} → {fmtTime(reviewRegModal.request.requestedCheckOut)}</span></p>
              <p><span className="text-slate-400">Reason:</span> <span className="text-slate-300">{reviewRegModal.request.reason}</span></p>
            </div>
            <div>
              <label className={DK_LABEL}>Review Note (optional)</label>
              <textarea rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Add a note…"
                className={DK_INPUT + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReviewRegModal(null)} className={DK_CANCEL}>Cancel</button>
              <button onClick={() => handleReviewReg('REJECTED')} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">Reject</button>
              <button onClick={() => handleReviewReg('APPROVED')} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Approve</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 truncate">{label}</div>
      <div className="text-sm sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{value}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
      {icon}
      <p className="mt-3 text-sm">{text}</p>
    </div>
  )
}

