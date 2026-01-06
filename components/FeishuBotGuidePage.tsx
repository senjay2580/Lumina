import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, ExternalLink, ChevronDown, ChevronRight, Bot, Key, Webhook, Settings, Rocket, MessageSquare } from 'lucide-react';

interface FeishuBotGuidePageProps {
  onBack: () => void;
}

const WEBHOOK_CODE = `// 飞书 Webhook 处理函数 - 单文件版本
// 复制此代码到 Supabase Edge Function

// @ts-ignore - Deno types
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ... 完整代码请查看 GitHub 仓库`;

export function FeishuBotGuidePage({ onBack }: FeishuBotGuidePageProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const copyToClipboard = async (text: string, item: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const steps = [
    {
      title: '创建飞书应用',
      icon: Bot,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">在飞书开放平台创建企业自建应用</p>
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>
              访问{' '}
              <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline inline-flex items-center gap-1">
                飞书开放平台 <ExternalLink size={14} />
              </a>
            </li>
            <li>点击「创建企业自建应用」</li>
            <li>填写应用名称（如：Lumina 资源助手）和描述</li>
            <li>上传应用图标</li>
          </ol>
        </div>
      ),
    },
    {
      title: '获取应用凭证',
      icon: Key,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">在「凭证与基础信息」页面获取以下信息</p>
          <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">App ID</span>
              <code className="text-orange-400 bg-zinc-900 px-2 py-1 rounded">cli_xxxxxxxxxx</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">App Secret</span>
              <code className="text-orange-400 bg-zinc-900 px-2 py-1 rounded">xxxxxxxxxxxxxxxx</code>
            </div>
          </div>
          <p className="text-yellow-500 text-sm">⚠️ App Secret 请妥善保管，不要泄露</p>
        </div>
      ),
    },
    {
      title: '配置应用权限',
      icon: Settings,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">进入「权限管理」→「API 权限」，开通以下权限：</p>
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                <span className="text-zinc-300">im:message - 获取与发送消息</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                <span className="text-zinc-300">im:message:send_as_bot - 以应用身份发送消息</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                <span className="text-zinc-300">im:resource - 获取消息中的资源文件</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                <span className="text-zinc-300">contact:user.base:readonly - 获取用户基本信息</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '启用机器人能力',
      icon: MessageSquare,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">进入「应用能力」→「机器人」</p>
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>开启机器人能力</li>
            <li>配置机器人名称和描述</li>
            <li>（可选）配置自定义菜单：
              <ul className="list-disc list-inside ml-4 mt-2 text-zinc-400">
                <li>列表 - 发送文字消息「列表」</li>
                <li>统计 - 发送文字消息「统计」</li>
                <li>帮助 - 发送文字消息「帮助」</li>
              </ul>
            </li>
          </ol>
        </div>
      ),
    },
    {
      title: '部署 Webhook 函数',
      icon: Webhook,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">在 Supabase 部署 Edge Function 处理飞书消息</p>
          
          <div className="space-y-3">
            <h4 className="text-zinc-300 font-medium">1. 配置环境变量</h4>
            <p className="text-zinc-400 text-sm">在 Supabase Dashboard → Settings → Edge Functions → Secrets 添加：</p>
            <div className="bg-zinc-800 rounded-lg p-4 space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">FEISHU_APP_ID</span>
                <button
                  onClick={() => copyToClipboard('FEISHU_APP_ID', 'env1')}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  {copiedItem === 'env1' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">FEISHU_APP_SECRET</span>
                <button
                  onClick={() => copyToClipboard('FEISHU_APP_SECRET', 'env2')}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  {copiedItem === 'env2' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">FEISHU_VERIFICATION_TOKEN</span>
                <button
                  onClick={() => copyToClipboard('FEISHU_VERIFICATION_TOKEN', 'env3')}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  {copiedItem === 'env3' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-zinc-300 font-medium">2. 创建 Edge Function</h4>
            <p className="text-zinc-400 text-sm">在 Supabase Dashboard → Edge Functions → Create new function</p>
            <ul className="list-disc list-inside text-zinc-400 text-sm space-y-1">
              <li>函数名：<code className="text-orange-400">feishu-webhook</code></li>
              <li>关闭 JWT Verification</li>
              <li>复制代码并部署</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-zinc-300 font-medium">3. 获取代码</h4>
            <a
              href="https://github.com/your-repo/lumina/blob/main/supabase/functions/feishu-webhook/index-standalone.ts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-orange-400 hover:underline"
            >
              查看完整代码 <ExternalLink size={14} />
            </a>
          </div>
        </div>
      ),
    },
    {
      title: '配置事件订阅',
      icon: Webhook,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">进入「事件与回调」页面配置 Webhook</p>
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>选择「将事件发送至开发者服务器」</li>
            <li>
              填写请求地址：
              <div className="mt-2 bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
                <code className="text-orange-400 text-sm break-all">
                  https://[你的项目ID].supabase.co/functions/v1/feishu-webhook
                </code>
                <button
                  onClick={() => copyToClipboard('https://[你的项目ID].supabase.co/functions/v1/feishu-webhook', 'webhook')}
                  className="text-zinc-500 hover:text-zinc-300 ml-2 flex-shrink-0"
                >
                  {copiedItem === 'webhook' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </li>
            <li>复制 Verification Token 到 Supabase 环境变量</li>
            <li>添加事件：<code className="text-orange-400">im.message.receive_v1</code></li>
          </ol>
        </div>
      ),
    },
    {
      title: '发布应用',
      icon: Rocket,
      content: (
        <div className="space-y-4">
          <p className="text-zinc-400">完成配置后发布应用</p>
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>进入「版本管理与发布」</li>
            <li>创建新版本</li>
            <li>提交审核（企业内部应用通常自动通过）</li>
            <li>发布上线</li>
          </ol>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mt-4">
            <p className="text-green-400">
              🎉 发布成功后，组织内成员可以在飞书搜索机器人名称并添加使用
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-zinc-400" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">飞书机器人自建指南</h1>
            <p className="text-sm text-zinc-500">按照以下步骤在你的组织中部署 Lumina 资源助手</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* 简介 */}
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-medium text-zinc-200 mb-2">为什么需要自建？</h2>
            <p className="text-zinc-400 text-sm">
              飞书企业自建应用只能在创建者的组织内使用。如果你想在自己的组织中使用 Lumina 资源助手，
              需要按照本指南创建属于你组织的机器人应用。整个过程大约需要 15-30 分钟。
            </p>
          </div>

          {/* Steps */}
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isExpanded = expandedSections.has(index);
            
            return (
              <div key={index} className="bg-zinc-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-zinc-700/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-400 font-medium">{index + 1}</span>
                  </div>
                  <Icon size={20} className="text-zinc-400 flex-shrink-0" />
                  <span className="text-zinc-200 font-medium flex-1 text-left">{step.title}</span>
                  {isExpanded ? (
                    <ChevronDown size={20} className="text-zinc-500" />
                  ) : (
                    <ChevronRight size={20} className="text-zinc-500" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pl-16">
                    {step.content}
                  </div>
                )}
              </div>
            );
          })}

          {/* 帮助 */}
          <div className="bg-zinc-800/50 rounded-lg p-4 mt-6">
            <h3 className="text-zinc-200 font-medium mb-2">遇到问题？</h3>
            <p className="text-zinc-400 text-sm">
              如果在配置过程中遇到问题，可以查看{' '}
              <a href="https://open.feishu.cn/document/home/introduction-to-custom-app-development/self-built-application-development-process" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                飞书官方文档
              </a>
              {' '}或在 GitHub 提交 Issue。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
