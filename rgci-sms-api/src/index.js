/**
 * Arkesel SMS Integration - Cloudflare Worker
 * Handles sending SMS through Arkesel API
 */

// Note: Environment variables are accessed via the 'env' parameter in the fetch handler
// Not via process.env (which doesn't exist in Workers)

const ARKESEL_BASE_URL = 'https://sms.arkesel.com/api/v2';

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, api-key, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle OPTIONS request (CORS preflight)
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Create JSON response helper
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Error response helper
 */
function errorResponse(message, status = 400, code = 'ERROR') {
  return jsonResponse({
    success: false,
    error: {
      code,
      message,
    },
  }, status);
}

/**
 * Validate and format phone number
 * - Converts Ghana local numbers to international format
 */
function formatPhoneNumber(phone) {
  // Remove any non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If number starts with 0 (local format), replace with 233
  if (cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }
  
  // If number doesn't start with 233 and is 10 digits or less, assume local format
  if (!cleaned.startsWith('233') && cleaned.length <= 10) {
    cleaned = '233' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format recipients for Arkesel API
 */
function formatRecipients(phones) {
  if (Array.isArray(phones)) {
    return phones.map(p => formatPhoneNumber(p));
  }
  return [formatPhoneNumber(phones)];
}

/**
 * Send SMS to Arkesel API (V2)
 */
async function sendToArkesel(payload, env) {
  try {
    const response = await fetch(`${ARKESEL_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'api-key': env.ARKESEL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      return { success: true, data };
    } else {
      const errorMessage = data.message || data.error || 'Failed to send SMS';
      const errorCode = data.code || response.status;
      return { success: false, error: errorMessage, code: errorCode };
    }
  } catch (error) {
    console.error('Arkesel API error:', error);
    return { success: false, error: 'Failed to connect to SMS service', code: 'CONNECTION_ERROR' };
  }
}

/**
 * Check balance from Arkesel (V2)
 */
async function checkBalance(env) {
  try {
    const response = await fetch(`${ARKESEL_BASE_URL}/clients/balance-details`, {
      method: 'GET',
      headers: {
        'api-key': env.ARKESEL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (data.status === 'success' && data.data) {
      return { 
        success: true, 
        balance: data.data.sms_balance || 0,
        mainBalance: data.data.main_balance || 'GHS 0.00'
      };
    } else {
      return { success: false, error: 'Failed to fetch balance' };
    }
  } catch (error) {
    console.error('Balance check error:', error);
    return { success: false, error: 'Failed to connect to balance service' };
  }
}

/**
 * Send SMS endpoint
 */
async function handleSendSMS(request, env) {
  try {
    const body = await request.json();
    
    const { recipients, message, sender, scheduled_date, callback_url, use_case } = body;
    
    if (!recipients || recipients.length === 0) {
      return errorResponse('Recipients are required', 400, 'MISSING_RECIPIENTS');
    }
    
    if (!message || message.trim().length === 0) {
      return errorResponse('Message content is required', 400, 'MISSING_MESSAGE');
    }
    
    const formattedRecipients = formatRecipients(recipients);
    
    const payload = {
      sender: sender || env.SENDER_ID || 'RGCI',
      message: message.trim(),
      recipients: formattedRecipients,
    };
    
    if (scheduled_date) {
      payload.scheduled_date = scheduled_date;
    }
    
    if (callback_url) {
      payload.callback_url = callback_url;
    }
    
    payload.use_case = use_case || env.USE_CASE || 'transactional';
    
    const result = await sendToArkesel(payload, env);
    
    if (result.success) {
      return jsonResponse({
        success: true,
        message: 'SMS sent successfully',
        data: result.data,
        recipientCount: formattedRecipients.length,
        recipients: formattedRecipients,
      });
    } else {
      return errorResponse(result.error, 400, result.code || 'ARKESEL_ERROR');
    }
  } catch (error) {
    console.error('Send SMS error:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * Check balance endpoint
 */
async function handleGetBalance(env) {
  const result = await checkBalance(env);
  
  if (result.success) {
    return jsonResponse({
      success: true,
      balance: result.balance,
      mainBalance: result.mainBalance,
      currency: 'GHS',
    });
  } else {
    return errorResponse(result.error, 400, 'BALANCE_ERROR');
  }
}

/**
 * Main worker handler - env is passed automatically by Cloudflare
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }
    
    // Route: Send SMS
    if (path === '/api/sms/send' && method === 'POST') {
      return handleSendSMS(request, env);
    }
    
    // Route: Schedule SMS (same endpoint with scheduled_date)
    if (path === '/api/sms/schedule' && method === 'POST') {
      return handleSendSMS(request, env);
    }
    
    // Route: Check balance
    if (path === '/api/sms/balance' && method === 'GET') {
      return handleGetBalance(env);
    }
    
    // Health check
    if (path === '/api/sms/health' && method === 'GET') {
      return jsonResponse({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
      });
    }
    
    // 404 - Not found
    return new Response('Not Found', { status: 404 });
  },
};