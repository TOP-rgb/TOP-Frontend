import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

const palettes = [
  { bg: 'bg-blue-500',   ring: 'ring-blue-200' },
  { bg: 'bg-violet-500', ring: 'ring-violet-200' },
  { bg: 'bg-emerald-500',ring: 'ring-emerald-200' },
  { bg: 'bg-amber-500',  ring: 'ring-amber-200' },
  { bg: 'bg-rose-500',   ring: 'ring-rose-200' },
  { bg: 'bg-cyan-500',   ring: 'ring-cyan-200' },
  { bg: 'bg-pink-500',   ring: 'ring-pink-200' },
  { bg: 'bg-indigo-500', ring: 'ring-indigo-200' },
]

function getPalette(name: string) {
  const index = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % palettes.length
  return palettes[index] ?? palettes[0]!
}

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const p = getPalette(name)
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2',
      p.bg, p.ring, sizes[size], className
    )}>
      {getInitials(name)}
    </div>
  )
}

export function AvatarGroup({ names, max = 3, size = 'sm' }: { names: string[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  const visible = names.slice(0, max)
  const rest = names.length - max
  return (
    <div className="flex items-center -space-x-2">
      {visible.map(name => (
        <Avatar key={name} name={name} size={size} className="ring-2 ring-white" />
      ))}
      {rest > 0 && (
        <div className={cn(
          'rounded-full flex items-center justify-center text-white font-semibold bg-slate-400 ring-2 ring-white flex-shrink-0',
          sizes[size]
        )}>
          +{rest}
        </div>
      )}
    </div>
  )
}
