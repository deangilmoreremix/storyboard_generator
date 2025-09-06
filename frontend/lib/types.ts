export type GPT5Model = "gpt-5" | "gpt-5-mini" | "gpt-5-nano";

export interface GPT5Request {
  input?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: GPT5Model;
}

export interface GPT5Response {
  output_text: string;
}