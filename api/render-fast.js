// Fast AI rendering endpoint using SDXL Lightning Multi-ControlNet
// Updated: 2026-03-08 - Using lucataco/sdxl-lightning-multi-controlnet for fast image generation (~12 seconds)
// This model supports img2img with ControlNet for structure preservation

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

    // Generate enhanced prompt for fast rendering
    const basePrompt = `Transform this ${roomType} interior space into ${style} style. ${styleDescription}. Maintain the room's structure and layout while applying the new design aesthetic.`;
    const enhancedPrompt = `${basePrompt}, masterfully designed interior, photorealistic, interior design magazine quality, 8k uhd, highly detailed`;

    // Start Replicate prediction with SDXL Lightning Multi-ControlNet (fast mode)
    console.log('Starting fast Replicate prediction with SDXL Lightning...');
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'd5116b11698b41d34c322cbd7b0bf068015e47831af0527de7a178dc59c5f2ee',  // SDXL Lightning Multi-ControlNet
        input: {
          image: imageUrl,
          prompt: enhancedPrompt,
          control_type_1: 'edge_canny',  // Use canny edge detection for structure preservation
          controlnet_1_conditioning_scale: 0.8,  // Strong structure preservation
          num_inference_steps: 4,  // Lightning 4-step for speed
          guidance_scale: 1.0,  // Low guidance for 4-step Lightning
          negative_prompt: 'ugly, deformed, noisy, blurry, low quality, glitch, distorted, disfigured, bad proportions, duplicate, out of frame, watermark'
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
      model: 'sdxl-lightning-multi-controlnet'
    });

  } catch (error) {
    console.error('Fast render error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
