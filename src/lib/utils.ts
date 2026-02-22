import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ✅ Avatar initials
export function getInitials(name: string) {
  if (!name) return ""
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

// ✅ Currency formatting (AUD for your TOP internal tool)
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount)
}

// ✅ Date formatting for display (e.g., "20 Feb 2026")
export function formatDate(date: string | Date | null | undefined) {
  if (!date) return ""
  try {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

// ✅ NEW: Format date for input fields (YYYY-MM-DD)
export function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return ""
  
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return "" // Invalid date
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  } catch {
    return ""
  }
}

// ✅ NEW: Parse date from input to ISO string for API
export function parseDateForAPI(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  
  try {
    // Create date at UTC midnight to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.toISOString()
  } catch {
    return null
  }
}