// Supabase Edge Function for sending emails via Resend API
// Supports verification and password_reset email types

// @ts-ignore - Deno types not available locally
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Lumina <noreply@lumina.app>'

interface EmailRequest {
  type: 'verification' | 'password_reset' | 'email_change'
  to: string
  code: string
}

interface EmailTemplate {
  subject: string
  html: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getEmailTemplate(type: string, code: string): EmailTemplate {
  // 获取当前时间
  const now = new Date()
  const year = now.getFullYear()
  const timeStr = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  const wrapHtml = (title: string, desc: string, footerNote: string) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Lumina</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #ffffff; min-height: 100vh;">
  
  <!-- 全屏艺术背景 -->
  <div style="min-height: 100vh; background: radial-gradient(circle at 0% 0%, rgba(255, 140, 0, 0.05) 0%, transparent 30%), radial-gradient(circle at 100% 100%, rgba(232, 93, 0, 0.05) 0%, transparent 30%);">
    
    <!-- 主内容区 -->
    <div style="max-width: 600px; margin: 0 auto; padding: 48px 24px; text-align: center;">
      
      <!-- Logo -->
      <div style="margin-bottom: 32px; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" style="display: inline-block; margin-bottom: 12px;">
          <defs>
            <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF8C00"/>
              <stop offset="50%" stop-color="#FF6B00"/>
              <stop offset="100%" stop-color="#E85D00"/>
            </linearGradient>
            <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFB347"/>
              <stop offset="100%" stop-color="#FF6B00"/>
            </linearGradient>
          </defs>
          <g fill="none">
            <path fill="url(#g1)" fill-rule="evenodd" d="M10.2 6L8 8a1 1 0 0 0 1.4 1.4A21 21 0 0 1 12 7.2a21 21 0 0 1 2.6 2.2A1 1 0 0 0 16.1 8l-2.2-2l2.6-1c1.2-.1 1.8 0 2.2.4c.4.5.6 1.6 0 3.4c-.7 1.8-2.1 3.9-4 5.8c-2 2-4 3.4-5.9 4c-1.8.7-3 .5-3.4 0c-.3-.3-.5-1-.3-2a9 9 0 0 1 1-2.7L8 16a1 1 0 0 0 1.3-1.5c-1.9-1.9-3.3-4-4-5.8c-.6-1.8-.4-3 0-3.4c.4-.3 1-.5 2.2-.3c.7.1 1.6.5 2.6 1ZM12 4.9c1.5-.8 2.9-1.4 4.2-1.7C17.6 3 19 3 20 4.1c1.3 1.3 1.2 3.5.4 5.5a15 15 0 0 1-1.2 2.4c.8 1.5 1.4 3 1.7 4.2c.2 1.4 0 2.9-1 3.9s-2.4 1.1-3.8.9c-1.3-.3-2.7-.9-4.2-1.7l-2.4 1.2c-2 .8-4.2 1-5.6-.4c-1-1-1.1-2.5-.9-3.9A12 12 0 0 1 4.7 12a15 15 0 0 1-1.2-2.4c-.8-2-1-4.2.4-5.6C5 3 6.5 3 8 3.1c1.2.3 2.6.9 4 1.7ZM14 18a9 9 0 0 0 2.7 1c1 .2 1.7 0 2-.3c.4-.4.6-1 .4-2.1a9 9 0 0 0-1-2.7A23.4 23.4 0 0 1 14 18" clip-rule="evenodd"/>
            <path fill="url(#g2)" d="M14 12a2 2 0 1 1-4 0a2 2 0 0 1 4 0"/>
          </g>
        </svg>
        <div style="font-size: 32px; font-weight: 800; color: #EA580C; letter-spacing: 2px;">LUMINA</div>
      </div>
      
      <!-- 标题 -->
      <h1 style="font-size: 28px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; margin: 0 0 16px 0;">${title}</h1>
      <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 32px 0; max-width: 400px; margin-left: auto; margin-right: auto;">${desc}</p>
      
      <!-- 通栏验证码区域 -->
      <div style="background: linear-gradient(135deg, rgba(255, 140, 0, 0.03) 0%, rgba(232, 93, 0, 0.08) 100%); border-top: 1px solid rgba(255, 140, 0, 0.15); border-bottom: 1px solid rgba(255, 140, 0, 0.15); padding: 40px 20px; margin: 0 -24px 32px -24px; position: relative;">
        <!-- 装饰线 -->
        <div style="position: absolute; top: -8px; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 140, 0, 0.3), transparent);"></div>
        <div style="position: absolute; bottom: -8px; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 140, 0, 0.3), transparent);"></div>
        
        <!-- 验证码 -->
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #EA580C; margin-bottom: 16px;">${code}</div>
        
        <!-- 装饰点 -->
        <div style="display: flex; justify-content: center; gap: 8px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #fed7aa;"></span>
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #fb923c;"></span>
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #ea580c;"></span>
        </div>
      </div>
      
      <!-- 有效期提示 -->
      <p style="font-size: 14px; color: #9ca3af; margin: 0 0 16px 0;">
        此验证码将于 <span style="color: #EA580C; font-family: monospace; font-weight: 600;">10:00</span> 分钟后失效
      </p>
      
      <!-- 安全提示 -->
      <p style="font-size: 13px; color: #d1d5db; margin: 0;">${footerNote}</p>
      
    </div>
    
    <!-- 页脚 -->
    <div style="background: #fafaf9; border-top: 1px solid #f3f4f6; padding: 24px; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2" style="opacity: 0.8;">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <span style="font-size: 13px; color: #EA580C; opacity: 0.8; font-weight: 500;">Lumina Security Protocol v4.0</span>
        </div>
        <p style="font-size: 12px; color: #a8a29e; margin: 0;">
          © ${year} Lumina Tech by Senjay. All Rights Reserved.
        </p>
        <p style="font-size: 11px; color: #d1d5db; margin: 8px 0 0 0;">
          发送时间：${timeStr}
        </p>
      </div>
    </div>
    
  </div>
</body>
</html>
`

  const templates: Record<string, EmailTemplate> = {
    verification: {
      subject: '✨ Lumina - 验证您的邮箱',
      html: wrapHtml(
        '邮箱验证',
        '感谢您注册 Lumina！请使用以下验证码完成邮箱验证，开启您的智能工作流之旅。',
        '如果您没有注册 Lumina 账户，请忽略此邮件。'
      ),
    },
    password_reset: {
      subject: '🔐 Lumina - 重置密码',
      html: wrapHtml(
        '重置密码',
        '您正在重置 Lumina 账户密码，请使用以下验证码完成密码重置操作。',
        '如果您没有请求重置密码，请忽略此邮件并确保账户安全。'
      ),
    },
    email_change: {
      subject: '📧 Lumina - 验证新邮箱',
      html: wrapHtml(
        '验证新邮箱',
        '您正在更改 Lumina 账户的邮箱地址，请使用以下验证码完成验证。',
        '如果您没有请求更改邮箱，请忽略此邮件并检查账户安全。'
      ),
    },
  }

  return templates[type] || templates.verification
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // Check if RESEND_API_KEY is configured
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { type, to, code }: EmailRequest = await req.json()

    // Validate request
    if (!type || !to || !code) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, to, code' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email type
    if (!['verification', 'password_reset', 'email_change'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const template = getEmailTemplate(type, code)

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text()
      console.error('Resend API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = await resendResponse.json()
    
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
