// 共享按钮组件 - 3D 立体效果
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const variantStyles: Record<ButtonVariant, { base: string; shadow: string }> = {
  primary: {
    base: 'bg-[#e67e22] border-[#f39c12] text-white hover:bg-[#d35400]',
    shadow: '#d35400'
  },
  secondary: {
    base: 'bg-[#3498db] border-[#5dade2] text-white hover:bg-[#2980b9]',
    shadow: '#2471a3'
  },
  success: {
    base: 'bg-[#27ae60] border-[#2ecc71] text-white hover:bg-[#1e8449]',
    shadow: '#1e8449'
  },
  danger: {
    base: 'bg-[#e74c3c] border-[#ec7063] text-white hover:bg-[#c0392b]',
    shadow: '#a93226'
  },
  ghost: {
    base: 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200',
    shadow: '#d1d5db'
  }
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }, ref) => {
    const styles = variantStyles[variant]
    
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium rounded-lg border
          cursor-pointer select-none
          transition-all duration-100
          ${styles.base}
          ${sizeStyles[size]}
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        style={{
          boxShadow: disabled || loading ? 'none' : `0px 4px 0px 0px ${styles.shadow}`,
        }}
        onMouseDown={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.boxShadow = `0px 2px 0px 0px ${styles.shadow}`
            e.currentTarget.style.transform = 'translateY(2px)'
          }
        }}
        onMouseUp={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.boxShadow = `0px 4px 0px 0px ${styles.shadow}`
            e.currentTarget.style.transform = 'translateY(0)'
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.boxShadow = `0px 4px 0px 0px ${styles.shadow}`
            e.currentTarget.style.transform = 'translateY(0)'
          }
        }}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          icon
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
