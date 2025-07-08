'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTeam(formData: FormData) {
  const name = formData.get('name')?.toString()

  if (!name || name.trim() === '') {
    return redirect('/teams/create?error=' + encodeURIComponent('Team name cannot be empty.'))
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError) {
    console.error('Error getting user:', userError)
    return redirect('/login?error=' + encodeURIComponent('Authentication error. Please log in again.'))
  }

  if (!user) {
    return redirect('/login?error=' + encodeURIComponent('User not authenticated.'))
  }

  let teamId: number | null = null

  try {
    // 1. Create the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (teamError) {
      console.error('Error creating team:', teamError)
      // Check for unique constraint violation
      if (teamError?.code === '23505') { // PostgreSQL unique_violation error code
        return redirect('/teams/create?error=' + encodeURIComponent('Team name already exists. Please choose a different name.'))
      }
      return redirect('/teams/create?error=' + encodeURIComponent(teamError?.message || 'Failed to create team.'))
    }

    // Add this check to see if RLS policies are preventing reading the created team
    if (!team) {
      console.error('Team created but no data returned. Check RLS policies on `teams` table.')
      return redirect('/teams/create?error=' + encodeURIComponent('Team created, but failed to retrieve team details. This is likely due to a missing or incorrect RLS policy on the \'teams\' table.'))
    }

    teamId = team.id

    // 2. Add the creator as a member of the new team
    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
    })

    if (memberError) {
      console.error('Error adding team member:', memberError)
      // If adding member fails, attempt to delete the created team to prevent orphaned data
      await supabase.from('teams').delete().eq('id', team.id)
      return redirect('/teams/create?error=' + encodeURIComponent(memberError?.message || 'Failed to add team creator as member.'))
    }

    // If all database operations succeed, the try block completes here.
    // The revalidatePath and redirect will be executed outside the try-catch.

  } catch (e: any) {
    console.error('Unexpected error during team creation:', e)
    // If an unexpected error occurs after team creation but before member addition,
    // attempt to clean up the created team.
    if (teamId) {
      await supabase.from('teams').delete().eq('id', teamId)
    }
    const errorMessage = e.message || 'An unexpected error occurred.';
    return redirect('/teams/create?error=' + encodeURIComponent(errorMessage))
  }

  // These lines are executed only if the try block completes without throwing an error.
  revalidatePath('/') // Revalidate main page to show new team
  redirect('/') // Redirect to home page on success
}
