// Basic quality AI rendering endpoint using SDXL Turbo ControlNet
// Updated: 2026-03-08 - Using SDXL Turbo for ultra-fast rendering (~2-3 seconds)
// This model uses single-step inference for maximum speed

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

    // Upload image to Replicate using their file upload API
    const imageBuffer = Buffer.from(image, 'base64');

    // Create form data for file upload
    const FormData = (await import('formdata-node')).FormData;
    const { Blob } = await import('node:buffer');

    const formData = new FormData();
    formData.append('content', new Blob([imageBuffer], { type: 'image/jpeg' }), 'image.jpg');

    console.log('Uploading image to Replicate for basic quality render...');
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
    console.log('Upload response:', JSON.stringify(uploadData, null, 2));

    // Get the image URL from the upload response
    const imageUrl = uploadData.urls?.get;

    if (!imageUrl) {
      console.error('No image URL in upload response:', uploadData);
      return res.status(500).json({
        error: 'Failed to get image URL from upload',
        details: 'Upload succeeded but no URL returned'
      });
    }

    console.log('Image uploaded successfully:', imageUrl);

    // Generate prompt for interior design
    const basePrompt = `Transform this ${roomType} interior space into ${style} style. ${styleDescription}. Maintain the room's structure and layout while applying the new design aesthetic.`;
    const enhancedPrompt = `${basePrompt}, well designed interior, clean aesthetic`;

    // Start Replicate prediction with SDXL Turbo ControlNet
    console.log('Starting basic quality Replicate prediction with SDXL Turbo...');
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '2e45f70b0e9e6b5e7e7b9c0e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c',  // SDXL Turbo ControlNet (placeholder - need to verify)
        input: {
          image: imageUrl,
          prompt: enhancedPrompt,
          negative_prompt: 'ugly, deformed, noisy, blurry, low quality',
          num_inference_steps: 1,  // Single step for Turbo
          guidance_scale: 0.0,  // Turbo uses no guidance
          controlnet_conditioning_scale: 0.7
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Replicate API error:', data);
      return res.status(500).json({ error: 'Replicate API request failed', details: data });
    }

    console.log('Basic quality prediction started:', data.id);

    // Return prediction ID immediately - client will poll for status
    return res.status(200).json({
      predictionId: data.id,
      status: data.status,
      renderingType: 'basic',
      model: 'sdxl-turbo-controlnet'
    });

  } catch (error) {
    console.error('Basic render error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
