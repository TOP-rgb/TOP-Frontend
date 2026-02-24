import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  hideHeader?: boolean
  hideFooter?: boolean
  headerClassName?: string
  footerClassName?: string
  contentClassName?: string
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  full: 'sm:max-w-[90vw]',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideHeader = false,
  hideFooter = false,
  headerClassName = '',
  footerClassName = '',
  contentClassName = '',
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${sizeClasses[size]} p-0 gap-0 max-h-[90vh] flex flex-col`}>
        {/* Custom close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          style={{ color: '#94a3b8' }}
        >
          <X size={18} />
          <span className="sr-only">Close</span>
        </button>

        {/* Header */}
        {!hideHeader && (
          <DialogHeader className={`px-6 py-4 bg-[#0f1a2e] border-b border-[#2d4068] rounded-t-lg ${headerClassName}`}>
            <DialogTitle className="text-lg font-semibold text-white">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-sm text-slate-400 mt-1">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        {/* Content */}
        <div className={`px-6 py-5 bg-[#152035] overflow-y-auto flex-1 min-h-0 hide-scrollbar ${contentClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {!hideFooter && footer && (
          <DialogFooter className={`px-6 py-4 bg-[#0f1a2e] border-t border-[#2d4068] rounded-b-lg ${footerClassName}`}>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}