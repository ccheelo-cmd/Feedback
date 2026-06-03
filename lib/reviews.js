// Shared Supabase logic used by both the Vercel serverless functions (api/*)
// and any other server entrypoint. Single source of truth.
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

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

// Find the existing row for a given name (case-insensitive). Returns the raw
// row { id, review, created_at } or null. Matching is done in JS so we don't
// depend on jsonb filter syntax or worry about ilike wildcard escaping — fine
// for a single cohort's worth of responses.
async function findRowByName(name) {
  const target = normalizeName(name);
  if (!target) return null;
  const { data, error } = await supabase
    .from('reviews')
    .select('id, review, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.find((row) => normalizeName(row.review?.name) === target) || null;
}

// Upsert by name: if someone already submitted under this name, update that
// row (an edit); otherwise insert a new one. Returns { updated }.
export async function saveReview(review) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const existing = await findRowByName(review.name);
  if (existing) {
    const { error } = await supabase.from('reviews').update({ review }).eq('id', existing.id);
    if (error) throw error;
    return { updated: true };
  }
  const { error } = await supabase.from('reviews').insert({ review });
  if (error) throw error;
  return { updated: false };
}

// Look up a previously submitted review by name, for pre-filling the form.
// Returns the review (with submittedAt) or null.
export async function getReviewByName(name) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const row = await findRowByName(name);
  return row ? { ...row.review, submittedAt: row.created_at } : null;
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

// ---------------------------------------------------------------------------
// Responses page — schema-driven aggregation, one section per question.
// Mirrors the questions and payload shape produced by index.html.
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    title: 'Expectations',
    questions: [
      { label: 'The program met the expectations I had when I joined.', path: ['expectations', 'metExpectations'], type: 'scale', max: 5 },
      { label: 'Goals, structure, and expectations were communicated clearly throughout.', path: ['expectations', 'clearCommunication'], type: 'scale', max: 5 },
      { label: 'How did the day-to-day reality compare to what was promised?', path: ['expectations', 'realityVsPromise'], type: 'choice', options: ['Far below', 'Below', 'As expected', 'Above', 'Far above'] },
    ],
  },
  {
    title: 'Curriculum & content',
    questions: [
      { label: 'Overall quality and depth of the curriculum', path: ['curriculum', 'quality'], type: 'scale', max: 5 },
      { label: 'The pace of the program was…', path: ['curriculum', 'pace'], type: 'choice', options: ['Too slow', 'A bit slow', 'Just right', 'A bit fast', 'Too fast'] },
      { label: 'Balance of theory vs hands-on practice', path: ['curriculum', 'theoryPracticeBalance'], type: 'choice', options: ['Too theoretical', 'Slightly theoretical', 'Well balanced', 'Slightly hands-on heavy', 'Too hands-on heavy'] },
      { label: 'Which topics needed more depth?', path: ['curriculum', 'topicsNeedingDepth'], type: 'multi' },
    ],
  },
  {
    title: 'Supervisors & program leads',
    questions: [
      { label: 'Knowledge and expertise of the supervisors', path: ['supervisors', 'expertise'], type: 'scale', max: 5 },
      { label: 'Clarity of guidance and instruction', path: ['supervisors', 'guidanceClarity'], type: 'scale', max: 5 },
      { label: 'Responsiveness and availability when you needed help', path: ['supervisors', 'responsiveness'], type: 'scale', max: 5 },
      { label: 'Quality and usefulness of feedback on your work', path: ['supervisors', 'feedbackQuality'], type: 'scale', max: 5 },
      { label: 'Fairness, respect, and professionalism', path: ['supervisors', 'professionalism'], type: 'scale', max: 5 },
      { label: 'What should the supervisors keep doing?', path: ['supervisors', 'keepDoing'], type: 'text' },
      { label: 'What should the supervisors do differently?', path: ['supervisors', 'changeDoing'], type: 'text' },
    ],
  },
  {
    title: 'Tools & platform',
    questions: [
      { label: 'Which tools do you feel confident using now?', path: ['tools', 'confidentWith'], type: 'multi' },
      { label: 'Which tools needed better instruction?', path: ['tools', 'needBetterInstruction'], type: 'multi' },
      { label: 'The learning platform / environment was…', path: ['tools', 'platform'], type: 'scale', max: 5 },
    ],
  },
  {
    title: 'Professional skills classes',
    questions: [
      { label: 'Overall, how valuable were the professional skills classes?', path: ['professionalSkills', 'overallValue'], type: 'scale', max: 5 },
      { label: 'Professional writing lessons', path: ['professionalSkills', 'writing'], type: 'scale', max: 5 },
      { label: 'Presentation skills sessions', path: ['professionalSkills', 'presentations'], type: 'scale', max: 5 },
      { label: 'Profiling sessions', path: ['professionalSkills', 'profiling'], type: 'scale', max: 5 },
      { label: 'Guest speaker sessions', path: ['professionalSkills', 'guestSpeakers'], type: 'scale', max: 5 },
      { label: 'The practical exercises were…', path: ['professionalSkills', 'exercises'], type: 'choice', options: ['Too few', 'A bit too few', 'About right', 'A bit too many', 'Too many'] },
      { label: 'What would strengthen the professional skills classes?', path: ['professionalSkills', 'notes'], type: 'text' },
    ],
  },
  {
    title: 'Prospects & readiness',
    questions: [
      { label: 'I feel confident applying these skills to real analytical work.', path: ['prospects', 'confidenceApplying'], type: 'scale', max: 5 },
      { label: 'The program prepared me well for what comes next in this field.', path: ['prospects', 'preparedForNext'], type: 'scale', max: 5 },
      { label: 'How ready do you feel to work independently as an analyst?', path: ['prospects', 'independentReadiness'], type: 'choice', options: ['Not yet', 'With close support', 'With occasional support', 'Mostly independent', 'Fully independent'] },
    ],
  },
  {
    title: 'Overall',
    questions: [
      { label: 'How likely are you to recommend this program to a future cohort?', path: ['overall', 'nps'], type: 'scale', max: 10 },
      { label: 'What worked best and should be preserved?', path: ['overall', 'whatWorked'], type: 'text' },
      { label: 'If you could change one thing about the program, what would it be?', path: ['overall', 'oneChange'], type: 'text' },
      { label: 'Anything else for the program leads?', path: ['overall', 'messageToLeads'], type: 'text' },
    ],
  },
];

