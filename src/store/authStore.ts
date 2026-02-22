import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'
import { api, setToken, clearToken, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'

interface ApiUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  createdAt?: string
  updatedAt?: string
}

// Backend login response structure
interface LoginResponse {
  success: boolean
  data: {
    user: ApiUser
    token: string
  }
  message?: string
}

// Backend profile response structure
interface ProfileResponse {
  success: boolean
  data: ApiUser
}

function normaliseUser(u: ApiUser): User {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    // Backend roles: 'Admin', 'Manager', 'Employee'
    role: u.role.toLowerCase() as UserRole,
    status: u.status.toLowerCase() as 'active' | 'inactive',
    department: '',
    joinedDate: u.createdAt || '',
    phone: '',
    costRate: 0,
  }
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  switchRole: (role: UserRole) => void
  restoreSession: () => Promise<void>
  clearError: () => void
}

// ── Demo fallback (used when backend is not available) ────────────────────────

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        // 2. Try real backend
        try {
          const response = await api.post<LoginResponse>('/auth/login', { email, password })
          
          if (response.success && response.data?.token) {
            setToken(response.data.token)
            set({ 
              user: normaliseUser(response.data.user), 
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
            return true
          }
          
          set({ 
            isLoading: false,
            error: response.message || 'Login failed'
          })
          return false
        } catch (error) {
          // Backend unavailable or error
          console.error('Login error:', error)
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Connection failed'
          })
          return false
        }
      },

      logout: () => {
        clearToken()
        set({ user: null, isAuthenticated: false, isLoading: false, error: null })
      },

      // Restore session from stored JWT on app load
      restoreSession: async () => {
        const token = getToken()
        if (!token) {
          set({ isAuthenticated: false, user: null })
          return
        }

        set({ isLoading: true })
        
        try {
          // Your backend uses /auth/profile (check if this is correct)
          const response = await api.get<ProfileResponse>('/auth/profile')
          
          if (response.success && response.data) {
            set({ 
              user: normaliseUser(response.data), 
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
          } else {
            // Token might be invalid
            clearToken()
            set({ 
              user: null, 
              isAuthenticated: false,
              isLoading: false,
              error: null
            })
          }
        } catch (error) {
          console.error('Session restore failed:', error)
          clearToken()
          set({ 
            user: null, 
            isAuthenticated: false,
            isLoading: false,
            error: null
          })
        }
      },

      // Switch between demo roles instantly
      switchRole: (role: UserRole) => {
        const currentUser = get().user
        if (!currentUser) return

      },

      clearError: () => set({ error: null }),
    }),
    { 
      name: 'top-auth',
      // Only persist these fields
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)