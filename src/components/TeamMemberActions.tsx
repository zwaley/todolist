'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { removeMember, leaveTeam } from '@/app/[locale]/teams/[id]/actions'
import ConfirmDialog from './ConfirmDialog'

interface TeamMemberActionsProps {
  teamId: string
  memberId: string
  isCurrentUser: boolean
  isTeamCreator: boolean
  currentUserIsCreator: boolean
  locale: string
}

/**
 * 团队成员操作组件
 * 提供删除成员和退出团队的功能
 */
export default function TeamMemberActions({
  teamId,
  memberId,
  isCurrentUser,
  isTeamCreator,
  currentUserIsCreator,
  locale
}: TeamMemberActionsProps) {
  const t = useTranslations('teams')
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  // 处理删除成员
  const handleRemoveMember = async () => {
    setIsRemoving(true)
    try {
      await removeMember(teamId, memberId)
      setShowRemoveDialog(false)
    } catch (error) {
      console.error('Failed to remove member:', error)
    } finally {
      setIsRemoving(false)
    }
  }

  // 处理退出团队
  const handleLeaveTeam = async () => {
    setIsLeaving(true)
    try {
      await leaveTeam(teamId)
      setShowLeaveDialog(false)
    } catch (error) {
      console.error('Failed to leave team:', error)
    } finally {
      setIsLeaving(false)
    }
  }

  // 如果是当前用户且是创建者，不显示任何操作
  if (isCurrentUser && isTeamCreator) {
    return (
      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
        {t('teamCreator')}
      </span>
    )
  }

  // 如果是其他成员且是创建者，不显示操作（创建者不能被删除）
  if (!isCurrentUser && isTeamCreator) {
    return (
      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
        {t('teamCreator')}
      </span>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 当前用户的退出按钮 */}
        {isCurrentUser && (
          <button
            onClick={() => setShowLeaveDialog(true)}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors"
          >
            {t('leaveTeam')}
          </button>
        )}
        
        {/* 创建者的删除成员按钮 */}
        {!isCurrentUser && currentUserIsCreator && (
          <button
            onClick={() => setShowRemoveDialog(true)}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors"
          >
            {t('removeMember')}
          </button>
        )}
      </div>

      {/* 删除成员确认对话框 */}
      <ConfirmDialog
        isOpen={showRemoveDialog}
        title={t('confirmAction')}
        message={t('removeConfirmMessage')}
        confirmText={isRemoving ? t('removing') : t('removeMember')}
        onConfirm={handleRemoveMember}
        onCancel={() => setShowRemoveDialog(false)}
        isLoading={isRemoving}
      />

      {/* 退出团队确认对话框 */}
      <ConfirmDialog
        isOpen={showLeaveDialog}
        title={t('confirmAction')}
        message={t('leaveConfirmMessage')}
        confirmText={isLeaving ? t('leaving') : t('leaveTeam')}
        onConfirm={handleLeaveTeam}
        onCancel={() => setShowLeaveDialog(false)}
        isLoading={isLeaving}
      />
    </>
  )
}