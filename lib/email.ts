/**
 * Email Service Library
 * 
 * Provides functions for sending verification and password reset emails.
 * In development mode, emails are simulated by logging to console.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we're in development mode (no Edge Function configured or explicit dev mode)
const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_EMAIL_DEV_MODE === 'true'

export type EmailType = 'verification' | 'password_reset' | 'email_change'

interface SendEmailOptions {
  type: EmailType
  to: string
  code: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Simulates sending an email in development mode by logging to console
 */
function simulateEmail(options: SendEmailOptions): void {
  const { type, to, code } = options
  
  const typeLabels: Record<EmailType, string> = {
    verification: '邮箱验证',
    password_reset: '密码重置',
    email_change: '邮箱更改验证',
  }

  console.log('\n' + '='.repeat(50))
  console.log(`📧 [开发模式] ${typeLabels[type]}邮件`)
  console.log('='.repeat(50))
  console.log(`收件人: ${to}`)
  console.log(`验证码: ${code}`)
  console.log(`类型: ${type}`)
  console.log(`时间: ${new Date().toLocaleString()}`)
  console.log('='.repeat(50) + '\n')
}

/**
 * Sends an email via Supabase Edge Function
 */
async function sendEmailViaEdgeFunction(options: SendEmailOptions): Promise<SendEmailResult> {
  const { type, to, code } = options

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration is missing')
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, to, code }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    return {
      success: false,
      error: errorData.error || '发送邮件失败',
    }
  }

  const result = await response.json()
  return {
    success: true,
    id: result.id,
  }
}

/**
 * Core email sending function
 * Uses Edge Function in production, console logging in development
 */
async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (isDevelopment) {
    simulateEmail(options)
    return { success: true, id: 'dev-mode-' + Date.now() }
  }

  return sendEmailViaEdgeFunction(options)
}

/**
 * Sends a verification email to the user
 * @param email - The recipient's email address
 * @param code - The 6-digit verification code
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const result = await sendEmail({
    type: 'verification',
    to: email,
    code,
  })

  if (!result.success) {
    throw new Error(result.error || '发送验证邮件失败')
  }
}

/**
 * Sends a password reset email to the user
 * @param email - The recipient's email address
 * @param code - The 6-digit reset code
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const result = await sendEmail({
    type: 'password_reset',
    to: email,
    code,
  })

  if (!result.success) {
    throw new Error(result.error || '发送密码重置邮件失败')
  }
}

/**
 * Sends an email change verification email to the new email address
 * @param email - The new email address to verify
 * @param code - The 6-digit verification code
 */
export async function sendEmailChangeVerification(email: string, code: string): Promise<void> {
  const result = await sendEmail({
    type: 'email_change',
    to: email,
    code,
  })

  if (!result.success) {
    throw new Error(result.error || '发送邮箱更改验证邮件失败')
  }
}

/**
 * Check if email service is in development mode
 */
export function isEmailDevMode(): boolean {
  return isDevelopment
}
