import { useState, useEffect, useCallback } from 'react'
import { api, normStr, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { User, UserRole } from '@/types'

interface ApiUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  createdAt: string
}

function normaliseUser(u: ApiUser): User {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    role: normStr(u.role) as UserRole,
    status: normStr(u.status) as 'active' | 'inactive',
    department: '',
    joinedDate: u.createdAt?.slice(0, 10) ?? '',
    phone: '',
    costRate: 0,
  }
}

interface UseUsersOptions {
  role?: string
  status?: string
  search?: string
}

export function useUsers(options: UseUsersOptions = {}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!getToken()) { return }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (options.role && options.role !== 'all') params.set('role', options.role.toUpperCase())
      if (options.status && options.status !== 'all') params.set('status', options.status.toUpperCase())
      if (options.search) params.set('search', options.search)

      const res = await api.get<ApiResponse<ApiUser[]>>(`/users?${params}`)
      setUsers((res.data ?? []).map(normaliseUser))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [options.role, options.status, options.search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const updateUserRole = async (id: string, role: UserRole): Promise<boolean> => {
    try {
      await api.put<ApiResponse<ApiUser>>(`/users/${id}/role`, { role: role.toUpperCase() })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update role')
      return false
    }
  }

  const updateUser = async (id: string, data: Partial<User>): Promise<boolean> => {
    try {
      // Transform the data to match Prisma schema
      const payload: any = { ...data };
      
      // Handle name field - split into firstName and lastName
      if (data.name) {
        const nameParts = data.name.trim().split(' ');
        payload.firstName = nameParts[0] || '';
        payload.lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
        delete payload.name;
      }
      
      // Remove fields that don't exist in Prisma schema
      delete payload.department;
      delete payload.phone;
      delete payload.costRate;
      delete payload.joinedDate;
      
      console.log('Sending update payload:', payload); // Debug log
      
      const res = await api.put<ApiResponse<ApiUser>>(`/users/${id}`, payload)
      const updated = normaliseUser(res.data)
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
      return false
    }
  }



// Deactivate user - now using the /deactivate endpoint
const deactivateUser = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/users/${id}/deactivate`) // Note the /deactivate suffix
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'inactive' as const } : u))
    return true
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Failed to deactivate user')
    return false
  }
}

// Delete user permanently - using the main endpoint
const deleteUser = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/users/${id}`) // No suffix
    setUsers(prev => prev.filter(u => u.id !== id))
    return true
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Failed to delete user')
    return false
  }
}

  const createUser = async (data: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: UserRole
  }): Promise<boolean> => {
    try {
      // Step 1: Create via /auth/signup — hashes password + creates DB record
      const res = await api.post<{ success: boolean; data: { user: ApiUser; token: string } }>(
        '/auth/signup',
        { firstName: data.firstName, lastName: data.lastName, email: data.email, password: data.password }
      )
      const newUser = normaliseUser(res.data.user)
      // Step 2: If role is not employee, update via PUT /users/:id/role (admin-only endpoint)
      if (data.role !== 'employee') {
        await api.put<ApiResponse<ApiUser>>(`/users/${newUser.id}/role`, { role: data.role.toUpperCase() })
        newUser.role = data.role
      }
      setUsers(prev => [newUser, ...prev])
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create user')
      return false
    }
  }

  return { 
    users, 
    loading, 
    error, 
    refetch: fetchUsers, 
    updateUserRole, 
    updateUser, 
    deactivateUser, 
    deleteUser,  // Add this
    createUser 
  }
}