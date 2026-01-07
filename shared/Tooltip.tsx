// 共享 Tooltip 组件 - 主题样式
import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: TooltipPosition
  delay?: number
  className?: string
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top', 
  delay = 200,
  className = ''
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const scrollX = window.scrollX
        const scrollY = window.scrollY
        
        let x = 0, y = 0
        
        switch (position) {
          case 'top':
            x = rect.left + rect.width / 2 + scrollX
            y = rect.top + scrollY - 8
            break
          case 'bottom':
            x = rect.left + rect.width / 2 + scrollX
            y = rect.bottom + scrollY + 8
            break
          case 'left':
            x = rect.left + scrollX - 8
            y = rect.top + rect.height / 2 + scrollY
            break
          case 'right':
            x = rect.right + scrollX + 8
            y = rect.top + rect.height / 2 + scrollY
            break
        }
        
        setCoords({ x, y })
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getTransformOrigin = () => {
    switch (position) {
      case 'top': return 'bottom center'
      case 'bottom': return 'top center'
      case 'left': return 'right center'
      case 'right': return 'left center'
    }
  }

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'top':
        return { 
          left: coords.x, 
          top: coords.y,
          transform: 'translate(-50%, -100%)'
        }
      case 'bottom':
        return { 
          left: coords.x, 
          top: coords.y,
          transform: 'translate(-50%, 0)'
        }
      case 'left':
        return { 
          left: coords.x, 
          top: coords.y,
          transform: 'translate(-100%, -50%)'
        }
      case 'right':
        return { 
          left: coords.x, 
          top: coords.y,
          transform: 'translate(0, -50%)'
        }
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={`inline-flex ${className}`}
      >
        {children}
      </div>
      
      {createPortal(
        <AnimatePresence>
          {isVisible && content && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                ...getPositionStyles(),
                transformOrigin: getTransformOrigin(),
                zIndex: 9999,
              }}
              className="pointer-events-none"
            >
              <div className="px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap">
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export default Tooltip
