'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { inviteMember } from './actions'

interface EnhancedInviteFormProps {
  teamId: string
  locale: string
}

export default function EnhancedInviteForm({ teamId, locale }: EnhancedInviteFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('teams')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!identifier.trim()) {
      setMessage(t('pleaseEnterEmailOrUsername'))
      setMessageType('error')
      return
    }

    startTransition(async () => {
      const result = await inviteMember(teamId, identifier.trim(), locale)
      if (result.success) {
        setMessage(result.message || t('invitationSuccessful'))
        setMessageType('success')
        setIdentifier('')
      } else {
        setMessage(result.error || t('invitationFailedUnknown'))
        setMessageType('error')
      }
    })
  }

  const validateInput = (value: string) => {
    if (!value.trim()) return ''
    
    const isEmail = value.includes('@')
    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return t('invalidEmailFormat')
      }
    } else {
      if (value.length < 3) {
        return t('usernameTooShort')
      }
      if (value.length > 20) {
        return t('usernameTooLong')
      }
    }
    return ''
  }

  const inputError = validateInput(identifier)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="identifier" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t('emailOrUsername')}
          </label>
          <input
            type="text"
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder={t('enterEmailOrUsername')}
            disabled={isPending}
          />
          {inputError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {inputError}
            </p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isPending || !!inputError || !identifier.trim()}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          {isPending ? t('inviting') : t('inviteMember')}
        </button>
      </form>
      
      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          messageType === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
            : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
        }`}>
          {message}
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>{t('inviteHint')}</p>
      </div>
    </div>
  )
}