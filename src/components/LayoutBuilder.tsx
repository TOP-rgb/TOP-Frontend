/**
 * LayoutBuilder — shared component for Job Layouts and Task Layouts
 * Used in Settings → Jobs & Tasks section
 */
import { useState } from 'react'
import {
  Plus, Edit2, Trash2, Check, X, Star, GripVertical,
  Loader2, ChevronDown, ChevronUp, Lock, Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LayoutField, JobLayout, TaskLayout } from '@/hooks/useLayouts'

type AnyLayout = JobLayout | TaskLayout

type FieldType = LayoutField['type']

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text Input',
  number: 'Number',
  date: 'Date Picker',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  textarea: 'Text Area',
  client: 'Client (system)',
  job: 'Job (system)',
  tasktype: 'Task Type (system)',
  users: 'Users (system)',
}

const CUSTOM_FIELD_TYPES: FieldType[] = ['text', 'number', 'date', 'select', 'checkbox', 'textarea']

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  text: '#3b82f6',
  number: '#8b5cf6',
  date: '#f59e0b',
  select: '#22c55e',
  checkbox: '#ec4899',
  textarea: '#14b8a6',
  client: '#94a3b8',
  job: '#94a3b8',
  tasktype: '#94a3b8',
  users: '#94a3b8',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, color: '#111827', outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}

// ── Custom Field Form ─────────────────────────────────────────────────────────

interface NewFieldState {
  label: string
  type: FieldType
  required: boolean
  options: string    // comma-separated for select type
  placeholder: string
}

