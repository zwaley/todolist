'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { getTeamInviteCode, regenerateInviteCode, joinTeamByInviteCode } from './actions'
import { cn } from '@/lib/utils'

interface InviteCodeSectionProps {
  teamId: string
  isTeamCreator: boolean
  className?: string
}

/**
 * 团队邀请码管理组件
 * 团队创建者可以查看和重新生成邀请码
 * 普通用户可以使用邀请码加入团队
 */
export default function InviteCodeSection({ teamId, isTeamCreator, className }: InviteCodeSectionProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inputCode, setInputCode] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showCode, setShowCode] = useState(false)

  // 加载邀请码（仅团队创建者）
  useEffect(() => {
    if (isTeamCreator) {
      loadInviteCode()
    }
  }, [isTeamCreator, teamId])

  // 获取邀请码
  const loadInviteCode = async () => {
    try {
      setIsLoading(true)
      const code = await getTeamInviteCode(teamId)
      setInviteCode(code)
    } catch (error: any) {
      setMessage(error.message || '获取邀请码失败')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  // 重新生成邀请码
  const handleRegenerateCode = () => {
    startTransition(async () => {
      try {
        const newCode = await regenerateInviteCode(teamId)
        setInviteCode(newCode)
        setMessage('邀请码已重新生成')
        setMessageType('success')
        setTimeout(() => setMessage(''), 3000)
      } catch (error: any) {
        setMessage(error.message || '重新生成邀请码失败')
        setMessageType('error')
      }
    })
  }

  // 复制邀请码到剪贴板
  const handleCopyCode = async () => {
    if (!inviteCode) return
    
    try {
      await navigator.clipboard.writeText(inviteCode)
      setMessage('邀请码已复制到剪贴板')
      setMessageType('success')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage('复制失败，请手动复制')
      setMessageType('error')
    }
  }

  // 使用邀请码加入团队
  const handleJoinTeam = () => {
    if (!inputCode.trim()) {
      setMessage('请输入邀请码')
      setMessageType('error')
      return
    }

    startTransition(async () => {
      try {
        await joinTeamByInviteCode(inputCode.trim().toUpperCase())
        setMessage('成功加入团队！')
        setMessageType('success')
        setInputCode('')
        // 刷新页面以显示新的团队信息
        setTimeout(() => window.location.reload(), 1500)
      } catch (error: any) {
        setMessage(error.message || '加入团队失败')
        setMessageType('error')
      }
    })
  }

  // 消息样式
  const getMessageStyle = () => {
    switch (messageType) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800'
    }
  }

  if (isTeamCreator) {
    // 团队创建者视图
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          团队邀请码
        </h3>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
            </div>
          ) : inviteCode ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    当前邀请码
                  </label>
                  <div className="relative">
                    <input
                      type={showCode ? 'text' : 'password'}
                      value={inviteCode}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-center text-lg tracking-wider dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showCode ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📋 复制邀请码
                </button>
                <button
                  onClick={handleRegenerateCode}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
                >
                  {isPending ? '生成中...' : '🔄 重新生成'}
                </button>
              </div>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <p>💡 <strong>使用说明：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>分享此邀请码给想要加入团队的用户</li>
                  <li>邀请码不会过期，但可以重新生成</li>
                  <li>重新生成后，旧的邀请码将失效</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400">无法获取邀请码</p>
              <button
                onClick={loadInviteCode}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                重试
              </button>
            </div>
          )}
        </div>
        
        {/* 消息显示 */}
        {message && (
          <div className={cn(
            'p-3 rounded-lg border text-sm',
            getMessageStyle()
          )}>
            {message}
          </div>
        )}
      </div>
    )
  } else {
    // 普通用户视图 - 加入团队
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          加入其他团队
        </h3>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              输入邀请码
            </label>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="输入8位邀请码..."
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-center text-lg tracking-wider uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500"
              disabled={isPending}
            />
          </div>
          
          <button
            onClick={handleJoinTeam}
            disabled={isPending || !inputCode.trim()}
            className={cn(
              'w-full px-4 py-2 text-white font-medium rounded-lg transition-colors',
              isPending || !inputCode.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>加入中...</span>
              </div>
            ) : (
              '🚀 加入团队'
            )}
          </button>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>💡 向团队创建者索取8位邀请码即可加入团队</p>
          </div>
        </div>
        
        {/* 消息显示 */}
        {message && (
          <div className={cn(
            'p-3 rounded-lg border text-sm',
            getMessageStyle()
          )}>
            {message}
          </div>
        )}
      </div>
    )
  }
}