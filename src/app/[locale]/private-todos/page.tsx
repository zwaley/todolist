import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { addPrivateTodo, togglePrivateTodo, deletePrivateTodo } from './actions'
import { TodoStatsBadge } from '@/components/todo-stats-badge'
import { LanguageToggle } from '@/components/LanguageSwitcher'

export const revalidate = 0

interface PrivateTodosPageProps {
  params: Promise<{ locale: string }>
}

export default async function PrivateTodosPage({ params }: PrivateTodosPageProps) {
  const { locale } = await params
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect(`/${locale}/login`)
  }

  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, task, is_completed')
    .eq('user_id', user.id)
    .is('team_id', null)
    .order('created_at', { ascending: false })

  if (todosError) {
    console.error('Error fetching private todos:', todosError)
  }

  // Calculate todo statistics
  const todoStats = {
    total: todos?.length || 0,
    completed: todos?.filter(todo => todo.is_completed).length || 0,
    pending: todos?.filter(todo => !todo.is_completed).length || 0
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <PrivateTodosHeader locale={locale} todoStats={todoStats} />
      <main className="flex-1 w-full max-w-4xl p-8">
        <PrivateTodosContent todos={todos} todoStats={todoStats} locale={locale} />
      </main>
    </div>
  )
}

// 私人待办事项页面头部
function PrivateTodosHeader({ locale, todoStats }: { 
  locale: string
  todoStats: { total: number; completed: number; pending: number }
}) {
  const t = useTranslations('todos')
  const tNav = useTranslations('navigation')
  
  return (
    <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('myPrivateTodos')}
          </h1>
          {/* 私人待办统计 */}
          <TodoStatsBadge 
            total={todoStats.total}
            completed={todoStats.completed}
            pending={todoStats.pending}
            variant="full"
          />
        </div>
        <div className="flex items-center space-x-4">
          <LanguageToggle />
          <Link href={`/${locale}`}>
            <span className="text-blue-500 hover:underline cursor-pointer">
              {tNav('backToHome')}
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

// 私人待办事项内容
function PrivateTodosContent({ todos, todoStats, locale }: {
  todos: any[] | null
  todoStats: { total: number; completed: number; pending: number }
  locale: string
}) {
  const t = useTranslations('todos')
  const tCommon = useTranslations('common')
  
  return (
    <>
      {/* 进度条显示 */}
      {todoStats.total > 0 && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${Math.round((todoStats.completed / todoStats.total) * 100)}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {Math.round((todoStats.completed / todoStats.total) * 100)}% 完成 ({todoStats.completed}/{todoStats.total})
          </p>
        </div>
      )}
      
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('addNewPrivateTodo')}
      </h2>
      <form action={addPrivateTodo} className="flex gap-2 mb-8">
        <input type="hidden" name="locale" value={locale} />
        <input
          type="text"
          name="task"
          className="flex-grow px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
          placeholder={t('addPrivateTodoPlaceholder')}
          required
        />
        <button
          type="submit"
          className="px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          {tCommon('add')}
        </button>
      </form>

      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('myTodoList')}
      </h2>
      <div className="space-y-4">
        {todos && todos.length > 0 ? (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center justify-between p-4 rounded-lg shadow-md bg-white dark:bg-gray-800"
            >
              <form action={togglePrivateTodo} className="flex-grow">
                <input type="hidden" name="todo_id" value={todo.id} />
                <input type="hidden" name="is_completed" value={todo.is_completed.toString()} />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className={`text-left w-full cursor-pointer ${
                    todo.is_completed 
                      ? 'line-through text-gray-500' 
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {todo.task}
                </button>
              </form>
              <form action={deletePrivateTodo}>
                <input type="hidden" name="todo_id" value={todo.id} />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  {tCommon('delete')}
                </button>
              </form>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">
            {t('noPrivateTodos')}
          </p>
        )}
      </div>
    </>
  )
}