function CustomFieldForm({
  onAdd,
  onCancel,
}: {
  onAdd: (field: Omit<LayoutField, 'key' | 'order' | 'system'>) => void
  onCancel: () => void
}) {
  const [f, setF] = useState<NewFieldState>({
    label: '', type: 'text', required: false, options: '', placeholder: '',
  })

  const handleAdd = () => {
    if (!f.label.trim()) { toast.error('Field label is required'); return }
    if (f.type === 'select' && !f.options.trim()) { toast.error('Please provide dropdown options'); return }
    onAdd({
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      options: f.type === 'select' ? f.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      placeholder: f.placeholder.trim() || undefined,
    })
  }

  return (
    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Add Custom Field
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Field Label *</label>
          <input style={inputStyle} value={f.label} onChange={e => setF(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Reference Number" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Field Type *</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value as FieldType }))}>
            {CUSTOM_FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {f.type === 'select' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Options (comma-separated) *</label>
          <input style={inputStyle} value={f.options} onChange={e => setF(p => ({ ...p, options: e.target.value }))} placeholder="Option 1, Option 2, Option 3" />
        </div>
      )}

      {(f.type === 'text' || f.type === 'number' || f.type === 'textarea') && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Placeholder (optional)</label>
          <input style={inputStyle} value={f.placeholder} onChange={e => setF(p => ({ ...p, placeholder: e.target.value }))} placeholder="Hint shown inside the field" />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
          <input type="checkbox" checked={f.required} onChange={e => setF(p => ({ ...p, required: e.target.checked }))} />
          Required field
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
            Cancel
          </button>
          <button onClick={handleAdd} style={{ padding: '6px 16px', border: 'none', borderRadius: 7, background: '#1a1f36', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> Add Field
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Layout Editor ─────────────────────────────────────────────────────────────

function LayoutEditor({
  layout,
  onSave,
  onCancel,
}: {
  layout: AnyLayout | null  // null = creating new
  onSave: (name: string, customFields: LayoutField[], isDefault: boolean) => Promise<boolean>
  onCancel: () => void
}) {
  const existingCustomFields = layout ? layout.fields.filter(f => !f.system) : []
  const [name, setName] = useState(layout?.name ?? '')
  const [isDefault, setIsDefault] = useState(layout?.isDefault ?? false)
  const [customFields, setCustomFields] = useState<LayoutField[]>(existingCustomFields)
  const [addingField, setAddingField] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAddField = (fieldDef: Omit<LayoutField, 'key' | 'order' | 'system'>) => {
    const key = `custom_${fieldDef.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
    const newField: LayoutField = {
      ...fieldDef,
      key,
      order: 100 + customFields.length,
      system: false,
    }
    setCustomFields(prev => [...prev, newField])
    setAddingField(false)
    toast.success(`Field "${fieldDef.label}" added`)
  }

  const handleRemoveCustomField = (key: string) => {
    setCustomFields(prev => prev.filter(f => f.key !== key))
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Layout name is required'); return }
    setSaving(true)
    const ok = await onSave(name.trim(), customFields, isDefault)
    setSaving(false)
    if (ok) {
      toast.success(layout ? 'Layout updated' : 'Layout created')
      onCancel()
    } else {
      toast.error('Failed to save layout')
    }
  }

  // System fields from the layout (read-only display)
  const systemFields = layout ? layout.fields.filter(f => f.system) : []

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
        {layout ? `Edit Layout: ${layout.name}` : 'Create New Layout'}
      </div>

      {/* Layout name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Layout Name *</label>
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Job, Tax Return Template" />
      </div>

      {/* Set as default */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
          <Star size={14} style={{ color: isDefault ? '#f59e0b' : '#d1d5db' }} />
          Set as default layout (used when creating new jobs/tasks)
        </label>
      </div>

      {/* System Fields — read-only */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={11} /> System Fields (always included, cannot be removed)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {systemFields.map(f => (
            <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
              <Lock size={10} />
              {f.label}
              {f.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Custom Fields */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings2 size={11} /> Custom Fields ({customFields.length})</span>
          {!addingField && (
            <button onClick={() => setAddingField(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
              <Plus size={11} /> Add Custom Field
            </button>
          )}
        </div>

        {addingField && (
          <CustomFieldForm onAdd={handleAddField} onCancel={() => setAddingField(false)} />
        )}

        {customFields.length === 0 && !addingField ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13, background: '#fafafa', borderRadius: 8, border: '1px dashed #e5e7eb' }}>
            No custom fields yet. Click "Add Custom Field" to extend this layout.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {customFields.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid #f3f4f6', background: '#fafafa' }}>
                <GripVertical size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: FIELD_TYPE_COLORS[f.type], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.label}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{FIELD_TYPE_LABELS[f.type]}</span>
                  {f.required && <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}>required</span>}
                  {f.options && f.options.length > 0 && (
                    <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>({f.options.join(', ')})</span>
                  )}
                </div>
                <button onClick={() => handleRemoveCustomField(f.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: saving ? '#9ca3af' : '#1a1f36', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
          {saving ? 'Saving…' : layout ? 'Update Layout' : 'Create Layout'}
        </button>
      </div>
    </div>
  )
}

// ── Layout Card ───────────────────────────────────────────────────────────────

function LayoutCard({
  layout,
  onEdit,
  onDelete,
  onSetDefault,
  canDelete,
}: {
  layout: AnyLayout
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  canDelete: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const systemFields = layout.fields.filter(f => f.system)
  const customFields = layout.fields.filter(f => !f.system)

  return (
    <div style={{
      border: `1px solid ${layout.isDefault ? '#3b82f6' : '#e5e7eb'}`,
      borderRadius: 12,
      background: '#fff',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
        {/* Default star */}
        <button
          onClick={onSetDefault}
          title={layout.isDefault ? 'Default layout' : 'Set as default'}
          style={{ background: 'none', border: 'none', cursor: layout.isDefault ? 'default' : 'pointer', padding: 2, flexShrink: 0 }}
        >
          <Star size={16} style={{ color: layout.isDefault ? '#f59e0b' : '#d1d5db', fill: layout.isDefault ? '#f59e0b' : 'none' }} />
        </button>

        {/* Name + info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{layout.name}</span>
            {layout.isDefault && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#eff6ff', color: '#3b82f6' }}>DEFAULT</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {systemFields.length} system field{systemFields.length !== 1 ? 's' : ''}
            {customFields.length > 0 && ` · ${customFields.length} custom field${customFields.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide' : 'Fields'}
          </button>
          <button onClick={onEdit} style={{ padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <Edit2 size={12} /> Edit
          </button>
          {canDelete && (
            <button onClick={onDelete} style={{ padding: '5px 8px', border: '1px solid #fecaca', borderRadius: 7, background: '#fff5f5', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded field list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 18px', background: '#fafafa' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {layout.fields.map(f => (
              <span key={f.key} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                background: f.system ? '#f3f4f6' : `${FIELD_TYPE_COLORS[f.type]}15`,
                color: f.system ? '#9ca3af' : FIELD_TYPE_COLORS[f.type],
                border: `1px solid ${f.system ? '#e5e7eb' : `${FIELD_TYPE_COLORS[f.type]}40`}`,
              }}>
                {f.system && <Lock size={10} />}
                {f.label}
                {f.required && !f.system && <span style={{ color: '#ef4444' }}>*</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main LayoutBuilder component ──────────────────────────────────────────────

interface LayoutBuilderProps {
  title: string
  subtitle: string
  layouts: AnyLayout[]
  loading: boolean
  onCreate: (name: string, customFields: LayoutField[], isDefault: boolean) => Promise<boolean>
  onUpdate: (id: string, payload: { name?: string; customFields?: LayoutField[]; isDefault?: boolean }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onSetDefault: (id: string) => Promise<boolean>
}

export function LayoutBuilder({
  title, subtitle, layouts, loading,
  onCreate, onUpdate, onDelete, onSetDefault,
}: LayoutBuilderProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingLayout, setEditingLayout] = useState<AnyLayout | null>(null)

  const handleCreate = async (name: string, customFields: LayoutField[], isDefault: boolean): Promise<boolean> => {
    return onCreate(name, customFields, isDefault)
  }

  const handleUpdate = async (name: string, customFields: LayoutField[], isDefault: boolean): Promise<boolean> => {
    if (!editingLayout) return false
    return onUpdate(editingLayout.id, { name, customFields, isDefault })
  }

  const handleDelete = async (layout: AnyLayout) => {
    if (!window.confirm(`Delete layout "${layout.name}"? Jobs/tasks using this layout will keep their data.`)) return
    const ok = await onDelete(layout.id)
    if (ok) toast.success('Layout deleted')
    else toast.error('Failed to delete layout')
  }

  const handleSetDefault = async (id: string) => {
    const ok = await onSetDefault(id)
    if (ok) toast.success('Default layout updated')
    else toast.error('Failed to update default')
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>
        </div>
        {mode === 'list' && (
          <button
            onClick={() => { setMode('create'); setEditingLayout(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1a1f36', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={14} /> New Layout
          </button>
        )}
      </div>

      {/* Editor */}
      {(mode === 'create' || mode === 'edit') && (
        <LayoutEditor
          layout={mode === 'edit' ? editingLayout : null}
          onSave={mode === 'create' ? handleCreate : handleUpdate}
          onCancel={() => { setMode('list'); setEditingLayout(null) }}
        />
      )}

      {/* Layout list */}
      {mode === 'list' && (
        <>
          {layouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14, background: '#fafafa', borderRadius: 10, border: '1px dashed #e5e7eb' }}>
              <Settings2 size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div>No layouts yet. Create your first layout to customise the form.</div>
            </div>
          ) : (
            layouts.map(l => (
              <LayoutCard
                key={l.id}
                layout={l}
                canDelete={layouts.length > 1}
                onEdit={() => { setEditingLayout(l); setMode('edit') }}
                onDelete={() => handleDelete(l)}
                onSetDefault={() => handleSetDefault(l.id)}
              />
            ))
          )}
        </>
      )}
    </div>
  )
}
