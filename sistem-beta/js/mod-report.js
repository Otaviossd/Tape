/* =====================================================================
   Tape Sistema 2.0 | relatório de resultados para o cliente
   Não é só número: o texto (em espanhol, editável) explica o que os
   números significam e justifica o custo por conversa com contexto real.
   Nunca inventa dados: tudo parte das métricas e do que você informa.
   ===================================================================== */

const RP = { R:null, busy:false };
const REASONS = {
  '': 'Sem motivo específico',
  test: 'Testando novos criativos',
  seg: 'Público mais segmentado (mais qualificado)',
  season: 'Mais concorrência na plataforma (temporada)',
  offer: 'Ajuste de oferta e mensagem',
  learn: 'Campanhas novas em fase de aprendizado',
};
const REASON_ES = {
  test: 'Esto se debe a que estamos probando nuevos creativos para descubrir cuáles funcionan mejor; esa inversión de aprendizaje es la que baja el costo en los próximos períodos.',
  seg: 'Esto se debe a que segmentamos un público más específico: llegamos a menos personas, pero mucho más interesadas y con mayor intención de compra.',
  season: 'En este período hubo más competencia en la plataforma (más anunciantes pujando por la misma audiencia), lo que encarece el costo para todos los anunciantes, no solo para tu negocio.',
  offer: 'Estamos ajustando la oferta y el mensaje de los anuncios para atraer clientes de mayor valor.',
  learn: 'Las campañas nuevas pasan por una fase de aprendizaje en la que la plataforma todavía está optimizando; el costo suele bajar cuando se estabiliza.',
};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dateEs(iso){ const d = parseISO(iso); return d.getDate() + ' de ' + MESES_ES[d.getMonth()]; }
function periodEs(since, until){
  const s = parseISO(since), u = parseISO(until);
  const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
  if(s.getDate() === 1 && u.getDate() === lastDay && s.getMonth() === u.getMonth() && s.getFullYear() === u.getFullYear()) return MESES_ES[s.getMonth()] + ' de ' + s.getFullYear();
  return 'del ' + dateEs(since) + ' al ' + dateEs(until);
}
function resEs(m){ const r = mainResult(m); return { n:r.n, es:r.es, one: { conversaciones:'conversación', contactos:'contacto', ventas:'venta', clics:'clic' }[r.es] }; }

