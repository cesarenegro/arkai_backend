// Check Replicate prediction status
// Updated: 2026-03-08 - Handle different output formats

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

    console.log(`Checking status for prediction: ${predictionId}`);

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

    console.log(`Prediction status: ${data.status}`);

    // If succeeded, download and return the image as base64
    if (data.status === 'succeeded') {
      console.log('Prediction succeeded, processing output...');
      console.log('Output type:', typeof data.output);
      console.log('Output:', JSON.stringify(data.output));

      // Handle different output formats
      let outputUrl;

      if (Array.isArray(data.output)) {
        outputUrl = data.output[0];
      } else if (typeof data.output === 'string') {
        outputUrl = data.output;
      } else if (data.output && typeof data.output === 'object') {
        // Some models return objects with URLs in different fields
        outputUrl = data.output.url || data.output.image || data.output[0];
      }

      if (!outputUrl || typeof outputUrl !== 'string') {
        console.error('Could not extract output URL');
        console.error('Output data:', JSON.stringify(data.output));
        return res.status(200).json({
          status: 'failed',
          error: 'No valid output URL from Replicate'
        });
      }

      // Validate URL format
      try {
        new URL(outputUrl);
      } catch (urlError) {
        console.error('Invalid URL format:', outputUrl);
        return res.status(200).json({
          status: 'failed',
          error: `Invalid output URL format: ${outputUrl.substring(0, 50)}`
        });
      }

      console.log(`Downloading image from: ${outputUrl}`);

      // Download the image and convert to base64
      try {
        const imageResponse = await fetch(outputUrl);

        if (!imageResponse.ok) {
          console.error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
          return res.status(200).json({
            status: 'failed',
            error: `Failed to download result image: ${imageResponse.status}`
          });
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        console.log(`Image downloaded successfully, size: ${imageBuffer.byteLength} bytes`);

        return res.status(200).json({
          status: 'succeeded',
          imageBase64
        });
      } catch (fetchError) {
        console.error('Error fetching image:', fetchError);
        return res.status(200).json({
          status: 'failed',
          error: `Failed to fetch image: ${fetchError.message}`
        });
      }
    }

    // If failed, return error
    if (data.status === 'failed') {
      console.error('Prediction failed:', data.error);
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
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join(' | ')
    });
  }
}
