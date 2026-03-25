import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  toggleCollapsed: () => void
  setSidebarOpen: (open: boolean) => void
  /** Real notification count computed by Topbar — shared so Sidebar can display the same number */
  notificationCount: number
  setNotificationCount: (count: number) => void
  theme: Theme
  toggleTheme: () => void
}

const savedTheme = (localStorage.getItem('top-theme') as Theme) || 'light'

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCollapsed: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  notificationCount: 0,
  setNotificationCount: (count) => set({ notificationCount: count }),
  theme: savedTheme,
  toggleTheme: () => set(s => {
    const next: Theme = s.theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('top-theme', next)
    return { theme: next }
  }),
}))
