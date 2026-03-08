import pg from 'pg';

const connectionString = process.env.POSTGRES_DIRECT_URL || 'postgres://fdfa38f59d192d554fdbe9249834520ae802ef81493414093c0a3c4b74ef243c:sk_WV2pma-noERwWdYXK2lpC@db.prisma.io:5432/postgres?sslmode=require';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();

    const { userId, isSubscribed, renderingsUsed, singleRenderCredits, subscriptionStartDate } = req.body;

    if (!userId) {
      await client.end();
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Check if user exists
    const existing = await client.query(
      'SELECT * FROM user_quota WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length === 0) {
      // Create new user record
      await client.query(
        `INSERT INTO user_quota (
          user_id,
          is_subscribed,
          renderings_used,
          single_render_credits,
          subscription_start_date,
          last_updated
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          userId,
          isSubscribed,
          renderingsUsed,
          singleRenderCredits,
          subscriptionStartDate ? new Date(subscriptionStartDate * 1000) : null
        ]
      );

      await client.end();
      return res.status(200).json({
        success: true,
        renderingsUsed,
        singleRenderCredits
      });
    }

    // Update existing user record
    const updated = await client.query(
      `UPDATE user_quota
       SET
         is_subscribed = $1,
         renderings_used = $2,
         single_render_credits = $3,
         subscription_start_date = $4,
         last_updated = NOW()
       WHERE user_id = $5
       RETURNING renderings_used, single_render_credits`,
      [
        isSubscribed,
        renderingsUsed,
        singleRenderCredits,
        subscriptionStartDate ? new Date(subscriptionStartDate * 1000) : null,
        userId
      ]
    );

    await client.end();
    return res.status(200).json({
      success: true,
      renderingsUsed: updated.rows[0].renderings_used,
      singleRenderCredits: updated.rows[0].single_render_credits
    });

  } catch (error) {
    console.error('Quota sync error:', error);
    try {
      await client.end();
    } catch (e) {}
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
