import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface VerificationInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string;
  countdown?: number;
  onResend?: () => void;
  resendText?: string;
  resendingText?: string;
  autoFocus?: boolean;
}

export const VerificationInput: React.FC<VerificationInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  error,
  countdown = 0,
  onResend,
  resendText = '重新发送',
  resendingText = '发送中...',
  autoFocus = true,
}) => {
  const [focused, setFocused] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Auto focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Focus next empty input when value changes
  useEffect(() => {
    const nextIndex = value.length;
    if (nextIndex < length && inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex]?.focus();
    }
  }, [value, length]);

  const handleChange = useCallback((index: number, inputValue: string) => {
    // Only allow digits
    const digit = inputValue.replace(/\D/g, '').slice(-1);
    
    if (digit) {
      const newValue = value.slice(0, index) + digit + value.slice(index + 1);
      onChange(newValue.slice(0, length));
      
      // Move to next input
      if (index < length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }, [value, onChange, length]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[index]) {
        // Clear current digit
        const newValue = value.slice(0, index) + value.slice(index + 1);
        onChange(newValue);
      } else if (index > 0) {
        // Move to previous input and clear it
        const newValue = value.slice(0, index - 1) + value.slice(index);
        onChange(newValue);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }, [value, onChange, length]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      // Focus the input after the last pasted digit
      const focusIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  }, [onChange, length]);

  const handleResend = async () => {
    if (!onResend || countdown > 0 || resending) return;
    
    setResending(true);
    try {
      await onResend();
    } finally {
      setResending(false);
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Input boxes */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            aria-label={`验证码第 ${index + 1} 位`}
            className={`
              w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-semibold
              rounded-xl bg-white/60 border-2 outline-none transition-all duration-200
              ${error 
                ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200' 
                : value[index] 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
              text-text placeholder:text-gray-300
            `}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-center text-sm text-red-500 flex items-center justify-center gap-1">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}

      {/* Countdown and resend button */}
      {onResend && (
        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-sm text-subtext flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatCountdown(countdown)} 后可重新发送</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || disabled}
              className={`
                text-sm font-medium transition-all duration-200
                ${resending || disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-primary hover:text-orange-600 hover:underline'
                }
              `}
            >
              {resending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {resendingText}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  {resendText}
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
