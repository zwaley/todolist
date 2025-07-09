import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { addPrivateTodo, togglePrivateTodo, deletePrivateTodo } from './actions'
import { TodoStatsBadge, TodoProgressBar } from '@/components/todo-stats-badge'

export const revalidate = 0

export default async function PrivateTodosPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
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
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              我的私人待办事项
            </h1>
            {/* 私人待办统计 */}
            <TodoStatsBadge 
              total={todoStats.total}
              completed={todoStats.completed}
              pending={todoStats.pending}
              variant="full"
            />
          </div>
          <Link href="/">
            <span className="text-blue-500 hover:underline cursor-pointer">
              &larr; 返回团队列表
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-8">
        {/* 进度条显示 */}
        {todoStats.total > 0 && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <TodoProgressBar 
              completed={todoStats.completed}
              total={todoStats.total}
            />
          </div>
        )}
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          添加新的私人待办事项
        </h2>
        <form action={addPrivateTodo} className="flex gap-2 mb-8">
          <input
            type="text"
            name="task"
            className="flex-grow px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="为自己添加一个私人任务..."
            required
          />
          <button
            type="submit"
            className="px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Add
          </button>
        </form>

        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          我的待办清单
        </h2>
        <div className="space-y-4">
          {todos && todos.length > 0 ? (
            todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center justify-between p-4 rounded-lg shadow-md bg-white dark:bg-gray-800"
              >
                <div
                  className={`cursor-pointer ${todo.is_completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}
                  onClick={async () => {
                    'use server'
                    await togglePrivateTodo(todo.id, todo.is_completed)
                  }}
                >
                  {todo.task}
                </div>
                <form action={deletePrivateTodo.bind(null, todo.id)}>
                  <button
                    type="submit"
                    className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400">
              您还没有私人待办事项。在上方添加一个吧！
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
