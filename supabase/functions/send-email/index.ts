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
  const templates: Record<string, EmailTemplate> = {
    verification: {
      subject: 'Lumina - 验证您的邮箱',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">验证您的邮箱</h2>
          <p>感谢您注册 Lumina！请使用以下验证码完成邮箱验证：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #666;">验证码有效期为 10 分钟。</p>
          <p style="color: #999; font-size: 12px;">如果您没有注册 Lumina 账户，请忽略此邮件。</p>
        </div>
      `,
    },
    password_reset: {
      subject: 'Lumina - 重置密码',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">重置您的密码</h2>
          <p>您请求重置 Lumina 账户密码。请使用以下验证码完成密码重置：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #666;">验证码有效期为 10 分钟。</p>
          <p style="color: #999; font-size: 12px;">如果您没有请求重置密码，请忽略此邮件。</p>
        </div>
      `,
    },
    email_change: {
      subject: 'Lumina - 验证新邮箱',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">验证新邮箱</h2>
          <p>您请求更改 Lumina 账户邮箱。请使用以下验证码完成验证：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #666;">验证码有效期为 10 分钟。</p>
          <p style="color: #999; font-size: 12px;">如果您没有请求更改邮箱，请忽略此邮件。</p>
        </div>
      `,
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
