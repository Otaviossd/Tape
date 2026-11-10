/* =====================================================================
   Tape Sistema 2.0 | contratos: mínimo, renovação, aviso e alertas
   Regras: período mínimo (padrão 3 meses) -> renova a cada N meses
   (padrão 3; 1 = mensal) -> cliente avisa com X dias (padrão 30) para sair.
   ===================================================================== */

function contractOf(clientId){
  const list = S.contracts.filter(k=>String(k.clientId) === String(clientId))
    .sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)));
  return list.find(k=>k.status !== 'encerrado') || list[0] || null;
}

function contractInfo(k){
  const today = localToday();
  const min = Math.max(1, +k.minMonths || 3), ren = Math.max(1, +k.renewMonths || 3), notice = Math.max(0, +k.noticeDays || 30);
  const start = String(k.startDate).slice(0, 10);
  const minEnd = addMonthsISO(start, min);
  let n = min, cycleEnd = minEnd, guard = 0;
  if(k.autoRenew !== false){ while(cycleEnd < today && guard++ < 600){ n += ren; cycleEnd = addMonthsISO(start, n); } }
  const base = { minEnd, cycleEnd, cycleNo: guard ? Math.round((n - min) / ren) + 1 : 1, inMinimum: today < minEnd, notice,
    noticeDeadline: addDaysISO(cycleEnd, -notice), value: +k.monthlyValue || 0 };
  if(k.status === 'encerrado'){
    return { ...base, state:'encerrado', level:'muted', alert:false, label:'Encerrado', shortLabel:'contrato encerrado', detail: k.endDate ? 'Encerrado em ' + fmtDate(k.endDate) : '' };
  }
  if(k.status === 'em_aviso'){
    const end = k.endDate || addDaysISO(k.noticeGivenAt || today, notice);
    const d = diffDays(today, end);
    return { ...base, state:'em_aviso', level: d <= 7 ? 'urgent' : 'soon', alert:true, daysToEnd:d, endDate:end,
      label: d < 0 ? 'Venceu, falta encerrar' : 'Em aviso, encerra ' + daysText(d),
      shortLabel: d < 0 ? 'passou do fim do aviso, encerre o contrato' : 'cliente em aviso, encerra ' + daysText(d),
      detail: 'Cliente avisou em ' + fmtDate(k.noticeGivenAt) + '. Último dia: ' + fmtDate(end) + '.' };
  }
  const d = diffDays(today, cycleEnd);
  const level = d <= 15 ? 'urgent' : d <= 45 ? 'soon' : 'ok';
  const what = base.inMinimum ? 'período mínimo termina' : (k.autoRenew === false ? 'contrato termina' : 'renova');
  return { ...base, state:'vigente', level, alert: d <= 45, daysToCycleEnd:d,
    label: base.inMinimum ? 'Período mínimo · termina ' + daysText(d) : 'Vigente · ' + (k.autoRenew === false ? 'termina ' : 'renova ') + daysText(d),
    shortLabel: what + ' ' + daysText(d),
    detail: k.autoRenew === false
      ? 'Contrato termina em ' + fmtDate(cycleEnd) + '.'
      : (base.noticeDeadline < today
        ? 'O prazo de aviso deste ciclo passou (' + fmtDate(base.noticeDeadline) + '). Se nada mudar, renova e segue até ' + fmtDate(addMonthsISO(start, n + ren)) + '.'
        : (base.inMinimum ? 'Fim do mínimo em ' : 'Ciclo termina em ') + fmtDate(cycleEnd) + '. Cliente pode avisar até ' + fmtDate(base.noticeDeadline) + '.') };
}
function contractChip(clientId){
  const k = contractOf(clientId);
  if(!k) return '<span class="chip-s warn">Sem contrato</span>';
  const i = contractInfo(k);
  const cls = { urgent:'danger', soon:'warn', ok:'ok', muted:'muted' }[i.level] || 'muted';
  return `<span class="chip-s ${cls}">${escapeHtml(i.label)}</span>`;
}

