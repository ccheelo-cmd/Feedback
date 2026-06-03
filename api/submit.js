// Vercel serverless function: POST /api/submit
import { isValidReview, saveReview, supabase } from '../lib/reviews.js';

// Read and parse the JSON body. Vercel usually populates req.body for
// application/json requests, but we fall back to reading the raw stream so the
// function works the same locally (vercel dev) and in production.
async function readJson(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Server is not configured (missing Supabase credentials).' });
  }

  try {
    const review = await readJson(req);
    if (!isValidReview(review)) {
      return res.status(400).json({ error: 'Invalid submission payload.' });
    }
    const { updated } = await saveReview(review);
    return res.status(updated ? 200 : 201).json({ success: true, updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save submission.' });
  }
}
