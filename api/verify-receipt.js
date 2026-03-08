// Apple App Store receipt verification endpoint

const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

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
    const { receiptData, productID } = req.body;

    if (!receiptData || !productID) {
      return res.status(400).json({
        isValid: false,
        error: 'receiptData and productID are required'
      });
    }

    const sharedSecret = process.env.ARKAI_KEY;

    if (!sharedSecret) {
      console.error('ARKAI_KEY not configured');
      return res.status(500).json({
        isValid: false,
        error: 'Server configuration error'
      });
    }

    // Try production first
    let response = await fetch(PRODUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': sharedSecret,
        'exclude-old-transactions': false
      })
    });

    let verificationResponse = await response.json();

    // If production returns sandbox receipt error, try sandbox
    if (verificationResponse.status === 21007) {
      response = await fetch(SANDBOX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': sharedSecret,
          'exclude-old-transactions': false
        })
      });
      verificationResponse = await response.json();
    }

    // Check if receipt is valid
    if (verificationResponse.status !== 0) {
      return res.status(200).json({
        isValid: false,
        error: `Apple verification failed with status ${verificationResponse.status}`
      });
    }

    // Extract receipt information
    const latestReceiptInfo = verificationResponse.latest_receipt_info || [];
    const receipt = verificationResponse.receipt || {};

    // Find matching product
    const matchingProduct = latestReceiptInfo.find(
      item => item.product_id === productID
    );

    if (!matchingProduct) {
      // Check in_app purchases for consumables
      const inAppPurchases = receipt.in_app || [];
      const consumable = inAppPurchases.find(
        item => item.product_id === productID
      );

      if (!consumable) {
        return res.status(200).json({
          isValid: false,
          error: 'Product not found in receipt'
        });
      }

      // Consumable purchase verified
      return res.status(200).json({
        isValid: true,
        productID: consumable.product_id,
        transactionId: consumable.transaction_id,
        purchaseDate: consumable.purchase_date_ms
      });
    }

    // Subscription purchase verified
    const expirationDate = matchingProduct.expires_date_ms
      ? parseInt(matchingProduct.expires_date_ms) / 1000
      : null;

    return res.status(200).json({
      isValid: true,
      productID: matchingProduct.product_id,
      transactionId: matchingProduct.transaction_id,
      purchaseDate: matchingProduct.purchase_date_ms,
      expirationDate: expirationDate,
      isActive: expirationDate ? (Date.now() / 1000) < expirationDate : true
    });

  } catch (error) {
    console.error('Receipt verification error:', error);
    return res.status(500).json({
      isValid: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
