import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Folder, FolderOpen, FileText, Image, File, Film,
  Upload, FolderPlus, Download, Trash2, X, Search,
  LayoutGrid, List, ChevronRight, HardDrive, Cloud,
  ExternalLink, MoreHorizontal, Check, Edit2, AlertTriangle, Settings,
  ClipboardList,
} from 'lucide-react'
import { useDocuments, type OrgDocument, type DocumentFolder } from '@/hooks/useDocuments'
import { api } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text'))
    return FileText
  return File
}

function getStorageLabel(backend: string) {
  if (backend === 'google') return { label: 'Google Drive', icon: Cloud, color: 'text-blue-600' }
  if (backend === 'onedrive') return { label: 'OneDrive', icon: Cloud, color: 'text-indigo-600' }
  return { label: 'Database', icon: HardDrive, color: 'text-slate-500' }
}

// ── Folder Tree Item ──────────────────────────────────────────────────────────

interface FolderTreeItemProps {
  folder: DocumentFolder
  activeId: string | null
  depth?: number
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onNewChild: (parentId: string) => void
}

function FolderTreeItem({
  folder, activeId, depth = 0, onSelect, onRename, onDelete, onNewChild,
}: FolderTreeItemProps) {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(folder.name)
  const isActive = activeId === folder.id
  const hasChildren = folder.children.length > 0

  const handleRename = () => {
    setRenaming(false)
    if (renameVal.trim() && renameVal !== folder.name) {
      onRename(folder.id, renameVal.trim())
    } else {
      setRenameVal(folder.name)
    }
  }

  return (
    <div>
      <div
        className={`relative flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer group select-none ${
          isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => { onSelect(folder.id); if (hasChildren) setOpen((p) => !p) }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}
        {open ? <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" /> : <Folder className="w-4 h-4 shrink-0 text-amber-500" />}

        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setRenaming(false); setRenameVal(folder.name) } }}
            className="flex-1 min-w-0 border-b border-blue-400 bg-transparent text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm">{folder.name}</span>
        )}

        <button
          className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p) }}
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-0.5 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onNewChild(folder.id) }}
            >
              <FolderPlus className="w-3.5 h-3.5" /> New Subfolder
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setRenaming(true) }}
            >
              <Edit2 className="w-3.5 h-3.5" /> Rename
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(folder.id) }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {open && folder.children.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          activeId={activeId}
          depth={depth + 1}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onNewChild={onNewChild}
        />
      ))}
    </div>
  )
}

// ── File Icon Component ───────────────────────────────────────────────────────

function FileIcon({ doc, size = 'md' }: { doc: OrgDocument; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = getMimeIcon(doc.mimeType)
  const isImage = doc.mimeType.startsWith('image/')
  const sizeClass = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' }[size]

  const API_BASE = import.meta.env.VITE_API_URL || 'https://top-backend-l2ax.onrender.com/api'
  const token = localStorage.getItem('top_jwt_token')
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok && !cancelled) {
          const blob = await res.blob()
          setThumbUrl(URL.createObjectURL(blob))
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [doc.id, isImage])

  if (isImage && thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt={doc.name}
        className={`${sizeClass} object-cover rounded`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }

  const colorMap: Record<string, string> = {
    'application/pdf': 'text-red-500',
    'image/': 'text-purple-500',
    'video/': 'text-pink-500',
  }
  const color = Object.entries(colorMap).find(([k]) => doc.mimeType.startsWith(k))?.[1] ?? 'text-slate-500'

  return <Icon className={`${sizeClass} ${color}`} />
}

// ── Create Folder Modal ───────────────────────────────────────────────────────

function NewFolderModal({
  parentId,
  onClose,
  onCreate,
}: {
  parentId: string | null
  onClose: () => void
  onCreate: (name: string, parentId?: string) => Promise<DocumentFolder | null>
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    const folder = await onCreate(name.trim(), parentId ?? undefined)
    if (folder) {
      toast.success('Folder created')
      onClose()
    } else {
      toast.error('Failed to create folder')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
        <h3 className="font-semibold text-slate-900 mb-4">New Folder</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="Folder name"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

function PreviewPanel({ doc, onClose, onDownload, onDelete }: {
  doc: OrgDocument
  onClose: () => void
  onDownload: (doc: OrgDocument) => void
  onDelete: (id: string) => void
}) {
  const storage = getStorageLabel(doc.storageBackend)
  const StorageIcon = storage.icon

  return (
    <div className="w-72 shrink-0 border-l border-slate-100 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-medium text-slate-700">Details</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-col items-center gap-3 py-4 border-b border-slate-100">
          <FileIcon doc={doc} size="lg" />
          <p className="text-sm font-medium text-slate-900 text-center break-all">{doc.name}</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Size</span>
            <span className="text-slate-800">{formatBytes(doc.sizeBytes)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Type</span>
            <span className="text-slate-800 truncate max-w-[140px]">{doc.mimeType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Uploaded</span>
            <span className="text-slate-800">{formatDate(doc.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">By</span>
            <span className="text-slate-800">{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Storage</span>
            <span className={`flex items-center gap-1 ${storage.color}`}>
              <StorageIcon className="w-3.5 h-3.5" />
              {storage.label}
            </span>
          </div>
          {doc.jobId && (
            <div className="flex justify-between">
              <span className="text-slate-500">Job</span>
              <a href={`/jobs`} className="text-blue-600 hover:underline text-xs">View Job</a>
            </div>
          )}
          {doc.taskId && (
            <div className="flex justify-between">
              <span className="text-slate-500">Task</span>
              <a href={`/tasks`} className="text-blue-600 hover:underline text-xs">View Task</a>
            </div>
          )}
        </div>

        {doc.webUrl && (
          <a
            href={doc.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in {storage.label}
          </a>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 space-y-2">
        <button
          onClick={() => onDownload(doc)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" /> Download
        </button>
        <button
          onClick={() => { if (confirm(`Delete "${doc.name}"?`)) onDelete(doc.id) }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 text-sm rounded-lg hover:bg-red-50 border border-red-100"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
    </div>
  )
}

// ── Main Documents Page ───────────────────────────────────────────────────────

// ── Storage status helpers ─────────────────────────────────────────────────

type StorageMeta = { backend: 'db' | 'google' | 'onedrive'; connected: boolean }

const STORAGE_INFO = {
  db:       { label: 'Database',        icon: '🗄️', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  google:   { label: 'Google Drive',    icon: '📁', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  onedrive: { label: 'Microsoft OneDrive', icon: '☁️', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
}

export function Documents() {
  const navigate = useNavigate()
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [tasksExpanded, setTasksExpanded] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<OrgDocument | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Storage connection status ──────────────────────────────────────────────
  const [storageMeta, setStorageMeta] = useState<StorageMeta>({ backend: 'db', connected: true })

  // ── User-level storage ────────────────────────────────────────────────────
  const [userStorage, setUserStorage] = useState<{
    storageBackend: string
    connected: boolean
    source: 'user' | 'org'
    allowUserStorage: boolean
    allowUserGoogleDrive: boolean
    allowUserMicrosoftDrive: boolean
  } | null>(null)
  const [connectingStorage, setConnectingStorage] = useState(false)

  const TOKEN_KEY = 'top_jwt_token'
  const API_BASE = import.meta.env.VITE_API_URL || 'https://top-backend-l2ax.onrender.com/api'

  const fetchUserStorage = useCallback(() => {
    return api.get<{ success: boolean; data: { storageBackend: string; connected: boolean; source: 'user' | 'org'; allowUserStorage: boolean; allowUserGoogleDrive: boolean; allowUserMicrosoftDrive: boolean } }>('/documents/storage/user/status')
      .then(res => { if (res.success) setUserStorage(res.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // Fetch org storage meta (for org-level banner)
    api.get<{ success: boolean; data: { settings: { storageBackend: string; storageConfig?: { googleTokens?: unknown; microsoftTokens?: unknown } | null } } }>('/settings')
      .then(res => {
        if (!res.success) return
        const { storageBackend: sb, storageConfig: sc } = res.data.settings
        const backend = (sb ?? 'db') as StorageMeta['backend']
        const connected =
          backend === 'db' ? true
          : backend === 'google' ? !!sc?.googleTokens
          : !!sc?.microsoftTokens
        setStorageMeta({ backend, connected })
      })
      .catch(() => {})
    // Fetch user storage meta
    fetchUserStorage()
  }, [fetchUserStorage])

  // Handle OAuth return from personal cloud storage connect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    if (success === 'user_google_drive') {
      toast.success('Google Drive connected to your account!')
      fetchUserStorage()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (success === 'user_onedrive') {
      toast.success('OneDrive connected to your account!')
      fetchUserStorage()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchUserStorage])

  const connectUserGoogleDrive = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    window.location.href = `${API_BASE}/documents/oauth/user/google?token=${token}`
  }, [API_BASE])

  const connectUserOneDrive = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    window.location.href = `${API_BASE}/documents/oauth/user/microsoft?token=${token}`
  }, [API_BASE])

  const disconnectUserStorage = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!confirm(`Disconnect your personal ${provider === 'google' ? 'Google Drive' : 'OneDrive'}?`)) return
    setConnectingStorage(true)
    try {
      const res = await api.delete<{ success: boolean }>(`/documents/storage/user/connection/${provider}`)
      if (res.success) {
        toast.success('Personal storage disconnected')
        fetchUserStorage()
      }
    } catch { toast.error('Failed to disconnect') }
    finally { setConnectingStorage(false) }
  }, [fetchUserStorage])

  // Effective storage for uploads: use user's own if configured, else org's
  const effectiveStorage = userStorage?.source === 'user'
    ? { backend: userStorage.storageBackend as StorageMeta['backend'], connected: userStorage.connected }
    : storageMeta

  const storageInfo = STORAGE_INFO[effectiveStorage.backend] ?? STORAGE_INFO.db
  const uploadDisabled = !effectiveStorage.connected

  const {
    folders, documents, loading, uploading,
    createFolder, renameFolder, deleteFolder,
    uploadFile, deleteDocument, downloadDocument,
    refetchDocuments,
  } = useDocuments({
    folderId: activeFolderId ?? undefined,
    taskId: activeTaskId ?? undefined,
  })

  // Re-fetch when folder or task changes
  useEffect(() => {
    refetchDocuments()
  }, [activeFolderId, activeTaskId, refetchDocuments])

  // ── Derive unique tasks from documents for sidebar ─────────────────────────
  // We fetch ALL documents (no folder/task filter) to build the sidebar task list
  const { documents: allDocs } = useDocuments({ autoLoad: true })
  const taskGroups = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>()
    for (const doc of allDocs) {
      if (doc.taskId && doc.task) {
        const existing = map.get(doc.taskId)
        if (existing) {
          existing.count++
        } else {
          map.set(doc.taskId, { id: doc.task.id, title: doc.task.title, count: 1 })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
  }, [allDocs])

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const doc = await uploadFile(file, activeFolderId ?? undefined)
      if (doc) toast.success(`"${file.name}" uploaded`)
      else toast.error(`Failed to upload "${file.name}"`)
    }
  }, [uploadFile, activeFolderId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (uploadDisabled) {
      toast.error(`Connect ${STORAGE_INFO[storageMeta.backend].label} in Settings to enable uploads`)
      return
    }
    const files = Array.from(e.dataTransfer.files)
    if (files.length) handleFiles(files)
  }, [handleFiles, uploadDisabled, storageMeta.backend])

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder and all its files?')) return
    const ok = await deleteFolder(id)
    if (ok) {
      if (activeFolderId === id) setActiveFolderId(null)
      toast.success('Folder deleted')
    } else {
      toast.error('Failed to delete folder')
    }
  }

  const handleDeleteDoc = async (id: string) => {
    const ok = await deleteDocument(id)
    if (ok) {
      toast.success('File deleted')
      if (selectedDoc?.id === id) setSelectedDoc(null)
    } else {
      toast.error('Failed to delete file')
    }
  }

  const handleNewFolder = (parentId: string | null) => {
    setNewFolderParentId(parentId)
    setShowNewFolder(true)
  }

  // Get breadcrumb path
  const getBreadcrumb = () => {
    if (activeTaskId) {
      const taskGroup = taskGroups.find((t) => t.id === activeTaskId)
      return [
        { id: null, name: 'All Files' },
        { id: `task:${activeTaskId}`, name: `Tasks` },
        { id: `task:${activeTaskId}`, name: taskGroup?.title ?? 'Task' },
      ]
    }
    if (!activeFolderId) return [{ id: null, name: 'All Files' }]
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'All Files' }]
    const findPath = (folders: DocumentFolder[], targetId: string): boolean => {
      for (const f of folders) {
        if (f.id === targetId) { crumbs.push({ id: f.id, name: f.name }); return true }
        if (findPath(f.children, targetId)) { crumbs.splice(1, 0, { id: f.id, name: f.name }); return true }
      }
      return false
    }
    findPath(folders, activeFolderId)
    return crumbs
  }

  const breadcrumb = getBreadcrumb()

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-white">
      {/* Left: Folder Tree */}
      <div className="w-56 shrink-0 border-r border-slate-100 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Folders</span>
            <button
              onClick={() => handleNewFolder(null)}
              className="text-slate-400 hover:text-blue-600 transition-colors"
              title="New Root Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-1">
          {/* All Files */}
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer text-sm ${
              activeFolderId === null && activeTaskId === null ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-700'
            }`}
            onClick={() => { setActiveFolderId(null); setActiveTaskId(null) }}
          >
            <Folder className="w-4 h-4 text-slate-400" />
            All Files
          </div>

          {folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              activeId={activeFolderId}
              onSelect={(id) => { setActiveFolderId(id); setActiveTaskId(null) }}
              onRename={async (id, name) => {
                const ok = await renameFolder(id, name)
                if (!ok) toast.error('Failed to rename folder')
              }}
              onDelete={handleDeleteFolder}
              onNewChild={(parentId) => handleNewFolder(parentId)}
            />
          ))}

          {/* ── Tasks virtual section ── */}
          {taskGroups.length > 0 && (
            <>
              <div className="border-t border-slate-100 my-2" />
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer text-sm text-slate-500 hover:bg-slate-50 select-none"
                onClick={() => setTasksExpanded((p) => !p)}
              >
                <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${tasksExpanded ? 'rotate-90' : ''}`} />
                <ClipboardList className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-xs uppercase tracking-wider">Tasks</span>
                <span className="ml-auto text-xs text-slate-400">{taskGroups.length}</span>
              </div>
              {tasksExpanded && taskGroups.map((tg) => (
                <div
                  key={tg.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer text-sm ml-4 ${
                    activeTaskId === tg.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                  onClick={() => { setActiveTaskId(tg.id); setActiveFolderId(null) }}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{tg.title}</span>
                  <span className="text-xs text-slate-400 shrink-0">{tg.count}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Your Storage section (shown when admin enabled at least one drive provider) ── */}
        {(userStorage?.allowUserGoogleDrive || userStorage?.allowUserMicrosoftDrive) && (
          <div className="border-t border-slate-100 px-3 py-3 shrink-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Storage</p>
            <div className="space-y-1.5">
              {/* Google Drive — only if admin enabled it */}
              {userStorage?.allowUserGoogleDrive && (
                userStorage.source === 'user' && userStorage.storageBackend === 'google' && userStorage.connected ? (
                  <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2.5 py-1.5">
                    <span>📁</span>
                    <span className="flex-1 truncate font-medium">Google Drive</span>
                    <button
                      onClick={() => disconnectUserStorage('google')}
                      disabled={connectingStorage}
                      className="text-blue-400 hover:text-blue-600 shrink-0"
                      title="Disconnect"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectUserGoogleDrive}
                    disabled={connectingStorage}
                    className="w-full flex items-center gap-2 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    <span>📁</span> Connect Google Drive
                  </button>
                )
              )}
              {/* OneDrive — only if admin enabled it */}
              {userStorage?.allowUserMicrosoftDrive && (
                userStorage.source === 'user' && userStorage.storageBackend === 'onedrive' && userStorage.connected ? (
                  <div className="flex items-center gap-2 text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-2.5 py-1.5">
                    <span>☁️</span>
                    <span className="flex-1 truncate font-medium">OneDrive</span>
                    <button
                      onClick={() => disconnectUserStorage('microsoft')}
                      disabled={connectingStorage}
                      className="text-purple-400 hover:text-purple-600 shrink-0"
                      title="Disconnect"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectUserOneDrive}
                    disabled={connectingStorage}
                    className="w-full flex items-center gap-2 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    <span>☁️</span> Connect OneDrive
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Centre: File List */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Storage status banner ── */}
        {!storageMeta.connected ? (
          /* Not connected — amber warning */
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, padding: '10px 16px',
            background: '#fffbeb', borderBottom: '1px solid #fde68a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle className="w-4 h-4" style={{ color: '#d97706', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#92400e' }}>
                <strong>{storageInfo.label}</strong> is selected but not connected — uploads are disabled until you connect.
              </span>
            </div>
            <button
              onClick={() => navigate('/settings')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                background: '#fff', color: '#d97706',
                border: '1px solid #fcd34d', borderRadius: 7,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Settings className="w-3.5 h-3.5" /> Go to Settings →
            </button>
          </div>
        ) : storageMeta.backend !== 'db' ? (
          /* Connected — green status pill */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            background: storageInfo.bg, borderBottom: `1px solid ${storageInfo.border}`,
          }}>
            <span style={{ fontSize: 15 }}>{storageInfo.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: storageInfo.color }}>
              ● Connected — files stored in {storageInfo.label}
            </span>
            <button
              onClick={() => navigate('/settings')}
              style={{
                marginLeft: 'auto', fontSize: 11, color: '#9ca3af',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              Change in Settings
            </button>
          </div>
        ) : null}

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
            {breadcrumb.map((crumb, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                <button
                  onClick={() => {
                    if (crumb.id === null) { setActiveFolderId(null); setActiveTaskId(null) }
                    else if (typeof crumb.id === 'string' && crumb.id.startsWith('task:')) { /* already viewing task */ }
                    else setActiveFolderId(crumb.id)
                  }}
                  className={`hover:text-blue-600 ${i === breadcrumb.length - 1 ? 'font-medium text-slate-900' : 'text-slate-500'}`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files…"
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>

          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              title="List view"
            >
              <List className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Actions — hidden when viewing task files */}
          {!activeTaskId && (
            <>
              <button
                onClick={() => handleNewFolder(activeFolderId)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <FolderPlus className="w-4 h-4" /> New Folder
              </button>
              <button
                onClick={() => uploadDisabled ? toast.error(`Connect ${storageInfo.label} in Settings first`) : fileInputRef.current?.click()}
                disabled={uploading}
                title={uploadDisabled ? `Connect ${storageInfo.label} in Settings to enable uploads` : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 ${
                  uploadDisabled
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />
        </div>

        {/* Drop zone + File list */}
        <div
          className={`flex-1 overflow-y-auto relative ${dragging ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {dragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="flex flex-col items-center gap-2 text-blue-600">
                <Upload className="w-10 h-10" />
                <span className="text-sm font-medium">Drop to upload</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Upload className="w-12 h-12 text-slate-200" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500">No files here</p>
                <p className="text-xs text-slate-400 mt-1">Drag & drop files or click Upload</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload Files
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Size</th>
                  <th className="text-left px-4 py-2 font-medium">Uploaded By</th>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${selectedDoc?.id === doc.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileIcon doc={doc} size="sm" />
                        <span className="font-medium text-slate-800 truncate max-w-xs">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{doc.mimeType.split('/')[1] ?? doc.mimeType}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatBytes(doc.sizeBytes)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadDocument(doc) }}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${doc.name}"?`)) handleDeleteDoc(doc.id) }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Grid view */
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedDoc?.id === doc.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100'
                  }`}
                >
                  <FileIcon doc={doc} size="md" />
                  <span className="text-xs text-center text-slate-700 font-medium leading-tight line-clamp-2 break-all">
                    {doc.name}
                  </span>
                  <span className="text-xs text-slate-400">{formatBytes(doc.sizeBytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Preview Panel */}
      {selectedDoc && (
        <PreviewPanel
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDownload={downloadDocument}
          onDelete={handleDeleteDoc}
        />
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <NewFolderModal
          parentId={newFolderParentId}
          onClose={() => setShowNewFolder(false)}
          onCreate={createFolder}
        />
      )}
    </div>
  )
}
