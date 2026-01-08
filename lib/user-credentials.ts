// 用户凭证管理库
import { supabase } from './supabase'

export interface UserCredential {
  id: string
  user_id: string
  service_name: string
  credential_type: string
  credential_value: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// 获取用户的特定服务凭证
export async function getUserCredential(
  userId: string,
  serviceName: string,
  credentialType: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('credential_value')
    .eq('user_id', userId)
    .eq('service_name', serviceName)
    .eq('credential_type', credentialType)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data?.credential_value || null
}

// 获取用户的所有凭证
export async function getUserCredentials(userId: string): Promise<UserCredential[]> {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('user_id', userId)
    .order('service_name')

  if (error) throw error
  return data || []
}

// 获取用户特定服务的所有凭证
export async function getServiceCredentials(
  userId: string,
  serviceName: string
): Promise<UserCredential[]> {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('service_name', serviceName)
    .order('credential_type')

  if (error) throw error
  return data || []
}

// 保存或更新凭证
export async function saveCredential(
  userId: string,
  serviceName: string,
  credentialType: string,
  credentialValue: string,
  description?: string
): Promise<UserCredential> {
  const { data, error } = await supabase
    .from('user_credentials')
    .upsert(
      {
        user_id: userId,
        service_name: serviceName,
        credential_type: credentialType,
        credential_value: credentialValue,
        description,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'user_id,service_name,credential_type'
      }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// 删除凭证
export async function deleteCredential(
  userId: string,
  serviceName: string,
  credentialType: string
): Promise<void> {
  const { error } = await supabase
    .from('user_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('service_name', serviceName)
    .eq('credential_type', credentialType)

  if (error) throw error
}

// 禁用凭证（软删除）
export async function disableCredential(
  userId: string,
  serviceName: string,
  credentialType: string
): Promise<void> {
  const { error } = await supabase
    .from('user_credentials')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('service_name', serviceName)
    .eq('credential_type', credentialType)

  if (error) throw error
}

// 获取爬虫所需的所有凭证
export async function getCrawlerCredentials(userId: string) {
  const { data, error } = await supabase
    .from('user_crawler_credentials')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data
}

// 获取 Tavily API Key
export async function getTavilyApiKey(userId: string): Promise<string | null> {
  return getUserCredential(userId, 'tavily', 'api_key')
}

// 检查用户是否配置了 Tavily
export async function hasTavilyConfigured(userId: string): Promise<boolean> {
  const apiKey = await getTavilyApiKey(userId)
  return !!apiKey
}

// 获取 GitHub Personal Access Token
export async function getGithubToken(userId: string): Promise<string | null> {
  return getUserCredential(userId, 'github', 'personal_access_token')
}

// 检查用户是否配置了 GitHub Token
export async function hasGithubTokenConfigured(userId: string): Promise<boolean> {
  const token = await getGithubToken(userId)
  return !!token
}
