import { Handler } from '@netlify/functions';

export const SUPABASE_EDGE_FUNCTION_URL = process.env.NETLIFY_SUPABASE_URL || 'https://bzxohkrxcwodllketcpz.supabase.co/functions/v1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export function createProxyHandler(
  functionName: string,
  options?: {
    useFormData?: boolean;
    streamResponse?: boolean;
    includeWebhookUrl?: boolean;
  }
): Handler {
  return async (event, context) => {
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

    const url = `${SUPABASE_EDGE_FUNCTION_URL}/${functionName}`;
    const requestHeaders: Record<string, string> = {
      'Authorization': authorization,
    };

    let body: string;

    try {
      if (options?.useFormData) {
        requestHeaders['Content-Type'] = event.headers['content-type'] || event.headers['Content-Type'] || 'application/x-www-form-urlencoded';
        body = event.body || '';
      } else {
        const requestBody = event.body ? JSON.parse(event.body) : {};
        body = JSON.stringify(requestBody);
        requestHeaders['Content-Type'] = 'application/json';
      }

      if (options?.includeWebhookUrl && event.httpMethod === 'POST') {
        const requestBody = JSON.parse(body);
        const webhookUrl = `${process.env.URL || 'https://your-site.netlify.app'}/.netlify/functions/${functionName}`;
        body = JSON.stringify({ ...requestBody, webhook_url: webhookUrl });
      }

      const response = await fetch(url, {
        method: event.httpMethod,
        headers: requestHeaders,
        body,
      });

      const responseBody = await response.text();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: responseBody || JSON.stringify({ error: 'Upstream error' }),
        };
      }

      return {
        statusCode: response.status,
        headers: {
          ...corsHeaders,
          ...(response.headers.get('content-type') ? { 'Content-Type': response.headers.get('content-type')! } : {}),
        },
        body: responseBody,
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message || 'Internal server error' }),
      };
    }
  };
}