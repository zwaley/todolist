'use client'

import React, { useState, useTransition } from 'react'
import { inviteMember } from './actions'
import { cn } from '@/lib/utils'

interface EnhancedInviteFormProps {
  teamId: string
  className?: string
}

/**
 * 增强的团队成员邀请表单组件
 * 支持通过邮箱或用户名邀请新成员
 */
export default function EnhancedInviteForm({ teamId, className }: EnhancedInviteFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [validationError, setValidationError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // 验证输入格式
  const validateIdentifier = (value: string) => {
    if (!value.trim()) {
      return '请输入邮箱地址或用户名'
    }
    
    const isEmail = value.includes('@')
    if (isEmail) {
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return '请输入有效的邮箱地址'
      }
    } else {
      // 用户名验证
      if (value.length < 3) {
        return '用户名至少需要3个字符'
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return '用户名只能包含字母、数字、下划线和连字符'
      }
    }
    
    return ''
  }

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setIdentifier(value)
    
    // 清除之前的消息
    setValidationError('')
    setSuccessMessage('')
    
    // 实时验证
    if (value.trim()) {
      const error = validateIdentifier(value)
      setValidationError(error)
    }
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // 最终验证
    const error = validateIdentifier(identifier)
    if (error) {
      setValidationError(error)
      return
    }
    
    // 清除消息
    setValidationError('')
    setSuccessMessage('')
    
    startTransition(async () => {
      try {
        await inviteMember(teamId, identifier.trim())
        setSuccessMessage(`成功邀请 ${identifier.trim()} 加入团队！`)
        setIdentifier('')
      } catch (error: any) {
        setValidationError(error.message || '邀请失败，请稍后重试')
      }
    })
  }

  // 判断输入类型
  const inputType = identifier.includes('@') ? 'email' : 'text'
  const placeholder = identifier.includes('@') ? '输入邮箱地址...' : '输入用户名或邮箱地址...'

  return (
    <div className={cn('space-y-4', className)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type={inputType}
            value={identifier}
            onChange={handleInputChange}
            className={cn(
              'w-full px-4 py-3 text-gray-900 bg-gray-50 border rounded-lg transition-colors',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              'dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white',
              'dark:focus:ring-blue-500 dark:focus:border-blue-500',
              validationError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300',
              isPending && 'opacity-50 cursor-not-allowed'
            )}
            placeholder={placeholder}
            disabled={isPending}
            autoComplete="off"
          />
          
          {/* 输入类型指示器 */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {identifier.includes('@') ? (
              <span className="text-blue-500 text-sm">📧</span>
            ) : identifier.length > 0 ? (
              <span className="text-green-500 text-sm">👤</span>
            ) : null}
          </div>
        </div>
        
        {/* 验证错误显示 */}
        {validationError && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <span>❌</span>
            <span>{validationError}</span>
          </div>
        )}
        
        {/* 成功消息显示 */}
        {successMessage && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}
        
        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={isPending || !!validationError || !identifier.trim()}
          className={cn(
            'w-full px-4 py-3 text-white font-medium rounded-lg transition-all duration-200',
            'focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800',
            isPending || !!validationError || !identifier.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          )}
        >
          {isPending ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>邀请中...</span>
            </div>
          ) : (
            '发送邀请'
          )}
        </button>
      </form>
      
      {/* 使用说明 */}
      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
        <p>💡 <strong>使用说明：</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>输入邮箱地址邀请已注册用户</li>
          <li>输入用户名邀请特定用户</li>
          <li>被邀请用户需要已在系统中注册</li>
        </ul>
      </div>
    </div>
  )
}