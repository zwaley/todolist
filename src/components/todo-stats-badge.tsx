import React from 'react'
import { cn } from '@/lib/utils'

interface TodoStatsBadgeProps {
  total: number
  completed: number
  pending: number
  variant?: 'full' | 'minimal'
  className?: string
}

/**
 * 待办事项统计徽章组件
 * 显示总数、已完成和待处理的待办事项数量
 */
export function TodoStatsBadge({ 
  total, 
  completed, 
  pending, 
  variant = 'full',
  className 
}: TodoStatsBadgeProps) {
  // 计算完成百分比
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
  
  // 根据完成率确定颜色主题
  const getColorTheme = () => {
    if (completionPercentage === 100) {
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200'
    } else if (completionPercentage >= 70) {
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200'
    } else if (completionPercentage >= 40) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
    } else {
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200'
    }
  }

  if (variant === 'minimal') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border',
        getColorTheme(),
        className
      )}>
        {pending > 0 ? pending : '✓'}
      </span>
    )
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border',
      getColorTheme(),
      className
    )}>
      <div className="flex items-center gap-1">
        <span className="text-xs">📊</span>
        <span>{total} 总计</span>
      </div>
      
      {total > 0 && (
        <>
          <div className="w-px h-4 bg-current opacity-30" />
          
          <div className="flex items-center gap-1">
            <span className="text-xs">✅</span>
            <span>{completed} 已完成</span>
          </div>
          
          {pending > 0 && (
            <>
              <div className="w-px h-4 bg-current opacity-30" />
              <div className="flex items-center gap-1">
                <span className="text-xs">⏳</span>
                <span>{pending} 待处理</span>
              </div>
            </>
          )}
          
          <div className="w-px h-4 bg-current opacity-30" />
          <span className="font-bold">{completionPercentage}%</span>
        </>
      )}
    </div>
  )
}

export default TodoStatsBadge