import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

function Input({ className, type, label, error, id, leftIcon, rightIcon, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            "h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            error && "border-red-500 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500",
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 flex items-center pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}

// Select Component - Modern Composed Pattern
interface SelectContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  value: string | number | undefined
  onValueChange: (value: string | number) => void
  selectedLabel: React.ReactNode
  setSelectedLabel: (label: React.ReactNode) => void
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined)

interface SelectProps {
  children: React.ReactNode
  value?: string | number
  onValueChange?: (value: string | number) => void
  label?: string
  error?: string
  disabled?: boolean
  className?: string
}

function Select({ children, value, onValueChange, label, error, disabled, className }: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedLabel, setSelectedLabel] = React.useState<React.ReactNode>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const handleValueChange = (newValue: string | number) => {
    onValueChange?.(newValue)
    setIsOpen(false)
  }

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <SelectContext.Provider
      value={{
        isOpen,
        setIsOpen,
        value: value ?? "",
        onValueChange: handleValueChange,
        selectedLabel,
        setSelectedLabel,
      }}
    >
      <div className={cn("space-y-1.5 relative", className)} ref={wrapperRef}>
        {label && (
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
            {label}
          </label>
        )}
        {children}
        {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
      </div>
    </SelectContext.Provider>
  )
}

function useSelectContext() {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error("Select components must be used within a Select")
  }
  return context
}

interface SelectTriggerProps extends React.ComponentProps<"button"> {
  children?: React.ReactNode
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { isOpen, setIsOpen, value } = useSelectContext()

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "w-full h-10 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 flex items-center justify-between gap-2",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500",
        value === "" && "text-slate-500 dark:text-slate-400",
        isOpen && "ring-2 ring-blue-500/30 border-blue-500",
        className
      )}
      {...props}
    >
      <span className="flex-1 text-left">{children}</span>
      <ChevronDown className={cn(
        "h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 flex-shrink-0",
        isOpen && "rotate-180"
      )} />
    </button>
  )
}

interface SelectValueProps {
  placeholder?: string
  children?: React.ReactNode
}

function SelectValue({ placeholder, children }: SelectValueProps) {
  const { selectedLabel, value } = useSelectContext()

  if (children) {
    return <>{children}</>
  }

  if (value && selectedLabel) {
    return <>{selectedLabel}</>
  }

  return <span className="text-slate-500 dark:text-slate-400">{placeholder || "Select an option"}</span>
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

function SelectContent({ children, className }: SelectContentProps) {
  const { isOpen } = useSelectContext()

  if (!isOpen) return null

  return (
    <div className={cn(
      "absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg",
      className
    )}>
      <div className="max-h-64 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

interface SelectItemProps {
  value: string | number
  children: React.ReactNode
  className?: string
}

function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: selectedValue, onValueChange, setSelectedLabel } = useSelectContext()
  const isSelected = selectedValue === value

  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value)
        setSelectedLabel(children)
      }}
      className={cn(
        "w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center gap-2",
        "hover:bg-slate-100 dark:hover:bg-slate-800",
        isSelected && "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold",
        !isSelected && "text-slate-700 dark:text-slate-300",
        className
      )}
    >
      {children}
    </button>
  )
}

interface SelectGroupProps {
  label?: string
  children: React.ReactNode
}

function SelectGroup({ label, children }: SelectGroupProps) {
  return (
    <div>
      {label && (
        <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

// Legacy simple select for backwards compatibility
export interface SelectOption {
  value: string | number
  label: string
}

export interface SimplSelectProps extends React.ComponentProps<"select"> {
  label?: string
  options?: SelectOption[]
  placeholder?: string
  error?: string
}

function SimpleSelect({ label, options = [], placeholder, className, error, id, ...props }: SimplSelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300 block"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md",
          error && "border-red-500 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500",
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}

export {
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SimpleSelect
}