function getPath(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function isAnswered(v) {
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function bar(label, count, maxCount, total) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  const share = total > 0 ? ` · ${Math.round((count / total) * 100)}%` : '';
  return `<div class="bar"><div class="bar-label">${escapeHtml(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-count">${count}${share}</div></div>`;
}

function renderScale(q, rows) {
  const entries = rows
    .map((r) => ({ name: r.name, value: getPath(r, q.path) }))
    .filter((e) => isAnswered(e.value) && Number.isFinite(Number(e.value)))
    .map((e) => ({ name: e.name, value: Number(e.value) }));
  const n = entries.length;
  const avg = n ? entries.reduce((s, e) => s + e.value, 0) / n : null;

  const min = q.max === 10 ? 0 : 1;
  const counts = {};
  for (let g = min; g <= q.max; g++) counts[g] = 0;
  entries.forEach((e) => {
    if (counts[e.value] !== undefined) counts[e.value] += 1;
  });
  const maxCount = Math.max(1, ...Object.values(counts));
  const bars = Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a)
    .map((g) => bar(String(g), counts[g], maxCount, n))
    .join('');

  const people =
    entries
      .slice()
      .sort((a, b) => b.value - a.value)
      .map((e) => `<li><span>${escapeHtml(e.name)}</span><b>${e.value} / ${q.max}</b></li>`)
      .join('') || '<li class="muted">No answers yet.</li>';

  const avgHtml =
    avg == null
      ? '<span class="noavg">No responses</span>'
      : `<span class="avg">${avg.toFixed(1)}</span><span class="avg-max">/ ${q.max} avg</span>`;

  return `<div class="q">
      <div class="q-label">${escapeHtml(q.label)}</div>
      <div class="q-avg">${avgHtml}<span class="q-n">${plural(n, 'response')}</span></div>
      <details><summary>Show breakdown</summary>
        <div class="bars">${bars}</div>
        <ul class="people">${people}</ul>
      </details>
    </div>`;
}

