// Vercel serverless function: GET /api/lookup?name=<name>
// Returns a previously submitted review for the given name so the form can
// pre-fill for editing. Responds { found: false } if there's no match.
import { getReviewByName, supabase } from '../lib/reviews.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Server is not configured (missing Supabase credentials).' });
  }

  const name = (req.query.name || '').toString().trim();
  if (!name) {
    return res.status(400).json({ error: 'Missing name.' });
  }

  try {
    const review = await getReviewByName(name);
    if (!review) {
      return res.status(200).json({ found: false });
    }
    return res.status(200).json({ found: true, review });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Lookup failed.' });
  }
}
