import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (n: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  if (total === 0) return null

  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const isFirst = page === 1
  const isLast = page === totalPages

  // Build visible page numbers — max 5 slots with ellipsis
  const getPageNums = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = []
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages)
    } else if (page >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
    }
    return pages
  }

  const btnLayout: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 32, padding: '0 8px',
    borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    lineHeight: 1,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>

      {/* Left: showing X–Y of Z */}
      <span className="text-slate-500 dark:text-slate-300" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
        Showing {from}–{to} of {total} result{total !== 1 ? 's' : ''}
      </span>

      {/* Centre: page size selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="text-slate-400 dark:text-slate-400" style={{ fontSize: 12, marginRight: 4 }}>Rows:</span>
        {pageSizeOptions.map(n => (
          <button
            key={n}
            onClick={() => onPageSizeChange(n)}
            className={pageSize === n
              ? 'bg-blue-600 text-white border border-blue-600'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}
            style={{ ...btnLayout, fontWeight: pageSize === n ? 700 : 500 }}
          >{n}</button>
        ))}
      </div>

      {/* Right: page navigation */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Prev */}
          <button
            onClick={() => !isFirst && onPageChange(page - 1)}
            disabled={isFirst}
            className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
            style={{ ...btnLayout, opacity: isFirst ? 0.4 : 1, cursor: isFirst ? 'not-allowed' : 'pointer' }}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page numbers */}
          {getPageNums().map((n, i) =>
            n === '...'
              ? <span key={`ellipsis-${i}`} className="text-slate-400 dark:text-slate-500" style={{ fontSize: 13, padding: '0 4px' }}>…</span>
              : (
                <button
                  key={n}
                  onClick={() => onPageChange(n as number)}
                  className={page === n
                    ? 'bg-blue-600 text-white border border-blue-600'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}
                  style={{ ...btnLayout, fontWeight: page === n ? 700 : 500 }}
                >{n}</button>
              )
          )}

          {/* Next */}
          <button
            onClick={() => !isLast && onPageChange(page + 1)}
            disabled={isLast}
            className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
            style={{ ...btnLayout, opacity: isLast ? 0.4 : 1, cursor: isLast ? 'not-allowed' : 'pointer' }}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
