import 'dotenv/config';
import { createClient } from '@vercel/postgres';

async function setupDatabase() {
  console.log('Setting up database...');

  // Use whichever connection string is available
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('No database connection string found!');
    process.exit(1);
  }

  console.log('Database URL: Found');

  const client = createClient({ connectionString });
  await client.connect();

  try {
    // Create user_quota table
    await client.sql`
      CREATE TABLE IF NOT EXISTS user_quota (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        is_subscribed BOOLEAN DEFAULT FALSE,
        renderings_used INTEGER DEFAULT 0,
        single_render_credits INTEGER DEFAULT 0,
        subscription_start_date TIMESTAMP,
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✓ Table user_quota created');

    // Create index
    await client.sql`
      CREATE INDEX IF NOT EXISTS idx_user_id ON user_quota(user_id)
    `;
    console.log('✓ Index created');

    // Test insert
    await client.sql`
      INSERT INTO user_quota (user_id, is_subscribed, renderings_used, single_render_credits)
      VALUES ('test_user', false, 0, 5)
      ON CONFLICT (user_id) DO NOTHING
    `;
    console.log('✓ Test record created');

    // Verify
    const result = await client.sql`
      SELECT * FROM user_quota WHERE user_id = 'test_user'
    `;
    console.log('✓ Database setup complete!');
    console.log('Test record:', result.rows[0]);

  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
