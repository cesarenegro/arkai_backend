// Fast AI rendering endpoint using a faster Replicate model
// Updated: 2026-03-08 - Fast rendering option (returns immediately with original image)
// NOTE: This is a simplified version that returns quickly for user experience
// In production, you might want to use a different fast model like SDXL Lightning

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

  try {
    const { image, style, styleDescription, roomType } = req.body;

    if (!image || !style || !roomType) {
      return res.status(400).json({
        error: 'image, style, and roomType are required'
      });
    }

    const replicateApiKey = process.env.REPLICATE_API_TOKEN;

    if (!replicateApiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    console.log('Starting fast render...');

    // Upload image to Replicate
    const imageBuffer = Buffer.from(image, 'base64');
    const FormData = (await import('formdata-node')).FormData;
    const { Blob } = await import('node:buffer');

    const formData = new FormData();
    formData.append('content', new Blob([imageBuffer], { type: 'image/jpeg' }), 'image.jpg');

    console.log('Uploading image to Replicate...');
    const uploadResponse = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json();
      console.error('Image upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload image', details: uploadError });
    }

    const uploadData = await uploadResponse.json();
    const imageUrl = uploadData.urls?.get;

    if (!imageUrl) {
      return res.status(500).json({
        error: 'Failed to get image URL from upload',
        details: 'Upload succeeded but no URL returned'
      });
    }

    // Generate prompt (same as hyper-realistic but with fewer steps)
    const basePrompt = `Transform this ${roomType} interior space into ${style} style. ${styleDescription}. Maintain the room's structure and layout while applying the new design aesthetic.`;
    const enhancedPrompt = `${basePrompt}, masterfully designed interior, photorealistic, interior design magazine quality, 8k uhd, highly detailed`;

    // Use the same model but with faster settings (fewer inference steps)
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'a3c091059a25590ce2d5ea13651fab63f447f21760e50c358d4b850e844f59ee',
        input: {
          image: imageUrl,
          prompt: enhancedPrompt,
          promax_strength: 0.6,  // Lower strength for faster processing
          depth_strength: 0.6,   // Lower strength for faster processing
          num_inference_steps: 25,  // Reduced from 50 for speed
          guidance_scale: 7.5,
          negative_prompt: 'ugly, deformed, noisy, blurry, low quality, glitch, distorted, disfigured, bad proportions, duplicate, out of frame, watermark'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Replicate API error:', data);
      return res.status(500).json({ error: 'Replicate API request failed', details: data });
    }

    console.log('Fast render prediction started:', data.id);

    // Return prediction ID - client will poll for status
    return res.status(200).json({
      predictionId: data.id,
      status: data.status,
      renderingType: 'fast'
    });

  } catch (error) {
    console.error('Fast render error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
