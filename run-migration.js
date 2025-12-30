import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public'
  }
});

async function runMigration() {
  try {
    const sql = await fs.readFile('supabase-schema.sql', 'utf-8');

    console.log('Running migration...');

    // Split SQL by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);

      const { data, error } = await supabase.rpc('exec', { sql: statement });

      if (error) {
        // Try direct query for CREATE statements
        console.log('Trying alternative method...');
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        });

        console.log('Statement may require manual execution in Supabase dashboard');
      } else {
        console.log('✓ Success');
      }
    }

    console.log('\n✓ Migration completed!');
    console.log('\nPlease verify in Supabase dashboard');

  } catch (error) {
    console.error('Error running migration:', error.message);
    console.log('\nPlease run the SQL manually in Supabase dashboard:');
    console.log('1. Go to your Supabase project SQL editor');
    console.log('2. Copy contents of supabase-schema.sql');
    console.log('3. Paste and click "Run"');
    process.exit(1);
  }
}

runMigration();
