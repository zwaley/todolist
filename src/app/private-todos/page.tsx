import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { addPrivateTodo, togglePrivateTodo, deletePrivateTodo } from './actions'

export const revalidate = 0

export default async function PrivateTodosPage() {
  const cookieStore = cookies()
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

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Private Todos
          </h1>
          <Link href="/">
            <span className="text-blue-500 hover:underline cursor-pointer">
              &larr; Back to Teams
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Add a New Private Todo
        </h2>
        <form action={addPrivateTodo} className="flex gap-2 mb-8">
          <input
            type="text"
            name="task"
            className="flex-grow px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="A private task for myself..."
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
          My Todo List
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
              You have no private todos yet. Add one above!
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
