import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, Trash2, Zap } from 'lucide-react'
import { getUserCredentials, saveCredential, deleteCredential, type UserCredential } from '../lib/user-credentials'
import { getUserProviders, type AIProvider } from '../lib/ai-providers'
import { useToast } from '../shared/useToast'

interface Props {
  userId: string
}

// GitHub 官方图标
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
  </svg>
)

// 支持的服务配置（Reddit 使用公共 API 无需配置）
const SERVICES = {
  github: {
    name: 'GitHub',
    icon: GitHubIcon,
    credentials: [
      { type: 'token', label: 'Personal Access Token (可选)', description: '可选配置，用于提高 API 速率限制。无需勾选任何权限，创建空白 token 即可' }
    ]
  }
}

export default function CredentialsManager({ userId }: Props) {
  const [credentials, setCredentials] = useState<UserCredential[]>([])
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([])
  const [selectedAiProvider, setSelectedAiProvider] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showSecret, setShowSecret] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      const [credData, providerData] = await Promise.all([
        getUserCredentials(userId),
        getUserProviders(userId)
      ])
      setCredentials(credData)
      setAiProviders(providerData.filter(p => p.isEnabled))
      
      // 设置默认选中的 AI 提供商
      const defaultProvider = providerData.find(p => p.isDefault && p.isEnabled)
      if (defaultProvider) {
        setSelectedAiProvider(defaultProvider.id)
      } else if (providerData.length > 0) {
        setSelectedAiProvider(providerData[0].id)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('加载数据失败')
    }
    setLoading(false)
  }

  const handleSave = async (serviceName: string, credentialType: string) => {
    try {
      await saveCredential(userId, serviceName, credentialType, editValue)
      toast.success('凭证已保存')
      setEditingId(null)
      loadData()
    } catch (error: any) {
      toast.error('保存失败: ' + error.message)
    }
  }

  const handleDelete = async (credId: string, serviceName: string, credentialType: string) => {
    if (!confirm('确定要删除这个凭证吗？')) return
    try {
      await deleteCredential(userId, serviceName, credentialType)
      toast.success('凭证已删除')
      loadData()
    } catch (error: any) {
      toast.error('删除失败: ' + error.message)
    }
  }

  const getCredentialValue = (serviceName: string, credentialType: string) => {
    return credentials.find(
      c => c.service_name === serviceName && c.credential_type === credentialType
    )?.credential_value || ''
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* AI 提供商选择 */}
      {aiProviders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🤖</span>
            <h3 className="text-lg font-semibold text-gray-900">AI 提供商</h3>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择用于采集分析的 AI 提供商
            </label>
            <select
              value={selectedAiProvider}
              onChange={e => setSelectedAiProvider(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-blue-500/20 bg-white"
            >
              <option value="">-- 选择 AI 提供商 --</option>
              {aiProviders.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.providerKey})
                </option>
              ))}
            </select>
            
            {selectedAiProvider && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <Zap className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">
                  已选择 <strong>{aiProviders.find(p => p.id === selectedAiProvider)?.name}</strong> 作为采集分析的 AI 提供商
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 服务凭证卡片 */}
      <div className="grid gap-6">
        {Object.entries(SERVICES).map(([serviceKey, service]) => {
          const IconComponent = service.icon
          return (
            <div key={serviceKey} className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8">
                  <IconComponent className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
              </div>

              <div className="space-y-4">
                {service.credentials.map(credConfig => {
                  const credId = `${serviceKey}-${credConfig.type}`
                  const isEditing = editingId === credId
                  const value = getCredentialValue(serviceKey, credConfig.type)
                  const isSecret = credConfig.type !== 'client_id'

                  return (
                    <div key={credId}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {credConfig.label}
                      </label>
                      
                      <div className="flex gap-3 items-center">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type={isSecret && !showSecret?.includes(credId) ? 'password' : 'text'}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              placeholder={`输入 ${credConfig.label}`}
                              className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-blue-500/20"
                              autoFocus
                            />
                          ) : (
                            <div className="relative">
                              <input
                                type={isSecret && showSecret !== credId ? 'password' : 'text'}
                                value={value}
                                readOnly
                                placeholder="未配置"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-600 pr-10"
                              />
                              {value && isSecret && (
                                <button
                                  onClick={() => setShowSecret(showSecret === credId ? null : credId)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                  {showSecret === credId ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(serviceKey, credConfig.type)}
                                className="px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                title="保存"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                title="取消"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(credId)
                                  setEditValue(value)
                                }}
                                className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                title="编辑"
                              >
                                ✎
                              </button>
                              {value && (
                                <button
                                  onClick={() => handleDelete(credId, serviceKey, credConfig.type)}
                                  className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-1">{credConfig.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
