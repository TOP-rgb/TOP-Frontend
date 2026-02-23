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
  department?: string
  phone?: string
  createdAt: string
}

function normaliseUser(u: ApiUser): User {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    role: normStr(u.role) as UserRole,
    status: normStr(u.status) as 'active' | 'inactive',
    department: u.department || '',
    joinedDate: u.createdAt?.slice(0, 10) ?? '',
    phone: u.phone || '',
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
      
      // Handle role and status uppercase
      if (payload.role) {
        payload.role = payload.role.toUpperCase();
      }
      if (payload.status) {
        payload.status = payload.status.toUpperCase();
      }
      
      // Remove fields that don't exist in Prisma schema
      delete payload.joinedDate;
      delete payload.costRate;
      
      console.log('Sending update payload:', payload);
      
      const res = await api.put<ApiResponse<ApiUser>>(`/users/${id}`, payload)
      const updated = normaliseUser(res.data)
      
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
      return false
    }
  }

  const deactivateUser = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/users/${id}/deactivate`)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'inactive' as const } : u))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate user')
      return false
    }
  }

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/users/${id}`)
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
    department?: string
    phone?: string
  }): Promise<boolean> => {
    try {
      // Use the invite endpoint — adds user to the admin's organization
      const res = await api.post<ApiResponse<ApiUser>>('/users/invite', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        role: data.role,
        department: data.department || null,
        phone: data.phone || null,
      })
      const newUser = normaliseUser(res.data)
      setUsers(prev => [newUser, ...prev])
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to invite user')
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
    deleteUser,
    createUser 
  }
}