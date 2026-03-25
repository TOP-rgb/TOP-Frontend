/**
 * useDynamicFavicon
 * Updates the browser tab icon dynamically based on org settings.
 * - If logoUrl is set: uses the logo directly
 * - If no logo: generates an SVG data URL with org name initials
 */
import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

function makeInitialsSvg(name: string): string {
  const initials = name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?'

  const fontSize = initials.length === 1 ? 100 : 76
  const y = 96 + fontSize * 0.37

  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
      <rect width="192" height="192" rx="40" fill="#1a1f36"/>
      <text x="96" y="${y}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">${initials}</text>
    </svg>`
  )}`
}

export function useDynamicFavicon() {
  const { orgName, orgLogoUrl } = useSettingsStore()

  useEffect(() => {
    if (!orgName) return

    const href = orgLogoUrl || makeInitialsSvg(orgName)

    // Update all favicon link tags
    const selectors = [
      'link[rel="icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="shortcut icon"]',
    ]

    selectors.forEach(sel => {
      let el = document.querySelector<HTMLLinkElement>(sel)
      if (!el) {
        el = document.createElement('link')
        el.rel = sel.includes('apple') ? 'apple-touch-icon' : 'icon'
        document.head.appendChild(el)
      }
      el.href = href
      if (!orgLogoUrl) el.type = 'image/svg+xml'
    })

    // Update page title to include org name
    document.title = orgName ? `${orgName} — Internal` : 'TOP Internal'
  }, [orgName, orgLogoUrl])
}
