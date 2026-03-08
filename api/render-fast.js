// Fast AI rendering endpoint using Stable Interiors V2
// Updated: 2026-03-08 - Using youzu/stable-interiors-v2 for fast interior design rendering (~13 seconds)
// This model is purpose-built for interior design with built-in structure preservation

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

    console.log('Uploading image to Replicate for fast render...');
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

    // Generate enhanced prompt for interior design
    const basePrompt = `Transform this ${roomType} interior space into ${style} style. ${styleDescription}. Maintain the room's structure and layout while applying the new design aesthetic.`;
    const enhancedPrompt = `${basePrompt}, masterfully designed interior, photorealistic, interior design magazine quality, 8k uhd, highly detailed`;

    // Start Replicate prediction with Stable Interiors V2
    console.log('Starting fast Replicate prediction with Stable Interiors V2...');
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '4836eb257a4fb8b87bac9eacbef9292ee8e1a497398ab96207067403a4be2daf',  // Stable Interiors V2
        input: {
          image: imageUrl,
          prompt: enhancedPrompt,
          negative_prompt: 'ugly, deformed, noisy, blurry, low quality, glitch, distorted, disfigured, bad proportions, duplicate, out of frame, watermark, text, signature',
          num_inference_steps: 30,  // Optimal for quality/speed balance
          guidance_scale: 7.5,  // Standard guidance
          prompt_strength: 0.8  // Strong transformation while preserving structure
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Replicate API error:', data);
      return res.status(500).json({ error: 'Replicate API request failed', details: data });
    }

    console.log('Fast prediction started:', data.id);

    // Return prediction ID immediately - client will poll for status
    return res.status(200).json({
      predictionId: data.id,
      status: data.status,
      renderingType: 'fast',
      model: 'stable-interiors-v2'
    });

  } catch (error) {
    console.error('Fast render error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