function genNarrative(R){
  const m = R.m, cu = R.currency, f = n=>fmtCur(n, cu);
  const res = resEs(m), cpr = safeDiv(m.spend, res.n);
  const per = periodEs(R.since, R.until);
  const range = /^del (.*) al (.*)$/.exec(per);
  const perIn = range ? `entre el ${range[1]} y el ${range[2]}` : `en ${per}`;      // "en octubre de 2026" / "entre el 11 de octubre y el 9 de noviembre"
  const perDur = range ? `Entre el ${range[1]} y el ${range[2]}` : `Durante ${per}`;
  const pm = R.prev; const pres = pm ? resEs(pm) : null; const pcpr = pm ? safeDiv(pm.spend, pres.n) : 0;
  const lc = m.linkClicks || m.clicks;

  const headline = res.n > 0
    ? `${fmtNum(res.n)} ${res.es} nuevas para tu negocio ${perIn}`
    : `Tu marca llegó a ${fmtNum(m.reach)} personas ${perIn}`;

  let summary = `${perDur} invertimos ${f(m.spend)} en anuncios y llegamos a ${fmtNum(m.reach)} personas distintas`;
  if(m.impressions) summary += ` (${fmtNum(m.impressions)} impresiones)`;
  summary += '.';
  if(lc) summary += ` Recibimos ${fmtNum(lc)} clics hacia tu negocio, con un CTR de ${fmtPct(m.ctr, 2)}.`;
  if(res.n > 0){
    let cmp = '';
    if(pm && pres.n > 0){
      const dr = (res.n - pres.n) / pres.n * 100;
      cmp = Math.abs(dr) < 1 ? ', igual que en el período anterior' : `, ${Math.round(Math.abs(dr))}% ${dr > 0 ? 'más' : 'menos'} que en el período anterior`;
    }
    summary += ` El resultado principal fueron ${fmtNum(res.n)} ${res.es}${cmp}.`;
  }

  const v = [];
  if(res.n > 0){
    if(m.messages > 0) v.push(`Cada conversación es una persona real que levantó la mano y escribió a tu negocio. Por eso medimos el costo por conversación (${f(cpr)}) y no el costo por "me gusta" o por alcance: es el indicador más cercano a una venta.`);
    else v.push(`Cada ${res.one} es una persona real interesada en lo que ofreces. El costo por ${res.one} (${f(cpr)}) es el indicador más cercano a una venta.`);
    if(pm && pcpr > 0){
      const d = (cpr - pcpr) / pcpr * 100;
      if(d <= -5) v.push(`Además, mejoramos el costo por ${res.one} un ${Math.abs(d).toFixed(0)}% frente al período anterior (de ${f(pcpr)} a ${f(cpr)}).`);
      else if(d >= 10){ v.push(`El costo por ${res.one} subió un ${d.toFixed(0)}% frente al período anterior (de ${f(pcpr)} a ${f(cpr)}). ${REASON_ES[R.reason] || 'Es una variación normal cuando se amplía el público o se renuevan los anuncios, y la estamos trabajando para optimizarla.'}`); }
      else v.push(`El costo por ${res.one} se mantuvo estable frente al período anterior (${f(pcpr)} → ${f(cpr)}).`);
    } else if(R.reason && REASON_ES[R.reason]) v.push(REASON_ES[R.reason]);
    const t = +R.ticket || 0, close = +R.close || 0;
    if(t > 0 && cpr > 0){
      const be = cpr / t;
      if(be < 1) v.push(`Con un ticket promedio de ${f(t)}, alcanza con concretar 1 venta cada ${Math.ceil(1 / be)} ${res.es} para recuperar toda la inversión.`);
      if(close > 0 && R.opts.showProjection){
        const sales = res.n * close / 100, rev = sales * t;
        v.push(`Con una tasa de cierre del ${fmtDec(close, 0)}%, estas ${fmtNum(res.n)} ${res.es} equivalen a unas ${fmtDec(sales, sales < 10 ? 1 : 0)} ventas y alrededor de ${f(rev)} en ingresos potenciales (estimación), contra ${f(m.spend)} invertidos: ${fmtDec(safeDiv(rev, m.spend), 1)} por cada unidad invertida.`);
      }
    }
    if(m.purchaseValue > 0) v.push(`Las compras registradas por la plataforma suman ${f(m.purchaseValue)}, es decir ${fmtDec(safeDiv(m.purchaseValue, m.spend), 1)} veces lo invertido.`);
  } else {
    v.push(`En este período el foco estuvo en construir presencia: ${fmtNum(m.reach)} personas conocieron tu marca por un costo de ${f(safeDiv(m.spend, m.reach) * 1000)} cada mil personas alcanzadas. Esa audiencia es la base de las conversaciones y ventas de los próximos períodos.`);
  }
  const value = v.join('\n\n');

  const h = [];
  const camps = (R.campaigns || []).filter(k=>resEs(k).n >= 3 && k.spend > 0).sort((a, b)=>safeDiv(a.spend, resEs(a).n) - safeDiv(b.spend, resEs(b).n));
  if(camps.length) h.push(`Campaña destacada: «${camps[0].name}» con ${fmtNum(resEs(camps[0]).n)} ${res.es} a ${f(safeDiv(camps[0].spend, resEs(camps[0]).n))} cada una.`);
  const days = (R.daily || []).filter(d=>resEs(d).n > 0).sort((a, b)=>resEs(b).n - resEs(a).n);
  if(days.length && resEs(days[0]).n >= 3) h.push(`Mejor día: ${dateEs(days[0].date)}, con ${fmtNum(resEs(days[0]).n)} ${res.es}.`);
  if(m.reach > 0 && m.frequency >= 1.2 && m.frequency <= 4) h.push(`Cada persona vio tu marca en promedio ${fmtDec(m.frequency, 1)} veces: una frecuencia saludable para generar recordación sin saturar.`);
  if(m.ctr >= 1.5) h.push(`El CTR de ${fmtPct(m.ctr, 2)} indica que los anuncios llaman la atención de la audiencia.`);
  if(R.extraHighlights) R.extraHighlights.split('\n').map(s=>s.trim()).filter(Boolean).forEach(s=>h.unshift(s));

  const nx = [];
  if(camps.length) nx.push('Dar más inversión a los anuncios con mejor rendimiento y pausar los que menos convierten.');
  if(m.frequency > 2.5) nx.push('Renovar los videos y las piezas para que la audiencia no se sature.');
  if(res.n > 0 && m.messages > 0) nx.push('Responder las conversaciones lo antes posible: la rapidez de respuesta es lo que más aumenta el cierre.');
  nx.push('Mantener el contenido orgánico activo para calentar a la audiencia que ven los anuncios.');
  nx.push('Revisar los resultados juntos al cierre del próximo período y ajustar la estrategia.');

  return { headline, summary, value, highlights: h.join('\n'), next: nx.join('\n') };
}

