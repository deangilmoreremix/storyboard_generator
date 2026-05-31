import { Handler } from '@netlify/functions';
import { createProxyHandler } from './_shared';

export const handler: Handler = createProxyHandler('create-variation', {
  useFormData: true,
});