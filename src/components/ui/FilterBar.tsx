import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string
  label: string
  color?: string
}

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'toggle' | 'date-range'
  options?: FilterOption[]
  toggleLabels?: { all: string; on: string; off: string }
  placeholder?: string
}

export type FilterValues = Record<string, string | string[] | boolean | null | { from: string; to: string }>

interface FilterBarProps {
  filters: FilterConfig[]
  values: FilterValues
  onChange: (key: string, value: unknown) => void
  onClear: () => void
  activeCount: number
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────

function MultiSelect({ config, value, onChange }: {
  config: FilterConfig
  value: string[]
  onChange: (val: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const options = config.options ?? []
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }

  const label = value.length === 0
    ? (config.placeholder ?? 'All')
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? '1 selected')
      : `${value.length} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
          background: value.length > 0 ? '#eff6ff' : '#fff',
          fontSize: 12.5, color: value.length > 0 ? '#2563eb' : '#374151',
          cursor: 'pointer', fontWeight: value.length > 0 ? 600 : 400,
          minWidth: 120, whiteSpace: 'nowrap', textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{label}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', left: 0, top: '100%', marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', width: 220, zIndex: 60,
          maxHeight: 280, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search inside dropdown */}
          {options.length > 6 && (
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f3f9' }}>
              <input
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb',
                  borderRadius: 5, fontSize: 12, outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', maxHeight: 240 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>No matches</div>
            )}
            {filtered.map(o => (
              <label
                key={o.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', cursor: 'pointer', fontSize: 12.5,
                  color: '#374151',
                  background: value.includes(o.value) ? '#f0f9ff' : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = value.includes(o.value) ? '#dbeafe' : '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = value.includes(o.value) ? '#f0f9ff' : 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  style={{ accentColor: '#2563eb', width: 14, height: 14 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f3f9', padding: '6px 10px' }}>
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── FilterBar component ───────────────────────────────────────────────────────

export function FilterBar({ filters, values, onChange, onClear, activeCount }: FilterBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 16,
      background: '#f9fafb', borderBottom: '1px solid #f1f3f9',
      padding: '12px 20px', flexWrap: 'wrap',
    }}>
      {filters.map(f => (
        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {f.label}
          </label>

          {/* ── Single select ─────────────────────────────────────────── */}
          {f.type === 'select' && (
            <select
              value={(values[f.key] as string) ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              style={{
                padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
                fontSize: 12.5, color: '#374151', background: '#fff',
                outline: 'none', minWidth: 110, cursor: 'pointer',
              }}
            >
              {(f.options ?? []).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {/* ── Multi select ──────────────────────────────────────────── */}
          {f.type === 'multi-select' && (
            <MultiSelect
              config={f}
              value={(values[f.key] as string[]) ?? []}
              onChange={val => onChange(f.key, val)}
            />
          )}

          {/* ── Toggle (3-state pill group) ───────────────────────────── */}
          {f.type === 'toggle' && (() => {
            const labels = f.toggleLabels ?? { all: 'All', on: 'Yes', off: 'No' }
            const currentVal = values[f.key] as boolean | null
            const pills: { label: string; val: boolean | null }[] = [
              { label: labels.all, val: null },
              { label: labels.on, val: true },
              { label: labels.off, val: false },
            ]
            return (
              <div style={{ display: 'flex', borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {pills.map(p => (
                  <button
                    key={p.label}
                    onClick={() => onChange(f.key, p.val)}
                    style={{
                      padding: '5px 12px', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      background: currentVal === p.val ? '#1a1f36' : '#fff',
                      color: currentVal === p.val ? '#fff' : '#6b7280',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* ── Date range ────────────────────────────────────────────── */}
          {f.type === 'date-range' && (() => {
            const range = (values[f.key] as { from: string; to: string }) ?? { from: '', to: '' }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="date"
                  value={range.from}
                  onChange={e => onChange(f.key, { ...range, from: e.target.value })}
                  style={{
                    padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6,
                    fontSize: 12, color: '#374151', outline: 'none', width: 120,
                  }}
                />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>to</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={e => onChange(f.key, { ...range, to: e.target.value })}
                  style={{
                    padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6,
                    fontSize: 12, color: '#374151', outline: 'none', width: 120,
                  }}
                />
              </div>
            )
          })()}
        </div>
      ))}

      {/* Spacer + Clear button */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', borderRadius: 6, border: 'none',
              background: '#fee2e2', color: '#b91c1c', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <X size={12} /> Clear Filters
          </button>
        )}
      </div>
    </div>
  )
}
