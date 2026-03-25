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
        className={value.length > 0
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 font-semibold'
          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-600'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '6px 10px', borderRadius: 6,
          fontSize: 12.5, cursor: 'pointer',
          minWidth: 120, whiteSpace: 'nowrap', textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{label}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{
          position: 'absolute', left: 0, top: '100%', marginTop: 4,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', width: 220, zIndex: 60,
          maxHeight: 280, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search inside dropdown */}
          {options.length > 6 && (
            <div className="border-b border-slate-100 dark:border-slate-700" style={{ padding: '6px 8px' }}>
              <input
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                className="bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 placeholder-slate-400"
                style={{
                  width: '100%', padding: '5px 8px',
                  borderRadius: 5, fontSize: 12, outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', maxHeight: 240 }}>
            {filtered.length === 0 && (
              <div className="text-slate-400 dark:text-slate-500" style={{ padding: '10px 12px', fontSize: 12, textAlign: 'center' }}>No matches</div>
            )}
            {filtered.map(o => (
              <label
                key={o.value}
                className={`text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer ${value.includes(o.value) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', fontSize: 12.5,
                }}
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
            <div className="border-t border-slate-100 dark:border-slate-700" style={{ padding: '6px 10px' }}>
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
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
    <div className="flex flex-wrap items-end gap-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 px-4 py-3 sm:px-5">
      {filters.map(f => (
        <div key={f.key} className="flex flex-col gap-1 min-w-[100px]">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {f.label}
          </label>

          {/* ── Single select ─────────────────────────────────────────── */}
          {f.type === 'select' && (
            <select
              value={(values[f.key] as string) ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-md text-[12.5px] text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-700 outline-none cursor-pointer min-w-[110px]"
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
              <div className="flex rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden">
                {pills.map(p => (
                  <button
                    key={p.label}
                    onClick={() => onChange(f.key, p.val)}
                    className={`px-3 py-1.5 border-r border-slate-200 dark:border-slate-600 text-xs font-semibold cursor-pointer last:border-r-0 ${
                      currentVal === p.val
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
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
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={range.from}
                  onChange={e => onChange(f.key, { ...range, from: e.target.value })}
                  className="px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-md text-xs text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-700 outline-none w-[120px]"
                />
                <span className="text-[11px] text-slate-400 dark:text-slate-500">to</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={e => onChange(f.key, { ...range, to: e.target.value })}
                  className="px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-md text-xs text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-700 outline-none w-[120px]"
                />
              </div>
            )
          })()}
        </div>
      ))}

      {/* Clear button */}
      {activeCount > 0 && (
        <div className="flex items-end ml-auto pb-0.5">
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <X size={12} /> Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}
