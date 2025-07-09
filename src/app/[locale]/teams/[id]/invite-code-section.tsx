'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { getTeamInviteCode, regenerateInviteCode } from './actions'

interface InviteCodeSectionProps {
  teamId: string
  isTeamCreator: boolean
  locale: string
}

export default function InviteCodeSection({ teamId, isTeamCreator, locale }: InviteCodeSectionProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('teams')

  // 只有团队创建者才能看到邀请码
  if (!isTeamCreator) {
    return null
  }

  // 获取邀请码
  const fetchInviteCode = async () => {
    setIsLoading(true)
    setError('')
    try {
      const code = await getTeamInviteCode(teamId)
      setInviteCode(code)
    } catch (err: any) {
      setError(err.message || t('failedToGetInviteCode'))
    } finally {
      setIsLoading(false)
    }
  }

  // 重新生成邀请码
  const handleRegenerateCode = () => {
    startTransition(async () => {
      try {
        const newCode = await regenerateInviteCode(teamId, locale)
        setInviteCode(newCode)
        setError('')
      } catch (err: any) {
        setError(err.message || t('failedToRegenerateCode'))
      }
    })
  }

  // 复制邀请码
  const handleCopyCode = async () => {
    if (!inviteCode) return
    
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      // 如果 clipboard API 不可用，使用备用方法
      const textArea = document.createElement('textarea')
      textArea.value = inviteCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  // 组件挂载时获取邀请码
  useEffect(() => {
    fetchInviteCode()
  }, [teamId])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('teamInviteCode')}
      </h3>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading')}</span>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 p-3 rounded-lg mb-4">
          {error}
        </div>
      ) : inviteCode ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm">
              {inviteCode}
            </div>
            <button
              onClick={handleCopyCode}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                copySuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copySuccess ? t('copied') : t('copy')}
            </button>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleRegenerateCode}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 focus:ring-4 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? t('regenerating') : t('regenerateCode')}
            </button>
            
            <button
              onClick={fetchInviteCode}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:ring-4 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t('refresh')}
            </button>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>{t('inviteCodeHint')}</p>
            <p className="mt-1">{t('shareCodeWarning')}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}