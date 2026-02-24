import { useState, useEffect, useCallback } from 'react'
import { api, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types'

interface UseInvoicesOptions {
  status?: string
  clientId?: string
}

export function useInvoices(options: UseInvoicesOptions = {}) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    if (!getToken()) return
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (options.status && options.status !== 'all') params.set('status', options.status)
      if (options.clientId) params.set('clientId', options.clientId)

      const res = await api.get<ApiResponse<Invoice[]>>(`/invoices?${params}`)
      setInvoices(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [options.status, options.clientId])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const createInvoice = async (data: InvoiceFormData): Promise<Invoice | null> => {
    try {
      const res = await api.post<ApiResponse<Invoice>>('/invoices', data)
      const created = res.data
      setInvoices(prev => [created, ...prev])
      return created
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice')
      return null
    }
  }

  const updateInvoice = async (id: string, data: Partial<InvoiceFormData>): Promise<boolean> => {
    try {
      const res = await api.put<ApiResponse<Invoice>>(`/invoices/${id}`, data)
      setInvoices(prev => prev.map(inv => inv.id === id ? res.data : inv))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update invoice')
      return false
    }
  }

  const updateStatus = async (id: string, status: InvoiceStatus): Promise<boolean> => {
    try {
      const res = await api.patch<ApiResponse<Invoice>>(`/invoices/${id}/status`, { status })
      setInvoices(prev => prev.map(inv => inv.id === id ? res.data : inv))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update invoice status')
      return false
    }
  }

  const deleteInvoice = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/invoices/${id}`)
      setInvoices(prev => prev.filter(inv => inv.id !== id))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete invoice')
      return false
    }
  }

  return { invoices, loading, error, refetch: fetchInvoices, createInvoice, updateInvoice, updateStatus, deleteInvoice }
}
