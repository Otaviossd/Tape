/* =====================================================================
   Tape Sistema 2.0 | painel de tráfego pago (Meta Ads)
   Acompanhe todos os clientes com anúncios sem abrir a Meta de cada um.
   Os números vêm pelo servidor (/api/meta); o token da Meta nunca chega aqui.
   ===================================================================== */

const TR = { cache:{}, inflight:{}, preset:'30d', since:null, until:null, status:null, expanded:null };

function periodFromPreset(p){
  const today = localToday();
  if(p === '7d') return { since: addDaysISO(today, -6), until: today };
  if(p === '30d') return { since: addDaysISO(today, -29), until: today };
  if(p === 'mes') return { since: today.slice(0, 8) + '01', until: today };
  if(p === 'mespass'){ const first = addMonthsISO(today.slice(0, 8) + '01', -1); return { since: first, until: addDaysISO(today.slice(0, 8) + '01', -1) }; }
  return null;
}
function trInitPeriod(){ if(!TR.since){ const p = periodFromPreset(TR.preset); TR.since = p.since; TR.until = p.until; } }
function prevPeriod(since, until){ const n = diffDays(since, until) + 1; return { since: addDaysISO(since, -n), until: addDaysISO(since, -1) }; }
function periodLabel(since, until){ return fmtDate(since) + ' a ' + fmtDate(until); }

function trKey(id, s, u){ return id + '|' + s + '|' + u; }
function fetchMeta(clientId, since, until){
  const key = trKey(clientId, since, until);
  if(TR.cache[key] && Date.now() - TR.cache[key].at < 5 * 60 * 1000) return Promise.resolve(TR.cache[key].data);
  if(TR.inflight[key]) return TR.inflight[key];
  const p = apiCall('meta', { clientId, since, until }).then(d=>{ TR.cache[key] = { at: Date.now(), data: d }; return d; })
    .finally(()=>{ delete TR.inflight[key]; });
  TR.inflight[key] = p; return p;
}
function trClearCache(){ TR.cache = {}; }

/* Resultado principal: mensagens > contatos > vendas > cliques */
function mainResult(m){
  if(m.messages > 0) return { n:m.messages, one:'conversa', many:'conversas', es:'conversaciones' };
  if(m.leads > 0) return { n:m.leads, one:'contato', many:'contatos', es:'contactos' };
  if(m.purchases > 0) return { n:m.purchases, one:'venda', many:'vendas', es:'ventas' };
  return { n:m.linkClicks || m.clicks || 0, one:'clique', many:'cliques', es:'clics' };
}
function deltaHtml(cur, prev, invert){
  if(!(prev > 0)) return '<span class="delta muted">sem base</span>';
  const d = (cur - prev) / prev * 100;
  if(Math.abs(d) < 0.5) return '<span class="delta muted">= igual</span>';
  const good = invert ? d < 0 : d > 0;
  return `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}%</span>`;
}

