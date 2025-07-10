'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const locale = formData.get('locale')?.toString() || 'zh'
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Sign In Error:', error);
    return redirect(`/${locale}/login?message=` + encodeURIComponent(error.message))
  }

  return redirect(`/${locale}`)
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const locale = formData.get('locale')?.toString() || 'zh'
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/auth/callback`,
    },
  })

  if (error) {
    console.error('Sign Up Error:', error);
    return redirect(`/${locale}/login?message=` + encodeURIComponent(error.message))
  }

  return redirect(`/${locale}/login?message=` + encodeURIComponent('Check email to verify account'))
}