require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLSPolicies() {
  try {
    console.log('Fixing RLS policies...');
    
    // 测试当前策略是否有问题
    console.log('Testing current team_members access...');
    const { data: testData, error: testError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Test query error:', testError.message);
      if (testError.message.includes('infinite recursion')) {
        console.log('❌ RLS policy has infinite recursion issue - manual fix required');
      }
    } else {
      console.log('✅ Test query successful - no infinite recursion detected');
      console.log('RLS policies appear to be working correctly.');
      return;
    }
    
    // 由于无法直接执行DDL，我们需要提供手动修复的SQL
    console.log('\n=== MANUAL FIX REQUIRED ===');
    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('\n-- 1. Drop the problematic policy');
    console.log('DROP POLICY IF EXISTS "Users can view team members" ON team_members;');
    console.log('\n-- 2. Create the fixed policy');
    console.log(`CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        -- Check if user is team creator
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
        OR
        -- Or check if current record belongs to current user
        user_id = auth.uid()
    );`);
    
    console.log('\n=== END MANUAL FIX ===\n');
    

    
  } catch (error) {
    console.error('Error fixing RLS policies:', error);
  }
}

fixRLSPolicies();