import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, getToken } from '@/lib/api'

interface ApiResponse<T> {
  success: boolean
  data?: T
}

interface LocaleSettings {
  currency: string
  currencySymbol: string
  dateFormat: string
  numberFormat: string
}

// Notification flags — read from backend, available globally
export interface NotificationFlags {
  notifyTimesheetApproval: boolean
  notifyInvoiceOverdue: boolean
  notifyFlaggedTimesheets: boolean
  notifyJobDeadline: boolean
  notifyNewUser: boolean
  overdueInvoiceDays: number
}

interface SettingsState extends LocaleSettings, NotificationFlags {
  orgName: string
  orgSlug: string
  timezone: string
  loaded: boolean
  loadSettings: () => Promise<void>
  setLocale: (locale: LocaleSettings) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Locale defaults
      currency: 'AUD',
      currencySymbol: '$',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: '1,234.56',
      // Org defaults
      orgName: '',
      orgSlug: '',
      timezone: 'Australia/Sydney',
      // Notification defaults
      notifyTimesheetApproval: true,
      notifyInvoiceOverdue: true,
      notifyFlaggedTimesheets: true,
      notifyJobDeadline: true,
      notifyNewUser: false,
      overdueInvoiceDays: 7,
      loaded: false,

      loadSettings: async () => {
        if (!getToken()) return
        try {
          const res = await api.get<ApiResponse<{
            org: { name: string; slug: string }
            settings: Record<string, unknown>
          }>>('/settings')
          if (res.success && res.data) {
            const s = res.data.settings ?? {}
            const org = res.data.org ?? {}
            set({
              currency:               (s.currency as string)               || 'AUD',
              currencySymbol:         (s.currencySymbol as string)         || '$',
              dateFormat:             (s.dateFormat as string)             || 'DD/MM/YYYY',
              numberFormat:           (s.numberFormat as string)           || '1,234.56',
              orgName:                (org as { name?: string }).name      || '',
              orgSlug:                (org as { slug?: string }).slug      || '',
              timezone:               (s.timezone as string)               || 'Australia/Sydney',
              notifyTimesheetApproval:(s.notifyTimesheetApproval as boolean) ?? true,
              notifyInvoiceOverdue:   (s.notifyInvoiceOverdue as boolean)  ?? true,
              notifyFlaggedTimesheets:(s.notifyFlaggedTimesheets as boolean)?? true,
              notifyJobDeadline:      (s.notifyJobDeadline as boolean)     ?? true,
              notifyNewUser:          (s.notifyNewUser as boolean)         ?? false,
              overdueInvoiceDays:     (s.overdueInvoiceDays as number)    ?? 7,
              loaded: true,
            })
          }
        } catch {
          set({ loaded: true })
        }
      },

      setLocale: (locale: LocaleSettings) => {
        set({
          currency:       locale.currency,
          currencySymbol: locale.currencySymbol,
          dateFormat:     locale.dateFormat,
          numberFormat:   locale.numberFormat,
        })
      },
    }),
    {
      name: 'top-settings',
      partialize: (state) => ({
        currency:       state.currency,
        currencySymbol: state.currencySymbol,
        dateFormat:     state.dateFormat,
        numberFormat:   state.numberFormat,
        orgName:        state.orgName,
        orgSlug:        state.orgSlug,
        timezone:       state.timezone,
      }),
    }
  )
)
