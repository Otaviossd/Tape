// Puxa os números do tráfego pago (Meta Ads) de um cliente. O token da Meta fica
// só na Vercel (META_ACCESS_TOKEN). Quem chama precisa ser da equipe com acesso a Tráfego.
const { send, readBody, originOk, rest, caller, hasKey, SERVICE_KEY } = require('./_lib');

const GRAPH = 'https://graph.facebook.com/' + (process.env.META_GRAPH_VERSION || 'v24.0');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MSG_TYPES = ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d'];
const LEAD_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
const BUY_TYPES = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'];

function pickAction(list, types) {
  if (!Array.isArray(list)) return 0;
  for (const t of types) {
    const a = list.find(x => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

function normalize(row) {
  const num = k => Number(row[k]) || 0;
  return {
    spend: num('spend'), impressions: num('impressions'), reach: num('reach'),
    clicks: num('clicks'), linkClicks: num('inline_link_clicks'),
    ctr: num('ctr'), cpc: num('cpc'), cpm: num('cpm'), frequency: num('frequency'),
    messages: pickAction(row.actions, MSG_TYPES),
    leads: pickAction(row.actions, LEAD_TYPES),
    purchases: pickAction(row.actions, BUY_TYPES),
    purchaseValue: pickAction(row.action_values, BUY_TYPES),
    videoViews: pickAction(row.actions, ['video_view']),
    engagement: pickAction(row.actions, ['post_engagement']),
  };
}

async function graph(path, params) {
  const url = new URL(GRAPH + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v)));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + process.env.META_ACCESS_TOKEN }, signal: ctl.signal });
    const data = await r.json();
    if (!r.ok || data.error) {
      const e = data.error || {};
      const err = new Error(e.message || 'Erro na Meta');
      err.code = e.code; err.status = r.status;
      throw err;
    }
    return data;
  } finally { clearTimeout(timer); }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!originOk(req)) return send(res, 403, { error: 'Origem não permitida.' });
  const me = await caller(req);
  if (!me) return send(res, 401, { error: 'Sessão inválida. Entre de novo.' });
  if (!(hasKey(me, 'trafego') || hasKey(me, 'financeiro'))) return send(res, 403, { error: 'Sem acesso ao painel de tráfego.' });
  if (!process.env.META_ACCESS_TOKEN) return send(res, 503, { error: 'not_configured', message: 'META_ACCESS_TOKEN não configurado na Vercel.' });

  const b = readBody(req);
  const clientId = String(b.clientId || '');
  const since = String(b.since || ''), until = String(b.until || '');
  if (!clientId || !DATE.test(since) || !DATE.test(until) || since > until) return send(res, 400, { error: 'Cliente ou período inválido.' });

  const c = await rest('/rest/v1/clients?id=eq.' + encodeURIComponent(clientId) + '&select=id,name,metaAccountId');
  if (!c.ok || !c.data || !c.data[0]) return send(res, 404, { error: 'Cliente não encontrado.' });
  const acc = String(c.data[0].metaAccountId || '').replace(/^act_/, '').replace(/\D/g, '');
  if (!acc) return send(res, 422, { error: 'no_account', message: 'Este cliente não tem conta de anúncios cadastrada.' });

  const range = { since, until };
  const fields = 'spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,cpm,frequency,actions,action_values';
  try {
    const wantCamp = b.campaigns !== false;
    const [tot, daily, camps, info] = await Promise.all([
      graph('/act_' + acc + '/insights', { level: 'account', fields, time_range: range }),
      graph('/act_' + acc + '/insights', { level: 'account', fields: 'spend,impressions,clicks,actions', time_range: range, time_increment: 1, limit: 400 }),
      wantCamp ? graph('/act_' + acc + '/insights', { level: 'campaign', fields: 'campaign_name,objective,' + fields, time_range: range, limit: 100 }) : Promise.resolve({ data: [] }),
      graph('/act_' + acc, { fields: 'name,currency,account_status' }),
    ]);
    const t = (tot.data && tot.data[0]) ? normalize(tot.data[0]) : normalize({});
    return send(res, 200, {
      ok: true,
      account: { id: acc, name: info.name, currency: info.currency, status: info.account_status },
      totals: t,
      daily: (daily.data || []).map(d => ({ date: d.date_start, ...normalize(d) })),
      campaigns: (camps.data || []).map(r => ({ name: r.campaign_name, objective: r.objective, ...normalize(r) })).sort((x, y) => y.spend - x.spend),
    });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'A Meta demorou demais para responder.' : (e.message || 'Erro na Meta');
    return send(res, 502, { error: 'meta_error', message: msg, code: e.code || null });
  }
};
