// Vercel serverless function backing /responses and /responses.json
// (mapped via the rewrites in vercel.json).
import { loadResponses, renderResponsesPage, supabase } from '../lib/reviews.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Server is not configured (missing Supabase credentials).' });
  }

  try {
    const responses = await loadResponses();

    if (req.query.format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify(responses, null, 2));
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderResponsesPage(responses));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load responses.' });
  }
}