/* ---- HTML do relatório (serve para a pré-visualização e para o PDF) ---- */
const REPORT_CSS = `
.rp{font-family:'Inter',system-ui,sans-serif;color:#0c1310;background:#fff;font-size:12.5px;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rp *{box-sizing:border-box}
.rp .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid #e4e9e7;margin-bottom:20px}
.rp .brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px}
.rp .mark{width:17px;height:17px;position:relative}.rp .mark i{position:absolute;background:#2F8F82}
.rp .mark i:first-child{left:0;right:0;top:7.5px;height:2px}.rp .mark i:last-child{top:0;bottom:0;left:7.5px;width:2px}
.rp .who{text-align:right;font-size:11.5px;color:#647169}.rp .who b{display:block;color:#0c1310;font-size:13px}
.rp .eyebrow{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#2F8F82;font-weight:700;margin-bottom:6px}
.rp h1{font-size:23px;line-height:1.2;letter-spacing:-.01em;margin:0 0 10px;font-weight:800}
.rp .lead{font-size:13.5px;color:#34413a;margin:0 0 18px;max-width:640px}
.rp .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 18px}
.rp .kpi{border:1px solid #e4e9e7;border-radius:10px;padding:11px 13px;background:#fbfcfc}
.rp .kpi .l{font-size:10.5px;color:#647169;font-weight:600}.rp .kpi .v{font-size:19px;font-weight:800;letter-spacing:-.01em;margin-top:2px}
.rp .kpi .d{font-size:10.5px;margin-top:2px;color:#647169}.rp .kpi .d.up{color:#2f8f52}.rp .kpi .d.down{color:#c0453b}
.rp .kpi.hero{background:#0f1613;border-color:#0f1613;color:#fff}.rp .kpi.hero .l{color:#9fb2a9}.rp .kpi.hero .d{color:#9fb2a9}
.rp h2{font-size:13px;margin:20px 0 8px;font-weight:800;letter-spacing:-.005em}
.rp p{margin:0 0 8px;color:#34413a}
.rp .box{background:#eef6f4;border-radius:12px;padding:14px 16px}
.rp .box p:last-child{margin-bottom:0}
.rp ul{margin:0;padding-left:18px;color:#34413a}.rp li{margin:0 0 5px}
.rp table{width:100%;border-collapse:collapse;font-size:11.5px}
.rp th{text-align:left;color:#647169;font-weight:600;font-size:10.5px;padding:6px 8px;border-bottom:1px solid #e4e9e7}
.rp td{padding:7px 8px;border-bottom:1px solid #eef2f1}.rp .r{text-align:right}
.rp .chart{width:100%;height:auto;display:block}
.rp .foot{margin-top:24px;padding-top:12px;border-top:1px solid #e4e9e7;font-size:10.5px;color:#647169;display:flex;justify-content:space-between}
.rp .sec{break-inside:avoid;page-break-inside:avoid}
@media (max-width:640px){.rp .kpis{grid-template-columns:repeat(2,1fr)}}
`;
function esc(s){ return escapeHtml(s); }
function rpParas(t){ return String(t || '').split(/\n{2,}/).filter(s=>s.trim()).map(p=>`<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join(''); }
function rpList(t){ const a = String(t || '').split('\n').map(s=>s.trim()).filter(Boolean); return a.length ? `<ul>${a.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>` : ''; }

function reportHtml(R){
  const m = R.m, cu = R.currency, f = n=>fmtCur(n, cu), res = resEs(m), cpr = safeDiv(m.spend, res.n);
  const pm = R.prev && R.opts.showCompare ? R.prev : null; const pres = pm ? resEs(pm) : null;
  const dl = (c, p, inv)=>{ if(!pm || !(p > 0)) return ''; const d = (c - p) / p * 100; if(Math.abs(d) < 0.5) return '<div class="d">igual al período anterior</div>'; const good = inv ? d < 0 : d > 0; return `<div class="d ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}% vs. período anterior</div>`; };
  const lc = m.linkClicks || m.clicks;
  const kpi = (l, v, d, hero)=>`<div class="kpi ${hero ? 'hero' : ''}"><div class="l">${l}</div><div class="v">${v}</div>${d || ''}</div>`;
  const capEs = res.es.charAt(0).toUpperCase() + res.es.slice(1);
  const client = clientById(R.clientId);
  const camps = R.opts.showCampaigns ? (R.campaigns || []).filter(k=>k.spend > 0).slice(0, 8) : [];
  return `<div class="rp">
    <div class="top"><div class="brand"><span class="mark"><i></i><i></i></span>Tape</div>
      <div class="who"><b>${esc(client ? client.name : '')}</b>${esc(dateEs(R.since))} al ${esc(dateEs(R.until))} de ${parseISO(R.until).getFullYear()}</div></div>
    <div class="eyebrow">Informe de resultados</div>
    <h1>${esc(R.text.headline)}</h1>
    <p class="lead">${esc(R.text.summary)}</p>
    <div class="kpis">
      ${kpi('Inversión', f(m.spend), dl(m.spend, pm && pm.spend, false))}
      ${kpi(capEs, fmtNum(res.n), pm ? dl(res.n, pres.n, false) : '', true)}
      ${kpi('Costo por ' + res.one, res.n ? f(cpr) : '-', pm && res.n ? dl(cpr, safeDiv(pm.spend, pres.n), true) : '')}
      ${kpi('Personas alcanzadas', fmtNum(m.reach), dl(m.reach, pm && pm.reach, false))}
      ${kpi('Clics en el anuncio', fmtNum(lc), dl(lc, pm && (pm.linkClicks || pm.clicks), false))}
      ${kpi('CTR', fmtPct(m.ctr, 2), '')}
    </div>
    ${R.daily && R.daily.length > 1 ? `<div class="sec"><h2>Evolución diaria</h2>${reportChartSvg(R.daily)}</div>` : ''}
    <div class="sec"><h2>Qué significan estos números</h2><div class="box">${rpParas(R.text.value)}</div></div>
    ${R.text.highlights.trim() ? `<div class="sec"><h2>Destacados del período</h2>${rpList(R.text.highlights)}</div>` : ''}
    ${camps.length ? `<div class="sec"><h2>Campañas</h2><table><thead><tr><th>Campaña</th><th class="r">Inversión</th><th class="r">${esc(capEs)}</th><th class="r">Costo</th><th class="r">Alcance</th></tr></thead><tbody>
      ${camps.map(k=>{ const kr = resEs(k); return `<tr><td>${esc(k.name)}</td><td class="r">${f(k.spend)}</td><td class="r">${fmtNum(kr.n)}</td><td class="r">${kr.n ? f(safeDiv(k.spend, kr.n)) : '-'}</td><td class="r">${fmtNum(k.reach)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
    ${R.text.next.trim() ? `<div class="sec"><h2>Próximos pasos</h2>${rpList(R.text.next)}</div>` : ''}
    <div class="foot"><span>Preparado por Tape · tapegrowth.agency</span><span>Datos: ${R.source === 'manual' ? 'panel de anuncios' : 'Meta Ads'}</span></div>
  </div>`;
}
function reportChartSvg(daily){
  const W = 640, H = 120, pad = 6, n = daily.length;
  const maxS = Math.max(...daily.map(d=>d.spend), 1), maxR = Math.max(...daily.map(d=>resEs(d).n), 1);
  const step = (W - pad * 2) / n, bw = Math.max(2, step - 2);
  const bars = daily.map((d, i)=>`<rect x="${(pad + i * step).toFixed(1)}" y="${(H - 16 - d.spend / maxS * (H - 30)).toFixed(1)}" width="${bw.toFixed(1)}" height="${(d.spend / maxS * (H - 30)).toFixed(1)}" rx="2" fill="#cfe7e2"/>`).join('');
  const pts = daily.map((d, i)=>`${(pad + i * step + bw / 2).toFixed(1)},${(H - 16 - resEs(d).n / maxR * (H - 30)).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${bars}<polyline points="${pts}" fill="none" stroke="#2F8F82" stroke-width="2.2" stroke-linejoin="round"/>
    <text x="${pad}" y="${H - 3}" font-size="9" fill="#647169">${esc(dateEs(daily[0].date))}</text><text x="${W - pad}" y="${H - 3}" font-size="9" text-anchor="end" fill="#647169">${esc(dateEs(daily[n - 1].date))}</text></svg>
    <div style="font-size:10.5px;color:#647169;margin-top:4px">Barras: inversión por día · Línea: resultados por día</div>`;
}

/* ---- Construtor (janela) ---- */
function emptyMetrics(){ return { spend:0, impressions:0, reach:0, clicks:0, linkClicks:0, ctr:0, cpc:0, cpm:0, frequency:0, messages:0, leads:0, purchases:0, purchaseValue:0, videoViews:0, engagement:0 }; }
function newReport(clientId){
  trInitPeriod();
  return { clientId, since:TR.since, until:TR.until, source:'meta', currency:'PYG', m:emptyMetrics(), prev:null, campaigns:[], daily:[],
    ticket:'', close:'', reason:'', extraHighlights:'', opts:{ showCampaigns:true, showCompare:true, showProjection:true },
    text:{ headline:'', summary:'', value:'', highlights:'', next:'' }, savedId:null, metaOk:false };
}
window.openReportBuilder = function(clientId){
  const c = clientById(clientId); if(!c) return;
  RP.R = newReport(clientId);
  renderReportBuilder();
  openModal('modalReport');
  if(c.metaAccountId) rpFetchMeta(); else { RP.R.source = 'manual'; rpRefresh(true); }
};
window.openSavedReport = function(id){
  const r = S.reports.find(x=>x.id === id); if(!r) return;
  const R = newReport(r.clientId);
  Object.assign(R, { since:r.periodStart, until:r.periodEnd, source:r.source, savedId:r.id });
  const n = r.narrative || {};
  R.m = { ...emptyMetrics(), ...(r.metrics.m || {}) }; R.prev = r.metrics.prev || null; R.campaigns = r.metrics.campaigns || []; R.daily = r.metrics.daily || []; R.currency = r.metrics.currency || 'PYG';
  R.ticket = n.ticket || ''; R.close = n.close || ''; R.reason = n.reason || ''; R.extraHighlights = n.extra || '';
  R.opts = { ...R.opts, ...(n.opts || {}) };
  R.text = { headline:n.headline || '', summary:n.summary || '', value:n.value || '', highlights:n.highlights || '', next:n.next || '' };
  RP.R = R; renderReportBuilder(); openModal('modalReport'); rpRefresh(false);
};

function renderReportBuilder(){
  const R = RP.R; const root = document.getElementById('reportRoot');
  const c = clientById(R.clientId);
  const num = (id, label, val, step)=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="${step || 1}" value="${val === 0 || val === '' ? '' : val}" oninput="rpManual()"></div>`;
  root.innerHTML = `<div class="rp-wrap">
    <div class="rp-form">
      <h2>Relatório · ${escapeHtml(c ? c.name : '')}</h2>
      <div class="field-row"><div class="field"><label>De</label><input type="date" id="rpSince" value="${R.since}" onchange="rpPeriod()"></div><div class="field"><label>Até</label><input type="date" id="rpUntil" value="${R.until}" onchange="rpPeriod()"></div></div>
      <div id="rpFetchInfo" class="rp-info"></div>
      <details class="rp-det" id="rpManualBox" ${R.source === 'manual' ? 'open' : ''}><summary>Números do período ${R.source === 'manual' ? '(digitados)' : '(editar manualmente)'}</summary>
        <div class="field-row">${num('rpSpend', 'Investimento', R.m.spend, 0.01)}<div class="field"><label for="rpCur">Moeda</label><select id="rpCur" onchange="rpManual()">${['PYG', 'USD', 'BRL'].map(x=>`<option ${R.currency === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
        <div class="field-row">${num('rpReach', 'Alcance (pessoas)', R.m.reach)}${num('rpImpr', 'Impressões', R.m.impressions)}</div>
        <div class="field-row">${num('rpClicks', 'Cliques no link', R.m.linkClicks || R.m.clicks)}${num('rpMsgs', 'Conversas iniciadas', R.m.messages)}</div>
        <div class="field-row">${num('rpLeads', 'Contatos (leads)', R.m.leads)}${num('rpSales', 'Vendas', R.m.purchases)}</div>
        ${num('rpSalesVal', 'Valor das vendas', R.m.purchaseValue, 0.01)}
        <p class="muted-s">Se preencher aqui, o relatório usa estes números no lugar dos da Meta.</p></details>
      <div class="field-row"><div class="field"><label for="rpTicket">Ticket médio de uma venda <span class="opt">opcional</span></label><input id="rpTicket" type="number" min="0" value="${R.ticket}" oninput="rpCtx()" placeholder="Ex: 1500000"></div>
        <div class="field"><label for="rpClose">Taxa de fechamento % <span class="opt">opcional</span></label><input id="rpClose" type="number" min="0" max="100" value="${R.close}" oninput="rpCtx()" placeholder="Ex: 20"></div></div>
      <div class="field"><label for="rpReason">Contexto do custo por resultado</label><select id="rpReason" onchange="rpCtx()">${Object.entries(REASONS).map(([k, v])=>`<option value="${k}" ${R.reason === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="muted-s">Usado só quando o custo subiu. Escolha o motivo verdadeiro.</div></div>
      <div class="field"><label for="rpExtra">Destaques seus <span class="opt">um por linha, em espanhol</span></label><textarea id="rpExtra" rows="2" oninput="rpCtx()">${escapeHtml(R.extraHighlights)}</textarea></div>
      <div class="checks"><label><input type="checkbox" id="rpOptC" ${R.opts.showCompare ? 'checked' : ''} onchange="rpCtx()"> Comparar com período anterior</label>
        <label><input type="checkbox" id="rpOptK" ${R.opts.showCampaigns ? 'checked' : ''} onchange="rpCtx()"> Mostrar campanhas</label>
        <label><input type="checkbox" id="rpOptP" ${R.opts.showProjection ? 'checked' : ''} onchange="rpCtx()"> Mostrar projeção de vendas</label></div>
      <div class="rp-texts"><div class="row-between"><b>Texto do relatório (espanhol)</b><button class="btn btn-ghost btn-sm" onclick="rpRegen()">${icon('refresh')}Gerar de novo</button></div>
        <div class="field"><label>Título</label><input id="rpHeadline" value="${escapeHtml(R.text.headline)}" oninput="rpText()"></div>
        <div class="field"><label>Resumo</label><textarea id="rpSummary" rows="3" oninput="rpText()">${escapeHtml(R.text.summary)}</textarea></div>
        <div class="field"><label>O que significam os números</label><textarea id="rpValue" rows="7" oninput="rpText()">${escapeHtml(R.text.value)}</textarea></div>
        <div class="field"><label>Destacados (um por linha)</label><textarea id="rpHigh" rows="4" oninput="rpText()">${escapeHtml(R.text.highlights)}</textarea></div>
        <div class="field"><label>Próximos pasos (um por linha)</label><textarea id="rpNext" rows="4" oninput="rpText()">${escapeHtml(R.text.next)}</textarea></div></div>
      <div class="rp-actions"><button class="btn btn-primary btn-sm" onclick="rpPdf()">${icon('download')}Exportar PDF</button>
        <button class="btn btn-outline btn-sm" onclick="rpCopyWa()">${icon('copy')}Copiar p/ WhatsApp</button>
        <button class="btn btn-outline btn-sm" onclick="rpSave()">${icon('check')}Salvar</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal('modalReport')">Fechar</button></div>
    </div>
    <div class="rp-preview"><div class="rp-sheet"><style>${REPORT_CSS}</style><div id="rpPreview"></div></div></div></div>`;
}
function rpInfo(msg, kind){ const el = document.getElementById('rpFetchInfo'); if(el) el.innerHTML = msg ? `<div class="banner ${kind || ''}">${msg}</div>` : ''; }
function rpDrawPreview(){ const el = document.getElementById('rpPreview'); if(el && RP.R) el.innerHTML = reportHtml(RP.R); }
function rpRefresh(regen){
  const R = RP.R; if(regen){ R.text = genNarrative(R); syncTextInputs(); }
  rpDrawPreview();
}
function syncTextInputs(){
  const t = RP.R.text; const set = (id, v)=>{ const e = document.getElementById(id); if(e) e.value = v; };
  set('rpHeadline', t.headline); set('rpSummary', t.summary); set('rpValue', t.value); set('rpHigh', t.highlights); set('rpNext', t.next);
}
async function rpFetchMeta(){
  const R = RP.R; rpInfo('Buscando os números na Meta…');
  const prev = prevPeriod(R.since, R.until);
  try{
    const [cur, old] = await Promise.all([fetchMeta(R.clientId, R.since, R.until), fetchMeta(R.clientId, prev.since, prev.until).catch(()=>null)]);
    if(RP.R !== R) return;
    R.source = 'meta'; R.metaOk = true; R.m = { ...emptyMetrics(), ...cur.totals }; R.currency = cur.account.currency || 'PYG';
    R.campaigns = cur.campaigns; R.daily = cur.daily; R.prev = old ? old.totals : null;
    rpInfo('Números atualizados da Meta (' + escapeHtml(cur.account.name || 'conta') + ').', 'ok');
    fillManualInputs(); rpRefresh(true);
  }catch(err){
    if(RP.R !== R) return;
    R.source = 'manual'; R.metaOk = false;
    rpInfo(escapeHtml(err.code === 'not_configured' ? 'A Meta ainda não está conectada. Digite os números do período abaixo.' : (err.message || 'Não consegui buscar na Meta.') + ' Digite os números abaixo.'), 'warn');
    const d = document.getElementById('rpManualBox'); if(d) d.open = true;
    rpRefresh(true);
  }
}
function fillManualInputs(){
  const m = RP.R.m; const set = (id, v)=>{ const e = document.getElementById(id); if(e) e.value = v ? v : ''; };
  set('rpSpend', m.spend); set('rpReach', m.reach); set('rpImpr', m.impressions); set('rpClicks', m.linkClicks || m.clicks);
  set('rpMsgs', m.messages); set('rpLeads', m.leads); set('rpSales', m.purchases); set('rpSalesVal', m.purchaseValue);
  const cu = document.getElementById('rpCur'); if(cu) cu.value = RP.R.currency;
}
window.rpPeriod = function(){
  const s = document.getElementById('rpSince').value, u = document.getElementById('rpUntil').value;
  if(!s || !u || s > u){ toast('Confira as datas.', 'error'); return; }
  RP.R.since = s; RP.R.until = u;
  const c = clientById(RP.R.clientId);
  if(c && c.metaAccountId) rpFetchMeta(); else rpRefresh(true);
};
window.rpManual = function(){
  const R = RP.R; const v = id=>parseFloat((document.getElementById(id) || {}).value) || 0;
  R.source = 'manual'; R.currency = document.getElementById('rpCur').value;
  const m = R.m;
  m.spend = v('rpSpend'); m.reach = v('rpReach'); m.impressions = v('rpImpr'); m.linkClicks = v('rpClicks'); m.clicks = m.linkClicks;
  m.messages = v('rpMsgs'); m.leads = v('rpLeads'); m.purchases = v('rpSales'); m.purchaseValue = v('rpSalesVal');
  m.ctr = m.impressions ? m.linkClicks / m.impressions * 100 : 0; m.cpm = m.impressions ? m.spend / m.impressions * 1000 : 0; m.frequency = m.reach ? m.impressions / m.reach : 0;
  R.campaigns = []; R.daily = []; R.prev = null;
  debRegen();
};
const debRegen = debounce(()=>rpRefresh(true), 350);
window.rpCtx = function(){
  const R = RP.R; const g = id=>document.getElementById(id);
  R.ticket = g('rpTicket').value; R.close = g('rpClose').value; R.reason = g('rpReason').value; R.extraHighlights = g('rpExtra').value;
  R.opts = { showCompare: g('rpOptC').checked, showCampaigns: g('rpOptK').checked, showProjection: g('rpOptP').checked };
  debRegen();
};
window.rpText = function(){
  const g = id=>document.getElementById(id).value;
  RP.R.text = { headline:g('rpHeadline'), summary:g('rpSummary'), value:g('rpValue'), highlights:g('rpHigh'), next:g('rpNext') };
  rpDrawPreview();
};
window.rpRegen = async function(){
  if(!(await askConfirm('Gerar o texto de novo?', 'Suas edições nos campos de texto serão substituídas.', 'Gerar de novo'))) return;
  rpRefresh(true);
};

/* ---- Exportar PDF: abre uma página limpa e chama a impressão (Salvar como PDF) ---- */
window.rpPdf = function(){
  const R = RP.R; const c = clientById(R.clientId);
  const title = 'Informe ' + (c ? c.name : '') + ' ' + R.since + ' a ' + R.until;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>@page{size:A4;margin:14mm}html,body{margin:0;background:#fff}body{padding:0}${REPORT_CSS}.rp{max-width:780px;margin:0 auto;padding:18px}@media print{.rp{padding:0;max-width:none}.noprint{display:none}}
    .noprint{position:fixed;top:12px;right:12px}.noprint button{font:600 13px Inter,sans-serif;padding:9px 14px;border-radius:9px;border:0;background:#2F8F82;color:#fff;cursor:pointer}</style></head>
    <body><div class="noprint"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>${reportHtml(R)}</body></html>`;
  const w = window.open('', '_blank');
  if(!w){ downloadText('informe-' + R.since + '.html', html, 'text/html;charset=utf-8'); toast('O navegador bloqueou a janela. Baixei o arquivo: abra e use Imprimir > Salvar como PDF.', 'info'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){} }, 900);
};
window.rpCopyWa = function(){
  const R = RP.R; const m = R.m, f = n=>fmtCur(n, R.currency), res = resEs(m), cpr = safeDiv(m.spend, res.n);
  const lines = [`*Resultados ${periodEs(R.since, R.until)}*`, '', `• Inversión: ${f(m.spend)}`, `• Personas alcanzadas: ${fmtNum(m.reach)}`];
  if(res.n) lines.push(`• ${res.es.charAt(0).toUpperCase() + res.es.slice(1)}: ${fmtNum(res.n)}`, `• Costo por ${res.one}: ${f(cpr)}`);
  lines.push('', R.text.value.split('\n\n')[0] || '', '', 'Te envío el informe completo en PDF.');
  copyText(lines.join('\n'));
};
window.rpSave = async function(){
  const R = RP.R;
  const row = { clientId:R.clientId, periodStart:R.since, periodEnd:R.until, source:R.source,
    metrics:{ m:R.m, prev:R.prev, campaigns:R.campaigns, daily:R.daily, currency:R.currency },
    narrative:{ ...R.text, ticket:R.ticket, close:R.close, reason:R.reason, extra:R.extraHighlights, opts:R.opts } };
  try{
    if(R.savedId) await dbUpdate('client_reports', R.savedId, row); else { const d = await dbInsert('client_reports', row); R.savedId = d.id; }
    toast('Relatório salvo no histórico do cliente.', 'ok');
    const { data } = await sb.from('client_reports').select('*'); if(data) S.reports = data;
  }catch(_){}
};
