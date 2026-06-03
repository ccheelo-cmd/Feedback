// Shared Supabase logic used by both the Vercel serverless functions (api/*)
// and the local dev server (server.js). Single source of truth.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Server-side client using the service-role key. Never import this into the
// browser bundle — the key must stay on the server.
export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function isValidReview(review) {
  return Boolean(review && review.name && typeof review.overall?.nps !== 'undefined');
}

export async function saveReview(review) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('reviews').insert({ review });
  if (error) throw error;
}

export async function loadResponses() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('reviews')
    .select('review, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((item) => ({ ...item.review, submittedAt: item.created_at }));
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderResponsesPage(responses) {
  const count = responses.length;
  const rows =
    responses
      .map((review, index) => {
        const submittedAt = new Date(review.submittedAt).toLocaleString();
        return `<section style="margin-bottom:24px;border:1px solid #e5e5e5;border-radius:14px;padding:18px;background:#fff;">
        <h2 style="font-size:1rem;margin:0 0 10px;color:#0f6b5f;">Response #${index + 1}</h2>
        <p style="margin:0 0 8px;color:#333;"><strong>Name:</strong> ${escapeHtml(review.name)}</p>
        <p style="margin:0 0 8px;color:#333;"><strong>Email:</strong> ${escapeHtml(review.email || '—')}</p>
        <p style="margin:0 0 8px;color:#333;"><strong>Recommendation:</strong> ${review.overall?.nps ?? '—'} / 10</p>
        <p style="margin:0 0 0;color:#6b6b6b;font-size:.95rem;">Submitted: ${escapeHtml(submittedAt)}</p>
      </section>`;
      })
      .join('') || '<p>No responses have been submitted yet.</p>';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Collected Responses</title></head><body style="font-family:system-ui,sans-serif;background:#f7f6f1;color:#23272d;padding:28px;">
      <div style="max-width:900px;margin:0 auto;">
        <h1 style="margin-bottom:12px;color:#0f6b5f;">Collected Feedback Responses</h1>
        <p style="margin:0 0 18px;line-height:1.6;">This page shows all reviews submitted through the feedback form. You can share this link, or use the raw JSON link below.</p>
        <p style="margin:0 0 18px;"><a href="/responses.json" style="color:#0f6b5f;text-decoration:none;font-weight:700;">View raw JSON data</a></p>
        <p style="margin:0 0 18px;font-size:.95rem;color:#555;"><strong>Total responses:</strong> ${count}</p>
        ${rows}
      </div></body></html>`;
}
