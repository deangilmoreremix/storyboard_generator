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

  const url = `${SUPABASE_EDGE_FUNCTION_URL}/stream-response`;

  try {
    const requestBody = event.body ? JSON.parse(event.body) : {};

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: errorBody || JSON.stringify({ error: 'Upstream error' }),
      };
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();

    if (!reader) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No response body' }),
      };
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const combinedChunks = chunks.map(chunk => decoder.decode(chunk)).join('');

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: combinedChunks,
      isBase64Encoded: false,
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};