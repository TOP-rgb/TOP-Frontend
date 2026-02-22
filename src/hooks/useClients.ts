import { useState, useEffect, useCallback } from 'react'
import { api, normStr, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { Client, ClientFormData } from '@/types'

interface ApiClient {
  id: string
  name: string           // Contact person name (added)
  company: string        // Company name
  industry: string
  email: string
  phone: string
  address: string
  status: string
  createdAt: string
  _count?: { jobs: number }
}

function normaliseClient(c: ApiClient): Client {
  return {
    id: c.id,
    name: c.name || c.company,     // Use name if available, fallback to company
    email: c.email,
    phone: c.phone,
    company: c.company,
    industry: c.industry,
    status: normStr(c.status) as 'active' | 'inactive',
    address: c.address,
    createdAt: c.createdAt,
    totalJobs: c._count?.jobs ?? 0,
    totalRevenue: 0,
    billingRate: 0,
  }
}

interface UseClientsOptions {
  status?: string
  search?: string
}

export function useClients(options: UseClientsOptions = {}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    if (!getToken()) { return }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (options.status && options.status !== 'all') params.set('status', options.status.toUpperCase())
      if (options.search) params.set('search', options.search)

      const res = await api.get<ApiResponse<ApiClient[]>>(`/clients?${params}`)
      setClients((res.data ?? []).map(normaliseClient))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [options.status, options.search])

  useEffect(() => { fetchClients() }, [fetchClients])

  const createClient = async (data: ClientFormData): Promise<Client | null> => {
    try {
      // Send both name and company to the API
      const payload = {
        name: data.name,           // Contact person name
        company: data.company,      // Company name
        industry: data.industry || '',
        email: data.email,
        phone: data.phone,
        address: data.address || '',
        status: data.status?.toUpperCase() ?? 'ACTIVE',
      }
      
      const res = await api.post<ApiResponse<ApiClient>>('/clients', payload)
      const newClient = normaliseClient(res.data)
      setClients(prev => [newClient, ...prev])
      return newClient
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create client')
      return null
    }
  }

  const updateClient = async (id: string, data: ClientFormData): Promise<boolean> => {
    try {
      // Send both name and company to the API
      const payload = {
        name: data.name,           // Contact person name
        company: data.company,      // Company name
        industry: data.industry,
        email: data.email,
        phone: data.phone,
        address: data.address,
        status: data.status ? data.status.toUpperCase() : undefined,
      }
      
      const res = await api.put<ApiResponse<ApiClient>>(`/clients/${id}`, payload)
      const updated = normaliseClient(res.data)
      setClients(prev => prev.map(c => c.id === id ? updated : c))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update client')
      return false
    }
  }

  return { 
    clients, 
    loading, 
    error, 
    refetch: fetchClients, 
    createClient, 
    updateClient 
  }
}