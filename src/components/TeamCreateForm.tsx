'use client'

// 团队创建表单组件
// 调试版本：能处理后端返回的详细错误信息

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createTeam, redirectToTeamPage } from '@/app/[locale]/teams/create/actions'
import { useRouter } from 'next/navigation'

interface TeamCreateFormProps {
  className?: string
  locale?: string
}

export default function TeamCreateForm({ className = '', locale = 'zh' }: TeamCreateFormProps) {
  const t = useTranslations('teams')
  const router = useRouter() // 使用 useRouter 进行跳转
  const [teamName, setTeamName] = useState('')
  const [validationError, setValidationError] = useState('')
  const [formError, setFormError] = useState<string | null>(null) // 新增：用于存储后端返回的错误
  const [isPending, setIsPending] = useState(false)

  const validateTeamName = (name: string) => {
    if (!name.trim()) return '团队名称不能为空'
    if (name.trim().length < 2) return '团队名称至少需要2个字符'
    if (name.trim().length > 50) return '团队名称不能超过50个字符'
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9\s\-_]+$/.test(name.trim())) {
      return '团队名称只能包含中文、英文、数字、空格、连字符和下划线'
    }
    return ''
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTeamName(value)
    setFormError(null) // 用户输入时清除后端错误
    const error = validateTeamName(value)
    setValidationError(error)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault() // 阻止表单默认提交
    const error = validateTeamName(teamName)
    if (error) {
      setValidationError(error)
      return
    }

    setIsPending(true)
    setFormError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createTeam(formData)

    setIsPending(false)

    if (result.success && result.teamId) {
      // 成功，手动跳转
      await redirectToTeamPage(result.teamId, locale)
    } else {
      // 失败，显示错误信息
      setFormError(result.error || '发生未知错误')
    }
  }

  const isValid = teamName.trim().length >= 2 && teamName.trim().length <= 50 && !validationError

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
          {t('teamName')}
        </label>
        <div className="relative">
          <input
            type="text"
            name="name"
            id="name"
            value={teamName}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 text-gray-900 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-all duration-200 ${
              validationError 
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                : teamName && isValid 
                ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300'
            }`}
            placeholder={t('teamNamePlaceholder')}
            required
            disabled={isPending}
            autoComplete="off"
            maxLength={50}
          />
          {teamName && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {validationError ? (
                <span className="text-red-500" title={validationError}>❌</span>
              ) : isValid ? (
                <span className="text-green-500" title="格式正确">✅</span>
              ) : null}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-between items-start">
          <div className="text-xs">
            {validationError ? (
              <span className="text-red-600 dark:text-red-400">{validationError}</span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{t('teamNameLengthHint')}</span>
            )}
          </div>
          <span className={`text-xs ${teamName.length > 45 ? 'text-orange-600' : 'text-gray-400'}`}>
            {teamName.length}/50
          </span>
        </div>
      </div>

      {/* 新增：显示后端错误信息 */}
      {formError && (
        <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-200 rounded-lg dark:bg-red-900 dark:text-red-300 dark:border-red-800">
          <p><span className="font-medium">{t('creationFailed')}:</span> {formError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || isPending}
        className={`w-full px-5 py-3 text-base font-medium text-center text-white rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 ${
          !isValid || isPending
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700'
        }`}
      >
        {isPending ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>{t('creating')}</span>
          </div>
        ) : (
          t('createTeam')
        )}
      </button>

      {isPending && (
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('creatingTeamHint')}</p>
        </div>
      )}
    </form>
  )
}
