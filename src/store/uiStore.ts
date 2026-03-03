import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  toggleCollapsed: () => void
  setSidebarOpen: (open: boolean) => void
  /** Real notification count computed by Topbar — shared so Sidebar can display the same number */
  notificationCount: number
  setNotificationCount: (count: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCollapsed: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  notificationCount: 0,
  setNotificationCount: (count) => set({ notificationCount: count }),
}))
