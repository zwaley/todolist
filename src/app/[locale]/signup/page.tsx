import { redirect } from 'next/navigation'

interface SignUpPageProps {
  params: Promise<{ locale: string }>
}

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { locale } = await params
  redirect(`/${locale}/login`)
}