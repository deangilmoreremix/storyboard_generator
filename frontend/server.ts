import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import openai from './lib/openai';
import { GPT5Request, GPT5Response, GPT5Model } from './lib/types';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/gpt5', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(401).json({ error: 'OpenAI API key not configured' });
  }

  const { input, messages, model }: GPT5Request = req.body;
  const selectedModel: GPT5Model = model || (process.env.OPENAI_MODEL as GPT5Model) || 'gpt-5';

  try {
    let prompt: string;
    if (messages) {
      prompt = messages.map(m => m.content).join('\n\n');
    } else {
      prompt = input || '';
    }

    const response = await openai.responses.create({
      model: selectedModel,
      input: [{ role: 'user', content: prompt }],
    });

    const result: GPT5Response = {
      output_text: response.output_text,
    };

    res.json(result);
  } catch (error: any) {
    if (error.status === 401) {
      res.status(401).json({ error: 'Invalid API key' });
    } else if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});