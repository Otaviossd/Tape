/* =====================================================================
   Tape Sistema 2.0 | Tape Lanza: painel por produto
   Receita, gasto em anúncios, outros custos, ganancia (lucro), comissão da
   Tape sobre a ganancia e etapas do funil, tudo dentro de cada lançamento.
   Valores só aparecem para quem tem acesso ao Financeiro.
   ===================================================================== */

const FUNNEL_DEFAULT = ['Alcance', 'Cliques', 'Leads', 'Conversas', 'Vendas'];
function termsOf(launchId){
  return S.launchTerms.find(t=>String(t.launchId) === String(launchId)) || { launchId, commissionPct:0, productPrice:0 };
}
function lanzaStats(l){
  const rows = S.lanzaEntries.filter(e=>String(e.launchId) === String(l.id));
  const sum = f=>rows.filter(f).reduce((a, e)=>a + (+e.amount || 0), 0);
  const income = sum(e=>e.type === 'income');
  const ads = sum(e=>e.type === 'expense' && e.category === 'anuncios');
  const other = sum(e=>e.type === 'expense' && e.category !== 'anuncios');
  const t = termsOf(l.id);
  const profit = income - ads - other;
  const commission = profit > 0 ? profit * (+t.commissionPct || 0) / 100 : 0;
  const sales = +t.productPrice > 0 ? income / t.productPrice : 0;
  return { rows, income, ads, other, profit, pct:+t.commissionPct || 0, price:+t.productPrice || 0, commission, clientNet: profit - commission,
    roas: safeDiv(income, ads), sales, cac: safeDiv(ads, sales) };
}

function renderLanzaPanel(l){
  const box = document.getElementById('lanzaPanelBox'); if(!box) return;
  const x = lanzaStats(l);
  const kpi = (label, val, sub, cls)=>`<div class="card stat-card"><div class="label">${label}</div><div class="value ${cls || ''}">${val}</div><div class="sub">${sub || ''}</div></div>`;
  box.innerHTML = `<div class="row-between" style="margin-bottom:8px"><div class="section-title" style="margin:0">Resultado financeiro</div>
      <div class="btn-row" style="margin:0"><button class="btn btn-outline btn-sm" onclick="openLanzaModal('${l.id}')">${icon('plus')}Registrar entrada ou gasto</button></div></div>
    ${schemaBanner('launch_terms')}
    <div class="card pad terms-bar">
      <label>Comissão da Tape sobre a ganancia <span class="inp-suf"><input type="number" min="0" max="100" step="0.5" value="${x.pct || ''}" placeholder="0" onchange="saveTerms('${l.id}','commissionPct',this.value)"><i>%</i></span></label>
      <label>Valor do produto <span class="inp-suf"><input type="number" min="0" step="1" value="${x.price || ''}" placeholder="0" onchange="saveTerms('${l.id}','productPrice',this.value)"><i>₲</i></span></label>
      <span class="muted-s">Ganancia = receita − anúncios − outros custos. A comissão só conta quando há ganancia.</span></div>
    <div class="grid grid-4" style="margin:12px 0">
      ${kpi('Receita', fmtMoney(x.income), x.sales ? '~' + fmtDec(x.sales, 0) + ' vendas estimadas' : 'entradas do lançamento', 'pos')}
      ${kpi('Anúncios', fmtMoney(x.ads), x.ads ? 'ROAS ' + fmtDec(x.roas, 2) + 'x' : 'sem gasto registrado')}
      ${kpi('Outros custos', fmtMoney(x.other), 'equipe, ferramentas, etc.')}
      ${kpi('Ganancia', fmtMoney(x.profit), x.income ? fmtPct(safeDiv(x.profit, x.income) * 100, 0) + ' da receita' : '', x.profit >= 0 ? 'pos' : 'neg')}
    </div>
    <div class="grid grid-3" style="margin-bottom:12px">
      ${kpi('Comissão da Tape (' + fmtDec(x.pct, x.pct % 1 ? 1 : 0) + '%)', fmtMoney(x.commission), x.pct ? 'sobre ' + fmtMoney(Math.max(0, x.profit)) : 'defina o % acima', 'pos')}
      ${kpi('Fica para o cliente', fmtMoney(x.clientNet), 'ganancia − comissão')}
      ${kpi('Custo por venda', x.sales ? fmtMoney(x.cac) : '-', x.sales ? 'anúncios ÷ vendas estimadas' : 'informe o valor do produto')}
    </div>
    ${x.rows.length ? renderLanzaTable(x.rows) : emptyBox('Sem lançamentos financeiros', 'Registre as entradas (vendas) e os gastos (categoria Anúncios para o ROAS) deste produto.')}`;
}
window.saveTerms = async function(launchId, field, value){
  const cur = termsOf(launchId);
  const row = { launchId: String(launchId), commissionPct: +cur.commissionPct || 0, productPrice: +cur.productPrice || 0, updatedAt: new Date().toISOString() };
  row[field] = Math.max(0, parseFloat(value) || 0);
  if(field === 'commissionPct') row[field] = Math.min(100, row[field]);
  const { error } = await sb.from('launch_terms').upsert(row, { onConflict:'launchId' });
  if(error){ toast('Não consegui salvar: ' + error.message, 'error'); return; }
  const i = S.launchTerms.findIndex(t=>String(t.launchId) === String(launchId));
  if(i >= 0) S.launchTerms[i] = { ...S.launchTerms[i], ...row }; else S.launchTerms.push(row);
  const l = S.launches.find(x=>x.id === launchId); if(l) renderLanzaPanel(l);
  toast('Salvo.', 'ok');
};

