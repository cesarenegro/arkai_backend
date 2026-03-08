// Normal quality AI rendering endpoint using Gemini 2.5 Flash Image
// Updated: 2026-03-08 - Using gemini-2.5-flash-image for ultra-fast image generation (3-5 seconds)
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

    console.log('Starting normal render with Gemini 2.5 Flash Image...');

    // Generate prompt for image transformation
    const promptText = `Transform this ${roomType} interior into ${style} style. ${styleDescription}. Maintain room structure and layout while redesigning the aesthetic.`;

    // Call Gemini 2.5 Flash Image API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': geminiApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: image
                }
              }
            ]
          }],
          generationConfig: {
            responseModalities: ['IMAGE']
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      return res.status(500).json({
        error: 'Gemini API request failed',
        status: geminiResponse.status,
        details: errorText
      });
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract the generated image
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('No candidates in response');
      return res.status(500).json({
        error: 'No response from Gemini',
        details: 'No candidates returned'
      });
    }

    const candidate = geminiData.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return res.status(500).json({
        error: 'Invalid response format',
        details: 'No content parts'
      });
    }

    // Extract image data - handle both inline_data (snake_case) and inlineData (camelCase)
    let imageBase64 = null;
    for (const part of candidate.content.parts) {
      const inlineData = part.inline_data || part.inlineData;
      if (inlineData && inlineData.data) {
        imageBase64 = inlineData.data;
        console.log('Found image, size:', imageBase64.length);
        break;
      }
    }

    if (!imageBase64) {
      console.error('No image in response');
      return res.status(500).json({
        error: 'No image generated',
        details: 'No image data in response'
      });
    }

    console.log('✅ Image generated successfully');

    return res.status(200).json({
      status: 'succeeded',
      imageBase64: imageBase64,
      renderingType: 'normal',
      model: 'gemini-2.5-flash-image'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
