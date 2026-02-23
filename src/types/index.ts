export type UserRole = 'employee' | 'manager' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department?: string
  avatar?: string
  status: 'active' | 'inactive'
  joinedDate: string
  phone?: string
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
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed'

export interface Task {
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
}

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