function renderChoice(q, rows) {
  const entries = rows
    .map((r) => ({ name: r.name, value: getPath(r, q.path) }))
    .filter((e) => isAnswered(e.value));
  const n = entries.length;

  const counts = {};
  q.options.forEach((o) => (counts[o] = 0));
  entries.forEach((e) => {
    counts[e.value] = (counts[e.value] || 0) + 1;
  });
  const ordered = [...q.options, ...Object.keys(counts).filter((k) => !q.options.includes(k))];
  const maxCount = Math.max(1, ...Object.values(counts));
  const bars = ordered.map((o) => bar(o, counts[o] || 0, maxCount, n)).join('');

  const people =
    entries
      .map((e) => `<li><span>${escapeHtml(e.name)}</span><b>${escapeHtml(e.value)}</b></li>`)
      .join('') || '<li class="muted">No answers yet.</li>';

  return `<div class="q">
      <div class="q-label">${escapeHtml(q.label)}</div>
      <div class="q-n">${plural(n, 'response')}</div>
      <div class="bars">${bars}</div>
      <details><summary>Show who answered</summary><ul class="people">${people}</ul></details>
    </div>`;
}

function renderMulti(q, rows) {
  const entries = rows
    .map((r) => ({ name: r.name, value: getPath(r, q.path) }))
    .filter((e) => Array.isArray(e.value) && e.value.length);
  const n = entries.length;

  const counts = {};
  entries.forEach((e) =>
    e.value.forEach((opt) => {
      counts[opt] = (counts[opt] || 0) + 1;
    })
  );
  const opts = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const maxCount = Math.max(1, ...Object.values(counts));
  const bars = opts.length
    ? opts.map((o) => bar(o, counts[o], maxCount, rows.length)).join('')
    : '<p class="muted">No selections yet.</p>';

  const people =
    entries
      .map((e) => `<li><span>${escapeHtml(e.name)}</span><b>${escapeHtml(e.value.join(', '))}</b></li>`)
      .join('') || '<li class="muted">No answers yet.</li>';

  return `<div class="q">
      <div class="q-label">${escapeHtml(q.label)}</div>
      <div class="q-n">${plural(n, 'respondent')} selected at least one</div>
      <div class="bars">${bars}</div>
      <details><summary>Show who selected what</summary><ul class="people">${people}</ul></details>
    </div>`;
}

function renderText(q, rows) {
  const entries = rows
    .map((r) => ({ name: r.name, value: getPath(r, q.path) }))
    .filter((e) => isAnswered(e.value) && String(e.value).trim());
  const n = entries.length;

  const list = entries.length
    ? entries
        .map(
          (e) =>
            `<blockquote class="answer"><p>${escapeHtml(String(e.value).trim())}</p><cite>— ${escapeHtml(e.name)}</cite></blockquote>`
        )
        .join('')
    : '<p class="muted">No answers yet.</p>';

  return `<div class="q">
      <div class="q-label">${escapeHtml(q.label)}</div>
      <div class="q-n">${plural(n, 'answer')}</div>
      ${list}
    </div>`;
}

function renderQuestion(q, rows) {
  switch (q.type) {
    case 'scale':
      return renderScale(q, rows);
    case 'choice':
      return renderChoice(q, rows);
    case 'multi':
      return renderMulti(q, rows);
    default:
      return renderText(q, rows);
  }
}

