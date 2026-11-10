/* =====================================================================
   Tape Sistema 2.0 | financeiro por cliente: cobrado, recebido, em aberto
   Cobrança do mês = valor do contrato. Pagamento conta no mês de referência
   (chargeMonth) ou, se vazio, no mês da data em que caiu.
   ===================================================================== */

function daysInMonth(ym){ const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function dueDateOf(k, ym){ const d = Math.min(+k.billingDay || 1, daysInMonth(ym)); return ym + '-' + String(d).padStart(2, '0'); }
const WAIVED = 'Dispensado';

function clientCharges(clientId){
  const k = contractOf(clientId); if(!k) return [];
  const today = localToday(); const nowYm = ymNow();
  const startYm = ymOf(k.startDate);
  let lastYm = nowYm;
  if((k.status === 'encerrado' || k.status === 'em_aviso') && k.endDate && ymOf(k.endDate) < lastYm) lastYm = ymOf(k.endDate);
  const nextYm = ymAdd(nowYm, 1);
  if(k.status !== 'encerrado' && lastYm === nowYm && diffDays(today, dueDateOf(k, nextYm)) <= 7) lastYm = nextYm;
  const entries = S.financeEntries.filter(e=>String(e.clientId) === String(clientId));
  const out = [];
  for(let ym = startYm, g = 0; ym <= lastYm && g < 240; ym = ymAdd(ym, 1), g++){
    const mine = entries.filter(e=>(e.chargeMonth || ymOf(e.date)) === ym);
    const waived = mine.some(e=>e.category === WAIVED);
    const received = mine.filter(e=>e.category !== WAIVED).reduce((a, e)=>a + (+e.amount || 0), 0);
    const charged = +k.monthlyValue || 0;
    const due = dueDateOf(k, ym);
    const dd = diffDays(today, due);
    let status;
    if(waived) status = 'dispensado';
    else if(charged > 0 && received >= charged - 0.5) status = 'pago';
    else if(dd < 0) status = received > 0 ? 'parcial_atrasado' : 'atrasado';
    else if(dd <= 5) status = 'vence';
    else status = received > 0 ? 'parcial' : 'futuro';
    out.push({ ym, due, charged, received, open: waived ? 0 : Math.max(0, charged - received), status, daysToDue: dd, waived });
  }
  return out;
}
const CHARGE_UI = {
  pago:{ t:'Pago', k:'ok' }, dispensado:{ t:'Dispensado', k:'muted' }, atrasado:{ t:'Atrasado', k:'danger' },
  parcial_atrasado:{ t:'Parcial, atrasado', k:'danger' }, vence:{ t:'Vence em breve', k:'warn' },
  parcial:{ t:'Parcial', k:'warn' }, futuro:{ t:'A vencer', k:'muted' },
};

/* Alertas para a tela inicial: no máximo um por cliente */
function clientFinanceAlerts(){
  const out = []; const lookFrom = ymAdd(ymNow(), -3);
  S.clients.forEach(c=>{
    const k = contractOf(c.id); if(!k || k.status === 'encerrado' || !(+k.monthlyValue > 0)) return;
    const ch = clientCharges(c.id).filter(x=>x.ym >= lookFrom);
    const late = ch.filter(x=>['atrasado', 'parcial_atrasado'].includes(x.status));
    if(late.length){
      const total = late.reduce((a, x)=>a + x.open, 0);
      const days = Math.abs(Math.min(...late.map(x=>x.daysToDue)));
      out.push({ clientId:c.id, level: days > 7 ? 'urgent' : 'soon', text: late.length > 1 ? late.length + ' parcelas atrasadas' : 'parcela de ' + ymLabelShort(late[0].ym) + ' atrasada', sub: fmtMoney(total) + ' em aberto, há ' + days + ' dias' });
      return;
    }
    const soon = ch.find(x=>x.status === 'vence');
    if(soon) out.push({ clientId:c.id, level:'soon', text:'cobrança ' + daysText(soon.daysToDue), sub: fmtMoney(soon.open) + ' vence em ' + fmtDM(soon.due) });
  });
  return out;
}

function renderClientFinancePanel(clientId){
  if(!canSeeMoney()) return emptyBox('Área restrita', 'Só quem tem acesso ao Financeiro vê valores.');
  const k = contractOf(clientId);
  if(!k) return `<div class="card pad empty-cta"><b>Cadastre o contrato para acompanhar as cobranças</b><p>O valor mensal e o dia de cobrança vêm do contrato.</p>
    <button class="btn btn-primary" onclick="goTab('cliente',{id:'${clientId}',sub:'contrato'})">Ir para o contrato</button></div>`;
  const ch = clientCharges(clientId);
  const due = ch.filter(x=>x.daysToDue <= 0 || x.ym <= ymNow());       // já exigíveis
  const charged = due.reduce((a, x)=>a + (x.status === 'dispensado' ? 0 : x.charged), 0);
  const received = ch.reduce((a, x)=>a + x.received, 0);
  const open = ch.filter(x=>['atrasado', 'parcial_atrasado'].includes(x.status)).reduce((a, x)=>a + x.open, 0);
  const next = ch.find(x=>['vence', 'futuro', 'parcial'].includes(x.status));
  const entries = S.financeEntries.filter(e=>String(e.clientId) === String(clientId)).sort((a, b)=>String(b.date).localeCompare(String(a.date)));
  return `<div class="grid grid-4" style="margin-bottom:16px">
      <div class="card stat-card"><div class="label">Cobrado até agora</div><div class="value">${fmtMoney(charged)}</div><div class="sub">${due.length} mês${due.length === 1 ? '' : 'es'} de contrato</div></div>
      <div class="card stat-card"><div class="label">Recebido</div><div class="value" style="color:var(--ok)">${fmtMoney(received)}</div><div class="sub">${entries.filter(e=>e.category !== WAIVED).length} pagamento(s)</div></div>
      <div class="card stat-card"><div class="label">Em aberto (vencido)</div><div class="value" style="color:${open > 0 ? 'var(--danger)' : 'var(--ok)'}">${fmtMoney(open)}</div><div class="sub">${open > 0 ? 'precisa de cobrança' : 'nada vencido'}</div></div>
      <div class="card stat-card"><div class="label">Próxima cobrança</div><div class="value">${next ? fmtDM(next.due) : '-'}</div><div class="sub">${next ? fmtMoney(next.open) + ' · ' + daysText(next.daysToDue) : 'sem cobranças futuras'}</div></div>
    </div>
    <div class="row-between" style="margin-bottom:8px"><div class="section-title" style="margin:0">Parcelas mensais</div>
      <button class="btn btn-primary btn-sm" onclick="openFinanceModal('${clientId}')">${icon('plus')}Registrar pagamento</button></div>
    <div class="card table-card"><table class="tbl"><thead><tr><th>Mês</th><th>Vencimento</th><th class="r">Cobrado</th><th class="r">Recebido</th><th class="r">Em aberto</th><th>Situação</th><th></th></tr></thead><tbody>
    ${[...ch].reverse().map(x=>{ const u = CHARGE_UI[x.status];
      return `<tr><td><b>${ymLabel(x.ym)}</b></td><td>${fmtDate(x.due)}</td><td class="r">${fmtMoney(x.charged)}</td><td class="r">${fmtMoney(x.received)}</td>
        <td class="r">${x.open > 0 ? fmtMoney(x.open) : '-'}</td><td>${badge(u.t, u.k)}</td>
        <td class="r">${['pago', 'dispensado'].includes(x.status) ? '' : `<button class="btn btn-outline btn-sm" onclick="openFinanceModal('${clientId}','${x.ym}',${Math.round(x.open)})">Registrar</button> <button class="btn btn-ghost btn-sm" title="Não cobrar este mês" onclick="waiveMonth('${clientId}','${x.ym}')">Dispensar</button>`}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="section-title">Pagamentos registrados</div>
    <div class="card table-card"><table class="tbl"><thead><tr><th>Data</th><th>Referente a</th><th>Categoria</th><th class="r">Valor</th><th></th></tr></thead><tbody>
    ${entries.length ? entries.map(e=>`<tr><td>${fmtDate(e.date)}</td><td>${ymLabelShort(e.chargeMonth || ymOf(e.date))}</td><td>${escapeHtml(e.category || '-')}${e.method ? ' · ' + escapeHtml(e.method) : ''}</td>
      <td class="r amount-in">${fmtMoney(e.amount)}</td><td class="r">${e.receiptLink ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(e.receiptLink)}" target="_blank" rel="noopener">${icon('folder')}</a>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="editFinanceEntry('${e.id}')">${icon('edit')}</button><button class="btn btn-ghost btn-sm" onclick="deleteFinanceEntry('${e.id}')">${icon('trash')}</button></td></tr>`).join('') : `<tr><td colspan="5">${emptyBox('Nenhum pagamento ainda', '')}</td></tr>`}
    </tbody></table></div>`;
}
window.waiveMonth = async function(clientId, ym){
  if(!(await askConfirm('Dispensar ' + ymLabel(ym) + '?', 'O mês deixa de contar como cobrança em aberto (ex.: mês de cortesia ou acerto antigo).', 'Dispensar'))) return;
  await dbInsert('finance_entries', { clientId, amount:0, date:localToday(), category:WAIVED, chargeMonth:ym, note:'Mês dispensado' });
};

/* ---- Aba Financeiro > Cobranças (todos os clientes) ---- */
function renderFinanceCobrancas(body){
  const today = localToday(); const nowYm = ymNow();
  const live = S.clients.filter(c=>{ const k = contractOf(c.id); return k && k.status !== 'encerrado' && c.status !== 'encerrado'; });
  const rows = live.map(c=>{ const ch = clientCharges(c.id); const cur = ch.find(x=>x.ym === nowYm) || ch[ch.length - 1];
    const lateOpen = ch.filter(x=>['atrasado', 'parcial_atrasado'].includes(x.status)).reduce((a, x)=>a + x.open, 0);
    return { c, k: contractOf(c.id), cur, lateOpen }; });
  const totalMonth = rows.reduce((a, r)=>a + (r.cur ? r.cur.charged : 0), 0);
  const recMonth = rows.reduce((a, r)=>a + (r.cur ? r.cur.received : 0), 0);
  const lateTotal = rows.reduce((a, r)=>a + r.lateOpen, 0);
  const fixed = S.fixedExpenses.reduce((a, x)=>a + (+x.amount || 0), 0);
  const order = { atrasado:0, parcial_atrasado:0, vence:1, parcial:2, futuro:3, pago:4, dispensado:5 };
  rows.sort((a, b)=>(order[a.cur ? a.cur.status : 'futuro']) - (order[b.cur ? b.cur.status : 'futuro']));
  const fixedRows = [...S.fixedExpenses].sort((a, b)=>(a.dayOfMonth || 99) - (b.dayOfMonth || 99)).map(x=>{
    const day = x.dayOfMonth; const t = new Date().getDate();
    const st = !day ? badge('Sem dia', 'muted') : day === t ? badge('Vence hoje', 'danger') : day < t ? badge('Já venceu', 'warn') : badge('Dia ' + day, 'muted');
    return `<div class="cobranca-row"><span class="client-dot" style="background:#999"></span><div class="cobranca-info"><b>${escapeHtml(x.name)}</b><span>${escapeHtml(x.category || 'Sem categoria')} · ${fmtMoney(x.amount)}</span></div>${st}</div>`;
  }).join('');
  body.innerHTML = schemaBanner('contracts') + `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Cobrado em ${MONTHS[new Date().getMonth()].toLowerCase()}</div><div class="value">${fmtMoney(totalMonth)}</div><div class="sub">${live.length} contrato${live.length === 1 ? '' : 's'} vigente${live.length === 1 ? '' : 's'}</div></div>
      <div class="card stat-card"><div class="label">Recebido no mês</div><div class="value" style="color:var(--ok)">${fmtMoney(recMonth)}</div><div class="sub">${totalMonth ? Math.round(recMonth / totalMonth * 100) : 0}% do cobrado</div></div>
      <div class="card stat-card"><div class="label">Em atraso</div><div class="value" style="color:${lateTotal ? 'var(--danger)' : 'var(--ok)'}">${fmtMoney(lateTotal)}</div><div class="sub">${rows.filter(r=>r.lateOpen > 0).length} cliente(s)</div></div>
      <div class="card stat-card"><div class="label">Líquido esperado</div><div class="value">${fmtMoney(totalMonth - fixed)}</div><div class="sub">cobrado − gastos fixos (${fmtMoney(fixed)})</div></div>
    </div>
    <div class="section-title" style="margin-top:0">Cobranças de ${MONTHS[new Date().getMonth()].toLowerCase()}</div>
    <div class="card" style="padding:4px 0">
      ${rows.length ? rows.map(r=>{ const u = r.cur ? CHARGE_UI[r.cur.status] : CHARGE_UI.futuro;
        return `<div class="cobranca-row ${r.lateOpen > 0 ? 'cobranca-hoje' : ''}">
          <span class="client-dot" style="background:${r.c.color || '#999'}"></span>
          <div class="cobranca-info"><b>${escapeHtml(r.c.name)}</b><span>${r.cur ? 'Vence ' + fmtDM(r.cur.due) : ''} · ${fmtMoney(r.k.monthlyValue)}${r.lateOpen > 0 ? ' · <b style="color:var(--danger)">' + fmtMoney(r.lateOpen) + ' em atraso</b>' : ''}</span></div>
          ${badge(u.t, u.k)}
          <button class="btn btn-ghost btn-sm" onclick="goTab('cliente',{id:'${r.c.id}',sub:'financeiro'})">Detalhes</button>
          ${r.cur && !['pago', 'dispensado'].includes(r.cur.status) ? `<button class="btn btn-primary btn-sm" onclick="openFinanceModal('${r.c.id}','${r.cur.ym}',${Math.round(r.cur.open)})">Registrar pagamento</button>` : ''}
        </div>`; }).join('') : emptyBox('Nenhum contrato vigente', 'Crie o contrato na ficha de cada cliente.')}
    </div>
    <div class="section-title">Custos fixos a pagar</div>
    <div class="card" style="padding:4px 0">${fixedRows || emptyBox('Nenhum gasto fixo cadastrado', '')}</div>`;
}
