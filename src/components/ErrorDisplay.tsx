'use client'

// 错误显示组件
// 用于在页面上展示详细的错误信息，包括错误类型、解决方案和技术细节

import { useState } from 'react'

interface ErrorDisplayProps {
  error: string
  className?: string
}

export default function ErrorDisplay({ error, className = '' }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  if (!error) return null
  
  // 解析错误消息（格式：主要消息 | 解决方案）
  const parts = error.split(' | ')
  const mainMessage = parts[0] || error
  const solution = parts[1] || ''
  
  // 检测错误类型
  const getErrorType = (message: string) => {
    if (message.includes('认证') || message.includes('登录')) return 'auth'
    if (message.includes('权限') || message.includes('授权')) return 'permission'
    if (message.includes('已存在') || message.includes('重复')) return 'duplicate'
    if (message.includes('网络') || message.includes('连接')) return 'network'
    if (message.includes('数据库') || message.includes('RLS')) return 'database'
    if (message.includes('验证') || message.includes('格式')) return 'validation'
    return 'unknown'
  }
  
  const errorType = getErrorType(error)
  
  // 错误类型对应的图标和颜色
  const getErrorStyle = (type: string) => {
    switch (type) {
      case 'auth':
        return { icon: '🔐', color: 'text-yellow-800 bg-yellow-50 border-yellow-200', iconColor: 'text-yellow-600' }
      case 'permission':
        return { icon: '🚫', color: 'text-red-800 bg-red-50 border-red-200', iconColor: 'text-red-600' }
      case 'duplicate':
        return { icon: '⚠️', color: 'text-orange-800 bg-orange-50 border-orange-200', iconColor: 'text-orange-600' }
      case 'network':
        return { icon: '🌐', color: 'text-blue-800 bg-blue-50 border-blue-200', iconColor: 'text-blue-600' }
      case 'database':
        return { icon: '🗄️', color: 'text-purple-800 bg-purple-50 border-purple-200', iconColor: 'text-purple-600' }
      case 'validation':
        return { icon: '📝', color: 'text-indigo-800 bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600' }
      default:
        return { icon: '❌', color: 'text-red-800 bg-red-50 border-red-200', iconColor: 'text-red-600' }
    }
  }
  
  const style = getErrorStyle(errorType)
  
  return (
    <div className={`border rounded-lg p-4 ${style.color} ${className}`} role="alert">
      {/* 主要错误信息 */}
      <div className="flex items-start space-x-3">
        <span className={`text-xl ${style.iconColor} flex-shrink-0 mt-0.5`}>
          {style.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">错误详情</span>
            {error.length > 100 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs underline hover:no-underline focus:outline-none"
              >
                {showDetails ? '收起详情' : '展开详情'}
              </button>
            )}
          </div>
          
          <div className={`mt-1 text-sm ${showDetails || error.length <= 100 ? '' : 'line-clamp-2'}`}>
            <div className="font-medium">{mainMessage}</div>
            
            {solution && (
              <div className="mt-2 p-2 rounded bg-white bg-opacity-50">
                <div className="text-xs font-medium mb-1">💡 建议解决方案：</div>
                <div className="text-xs">{solution}</div>
              </div>
            )}
            
            {showDetails && (
              <div className="mt-3 space-y-2">
                <div className="text-xs">
                  <div className="font-medium mb-1">🔍 错误分类：</div>
                  <div className="ml-2">
                    {errorType === 'auth' && '认证错误 - 用户身份验证问题'}
                    {errorType === 'permission' && '权限错误 - 用户权限不足'}
                    {errorType === 'duplicate' && '重复数据错误 - 数据已存在'}
                    {errorType === 'network' && '网络错误 - 连接或通信问题'}
                    {errorType === 'database' && '数据库错误 - 数据存储问题'}
                    {errorType === 'validation' && '验证错误 - 输入数据格式问题'}
                    {errorType === 'unknown' && '未知错误 - 需要进一步诊断'}
                  </div>
                </div>
                
                <div className="text-xs">
                  <div className="font-medium mb-1">⏰ 发生时间：</div>
                  <div className="ml-2">{new Date().toLocaleString('zh-CN')}</div>
                </div>
                
                <div className="text-xs">
                  <div className="font-medium mb-1">🛠️ 下一步操作：</div>
                  <div className="ml-2">
                    {errorType === 'auth' && '请重新登录或检查登录凭据'}
                    {errorType === 'permission' && '请联系管理员获取相应权限'}
                    {errorType === 'duplicate' && '请修改输入内容以避免重复'}
                    {errorType === 'network' && '请检查网络连接后重试'}
                    {errorType === 'database' && '请稍后重试或联系技术支持'}
                    {errorType === 'validation' && '请检查输入格式是否正确'}
                    {errorType === 'unknown' && '请联系技术支持并提供错误详情'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 简化版错误显示组件（用于简单场景）
export function SimpleErrorDisplay({ error, className = '' }: ErrorDisplayProps) {
  if (!error) return null
  
  const parts = error.split(' | ')
  const mainMessage = parts[0] || error
  
  return (
    <div className={`p-3 text-sm text-red-800 rounded-lg bg-red-50 border border-red-200 ${className}`} role="alert">
      <div className="flex items-center space-x-2">
        <span className="text-red-600">❌</span>
        <span className="font-medium">错误：</span>
        <span>{mainMessage}</span>
      </div>
    </div>
  )
}