function renderContractPanel(clientId){
  if(!canSeeMoney()) return emptyBox('Área restrita', 'Só quem tem acesso ao Financeiro vê contratos e valores.');
  const c = clientById(clientId);
  const k = contractOf(clientId);
  const banner = schemaBanner('contracts');
  if(!k){
    return banner + `<div class="card pad empty-cta"><b>Este cliente ainda não tem contrato registrado</b>
      <p>Registre o valor, o período mínimo e o aviso prévio para a Tape te avisar antes da renovação.</p>
      <button class="btn btn-primary" onclick="openContractModal('${clientId}')">${icon('plus')}Criar contrato</button></div>`;
  }
  const i = contractInfo(k);
  const hist = S.contracts.filter(x=>String(x.clientId) === String(clientId) && x.id !== k.id);
  const today = localToday();
  const sameEnd = i.cycleEnd === i.minEnd;
  const rows = [
    { d:String(k.startDate).slice(0, 10), t:'Início do contrato' },
    { d:i.minEnd, t:'Fim do período mínimo (' + (k.minMonths || 3) + ' meses)' + (sameEnd && k.status === 'vigente' && k.autoRenew !== false ? ', depois renova a cada ' + (k.renewMonths || 3) + ' meses' : '') },
    k.status === 'em_aviso' ? { d:i.endDate, t:'Encerramento previsto' } : (!sameEnd ? { d:i.cycleEnd, t: k.autoRenew !== false ? 'Fim do ciclo atual (renova por mais ' + (k.renewMonths || 3) + ' meses)' : 'Fim do contrato' } : null),
    k.status === 'vigente' ? { d:i.noticeDeadline, t:'Último dia para o cliente avisar que sai' } : null,
  ].filter(Boolean).sort((x, y)=>String(x.d).localeCompare(String(y.d)));
  const nextIdx = rows.findIndex(r=>r.d >= today);
  const tl = rows.map((r, ix)=>[r.t, fmtDate(r.d), ix === nextIdx ? 'now' : (r.d < today ? 'done' : '')]);
  return banner + `<div class="split2">
    <div class="card pad">
      <div class="row-between"><div><div class="muted-s">Valor mensal</div><div class="big-num">${fmtMoney(k.monthlyValue)}</div></div>
        <span class="chip-s ${ {urgent:'danger',soon:'warn',ok:'ok',muted:'muted'}[i.level] }">${escapeHtml(i.label)}</span></div>
      <div class="kv"><span>Cobrança</span><b>${k.billingDay ? 'todo dia ' + k.billingDay : 'sem dia definido'}</b></div>
      <div class="kv"><span>Período mínimo</span><b>${k.minMonths || 3} meses</b></div>
      <div class="kv"><span>Renovação</span><b>${k.autoRenew === false ? 'não renova sozinho' : 'a cada ' + (k.renewMonths || 3) + (k.renewMonths == 1 ? ' mês' : ' meses')}</b></div>
      <div class="kv"><span>Aviso para sair</span><b>${k.noticeDays || 30} dias</b></div>
      ${k.fileUrl ? `<div class="kv"><span>Contrato assinado</span><a href="${escapeHtml(k.fileUrl)}" target="_blank" rel="noopener" class="lnk">Abrir arquivo ${icon('external', 12)}</a></div>` : ''}
      ${k.notes ? `<div class="note-box">${escapeHtml(k.notes)}</div>` : ''}
      <div class="btn-row">
        <button class="btn btn-outline btn-sm" onclick="openContractModal('${clientId}','${k.id}')">${icon('edit')}Editar</button>
        ${k.status === 'vigente' ? `<button class="btn btn-outline btn-sm" onclick="openNoticeModal('${k.id}')">${icon('clock')}Cliente avisou que vai sair</button>` : ''}
        ${k.status === 'em_aviso' ? `<button class="btn btn-outline btn-sm" onclick="cancelNotice('${k.id}')">Cliente desistiu de sair</button>` : ''}
        ${k.status !== 'encerrado' ? `<button class="btn btn-ghost btn-sm" onclick="closeContract('${k.id}')">Encerrar contrato</button>` : `<button class="btn btn-ghost btn-sm" onclick="reopenContract('${k.id}')">Reabrir</button>`}
      </div>
    </div>
    <div class="card pad">
      <div class="section-title" style="margin-top:0">Linha do tempo</div>
      <ol class="timeline">${tl.map(t=>`<li class="${t[2]}"><b>${t[1]}</b><span>${t[0]}</span></li>`).join('')}</ol>
      ${hist.length ? `<div class="muted-s" style="margin-top:12px">Contratos anteriores: ${hist.map(h=>fmtDate(h.startDate)).join(', ')}</div>` : ''}
    </div>
  </div>`;
}

