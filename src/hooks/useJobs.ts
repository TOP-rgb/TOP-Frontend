import { useState, useEffect, useCallback } from 'react'
import { api, normStr, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { Job, JobStatus, Priority } from '@/types'

// ── Shape returned by the backend ────────────────────────────────────────────

interface ApiJob {
  id: string
  jobId: string
  title: string
  clientId: string
  client: { id: string; company: string }
  jobType: string
  billingType: 'HOURLY' | 'FIXED'
  billingRate: number
  quotedHours: number
  actualHours: number
  status: string
  priority: string
  quoteApprovedDate: string | null
  startDate: string | null
  deadline: string | null
  revenue: number | null
  totalCost: number | null
  profit: number | null
  margin: number | null
  jobScore: number | null
  assignedManager: string | null
  createdAt: string
}

// ── Normalise backend → frontend shape ───────────────────────────────────────

function normaliseJob(j: ApiJob): Job {
  return {
    id: j.id,
    jobId: j.jobId,
    title: j.title,
    clientId: j.clientId,
    clientName: j.client?.company ?? '',
    jobType: j.jobType,
    billingType: normStr(j.billingType) as 'hourly' | 'fixed',
    billingRate: j.billingRate,
    quotedHours: j.quotedHours,
    actualHours: j.actualHours,
    status: normStr(j.status) as JobStatus,
    priority: normStr(j.priority) as Priority,
    quoteApprovedDate: j.quoteApprovedDate ?? '',
    startDate: j.startDate ?? '',
    deadline: j.deadline ?? '',
    revenue: j.revenue ?? undefined,
    totalCost: j.totalCost ?? undefined,
    profit: j.profit ?? undefined,
    margin: j.margin ?? undefined,
    jobScore: j.jobScore ?? undefined,
    assignedManager: j.assignedManager ?? '',
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseJobsOptions {
  status?: string
  clientId?: string
  priority?: string
  search?: string
}

export function useJobs(options: UseJobsOptions = {}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!getToken()) { return }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (options.status && options.status !== 'all') params.set('status', options.status.toUpperCase())
      if (options.clientId) params.set('clientId', options.clientId)
      if (options.priority) params.set('priority', options.priority.toUpperCase())
      if (options.search) params.set('search', options.search)

      const res = await api.get<ApiResponse<ApiJob[]>>(`/jobs?${params}`)
      setJobs((res.data ?? []).map(normaliseJob))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [options.status, options.clientId, options.priority, options.search])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const createJob = async (data: Partial<Job>): Promise<Job | null> => {
    try {
      const payload = {
        ...data,
        billingType: data.billingType?.toUpperCase(),
        priority: data.priority?.toUpperCase(),
        status: data.status?.toUpperCase(),
      }
      const res = await api.post<ApiResponse<ApiJob>>('/jobs', payload)
      const newJob = normaliseJob(res.data)
      setJobs(prev => [newJob, ...prev])
      return newJob
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create job')
      return null
    }
  }

  const updateJob = async (id: string, data: Partial<Job>): Promise<boolean> => {
    try {
      const payload = {
        ...data,
        billingType: data.billingType ? data.billingType.toUpperCase() : undefined,
        priority: data.priority ? data.priority.toUpperCase() : undefined,
        status: data.status ? data.status.toUpperCase() : undefined,
      }
      const res = await api.put<ApiResponse<ApiJob>>(`/jobs/${id}`, payload)
      const updated = normaliseJob(res.data)
      setJobs(prev => prev.map(j => j.id === id ? updated : j))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update job')
      return false
    }
  }

  const updateStatus = async (id: string, status: JobStatus): Promise<boolean> => {
    try {
      const res = await api.patch<ApiResponse<ApiJob>>(`/jobs/${id}/status`, { status: status.toUpperCase() })
      const updated = normaliseJob(res.data)
      setJobs(prev => prev.map(j => j.id === id ? updated : j))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update job status')
      return false
    }
  }

  return { jobs, loading, error, refetch: fetchJobs, createJob, updateJob, updateStatus }
}
