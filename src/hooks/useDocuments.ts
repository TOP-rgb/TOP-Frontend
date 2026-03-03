import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentFolder {
  id: string
  name: string
  parentId: string | null
  children: DocumentFolder[]
  organizationId: string
  createdAt: string
  updatedAt: string
}

export interface DocumentUploader {
  id: string
  firstName: string
  lastName: string
}

export interface OrgDocument {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  folderId: string | null
  storageBackend: string
  webUrl: string | null
  jobId: string | null
  taskId: string | null
  invoiceId: string | null
  uploadedById: string
  uploadedBy: DocumentUploader
  createdAt: string
  updatedAt: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ── Upload helper (multipart) ─────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'https://top-backend-l2ax.onrender.com/api'
const TOKEN_KEY = 'top_jwt_token'

async function uploadFileRaw(
  file: File,
  folderId?: string,
  context?: { jobId?: string; taskId?: string; invoiceId?: string }
): Promise<OrgDocument | null> {
  const token = localStorage.getItem(TOKEN_KEY)
  const formData = new FormData()
  formData.append('file', file)
  if (folderId) formData.append('folderId', folderId)
  if (context?.jobId) formData.append('jobId', context.jobId)
  if (context?.taskId) formData.append('taskId', context.taskId)
  if (context?.invoiceId) formData.append('invoiceId', context.invoiceId)

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const json = await res.json()
  return json.success ? json.data : null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseDocumentsOptions {
  folderId?: string
  jobId?: string
  taskId?: string
  invoiceId?: string
  autoLoad?: boolean
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { folderId, jobId, taskId, invoiceId, autoLoad = true } = options

  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch folders (full tree) ──────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<DocumentFolder[]>>('/documents/folders')
      if (res.success) setFolders(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load folders')
    }
  }, [])

  // ── Fetch documents ────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (folderId) params.append('folderId', folderId)
      if (jobId) params.append('jobId', jobId)
      if (taskId) params.append('taskId', taskId)
      if (invoiceId) params.append('invoiceId', invoiceId)

      const res = await api.get<ApiResponse<OrgDocument[]>>(
        `/documents${params.toString() ? `?${params}` : ''}`
      )
      if (res.success) setDocuments(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [folderId, jobId, taskId, invoiceId])

  useEffect(() => {
    if (autoLoad) {
      fetchFolders()
      fetchDocuments()
    }
  }, [autoLoad, fetchFolders, fetchDocuments])

  // ── Folder actions ─────────────────────────────────────────────────────────

  const createFolder = useCallback(
    async (name: string, parentId?: string): Promise<DocumentFolder | null> => {
      try {
        const res = await api.post<ApiResponse<DocumentFolder>>('/documents/folders', { name, parentId })
        if (res.success && res.data) {
          await fetchFolders()
          return res.data
        }
        return null
      } catch { return null }
    },
    [fetchFolders]
  )

  const renameFolder = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      try {
        const res = await api.put<ApiResponse<DocumentFolder>>(`/documents/folders/${id}`, { name })
        if (res.success) { await fetchFolders(); return true }
        return false
      } catch { return false }
    },
    [fetchFolders]
  )

  const deleteFolder = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await api.delete<ApiResponse<null>>(`/documents/folders/${id}`)
        if (res.success) {
          await fetchFolders()
          await fetchDocuments()
          return true
        }
        return false
      } catch { return false }
    },
    [fetchFolders, fetchDocuments]
  )

  // ── Document actions ───────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (
      file: File,
      uploadFolderId?: string,
      context?: { jobId?: string; taskId?: string; invoiceId?: string }
    ): Promise<OrgDocument | null> => {
      setUploading(true)
      try {
        const doc = await uploadFileRaw(file, uploadFolderId ?? folderId, context)
        if (doc) setDocuments((prev) => [doc, ...prev])
        return doc
      } catch {
        return null
      } finally {
        setUploading(false)
      }
    },
    [folderId]
  )

  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await api.delete<ApiResponse<null>>(`/documents/${id}`)
        if (res.success) {
          setDocuments((prev) => prev.filter((d) => d.id !== id))
          return true
        }
        return false
      } catch { return false }
    },
    []
  )

  // ── Download ───────────────────────────────────────────────────────────────

  const downloadDocument = useCallback(async (doc: OrgDocument): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY)
    // Always proxy through the backend so task assignees can
    // download files without needing cloud provider access.
    const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return {
    folders,
    documents,
    loading,
    uploading,
    error,
    refetchFolders: fetchFolders,
    refetchDocuments: fetchDocuments,
    createFolder,
    renameFolder,
    deleteFolder,
    uploadFile,
    deleteDocument,
    downloadDocument,
  }
}
