import 'dotenv/config';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import url from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const publicFile = path.join(__dirname, 'arcadius-c4-program-review.html');
const responsesFile = path.join(__dirname, 'responses.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn('Supabase credentials not found. Falling back to local responses.json storage.');
}

async function loadResponses() {
  if (supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .select('review, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(item => ({ ...item.review, submittedAt: item.created_at }));
  }

  try {
    const content = await fs.readFile(responsesFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveResponse(review) {
  if (supabase) {
    const { error } = await supabase.from('reviews').insert({ review });
    if (error) throw error;
    return;
  }

  const responses = await loadResponses();
  responses.push(review);
  await fs.writeFile(responsesFile, JSON.stringify(responses, null, 2), 'utf8');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  if (req.method === 'GET' && (parsed.pathname === '/' || parsed.pathname === '/arcadius-c4-program-review.html')) {
    const html = await fs.readFile(publicFile, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/responses') {
    const responses = await loadResponses();
    const count = responses.length;
    const rows = responses.map((review, index) => {
      const submittedAt = new Date(review.submittedAt).toLocaleString();
      return `<section style="margin-bottom:24px;border:1px solid #e5e5e5;border-radius:14px;padding:18px;background:#fff;">
        <h2 style="font-size:1rem;margin:0 0 10px;color:#0f6b5f;">Response #${index + 1}</h2>
        <p style="margin:0 0 8px;color:#333;"><strong>Name:</strong> ${escapeHtml(review.name)}</p>
        <p style="margin:0 0 8px;color:#333;"><strong>Email:</strong> ${escapeHtml(review.email || '—')}</p>
        <p style="margin:0 0 8px;color:#333;"><strong>Recommendation:</strong> ${review.overall?.nps ?? '—'} / 10</p>
        <p style="margin:0 0 0;color:#6b6b6b;font-size:.95rem;">Submitted: ${submittedAt}</p>
      </section>`;
    }).join('') || '<p>No responses have been submitted yet.</p>';

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Collected Responses</title></head><body style="font-family:system-ui,sans-serif;background:#f7f6f1;color:#23272d;padding:28px;">
      <div style="max-width:900px;margin:0 auto;">
        <h1 style="margin-bottom:12px;color:#0f6b5f;">Collected Feedback Responses</h1>
        <p style="margin:0 0 18px;line-height:1.6;">This page shows all reviews submitted through the feedback form. You can share this link, or use the raw JSON link below.</p>
        <p style="margin:0 0 18px;"><a href="/responses.json" style="color:#0f6b5f;text-decoration:none;font-weight:700;">View raw JSON data</a></p>
        <p style="margin:0 0 18px;font-size:.95rem;color:#555;"><strong>Total responses:</strong> ${count}</p>
        ${rows}
      </div></body></html>`);
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/submit') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const payload = JSON.parse(body);
      if (!payload || !payload.name || typeof payload.overall?.nps === 'undefined') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid submission payload.' }));
        return;
      }
      await saveResponse(payload);
      const responses = await loadResponses();
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, count: responses.length }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Failed to save submission.' }));
    }
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/responses.json') {
    try {
      const responses = await loadResponses();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(responses, null, 2));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Failed to load responses.' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  });
});

server.listen(PORT, () => {
  console.log(`Feedback collector running at http://localhost:${PORT}`);
  console.log('Open that address in your browser to submit reviews.');
});
