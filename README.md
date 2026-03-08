# Arkai Backend

Backend API for Arkai iOS app - handles quota tracking and App Store receipt verification.

## Endpoints

### POST /api/quota/sync
Syncs user rendering quota with server.

**Request:**
```json
{
  "userId": "string",
  "isSubscribed": boolean,
  "renderingsUsed": number,
  "singleRenderCredits": number,
  "subscriptionStartDate": number (optional, Unix timestamp)
}
```

**Response:**
```json
{
  "success": true,
  "renderingsUsed": number,
  "singleRenderCredits": number
}
```

### POST /api/verify-receipt
Verifies App Store purchase receipts.

**Request:**
```json
{
  "receiptData": "string (base64)",
  "productID": "string"
}
```

**Response:**
```json
{
  "isValid": boolean,
  "productID": "string",
  "transactionId": "string",
  "expirationDate": number (optional)
}
```

## Environment Variables

- `APP_STORE_SHARED_SECRET` - Your App Store Connect shared secret
- Postgres connection (automatically set by Vercel)

## Database Schema

```sql
CREATE TABLE user_quota (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  is_subscribed BOOLEAN DEFAULT FALSE,
  renderings_used INTEGER DEFAULT 0,
  single_render_credits INTEGER DEFAULT 0,
  subscription_start_date TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Deployment

Deploy to Vercel:
```bash
vercel
```

Deploy to production:
```bash
vercel --prod
```
