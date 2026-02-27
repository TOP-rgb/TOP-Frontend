import * as SwitchPrimitive from '@radix-ui/react-switch'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}

export function Switch({ checked, onCheckedChange, label, description, disabled, id }: SwitchProps) {
  const switchId = id || `switch-${Math.random().toString(36).substring(2, 9)}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      {(label || description) && (
        <div style={{ flex: 1, minWidth: 0 }}>
          {label && (
            <label
              htmlFor={switchId}
              style={{ fontSize: 14, fontWeight: 500, color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer', display: 'block' }}
            >
              {label}
            </label>
          )}
          {description && (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0', lineHeight: 1.4 }}>
              {description}
            </p>
          )}
        </div>
      )}

      <SwitchPrimitive.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        style={{
          position: 'relative',
          display: 'inline-flex',
          height: 22,
          width: 42,
          flexShrink: 0,
          alignItems: 'center',
          borderRadius: 9999,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          backgroundColor: checked ? '#3b82f6' : '#d1d5db',
          opacity: disabled ? 0.5 : 1,
          outline: 'none',
        }}
      >
        <SwitchPrimitive.Thumb
          style={{
            display: 'block',
            height: 16,
            width: 16,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s',
            transform: checked ? 'translateX(22px)' : 'translateX(3px)',
          }}
        />
      </SwitchPrimitive.Root>
    </div>
  )
}
