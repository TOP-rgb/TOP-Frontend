export type UserRole = 'employee' | 'manager' | 'admin'
export type EmployeeType = 'PERMANENT' | 'PROBATION' | 'INTERN' | 'CONTRACT'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  employeeType: EmployeeType
  department?: string
  avatar?: string
  status: 'active' | 'inactive'
  joinedDate: string
  phone?: string
  country?: string | null   // ISO country code e.g. "IN", "AU" — for region-specific holidays
  billingRate?: number
  costRate?: number
  organizationId?: string
  organizationName?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
}

// Database model (matches Prisma schema)
export interface ClientDB {
  id: string
  name: string           // Contact person name
  company: string        // Company name
  email: string
  phone: string
  industry: string
  address: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt?: string
}

// UI model (includes computed fields for display)
export interface Client extends ClientDB {
  billingRate: number    // Computed from jobs
  totalJobs: number      // Computed from jobs count
  totalRevenue: number   // Computed from jobs revenue
}

// Form data type (for creating/updating)
export interface ClientFormData {
  name: string
  company: string
  email: string
  phone: string
  industry: string
  address: string
  status: 'active' | 'inactive'
  createdAt: string
}

export type JobStatus = 'open' | 'in_progress' | 'on_hold' | 'completed' | 'invoiced' | 'closed'
export type BillingType = 'hourly' | 'fixed'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Job {
  id: string
  jobId: string
  title: string
  clientId: string
  clientName: string
  jobType: string
  billingType: BillingType
  billingRate: number
  quotedHours: number
  actualHours: number
  status: JobStatus
  priority: Priority
  quoteApprovedDate: string
  startDate: string
  deadline: string
  completionDate?: string
  assignedManager: string
  description?: string
  totalCost?: number
  revenue?: number
  profit?: number
  margin?: number
  jobScore?: number
  layoutId?: string
  customFieldValues?: Record<string, unknown>
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed'

export interface Task {
  priority: string | null | undefined
  id: string
  name: string
  type: string
  jobId: string
  jobTitle: string
  clientName: string
  assignedToNames: string  // Comma-separated names
  assignedToIds: string[]  // Array of user IDs
  createdByName?: string   // Name of manager/admin who created/assigned this task
  createdByEmail?: string  // Email of manager/admin who created/assigned this task
  estimatedHours: number
  actualHours: number
  billable: boolean
  status: TaskStatus
  startedAt?: string
  completedAt?: string
  timerRunning: boolean
  timerSeconds: number
  description?: string
  notes?: string           // Employee notes — only assignees can edit, managers/admins can view
  layoutId?: string
  customFieldValues?: Record<string, unknown>
}

// ── Invoice ──────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface InvoiceLineItem {
  description: string
  qty: number
  rate: number
  amount: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  jobId: string
  jobTitle?: string
  jobRef?: string
  clientId: string
  clientCompany: string
  clientEmail: string
  clientAddress?: string
  organizationId: string
  organizationName: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  notes?: string
  lineItems: InvoiceLineItem[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceFormData {
  jobId: string
  taxRate: number
  dueDate: string
  notes: string
  lineItems: InvoiceLineItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance & Leave types
// ─────────────────────────────────────────────────────────────────────────────
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'AUTO_CHECKED_OUT' | 'ON_LEAVE' | 'ABSENT'
export type ExceptionType = 'LATE_ARRIVAL' | 'EARLY_DEPARTURE' | 'MISSED_CHECKOUT' | 'LOCATION_VIOLATION'
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type WorkMode = 'OFFICE' | 'WFH' | 'TRAVELLING'

export interface AttendanceWorkPolicy {
  id: string
  userId: string
  organizationId: string
  /** Empty array = unrestricted (all modes allowed) */
  allowedModes: WorkMode[]
  createdAt: string
  updatedAt: string
  user?: { id: string; firstName: string; lastName: string }
}

export interface ShiftTemplate {
  id: string
  organizationId: string
  name: string
  startTime: string
  endTime: string
  gracePeriodMinutes: number
  workingDays: number[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  assignments?: ShiftAssignment[]
}

export interface ShiftAssignment {
  id: string
  organizationId: string
  userId: string
  shiftId: string
  effectiveFrom: string
  effectiveTo?: string | null
  createdAt: string
  user?: { id: string; firstName: string; lastName: string }
  shift?: Pick<ShiftTemplate, 'id' | 'name' | 'startTime' | 'endTime'>
}

export interface GeofenceLocation {
  id: string
  organizationId: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AttendanceException {
  id: string
  organizationId: string
  recordId: string
  userId: string
  type: ExceptionType
  details?: string | null
  isReviewed: boolean
  reviewedBy?: string | null
  reviewedAt?: string | null
  detectedAt: string
  user?: { id: string; firstName: string; lastName: string }
  record?: { date: string; checkInAt: string; checkOutAt?: string | null }
}

export interface AttendanceRecord {
  id: string
  organizationId: string
  userId: string
  date: string
  checkInAt: string | null     // current/latest session start — used by live timer (null for synthetic absent entries)
  firstCheckInAt?: string | null  // original first check-in of the day — display only
  checkOutAt?: string | null
  checkInLat?: number | null
  checkInLng?: number | null
  checkOutLat?: number | null
  checkOutLng?: number | null
  geofenceId?: string | null
  isWithinGeofence?: boolean | null
  status: AttendanceStatus
  autoCheckedOut: boolean
  isHoliday: boolean
  isOnLeave: boolean
  shiftId?: string | null
  minutesLate?: number | null
  minutesEarly?: number | null
  workMinutes?: number | null
  overtimeMinutes?: number | null
  isRemote: boolean
  workMode?: WorkMode | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; firstName: string; lastName: string; email: string }
  exceptions?: AttendanceException[]
  regularization?: RegularizationRequest | null
}

export interface RegularizationRequest {
  id: string
  organizationId: string
  userId: string
  recordId: string
  requestedCheckIn: string
  requestedCheckOut?: string | null
  reason: string
  status: RequestStatus
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNote?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; firstName: string; lastName: string; email: string }
  record?: { date: string; checkInAt: string; firstCheckInAt?: string | null; checkOutAt?: string | null; status: AttendanceStatus }
}

export interface PublicHoliday {
  id: string
  organizationId: string
  name: string
  date: string
  type: string
  countryCode?: string | null
  isActive: boolean
  createdAt: string
}

export interface LeaveType {
  id: string
  organizationId: string
  name: string
  color: string
  maxDaysPerYear: number
  carryForwardDays: number
  isPaid: boolean
  isActive: boolean
  allowedEmployeeTypes: string[]   // empty = unrestricted; otherwise EmployeeType values
  createdAt: string
  updatedAt: string
}

export interface LeaveBalance {
  id: string
  organizationId: string
  userId: string
  leaveTypeId: string
  year: number
  allocated: number
  used: number
  pending: number
  leaveType?: LeaveType
  user?: { id: string; firstName: string; lastName: string; email: string }
}

export interface LeaveRequest {
  id: string
  organizationId: string
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  days: number
  reason?: string | null
  status: RequestStatus
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNote?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; firstName: string; lastName: string; email: string }
  leaveType?: { id: string; name: string; color: string }
}

export interface WFHRequest {
  id: string
  organizationId: string
  userId: string
  startDate: string
  endDate: string
  mode: WorkMode          // WFH | TRAVELLING
  reason?: string | null
  status: RequestStatus
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNote?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; firstName: string; lastName: string }
}

export interface TeamStatus {
  present: AttendanceRecord[]
  late: AttendanceRecord[]
  checkedOut: AttendanceRecord[]
  onLeave: Array<{ user: { id: string; firstName: string; lastName: string; email: string }; leaveType?: { name: string; color: string } }>
  absent: Array<{ user: { id: string; firstName: string; lastName: string; email: string } }>
  holiday: PublicHoliday | null
  date: string
}

// ─────────────────────────────────────────────────────────────────────────────
export type TimesheetStatus = 'pending_normal' | 'pending_approval' | 'approved' | 'rejected'

export interface TimesheetEntry {
  id: string
  date: string
  clientId: string
  clientName: string
  jobId: string
  jobTitle: string
  taskId?: string
  taskName: string
  hours: number
  billable: boolean
  notes?: string
  status: TimesheetStatus
  flagReason?: string
  rejectionNote?: string
}