import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { updateProfile } from './actions'

// 设置页面 - 用户可以编辑个人资料
export default async function SettingsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string }
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 检查用户是否已登录
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // 获取用户的配置文件信息
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('username, display_name, avatar_url, bio')
    .eq('user_id', user.id)
    .single()

  // 如果没有配置文件，创建一个默认的
  let userProfile = profile
  if (profileError || !profile) {
    console.log('用户配置文件不存在，将显示默认值')
    userProfile = {
      username: '',
      display_name: '',
      avatar_url: '',
      bio: ''
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            个人设置
          </h1>
          <Link href="/">
            <span className="text-blue-500 hover:underline cursor-pointer">
              &larr; 返回首页
            </span>
          </Link>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-2xl p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            编辑个人资料
          </h2>
          
          {/* 成功/错误消息显示 */}
          {searchParams.success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    个人资料已成功更新！
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {searchParams.error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    更新失败：{decodeURIComponent(searchParams.error)}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 当前用户信息显示 */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              账户信息
            </h3>
            <p className="text-gray-900 dark:text-white">
              <span className="font-medium">邮箱：</span>{user.email}
            </p>
            <p className="text-gray-900 dark:text-white">
              <span className="font-medium">用户ID：</span>{user.id}
            </p>
          </div>

          {/* 个人资料编辑表单 */}
          <form action={updateProfile} className="space-y-6">
            {/* 隐藏字段：用户ID */}
            <input type="hidden" name="user_id" value={user.id} />
            
            {/* 用户名 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                用户名
              </label>
              <input
                type="text"
                id="username"
                name="username"
                defaultValue={userProfile.username || ''}
                className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                placeholder="请输入用户名（用于邀请功能）"
                pattern="[a-zA-Z0-9_]+"
                title="用户名只能包含字母、数字和下划线"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                用户名用于团队邀请功能，只能包含字母、数字和下划线
              </p>
            </div>

            {/* 显示名称（昵称） */}
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                显示名称（昵称）
              </label>
              <input
                type="text"
                id="display_name"
                name="display_name"
                defaultValue={userProfile.display_name || ''}
                className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                placeholder="请输入显示名称"
                maxLength={50}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                这是其他用户看到的你的名称
              </p>
            </div>

            {/* 头像URL */}
            <div>
              <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                头像URL
              </label>
              <input
                type="url"
                id="avatar_url"
                name="avatar_url"
                defaultValue={userProfile.avatar_url || ''}
                className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                placeholder="请输入头像图片URL"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                输入图片链接地址，留空将显示默认头像
              </p>
            </div>

            {/* 个人简介 */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                个人简介
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                defaultValue={userProfile.bio || ''}
                className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                placeholder="介绍一下自己吧..."
                maxLength={500}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                最多500个字符
              </p>
            </div>

            {/* 提交按钮 */}
            <div className="flex justify-end space-x-4">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
              >
                取消
              </Link>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
              >
                保存设置
              </button>
            </div>
          </form>
        </div>

        {/* 账户操作区域 */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            账户操作
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                💡 使用提示
              </h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• 用户名用于团队邀请功能，设置后其他人可以通过用户名邀请你加入团队</li>
                <li>• 显示名称是其他用户看到的你的名称，可以使用中文</li>
                <li>• 头像URL支持常见的图片格式（jpg, png, gif等）</li>
                <li>• 所有设置都是可选的，你可以随时修改</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}