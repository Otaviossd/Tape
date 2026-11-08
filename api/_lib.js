// Funções de apoio das rotas /api. Nada aqui é segredo: as chaves vêm só das
// variáveis de ambiente da Vercel (SUPABASE_SERVICE_ROLE_KEY, META_ACCESS_TOKEN).
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://dkpoqvggctglfjrhichs.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://tapegrowth.agency,https://www.tapegrowth.agency')
  .split(',').map(s => s.trim()).filter(Boolean);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (_) { return {}; } }
  return {};
}

// Só aceita pedidos vindos do próprio site (ou da pré-visualização da Vercel do mesmo projeto)
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true; // chamadas sem Origin (ex.: mesmo domínio em alguns navegadores) dependem do token
  if (ALLOWED.includes(o)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(o) && process.env.ALLOW_VERCEL_PREVIEW === '1') return true;
  return false;
}

async function rest(path, opts = {}) {
  const r = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: r.ok, status: r.status, data };
}

// Descobre quem está chamando (token do login) e qual o perfil dele no banco
async function caller(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token || !SERVICE_KEY) return null;
  const u = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + token } });
  if (!u.ok) return null;
  const user = await u.json();
  if (!user || !user.id) return null;
  const p = await rest('/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=id,name,role,access,clientId');
  if (!p.ok || !Array.isArray(p.data) || !p.data[0]) return null;
  return { user, profile: p.data[0] };
}

const isAdmin = c => !!c && c.profile.role === 'admin';
const hasKey = (c, k) => !!c && (c.profile.role === 'admin' || (c.profile.role !== 'cliente' && c.profile.access && c.profile.access[k] === true));

module.exports = { SUPABASE_URL, SERVICE_KEY, send, readBody, originOk, rest, caller, isAdmin, hasKey };
