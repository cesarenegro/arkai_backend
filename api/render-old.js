// AI rendering endpoint using Replicate + rocketdigitalai/interior-design-sdxl
// Updated: 2026-03-08 - Fixed image upload to use Replicate file storage

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

    // Use Replicate API for reliable image generation
    const replicateApiKey = process.env.REPLICATE_API_TOKEN;

    if (!replicateApiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' });
    }

    // Upload image to Replicate using their file upload API
    const imageBuffer = Buffer.from(image, 'base64');

    // Create form data for file upload
    const FormData = (await import('formdata-node')).FormData;
    const { Blob } = await import('node:buffer');

    const formData = new FormData();
    formData.append('content', new Blob([imageBuffer], { type: 'image/jpeg' }), 'image.jpg');

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
    const imageUrl = uploadData.urls.get;

    // Generate enhanced prompt for professional interior design
    const basePrompt = `Transform this ${roomType} interior space into ${style} style. ${styleDescription}. Maintain the room's structure and layout while applying the new design aesthetic.`;
    const enhancedPrompt = `${basePrompt}, masterfully designed interior, photorealistic, interior design magazine quality, 8k uhd, highly detailed`;

    // Call Replicate API with rocketdigitalai/interior-design-sdxl model
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // rocketdigitalai/interior-design-sdxl with dual ControlNets (Depth + ProMax)
        version: 'a3c091059a25590ce2d5ea13651fab63f447f21760e50c358d4b850e844f59ee',
        input: {
          image: imageUrl,
          prompt: enhancedPrompt,
          promax_strength: 0.8,  // Controls architectural line preservation
          depth_strength: 0.8,    // Controls 3D volume preservation
          num_inference_steps: 50, // High quality rendering
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

    // Poll for completion (Replicate uses async processing)
    const predictionId = data.id;
    let predictionStatus = data.status;
    let attempts = 0;
    const maxAttempts = 25; // 50 seconds max (2 seconds * 25) to stay under Vercel 60s limit

    while (predictionStatus !== 'succeeded' && predictionStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${replicateApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const statusData = await statusResponse.json();
      predictionStatus = statusData.status;

      if (predictionStatus === 'succeeded') {
        // Get the output image URL
        const outputUrl = statusData.output && statusData.output[0];

        if (!outputUrl) {
          return res.status(500).json({
            error: 'No output image from Replicate',
            details: statusData
          });
        }

        // Download the image and convert to base64
        const imageResponse = await fetch(outputUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        return res.status(200).json({ imageBase64 });
      }

      if (predictionStatus === 'failed') {
        return res.status(500).json({
          error: 'Replicate prediction failed',
          details: statusData.error || statusData
        });
      }

      attempts++;
    }

    // Timeout
    return res.status(504).json({
      error: 'Rendering timeout',
      details: 'Image generation took too long'
    });

  } catch (error) {
    console.error('Render error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