const STYLES = `
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f7f6f1;color:#23272d;margin:0;padding:28px 16px 80px;line-height:1.5}
  .wrap{max-width:880px;margin:0 auto}
  .top{background:#fff;border:1px solid #e8e2d6;border-radius:16px;padding:26px;margin-bottom:22px}
  h1{margin:0 0 4px;color:#0f6b5f;font-size:1.5rem}
  .sub{margin:0 0 16px;color:#7e838c}
  .total{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
  .total-n{font-size:2.6rem;font-weight:800;color:#0f6b5f;line-height:1}
  .total-l{color:#4c525a;font-weight:600}
  .links a{color:#0f6b5f;font-weight:700;text-decoration:none}
  .links a:hover{text-decoration:underline}
  .section{background:#fff;border:1px solid #e8e2d6;border-radius:16px;padding:22px;margin-bottom:22px}
  .section-title{margin:0 0 10px;color:#0a5246;font-size:1.15rem;border-bottom:1px solid #eee;padding-bottom:10px}
  .q{padding:16px 0;border-top:1px solid #f0ece2}
  .q:first-of-type{border-top:0}
  .q-label{font-weight:700;color:#23272d;margin-bottom:8px}
  .q-avg{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
  .avg{font-size:1.9rem;font-weight:800;color:#0f6b5f;line-height:1}
  .avg-max{color:#9aa0a8;font-weight:600}
  .q-n{color:#7e838c;font-size:.9rem}
  .noavg{color:#9aa0a8;font-weight:600}
  details{margin-top:8px}
  summary{cursor:pointer;color:#0f6b5f;font-weight:600;font-size:.92rem;user-select:none}
  .bars{margin:10px 0 4px}
  .bar{display:flex;align-items:center;gap:10px;margin:5px 0}
  .bar-label{width:170px;flex:0 0 170px;font-size:.88rem;color:#4c525a;text-align:right}
  .bar-track{flex:1;background:#eef0ee;border-radius:6px;height:18px;overflow:hidden}
  .bar-fill{background:#0f6b5f;height:100%;border-radius:6px;min-width:2px}
  .bar-count{width:84px;flex:0 0 84px;font-size:.85rem;color:#4c525a}
  .people{list-style:none;margin:8px 0 0;padding:0}
  .people li{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:5px 0;border-bottom:1px solid #f3f0e8;font-size:.92rem}
  .people li:last-child{border-bottom:0}
  .people li span{color:#4c525a}
  .people li b{color:#0a5246;text-align:right}
  .people time{color:#9aa0a8;font-size:.82rem;white-space:nowrap}
  .answer{margin:10px 0;padding:12px 14px;background:#f9f8f4;border-left:3px solid #0f6b5f;border-radius:0 8px 8px 0}
  .answer p{margin:0 0 6px;white-space:pre-wrap}
  .answer cite{color:#7e838c;font-style:normal;font-size:.85rem}
  .muted{color:#9aa0a8}
  .empty{text-align:center;color:#7e838c;padding:40px;background:#fff;border:1px solid #e8e2d6;border-radius:16px}
`;

export function renderResponsesPage(responses) {
  const rows = responses || [];
  const count = rows.length;

  const sectionsHtml = SECTIONS.map((sec) => {
    const qs = sec.questions.map((q) => renderQuestion(q, rows)).join('');
    return `<section class="section"><h2 class="section-title">${escapeHtml(sec.title)}</h2>${qs}</section>`;
  }).join('');

  const respondents =
    rows
      .map(
        (r) =>
          `<li><span>${escapeHtml(r.name || '—')}</span><b>${escapeHtml(r.email || 'no email')}</b><time>${escapeHtml(new Date(r.submittedAt).toLocaleString())}</time></li>`
      )
      .join('') || '<li class="muted">No responses yet.</li>';

  const body =
    count === 0 ? '<p class="empty">No responses have been submitted yet.</p>' : sectionsHtml;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Collected Responses</title><style>${STYLES}</style></head><body>
    <div class="wrap">
      <header class="top">
        <h1>Collected Feedback Responses</h1>
        <p class="sub">Analysts of Arcadius (C4) — program review</p>
        <div class="total"><span class="total-n">${count}</span><span class="total-l">total response${count === 1 ? '' : 's'}</span></div>
        <p class="links"><a href="/responses.json">View raw JSON data</a></p>
        <details><summary>Respondents (${count})</summary><ul class="people">${respondents}</ul></details>
      </header>
      ${body}
    </div>
  </body></html>`;
}
