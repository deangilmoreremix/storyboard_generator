import { Handler } from '@netlify/functions';
import { SUPABASE_EDGE_FUNCTION_URL, corsHeaders } from './_shared';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  const authorization = event.headers.authorization || event.headers.Authorization;
  if (!authorization) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing authorization header' }),
    };
  }

  const url = `${SUPABASE_EDGE_FUNCTION_URL}/video-webhook`;

  try {
    const requestBody = event.body ? JSON.parse(event.body) : {};

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'X-Netlify-Event': 'webhook',
      },
      body: JSON.stringify(requestBody),
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        ...(response.headers.get('content-type') ? { 'Content-Type': response.headers.get('content-type')! } : {}),
      },
      body,
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};