/* ---- Formulário ---- */
window.openContractModal = function(clientId, id){
  const k = id ? S.contracts.find(x=>x.id === id) : null;
  document.getElementById('contractModalTitle').textContent = (k ? 'Editar contrato' : 'Novo contrato') + ' · ' + clientName(clientId);
  document.getElementById('kId').value = k ? k.id : '';
  document.getElementById('kClient').value = clientId;
  document.getElementById('kStart').value = k ? String(k.startDate).slice(0, 10) : localToday();
  document.getElementById('kMin').value = k ? k.minMonths : 3;
  document.getElementById('kRenew').value = k ? k.renewMonths : 3;
  document.getElementById('kNotice').value = k ? k.noticeDays : 30;
  document.getElementById('kAuto').checked = k ? k.autoRenew !== false : true;
  document.getElementById('kValue').value = k ? (k.monthlyValue || '') : '';
  document.getElementById('kDay').value = k && k.billingDay ? k.billingDay : '';
  document.getElementById('kFile').value = k ? (k.fileUrl || '') : '';
  document.getElementById('kNotes').value = k ? (k.notes || '') : '';
  openModal('modalContract');
};
document.getElementById('contractForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('kId').value;
  const file = document.getElementById('kFile').value.trim();
  if(file && !isHttpUrl(file)){ toast('Cole o link completo do contrato (https://...).', 'error'); return; }
  const day = parseInt(document.getElementById('kDay').value, 10);
  const row = {
    clientId: document.getElementById('kClient').value,
    startDate: document.getElementById('kStart').value,
    minMonths: Math.max(1, parseInt(document.getElementById('kMin').value, 10) || 3),
    renewMonths: Math.max(1, parseInt(document.getElementById('kRenew').value, 10) || 3),
    noticeDays: Math.max(0, parseInt(document.getElementById('kNotice').value, 10) || 0),
    autoRenew: document.getElementById('kAuto').checked,
    monthlyValue: Math.max(0, parseFloat(document.getElementById('kValue').value) || 0),
    billingDay: day >= 1 && day <= 31 ? day : null,
    fileUrl: file || null,
    notes: document.getElementById('kNotes').value.trim() || null,
  };
  if(!row.startDate){ toast('Informe a data de início.', 'error'); return; }
  try{
    if(id) await dbUpdate('contracts', id, row); else await dbInsert('contracts', { ...row, status:'vigente' });
    closeModal('modalContract'); toast('Contrato salvo.', 'ok'); await reloadContracts();
  }catch(_){}
});
async function reloadContracts(){
  const { data } = await sb.from('contracts').select('*'); if(data){ S.contracts = data; safeRender(); }
}

