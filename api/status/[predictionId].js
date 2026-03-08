// Check Replicate prediction status
// Updated: 2026-03-08 - Status polling endpoint

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { predictionId } = req.query;

    if (!predictionId) {
      return res.status(400).json({ error: 'predictionId is required' });
    }

    const replicateApiKey = process.env.REPLICATE_API_TOKEN;

    if (!replicateApiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    // Get prediction status from Replicate
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Replicate status error:', data);
      return res.status(500).json({ error: 'Failed to get prediction status', details: data });
    }

    // If succeeded, download and return the image as base64
    if (data.status === 'succeeded') {
      const outputUrl = data.output && data.output[0];

      if (!outputUrl) {
        return res.status(500).json({
          error: 'No output image from Replicate',
          status: 'failed'
        });
      }

      // Download the image and convert to base64
      const imageResponse = await fetch(outputUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      return res.status(200).json({
        status: 'succeeded',
        imageBase64
      });
    }

    // If failed, return error
    if (data.status === 'failed') {
      return res.status(200).json({
        status: 'failed',
        error: data.error || 'Prediction failed'
      });
    }

    // Otherwise, return current status (processing/starting)
    return res.status(200).json({
      status: data.status
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
