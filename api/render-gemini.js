// Fast AI rendering endpoint using Gemini 3.1 Flash Image Preview
// Updated: 2026-03-08 - Using gemini-3.1-flash-image-preview for fast image generation (5-10 seconds)
// This model supports native image-to-image transformation with low latency
// Synchronous response - returns image immediately

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

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    console.log('Starting fast render with Gemini 3.1 Flash Image Preview...');

    // Generate enhanced prompt for image transformation
    const basePrompt = `Transform this ${roomType} interior space into ${style} style. ${styleDescription}. Maintain the room's structure and layout while applying the new design aesthetic.`;
    const enhancedPrompt = `${basePrompt} Create a masterfully designed interior with photorealistic quality, magazine-worthy composition, 8k detail, and professional lighting.`;

    // Call Gemini 3.1 Flash Image Preview API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: enhancedPrompt
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('Gemini API error:', errorData);
      return res.status(500).json({
        error: 'Gemini API request failed',
        details: errorData
      });
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract the generated image from the response
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('No candidates in Gemini response');
      return res.status(500).json({
        error: 'No response from Gemini',
        details: 'The model did not return any results'
      });
    }

    const candidate = geminiData.candidates[0];

    // Check if response contains inline_data (the generated image)
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('No content parts in Gemini response');
      return res.status(500).json({
        error: 'Invalid response format from Gemini',
        details: 'No content parts found'
      });
    }

    // Extract the image data
    let imageBase64 = null;
    for (const part of candidate.content.parts) {
      if (part.inline_data && part.inline_data.data) {
        imageBase64 = part.inline_data.data;
        break;
      }
    }

    if (!imageBase64) {
      console.error('No image data in Gemini response');
      console.error('Response structure:', JSON.stringify(geminiData, null, 2));
      return res.status(500).json({
        error: 'No image generated',
        details: 'Gemini did not return image data'
      });
    }

    console.log('Image generated successfully with Gemini 3.1 Flash');

    // Return the generated image immediately (synchronous response)
    return res.status(200).json({
      status: 'succeeded',
      imageBase64: imageBase64,
      renderingType: 'fast',
      model: 'gemini-3.1-flash-image-preview'
    });

  } catch (error) {
    console.error('Gemini render error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
