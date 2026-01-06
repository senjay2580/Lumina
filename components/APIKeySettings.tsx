import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../shared/useToast'

interface Props {
  userId: string
}

export default function APIKeySettings({ userId }: Props) {
  const [keys, setKeys] = useState({
    reddit_client_id: '',
    reddit_client_secret: '',
    github_token: '',
    openai_api_key: ''
  })
  
  const [showSecrets, setShowSecrets] = useState({
    reddit_client_secret: false,
    github_token: false,
    openai_api_key: false
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    loadKeys()
  }, [userId])

  const loadKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      if (data) {
        setKeys({
          reddit_client_id: data.reddit_client_id || '',
          reddit_client_secret: data.reddit_client_secret || '',
          github_token: data.github_token || '',
          openai_api_key: data.openai_api_key || ''
        })
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .upsert({
          user_id: userId,
          reddit_client_id: keys.reddit_client_id,
          reddit_client_secret: keys.reddit_client_secret,
          github_token: keys.github_token,
          openai_api_key: keys.openai_api_key,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
      
      if (error) throw error
      toast.success('API 密钥已保存')
    } catch (error: any) {
      toast.error('保存失败: ' + error.message)
    }
    setSaving(false)
  }

  const toggleShow = (key: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">使用你自己的 API 密钥</h3>
          <p className="text-sm text-blue-700">
            配置你自己的 API 密钥后，采集系统会使用你的密钥而不是共享密钥。这样可以避免配额限制。
          </p>
        </div>
      </div>

      {/* Reddit 密钥 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reddit API 密钥</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client ID
            </label>
            <input
              type="text"
              value={keys.reddit_client_id}
              onChange={e => setKeys({ ...keys, reddit_client_id: e.target.value })}
              placeholder="输入 Reddit Client ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-blue-500/20"
            />
            <p className="text-xs text-gray-500 mt-1">
              从 <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Reddit Apps</a> 获取
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecrets.reddit_client_secret ? 'text' : 'password'}
                value={keys.reddit_client_secret}
                onChange={e => setKeys({ ...keys, reddit_client_secret: e.target.value })}
                placeholder="输入 Reddit Client Secret"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-blue-500/20 pr-10"
              />
              <button
                onClick={() => toggleShow('reddit_client_secret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showSecrets.reddit_client_secret ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub 密钥 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">GitHub Token</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personal Access Token
          </label>
          <div className="relative">
            <input
              type={showSecrets.github_token ? 'text' : 'password'}
              value={keys.github_token}
              onChange={e => setKeys({ ...keys, github_token: e.target.value })}
              placeholder="输入 GitHub Personal Access Token"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-blue-500/20 pr-10"
            />
            <button
              onClick={() => toggleShow('github_token')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showSecrets.github_token ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            从 <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub Settings</a> 获取
          </p>
        </div>
      </div>

      {/* OpenAI 密钥 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">OpenAI API Key</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showSecrets.openai_api_key ? 'text' : 'password'}
              value={keys.openai_api_key}
              onChange={e => setKeys({ ...keys, openai_api_key: e.target.value })}
              placeholder="输入 OpenAI API Key"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-blue-500/20 pr-10"
            />
            <button
              onClick={() => toggleShow('openai_api_key')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showSecrets.openai_api_key ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            从 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a> 获取
          </p>
        </div>
      </div>

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存 API 密钥'}
      </button>
    </div>
  )
}