/* ---- Aviso, encerramento ---- */
window.openNoticeModal = function(id){
  const k = S.contracts.find(x=>x.id === id); if(!k) return;
  const i = contractInfo(k);
  document.getElementById('nId').value = id;
  document.getElementById('nDate').value = localToday();
  document.getElementById('nEnd').value = i.cycleEnd > addDaysISO(localToday(), i.notice) ? i.cycleEnd : addDaysISO(localToday(), i.notice);
  document.getElementById('nHint').textContent = `Aviso de ${i.notice} dias. O fim sugerido respeita o período mínimo (${fmtDate(i.minEnd)}) e o ciclo atual; você pode ajustar.`;
  openModal('modalNotice');
};
document.getElementById('noticeForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('nId').value;
  try{
    await dbUpdate('contracts', id, { status:'em_aviso', noticeGivenAt: document.getElementById('nDate').value, endDate: document.getElementById('nEnd').value });
    closeModal('modalNotice'); toast('Aviso registrado. O sistema vai te lembrar do encerramento.', 'ok'); await reloadContracts();
  }catch(_){}
});
window.cancelNotice = async function(id){
  if(!(await askConfirm('Cliente desistiu de sair?', 'O contrato volta a ficar vigente.', 'Voltar a vigente'))) return;
  await dbUpdate('contracts', id, { status:'vigente', noticeGivenAt:null, endDate:null }); await reloadContracts();
};
window.closeContract = async function(id){
  const k = S.contracts.find(x=>x.id === id); if(!k) return;
  if(!(await askConfirm('Encerrar este contrato?', 'Ele deixa de gerar cobranças e alertas. O histórico financeiro continua salvo.', 'Encerrar', true))) return;
  await dbUpdate('contracts', id, { status:'encerrado', endDate: k.endDate || localToday() }); await reloadContracts();
};
window.reopenContract = async function(id){ await dbUpdate('contracts', id, { status:'vigente', endDate:null, noticeGivenAt:null }); await reloadContracts(); };

/* ---- Visão geral (aba Financeiro > Contratos) ---- */
function renderContractsOverview(body){
  const rows = S.clients.map(c=>({ c, k: contractOf(c.id) })).map(r=>({ ...r, i: r.k ? contractInfo(r.k) : null }));
  const live = rows.filter(r=>r.k && r.k.status !== 'encerrado');
  const mrr = live.reduce((a, r)=>a + (+r.k.monthlyValue || 0), 0);
  const soon = live.filter(r=>r.i.alert).length;
  const none = rows.filter(r=>!r.k && r.c.status === 'ativo').length;
  const order = { urgent:0, soon:1, ok:2, muted:3 };
  rows.sort((a, b)=>(a.i ? order[a.i.level] : 1.5) - (b.i ? order[b.i.level] : 1.5) || (a.i && b.i ? (a.i.cycleEnd || '').localeCompare(b.i.cycleEnd || '') : 0));
  body.innerHTML = schemaBanner('contracts') + `
    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Receita recorrente (mês)</div><div class="value">${fmtMoney(mrr)}</div><div class="sub">${live.length} contrato${live.length === 1 ? '' : 's'} vigente${live.length === 1 ? '' : 's'}</div></div>
      <div class="card stat-card"><div class="label">Perto de renovar ou encerrar</div><div class="value" style="color:${soon ? 'var(--warn)' : 'var(--ok)'}">${soon}</div><div class="sub">nos próximos 45 dias</div></div>
      <div class="card stat-card"><div class="label">Clientes ativos sem contrato</div><div class="value" style="color:${none ? 'var(--danger)' : 'var(--ok)'}">${none}</div><div class="sub">cadastre o contrato na ficha</div></div>
    </div>
    <div class="card table-card"><table class="tbl"><thead><tr><th>Cliente</th><th class="r">Valor/mês</th><th>Início</th><th>Próxima data</th><th>Situação</th><th></th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td><span class="client-dot" style="background:${r.c.color || '#999'}"></span> <b>${escapeHtml(r.c.name)}</b></td>
      <td class="r">${r.k ? fmtMoney(r.k.monthlyValue) : '-'}</td>
      <td>${r.k ? fmtDate(r.k.startDate) : '-'}</td>
      <td>${r.i ? (r.i.state === 'em_aviso' ? fmtDate(r.i.endDate) : r.i.state === 'encerrado' ? '-' : fmtDate(r.i.cycleEnd)) : '-'}</td>
      <td>${contractChip(r.c.id)}</td>
      <td class="r"><button class="btn btn-ghost btn-sm" onclick="goTab('cliente',{id:'${r.c.id}',sub:'contrato'})">Abrir</button></td></tr>`).join('') || '<tr><td colspan="6">' + emptyBox('Nenhum cliente', '') + '</td></tr>'}
    </tbody></table></div>`;
}