/* ---- Categoria do gasto no formulário ---- */
function syncLanzaCat(){
  const isExp = document.getElementById('lType').value === 'expense';
  document.getElementById('lCatField').style.display = isExp ? '' : 'none';
}
document.getElementById('lType').addEventListener('change', syncLanzaCat);

/* ---- Funil (sem valores; custo por etapa só aparece para quem vê dinheiro) ---- */
function funnelOf(l){ return Array.isArray(l.funnel) ? l.funnel : []; }
function renderFunnelBlock(l){
  const st = funnelOf(l);
  if(!st.length) return `<div class="section-title">Funil do lançamento</div><div class="card pad empty-cta"><b>Monte as etapas do funil</b><p>Acompanhe quantas pessoas chegam em cada etapa, a taxa de passagem e (no financeiro) o custo por etapa.</p>
    <button class="btn btn-primary btn-sm" onclick="funnelTemplate('${l.id}')">Usar etapas padrão</button></div>`;
  const first = Math.max(+st[0].count || 0, 1);
  const ads = canSeeMoney() ? lanzaStats(l).ads : 0;
  return `<div class="row-between" style="margin-bottom:8px"><div class="section-title" style="margin:0">Funil do lançamento</div><button class="btn btn-outline btn-sm" onclick="funnelAdd('${l.id}')">${icon('plus')}Etapa</button></div>
    <div class="card pad funnel">${st.map((s, i)=>{
      const n = +s.count || 0, prev = i ? (+st[i - 1].count || 0) : 0;
      return `<div class="fn-row">
        <input class="fn-name" value="${escapeHtml(s.name)}" maxlength="30" onchange="funnelEdit('${l.id}',${i},'name',this.value)" aria-label="Nome da etapa">
        <div class="fn-bar"><i style="width:${Math.max(2, Math.round(n / first * 100))}%"></i></div>
        <input class="fn-count" type="number" min="0" value="${n || ''}" placeholder="0" onchange="funnelEdit('${l.id}',${i},'count',this.value)" aria-label="Quantidade">
        <span class="fn-rate">${i ? (prev ? fmtPct(n / prev * 100, 1) : '-') : '100%'}</span>
        <span class="fn-cost">${ads && n ? fmtMoney(ads / n) : ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="funnelDel('${l.id}',${i})" aria-label="Remover etapa">${icon('x', 14)}</button></div>`; }).join('')}
      <div class="fn-head"><span></span><span></span><span>Pessoas</span><span>Passagem</span><span>${ads ? 'Custo por pessoa' : ''}</span><span></span></div>
    </div>`;
}
async function funnelSave(id, arr){
  const l = S.launches.find(x=>x.id === id); if(!l) return;
  l.funnel = arr;
  const box = document.getElementById('funnelBox'); if(box) box.innerHTML = renderFunnelBlock(l);
  try{ await dbUpdate('launches', id, { funnel: arr }); }catch(_){}
}
window.funnelTemplate = function(id){ funnelSave(id, FUNNEL_DEFAULT.map(n=>({ name:n, count:0 }))); };
window.funnelAdd = function(id){ const l = S.launches.find(x=>x.id === id); funnelSave(id, [...funnelOf(l), { name:'Nova etapa', count:0 }]); };
window.funnelDel = function(id, i){ const l = S.launches.find(x=>x.id === id); const a = [...funnelOf(l)]; a.splice(i, 1); funnelSave(id, a); };
window.funnelEdit = function(id, i, f, v){
  const l = S.launches.find(x=>x.id === id); const a = funnelOf(l).map(x=>({ ...x }));
  a[i][f] = f === 'count' ? Math.max(0, parseInt(v, 10) || 0) : String(v).trim().slice(0, 30);
  funnelSave(id, a);
};

/* ---- Financeiro > Tape Lanza: resumo por produto + todos os lançamentos ---- */
function renderFinanceLanza(body){
  fillLaunchSelect();
  const per = S.launches.map(l=>({ l, x: lanzaStats(l) }));
  const gen = S.lanzaEntries.filter(e=>!e.launchId || !S.launches.some(l=>l.id === e.launchId));
  const tot = per.reduce((a, p)=>({ income:a.income + p.x.income, ads:a.ads + p.x.ads, profit:a.profit + p.x.profit, commission:a.commission + p.x.commission }), { income:0, ads:0, profit:0, commission:0 });
  body.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Receita dos lançamentos</div><div class="value pos">${fmtMoney(tot.income)}</div></div>
      <div class="card stat-card"><div class="label">Anúncios</div><div class="value">${fmtMoney(tot.ads)}</div><div class="sub">${tot.ads ? 'ROAS geral ' + fmtDec(safeDiv(tot.income, tot.ads), 2) + 'x' : ''}</div></div>
      <div class="card stat-card"><div class="label">Ganancia</div><div class="value ${tot.profit >= 0 ? 'pos' : 'neg'}">${fmtMoney(tot.profit)}</div></div>
      <div class="card stat-card"><div class="label">Comissão da Tape</div><div class="value pos">${fmtMoney(tot.commission)}</div><div class="sub">soma dos produtos</div></div>
    </div>
    <div class="section-title" style="margin-top:0">Por produto</div>
    <div class="card table-card"><table class="tbl"><thead><tr><th>Produto</th><th class="r">Receita</th><th class="r">Anúncios</th><th class="r">Outros</th><th class="r">Ganancia</th><th class="r">Comissão</th><th></th></tr></thead><tbody>
      ${per.length ? per.map(p=>`<tr><td><b>${escapeHtml(p.l.name)}</b><br><span class="muted-s">${escapeHtml(LAUNCH_STATUS_LABEL[p.l.status] || '')}${p.x.pct ? ' · ' + fmtDec(p.x.pct, p.x.pct % 1 ? 1 : 0) + '% de comissão' : ' · sem comissão definida'}</span></td>
        <td class="r">${fmtMoney(p.x.income)}</td><td class="r">${fmtMoney(p.x.ads)}</td><td class="r">${fmtMoney(p.x.other)}</td>
        <td class="r ${p.x.profit >= 0 ? 'amount-in' : 'amount-out'}">${fmtMoney(p.x.profit)}</td><td class="r"><b>${fmtMoney(p.x.commission)}</b></td>
        <td class="r"><button class="btn btn-ghost btn-sm" onclick="currentLaunchIdShared='${p.l.id}';goTab('lancamentos')">Abrir</button></td></tr>`).join('') : `<tr><td colspan="7">${emptyBox('Nenhum lançamento cadastrado', 'Crie em Lançamentos.')}</td></tr>`}
    </tbody></table></div>
    <div class="view-head" style="margin:22px 0 12px"><div><b>Todos os lançamentos financeiros</b>${gen.length ? `<span class="muted-s"> · ${gen.length} sem produto definido</span>` : ''}</div>
      <button class="btn btn-primary btn-sm" onclick="openLanzaModal()">${icon('plus')}Novo lançamento financeiro</button></div>
    ${renderLanzaTable(S.lanzaEntries)}`;
}