/* ---- Visão geral ---- */
function trafficClients(){
  return S.clients.filter(c=>c.status !== 'encerrado' && (hasService(c, 'trafego') || c.metaAccountId));
}
function renderTraffic(){
  trInitPeriod();
  const box = document.getElementById('trafficBody');
  const cl = trafficClients();
  box.innerHTML = `
    <div class="view-head"><div><h1>Tráfego pago</h1><p>Números de todos os clientes com anúncios, num lugar só.</p></div>
      <div class="period-bar">${periodBarHtml()}<button class="btn btn-outline" onclick="trRefresh()">${icon('refresh')}Atualizar</button></div></div>
    <div id="trStatus"></div>
    <div class="card table-card"><table class="tbl tr-tbl"><thead><tr><th>Cliente</th><th class="r">Investimento</th><th class="r">Resultado</th><th class="r">Custo por resultado</th><th class="r">Alcance</th><th class="r">CTR</th><th>Evolução</th><th></th></tr></thead>
    <tbody id="trRows">${cl.length ? cl.map(c=>`<tr id="tr-${c.id}"><td><span class="client-dot" style="background:${c.color || '#999'}"></span> <b>${escapeHtml(c.name)}</b></td><td colspan="6" class="muted-s">${c.metaAccountId ? 'Carregando…' : 'Sem conta de anúncios cadastrada.'}</td><td class="r"></td></tr>`).join('')
      : `<tr><td colspan="8">${emptyBox('Nenhum cliente com tráfego pago', 'Marque "Tráfego pago" no cadastro do cliente e informe o ID da conta de anúncios.')}</td></tr>`}</tbody></table></div>
    <div id="trTotals"></div>
    <p class="muted-s" style="margin-top:12px">Resultado = conversas iniciadas; se a campanha não gera conversas, usa contatos, vendas ou cliques. Variação compara com o período anterior de mesmo tamanho.</p>`;
  bindPeriodBar();
  loadTrafficRows(cl);
}
function periodBarHtml(){
  const presets = [['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['mespass', 'Mês passado'], ['custom', 'Outro']];
  return `<div class="seg" role="group" aria-label="Período">${presets.map(p=>`<button class="${TR.preset === p[0] ? 'on' : ''}" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>
    <div class="dates ${TR.preset === 'custom' ? '' : 'hide'}"><input type="date" id="trSince" value="${TR.since}" max="${localToday()}"><span>até</span><input type="date" id="trUntil" value="${TR.until}" max="${localToday()}"></div>`;
}
function bindPeriodBar(){
  document.querySelectorAll('.period-bar .seg button').forEach(b=>b.addEventListener('click', ()=>{
    const p = b.dataset.p; TR.preset = p;
    if(p !== 'custom'){ const r = periodFromPreset(p); TR.since = r.since; TR.until = r.until; }
    rerenderTrafficView();
  }));
  ['trSince', 'trUntil'].forEach(id=>{ const el = document.getElementById(id); if(el) el.addEventListener('change', ()=>{
    const s = document.getElementById('trSince').value, u = document.getElementById('trUntil').value;
    if(s && u && s <= u){ TR.since = s; TR.until = u; rerenderTrafficView(); } else toast('Confira as datas do período.', 'error');
  }); });
}
function rerenderTrafficView(){ if(currentTab === 'trafego') renderTraffic(); else if(currentTab === 'cliente') renderClientFicha(); }
window.trRefresh = function(){ trClearCache(); rerenderTrafficView(); };

function trShowStatus(err){
  const el = document.getElementById('trStatus'); if(!el || !err) return;
  if(err.code === 'not_configured' || err.status === 503) el.innerHTML = `<div class="banner warn"><b>Conexão com a Meta ainda não configurada.</b> Cadastre o token na Vercel (variável <code>META_ACCESS_TOKEN</code>) e faça um novo deploy. Enquanto isso, dá para gerar relatórios digitando os números manualmente.</div>`;
  else if(err.status === 401) el.innerHTML = `<div class="banner warn">Sessão expirada. Entre de novo.</div>`;
  else if(err.status === 404) el.innerHTML = `<div class="banner warn"><b>Rota de tráfego não encontrada.</b> O servidor (/api) ainda não está publicado neste endereço.</div>`;
}
async function loadTrafficRows(cl){
  const prev = prevPeriod(TR.since, TR.until);
  const queue = cl.filter(c=>c.metaAccountId);
  let idx = 0; const totals = {}; let anyData = false;
  const work = async ()=>{
    while(idx < queue.length){
      const c = queue[idx++]; const row = document.getElementById('tr-' + c.id); if(!row) continue;
      try{
        const [cur, old] = await Promise.all([fetchMeta(c.id, TR.since, TR.until), fetchMeta(c.id, prev.since, prev.until).catch(()=>null)]);
        const m = cur.totals, r = mainResult(m), cpr = safeDiv(m.spend, r.n);
        const om = old && old.totals, or = om ? mainResult(om) : null, ocpr = om ? safeDiv(om.spend, or.n) : 0;
        const cur$ = cur.account.currency || 'PYG';
        const t = totals[cur$] = totals[cur$] || { spend:0, n:0, reach:0 }; t.spend += m.spend; t.n += r.n; t.reach += m.reach; anyData = true;
        row.innerHTML = `<td><span class="client-dot" style="background:${c.color || '#999'}"></span> <b>${escapeHtml(c.name)}</b></td>
          <td class="r">${fmtCur(m.spend, cur$)}<br>${om ? deltaHtml(m.spend, om.spend, false) : ''}</td>
          <td class="r"><b>${fmtNum(r.n)}</b> <small>${r.many}</small><br>${or ? deltaHtml(r.n, or.n, false) : ''}</td>
          <td class="r">${r.n ? fmtCur(cpr, cur$) : '-'}<br>${or && r.n ? deltaHtml(cpr, ocpr, true) : ''}</td>
          <td class="r">${fmtNum(m.reach)}</td><td class="r">${fmtPct(m.ctr, 2)}</td>
          <td>${sparkSvg(cur.daily.map(d=>mainResult(d).n))}</td>
          <td class="r nowrap"><button class="btn btn-outline btn-sm" onclick="goTab('cliente',{id:'${c.id}',sub:'trafego'})">Detalhes</button> <button class="btn btn-primary btn-sm" onclick="openReportBuilder('${c.id}')">Relatório</button></td>`;
      }catch(err){
        trShowStatus(err);
        row.innerHTML = `<td><span class="client-dot" style="background:${c.color || '#999'}"></span> <b>${escapeHtml(c.name)}</b></td><td colspan="6" class="muted-s">${escapeHtml(err.code === 'no_account' ? 'Sem conta de anúncios.' : err.message || 'Erro ao buscar')}</td><td class="r"><button class="btn btn-outline btn-sm" onclick="openReportBuilder('${c.id}')">Relatório manual</button></td>`;
      }
    }
  };
  await Promise.all([work(), work(), work()]);
  cl.filter(c=>!c.metaAccountId).forEach(c=>{ const row = document.getElementById('tr-' + c.id); if(row) row.innerHTML = `<td><span class="client-dot" style="background:${c.color || '#999'}"></span> <b>${escapeHtml(c.name)}</b></td><td colspan="6" class="muted-s">Sem conta de anúncios cadastrada.</td><td class="r nowrap"><button class="btn btn-outline btn-sm" onclick="editClient('${c.id}')">Cadastrar conta</button> <button class="btn btn-ghost btn-sm" onclick="openReportBuilder('${c.id}')">Relatório manual</button></td>`; });
  const tEl = document.getElementById('trTotals');
  if(tEl && anyData){
    tEl.innerHTML = Object.entries(totals).map(([cur, t])=>`<div class="card pad totals-bar"><b>Total ${cur}</b><span>Investimento <b>${fmtCur(t.spend, cur)}</b></span><span>Resultados <b>${fmtNum(t.n)}</b></span><span>Custo médio <b>${t.n ? fmtCur(t.spend / t.n, cur) : '-'}</b></span><span>Alcance somado <b>${fmtNum(t.reach)}</b></span></div>`).join('');
  }
}
function sparkSvg(vals){
  if(!vals || vals.length < 2) return '';
  const max = Math.max(...vals, 1); const w = 90, h = 26;
  const pts = vals.map((v, i)=>`${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - v / max * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* ---- Painel dentro da ficha do cliente ---- */
function renderClientTrafficPanel(c){
  trInitPeriod();
  const reports = S.reports.filter(r=>String(r.clientId) === String(c.id)).sort((a, b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return `<div class="row-between" style="margin-bottom:12px;flex-wrap:wrap;gap:10px"><div class="period-bar">${periodBarHtml()}</div>
      <div class="btn-row" style="margin:0"><button class="btn btn-outline btn-sm" onclick="trRefresh()">${icon('refresh')}Atualizar</button><button class="btn btn-primary btn-sm" onclick="openReportBuilder('${c.id}')">${icon('file')}Gerar relatório</button></div></div>
    <div id="trStatus"></div>
    ${!c.metaAccountId ? `<div class="banner warn">Este cliente não tem conta de anúncios cadastrada. <a href="#" onclick="event.preventDefault();editClient('${c.id}')">Cadastrar agora</a>. Você ainda pode gerar o relatório com números digitados.</div>` : '<div id="ctBody">' + skeleton(4) + '</div>'}
    <div class="section-title">Relatórios salvos</div>
    <div class="card" style="padding:4px 0">${schemaBanner('client_reports')}${reports.length ? reports.map(r=>`<div class="pend-row" style="cursor:default"><div class="pend-body"><div class="pend-title">${periodLabel(r.periodStart, r.periodEnd)}</div><div class="pend-sub">${r.source === 'manual' ? 'Números digitados' : 'Dados da Meta'} · salvo em ${fmtDate(String(r.createdAt).slice(0, 10))}</div></div>
      <button class="btn btn-outline btn-sm" onclick="openSavedReport('${r.id}')">Abrir</button><button class="btn btn-ghost btn-sm" onclick="deleteSavedReport('${r.id}')">${icon('trash')}</button></div>`).join('') : emptyBox('Nenhum relatório salvo', 'Gere um relatório e clique em "Salvar" para guardar o histórico.')}</div>`;
}
async function mountClientTraffic(c){
  bindPeriodBar();
  if(!c.metaAccountId) return;
  const el = document.getElementById('ctBody'); if(!el) return;
  const prev = prevPeriod(TR.since, TR.until);
  try{
    const [cur, old] = await Promise.all([fetchMeta(c.id, TR.since, TR.until), fetchMeta(c.id, prev.since, prev.until).catch(()=>null)]);
    if(!document.getElementById('ctBody')) return;
    const m = cur.totals, om = old && old.totals, cu = cur.account.currency || 'PYG';
    const r = mainResult(m), or = om ? mainResult(om) : null, cpr = safeDiv(m.spend, r.n), ocpr = om ? safeDiv(om.spend, or.n) : 0;
    const kpi = (label, val, d, sub)=>`<div class="card stat-card"><div class="label">${label}</div><div class="value">${val}</div><div class="sub">${d || ''} ${sub || ''}</div></div>`;
    el.innerHTML = `<div class="grid grid-4" style="margin-bottom:14px">
      ${kpi('Investimento', fmtCur(m.spend, cu), om ? deltaHtml(m.spend, om.spend, false) : '', 'vs. período anterior')}
      ${kpi('Resultados (' + r.many + ')', fmtNum(r.n), or ? deltaHtml(r.n, or.n, false) : '', '')}
      ${kpi('Custo por ' + r.one, r.n ? fmtCur(cpr, cu) : '-', or && r.n ? deltaHtml(cpr, ocpr, true) : '', '')}
      ${kpi('Alcance', fmtNum(m.reach), om ? deltaHtml(m.reach, om.reach, false) : '', 'pessoas')}
      ${kpi('Cliques no link', fmtNum(m.linkClicks || m.clicks), om ? deltaHtml(m.linkClicks || m.clicks, om.linkClicks || om.clicks, false) : '', '')}
      ${kpi('CTR', fmtPct(m.ctr, 2), '', 'cliques por impressão')}
      ${kpi('CPM', fmtCur(m.cpm, cu), om ? deltaHtml(m.cpm, om.cpm, true) : '', 'por mil impressões')}
      ${kpi('Frequência', fmtDec(m.frequency, 2), '', 'vezes por pessoa')}</div>
      <div class="card pad"><div class="card-h">${icon('chart')}Por dia</div>${dailyChartSvg(cur.daily, cu)}</div>
      <div class="section-title">Campanhas</div>
      <div class="card table-card"><table class="tbl"><thead><tr><th>Campanha</th><th class="r">Investimento</th><th class="r">Resultados</th><th class="r">Custo</th><th class="r">Alcance</th><th class="r">CTR</th></tr></thead><tbody>
      ${cur.campaigns.length ? cur.campaigns.map(k=>{ const kr = mainResult(k); return `<tr><td>${escapeHtml(k.name)}</td><td class="r">${fmtCur(k.spend, cu)}</td><td class="r">${fmtNum(kr.n)}</td><td class="r">${kr.n ? fmtCur(safeDiv(k.spend, kr.n), cu) : '-'}</td><td class="r">${fmtNum(k.reach)}</td><td class="r">${fmtPct(k.ctr, 2)}</td></tr>`; }).join('') : `<tr><td colspan="6">${emptyBox('Sem campanhas com gasto neste período', '')}</td></tr>`}
      </tbody></table></div>`;
  }catch(err){
    trShowStatus(err);
    el.innerHTML = `<div class="banner warn">${escapeHtml(err.message || 'Não consegui buscar os números.')}</div>`;
  }
}
function dailyChartSvg(daily, cu){
  if(!daily || !daily.length) return emptyBox('Sem dados por dia', '');
  const W = 720, H = 170, pad = 28; const n = daily.length;
  const maxS = Math.max(...daily.map(d=>d.spend), 1), maxR = Math.max(...daily.map(d=>mainResult(d).n), 1);
  const bw = Math.max(2, (W - pad * 2) / n - 2);
  const bars = daily.map((d, i)=>{ const x = pad + i * ((W - pad * 2) / n); const h = d.spend / maxS * (H - pad * 1.6); return `<rect x="${x.toFixed(1)}" y="${(H - pad - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="var(--teal-lt2)"><title>${fmtDM(d.date)}: ${fmtCur(d.spend, cu)}</title></rect>`; }).join('');
  const pts = daily.map((d, i)=>`${(pad + i * ((W - pad * 2) / n) + bw / 2).toFixed(1)},${(H - pad - mainResult(d).n / maxR * (H - pad * 1.6)).toFixed(1)}`).join(' ');
  const labels = [0, Math.floor(n / 2), n - 1].filter((v, i, a)=>a.indexOf(v) === i).map(i=>`<text x="${(pad + i * ((W - pad * 2) / n)).toFixed(1)}" y="${H - 8}" font-size="10" fill="var(--muted)">${fmtDM(daily[i].date)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Investimento e resultados por dia">${bars}<polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="2.2" stroke-linejoin="round"/>${labels}</svg>
    <div class="legend"><span><b class="bar"></b>Investimento por dia</span><span><b class="line"></b>Resultados por dia</span></div>`;
}

window.deleteSavedReport = async function(id){
  if(!(await askConfirm('Apagar este relatório salvo?', '', 'Apagar', true))) return;
  try{ await dbDelete('client_reports', id); S.reports = S.reports.filter(r=>r.id !== id); safeRender(); toast('Relatório apagado.', 'ok'); }catch(_){}
};
