/* =====================================================================
   Tape Sistema 2.0 | clientes: lista, cadastro e ficha completa
   A ficha junta contrato, roteiros, entregas, financeiro e tráfego.
   ===================================================================== */

let clientsFilter = 'ativo', clientsQuery = '';
let fichaSub = 'resumo';
let fichaMonth = null;

function buildColorPicker(sel){
  const wrap = document.getElementById('colorPick');
  wrap.innerHTML = COLORS.map(c=>`<span style="background:${c}" data-c="${c}" class="${c === sel ? 'sel' : ''}" role="button" tabindex="0" aria-label="Cor ${c}"></span>`).join('');
  wrap.querySelectorAll('span').forEach(s=>s.addEventListener('click', ()=>{
    wrap.querySelectorAll('span').forEach(x=>x.classList.remove('sel'));
    s.classList.add('sel'); document.getElementById('cColor').value = s.dataset.c;
  }));
}
function syncPlanRows(){
  document.querySelectorAll('#planBox .planrow').forEach(r=>{ const on = r.querySelector('input[type=checkbox]').checked; r.classList.toggle('on', on); const q = r.querySelector('.qty input'); if(q) q.disabled = !on; });
}
document.getElementById('planBox').addEventListener('change', syncPlanRows);
function planOf(c){
  const p = (c && c.plan) || {};
  return { qtySocial: +(p.social && p.social.qty) || 0, qtyVideo: +(p.video && p.video.qty) || 0 };
}
function hasService(c, s){ return !!c && ((c.services || []).includes(s) || !!(c.plan && c.plan[s] && c.plan[s].on)); }

/* ---- Lista ---- */
function pendingForClient(id){
  const v = S.videoTasks.filter(x=>String(x.clientId) === String(id));
  return { wait: v.filter(x=>x.approval === 'aguardando').length, change: v.filter(x=>x.approval === 'alteracao').length };
}
function renderClients(){
  const grid = document.getElementById('clientsGrid');
  document.querySelectorAll('#clientsFilters button').forEach(b=>b.classList.toggle('on', b.dataset.f === clientsFilter));
  const q = clientsQuery.trim().toLowerCase();
  const list = S.clients.filter(c=>(clientsFilter === 'todos' || (c.status || 'ativo') === clientsFilter) && (!q || (c.name || '').toLowerCase().includes(q)))
    .sort((a, b)=>(a.name || '').localeCompare(b.name || ''));
  if(!S.clients.length){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><b>Nenhum cliente ainda</b>Cadastre o primeiro cliente para começar a organizar tudo.</div>`; return; }
  if(!list.length){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><b>Nenhum cliente encontrado</b>Mude o filtro ou a busca.</div>`; return; }
  grid.innerHTML = list.map(c=>{
    const st = c.status === 'pausado' ? badge('Pausado', 'warn') : c.status === 'encerrado' ? badge('Encerrado', 'muted') : badge('Ativo', 'ok');
    const pl = planOf(c);
    const tags = (c.services || []).map(s=>{
      let t = SERVICE_LABELS[s] || s;
      if(s === 'video' && pl.qtyVideo) t = pl.qtyVideo + ' vídeos/mês';
      if(s === 'social' && pl.qtySocial) t = pl.qtySocial + ' posts/mês';
      return `<span class="tag">${escapeHtml(t)}</span>`;
    }).join('');
    const p = pendingForClient(c.id);
    return `<div class="card client-card clickable" onclick="goTab('cliente',{id:'${c.id}'})" tabindex="0" onkeydown="if(event.key==='Enter')goTab('cliente',{id:'${c.id}'})">
      <div class="client-top"><div style="display:flex;gap:10px;align-items:center;min-width:0"><span class="client-dot lg" style="background:${c.color || '#999'}"></span><div class="client-name">${escapeHtml(c.name)}</div></div>${st}</div>
      <div class="client-tags">${tags || '<span class="muted-s">Sem serviços marcados</span>'}</div>
      <div class="client-foot">
        ${canSeeMoney() ? contractChip(c.id) : ''}
        ${p.change ? `<span class="chip-s danger">${p.change === 1 ? '1 alteração pedida' : p.change + ' alterações pedidas'}</span>` : ''}${p.wait ? `<span class="chip-s warn">${p.wait} aguardando</span>` : ''}
      </div></div>`;
  }).join('');
}
document.getElementById('clientsSearch').addEventListener('input', debounce(e=>{ clientsQuery = e.target.value; renderClients(); }, 120));
document.querySelectorAll('#clientsFilters button').forEach(b=>b.addEventListener('click', ()=>{ clientsFilter = b.dataset.f; renderClients(); }));

/* ---- Cadastro / edição ---- */
function applyClientFormVisibility(){
  document.getElementById('cMetaField').style.display = hasAccess('trafego') ? '' : 'none';
}
document.getElementById('btnNewClient').addEventListener('click', ()=>{
  document.getElementById('clientModalTitle').textContent = 'Novo cliente';
  document.getElementById('clientForm').reset();
  document.getElementById('clientId').value = '';
  syncPlanRows();
  document.getElementById('cColor').value = COLORS[S.clients.length % COLORS.length];
  buildColorPicker(document.getElementById('cColor').value);
  applyClientFormVisibility();
  openModal('modalClient');
});
window.editClient = function(id){
  const c = clientById(id); if(!c) return;
  document.getElementById('clientModalTitle').textContent = 'Editar cliente';
  document.getElementById('clientForm').reset();
  document.getElementById('clientId').value = c.id;
  document.getElementById('cName').value = c.name || '';
  document.getElementById('cStatus').value = c.status || 'ativo';
  document.getElementById('cDrive').value = c.driveFolder || '';
  document.getElementById('cMeta').value = c.metaAccountId || '';
  document.querySelectorAll('#planBox .checkchip input').forEach(chk=>{ chk.checked = (c.services || []).includes(chk.value); });
  const pl = planOf(c);
  document.getElementById('cQtySocial').value = pl.qtySocial || '';
  document.getElementById('cQtyVideo').value = pl.qtyVideo || '';
  syncPlanRows();
  document.getElementById('cColor').value = c.color || COLORS[0];
  buildColorPicker(c.color || COLORS[0]);
  applyClientFormVisibility();
  openModal('modalClient');
};
window.deleteClient = async function(id){
  const c = clientById(id); if(!c) return;
  if(!(await askConfirm('Remover ' + c.name + '?', 'Contrato, roteiros e pagamentos deste cliente também serão apagados. Postagens e vídeos antigos continuam salvos, sem cliente. Se só quer pausar, mude o status para Pausado.', 'Remover cliente', true))) return;
  try{ await dbDelete('clients', id); toast('Cliente removido.', 'ok'); goTab('clientes'); }catch(_){}
};
document.getElementById('clientForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('clientId').value;
  const services = [...document.querySelectorAll('#planBox .checkchip input:checked')].map(i=>i.value);
  const drive = document.getElementById('cDrive').value.trim();
  if(drive && !isHttpUrl(drive)){ toast('Cole o link completo da pasta do Drive (https://...).', 'error'); return; }
  const data = {
    name: document.getElementById('cName').value.trim(),
    status: document.getElementById('cStatus').value,
    driveFolder: drive, services, color: document.getElementById('cColor').value,
    plan: {
      social: { on: services.includes('social'), qty: parseInt(document.getElementById('cQtySocial').value, 10) || 0 },
      video: { on: services.includes('video'), qty: parseInt(document.getElementById('cQtyVideo').value, 10) || 0 },
      trafego: { on: services.includes('trafego') }, branding: { on: services.includes('branding') }, web: { on: services.includes('web') },
    },
  };
  if(!data.name){ toast('Informe o nome do cliente.', 'error'); return; }
  if(hasAccess('trafego')) data.metaAccountId = document.getElementById('cMeta').value.replace(/\D/g, '') || null;
  try{
    if(id){ await db.collection('clients').doc(id).update(data); toast('Cliente atualizado.', 'ok'); closeModal('modalClient'); }
    else {
      data.createdAt = new Date().toISOString();
      const ref = await db.collection('clients').add(data);
      closeModal('modalClient'); toast('Cliente cadastrado.', 'ok');
      await new Promise(r=>setTimeout(r, 400));
      goTab('cliente', { id: ref.id, sub: canSeeMoney() ? 'contrato' : 'resumo' });
    }
  }catch(err){ toast('Não consegui salvar: ' + (err.message || err), 'error'); }
});

/* ---- Ficha ---- */
const FICHA_TABS = [
  { id:'resumo', label:'Resumo', ic:'home' },
  { id:'contrato', label:'Contrato', ic:'file', money:true },
  { id:'roteiros', label:'Roteiros', ic:'edit' },
  { id:'entregas', label:'Entregas', ic:'film' },
  { id:'financeiro', label:'Financeiro', ic:'wallet', money:true },
  { id:'trafego', label:'Tráfego', ic:'chart', traffic:true },
];
function fichaTabs(){
  return FICHA_TABS.filter(t=>(!t.money || canSeeMoney()) && (!t.traffic || hasAccess('trafego')));
}
function renderClientFicha(){
  const el = document.getElementById('fichaBody');
  const c = clientById(currentClientId);
  if(!c){ el.innerHTML = S.clients.length ? emptyBox('Cliente não encontrado', '') : skeleton(4); return; }
  if(window.pendingSub){ fichaSub = window.pendingSub; window.pendingSub = null; }
  const tabs = fichaTabs();
  if(!tabs.some(t=>t.id === fichaSub)) fichaSub = 'resumo';
  const st = c.status === 'pausado' ? badge('Pausado', 'warn') : c.status === 'encerrado' ? badge('Encerrado', 'muted') : badge('Ativo', 'ok');
  const body = {
    resumo: ()=>renderFichaResumo(c), contrato: ()=>renderContractPanel(c.id), roteiros: ()=>renderScriptsPanel(c.id),
    entregas: ()=>renderFichaEntregas(c), financeiro: ()=>renderClientFinancePanel(c.id), trafego: ()=>renderClientTrafficPanel(c),
  }[fichaSub]();
  el.innerHTML = `
    <a class="back-link" href="#clientes" onclick="event.preventDefault();goTab('clientes')">${icon('arrow-left')}Todos os clientes</a>
    <div class="ficha-head">
      <div style="display:flex;align-items:center;gap:12px;min-width:0"><span class="client-dot xl" style="background:${c.color || '#999'}"></span>
        <div style="min-width:0"><h1>${escapeHtml(c.name)}</h1><div class="ficha-meta">${st}${(c.services || []).map(s=>`<span class="tag">${escapeHtml(SERVICE_LABELS[s] || s)}</span>`).join('')}</div></div></div>
      <div class="ficha-actions">
        ${c.driveFolder ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(c.driveFolder)}" target="_blank" rel="noopener">${icon('folder')}Drive</a>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openShare('${c.id}')">${icon('link')}Link do cliente</button>
        <button class="btn btn-outline btn-sm" onclick="editClient('${c.id}')">${icon('edit')}Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteClient('${c.id}')" aria-label="Remover cliente">${icon('trash')}</button>
      </div></div>
    <div class="subtabs ficha-tabs" role="tablist">${tabs.map(t=>`<button role="tab" class="${t.id === fichaSub ? 'active' : ''}" onclick="fichaGo('${t.id}')">${icon(t.ic, 15)}${t.label}</button>`).join('')}</div>
    <div class="ficha-content">${body}</div>`;
  if(fichaSub === 'trafego') mountClientTraffic(c);
}
window.fichaGo = function(sub){ fichaSub = sub; history.replaceState(null, '', '#cliente/' + currentClientId + '/' + sub); renderClientFicha(); };

function monthsWithContent(clientId){
  const set = new Set([ymNow()]);
  S.videoTasks.filter(v=>String(v.clientId) === String(clientId)).forEach(v=>{ const m = vMonth(v); if(m) set.add(m); });
  S.postTasks.filter(v=>String(v.clientId) === String(clientId)).forEach(v=>{ const m = postMonthOf(v); if(m) set.add(m); });
  return [...set].sort();
}

function renderFichaResumo(c){
  const ym = ymNow(); const pl = planOf(c);
  const vids = S.videoTasks.filter(v=>String(v.clientId) === String(c.id));
  const delivered = vids.filter(v=>v.status === 'entregue' && vMonth(v) === ym).length;
  const posts = S.postTasks.filter(t=>String(t.clientId) === String(c.id) && t.status === 'entregue' && postMonthOf(t) === ym).length;
  const bar = (n, q)=>`<div class="pbar"><i style="width:${q ? Math.min(100, Math.round(n / q * 100)) : 0}%"></i></div>`;
  const appr = {
    wait: vids.filter(v=>v.approval === 'aguardando'), change: vids.filter(v=>v.approval === 'alteracao'),
    ok: vids.filter(v=>v.approval === 'aprovado' && !v.postedAt),
  };
  const today = localToday();
  const upcoming = [
    ...S.scripts.filter(s=>String(s.clientId) === String(c.id) && s.recordDate && s.recordDate >= today && ['roteiro', 'gravar'].includes(s.status)).map(s=>({ d:s.recordDate, t:'Gravar: ' + s.title, ic:'film' })),
    ...S.socialPosts.filter(p=>String(p.clientId) === String(c.id) && p.date >= today && p.status !== 'feito').map(p=>({ d:p.date, t:'Postagem às ' + (p.time || '').slice(0, 5), ic:'cal' })),
  ].sort((a, b)=>a.d.localeCompare(b.d)).slice(0, 5);
  const k = canSeeMoney() ? contractOf(c.id) : null;
  let fin = '';
  if(canSeeMoney()){
    const cur = clientCharges(c.id).find(x=>x.ym === ym);
    fin = cur ? `<div class="card pad"><div class="card-h">${icon('wallet')}Financeiro do mês</div>
        <div class="kv"><span>Cobrado</span><b>${fmtMoney(cur.charged)}</b></div><div class="kv"><span>Recebido</span><b style="color:var(--ok)">${fmtMoney(cur.received)}</b></div>
        <div class="kv"><span>Vencimento</span><b>${fmtDM(cur.due)} ${badge(CHARGE_UI[cur.status].t, CHARGE_UI[cur.status].k)}</b></div>
        <button class="btn btn-ghost btn-sm" onclick="fichaGo('financeiro')">Ver parcelas</button></div>` : '';
  }
  const link = c.shareSlug ? SHARE_BASE + c.shareSlug : '';
  return `<div class="grid grid-3 resumo-grid">
    ${canSeeMoney() ? `<div class="card pad"><div class="card-h">${icon('file')}Contrato</div>
      ${k ? `<div class="big-num sm">${fmtMoney(k.monthlyValue)}<small>/mês</small></div><div style="margin:6px 0 10px">${contractChip(c.id)}</div><div class="muted-s">${escapeHtml(contractInfo(k).detail)}</div>
        <button class="btn btn-ghost btn-sm" onclick="fichaGo('contrato')">Ver contrato</button>` : `<p class="muted-s">Ainda sem contrato registrado.</p><button class="btn btn-primary btn-sm" onclick="fichaGo('contrato')">Criar contrato</button>`}</div>` : ''}
    <div class="card pad"><div class="card-h">${icon('film')}Entregas de ${MONTHS[new Date().getMonth()].toLowerCase()}</div>
      ${hasService(c, 'video') || vids.length ? `<div class="kv"><span>Vídeos</span><b>${delivered}${pl.qtyVideo ? ' de ' + pl.qtyVideo : ''}</b></div>${pl.qtyVideo ? bar(delivered, pl.qtyVideo) : ''}` : ''}
      ${hasService(c, 'social') ? `<div class="kv"><span>Posts</span><b>${posts}${pl.qtySocial ? ' de ' + pl.qtySocial : ''}</b></div>${pl.qtySocial ? bar(posts, pl.qtySocial) : ''}` : ''}
      ${!hasService(c, 'video') && !hasService(c, 'social') && !vids.length ? '<p class="muted-s">Sem serviços de vídeo ou social marcados.</p>' : ''}
      <button class="btn btn-ghost btn-sm" onclick="fichaGo('entregas')">Ver entregas</button></div>
    <div class="card pad"><div class="card-h">${icon('check')}Aprovação do cliente</div>
      <div class="kv"><span>Aguardando o cliente</span><b>${appr.wait.length}</b></div>
      <div class="kv"><span>Pediram alteração</span><b style="color:${appr.change.length ? 'var(--danger)' : 'inherit'}">${appr.change.length}</b></div>
      <div class="kv"><span>Aprovados, prontos para postar</span><b style="color:var(--ok)">${appr.ok.length}</b></div>
      ${appr.change.slice(0, 2).map(v=>`<div class="appr-note">“${escapeHtml(v.approvalNote || '')}”</div>`).join('')}</div>
    <div class="card pad"><div class="card-h">${icon('cal')}Próximas datas</div>
      ${upcoming.length ? upcoming.map(u=>`<div class="kv"><span>${icon(u.ic, 13)} ${escapeHtml(u.t)}</span><b>${fmtDM(u.d)}</b></div>`).join('') : '<p class="muted-s">Nada agendado. Crie roteiros com data de gravação e publicação.</p>'}
      <button class="btn btn-ghost btn-sm" onclick="fichaGo('roteiros')">Ver roteiros</button></div>
    ${fin}
    <div class="card pad"><div class="card-h">${icon('link')}Link do cliente</div>
      ${link ? `<input class="link-input" readonly value="${escapeHtml(link)}" onclick="this.select()"><div class="btn-row"><button class="btn btn-outline btn-sm" onclick="copyText('${escapeHtml(link)}')">${icon('copy')}Copiar</button><a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${escapeHtml(link)}">${icon('external')}Abrir</a></div>`
        : `<p class="muted-s">O cliente ainda não tem link. Ele serve para assistir, aprovar e acompanhar o calendário.</p><button class="btn btn-primary btn-sm" onclick="openShare('${c.id}')">Gerar link</button>`}</div>
  </div>`;
}

function renderFichaEntregas(c){
  const months = monthsWithContent(c.id);
  if(!fichaMonth || !months.includes(fichaMonth)) fichaMonth = months.includes(ymNow()) ? ymNow() : months[months.length - 1];
  const vids = S.videoTasks.filter(v=>String(v.clientId) === String(c.id) && vMonth(v) === fichaMonth).sort((a, b)=>vNum(a) - vNum(b));
  const arts = S.postTasks.filter(t=>String(t.clientId) === String(c.id) && postMonthOf(t) === fichaMonth);
  const pl = planOf(c);
  const done = vids.filter(v=>v.status === 'entregue').length;
  return `<div class="row-between" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="chips">${months.map(m=>`<button class="chip-btn ${m === fichaMonth ? 'on' : ''}" onclick="fichaMonth='${m}';renderClientFicha()">${ymLabelShort(m)}</button>`).join('')}</div>
      <div class="btn-row" style="margin:0">${hasAccess('video') ? `<button class="btn btn-primary btn-sm" onclick="delMonth='${fichaMonth}';goTab('video',{client:'${c.id}'})">${icon('plus')}Subir vídeos</button>` : ''}</div></div>
    <div class="muted-s" style="margin-bottom:10px">${ymLabel(fichaMonth)} · ${done}${pl.qtyVideo ? ' de ' + pl.qtyVideo : ''} vídeo(s) entregue(s)</div>
    ${vids.length ? `<div class="vcards">${vids.map(v=>{
      const canSite = !!v.filePath;
      return `<div class="card vcard2">
        <a class="vthumb" href="${escapeHtml(v.finalLink || '#')}" target="_blank" rel="noopener">${videoThumb(v)}<span class="vnum">${pad2(vNum(v) || 0)}</span></a>
        <div class="vbody"><div class="vtitle">${escapeHtml(v.title || 'Vídeo')}</div>
          ${v.status !== 'entregue' ? badge(VIDEO_STATUS_LABEL[v.status] || v.status, 'muted') : approvalHtml(v) || '<span class="muted-s">Sem fluxo de aprovação</span>'}
          ${v.postedAt ? `<div class="muted-s">Postado em ${fmtDM(String(v.postedAt).slice(0, 10))}</div>` : ''}
          <div class="vact">
            ${v.status === 'entregue' && !v.approval ? `<button class="btn btn-outline btn-sm" onclick="requestApproval('video','${v.id}')">Pedir aprovação</button>` : ''}
            ${['aguardando', 'alteracao'].includes(v.approval) ? `<button class="btn btn-outline btn-sm" onclick="markApproved('video','${v.id}')">Marcar aprovado</button>` : ''}
            ${v.approval === 'alteracao' ? `<button class="btn btn-primary btn-sm" onclick="delAttach('${v.id}')">Nova versão</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="delEdit('${v.id}')" aria-label="Editar">${icon('edit')}</button>
          </div>
          ${v.status === 'entregue' ? `<label class="switch-row ${canSite ? '' : 'off'}" title="${canSite ? '' : 'Suba a prévia no sistema para liberar'}"><input type="checkbox" ${v.showOnSite ? 'checked' : ''} ${canSite ? '' : 'disabled'} onchange="toggleShowOnSite('${v.id}',this.checked)"><span class="sw"></span>Mostrar no site</label>` : ''}
        </div></div>`; }).join('')}</div>` : emptyBox('Sem vídeos neste mês', 'Use "Subir vídeos" para adicionar as entregas.')}
    ${arts.length ? `<div class="section-title">Artes e posts</div><div class="card" style="padding:4px 0">${arts.map(t=>`<div class="pend-row" style="cursor:default">
      <div class="pend-body"><div class="pend-title">${escapeHtml(t.title || '')}</div><div class="pend-sub">${POST_FORMAT_LABEL[t.format] || 'Post'} · ${POST_STATUS_LABEL[t.status] || t.status}${t.dueDate ? ' · prazo ' + fmtDM(t.dueDate) : ''}</div>${t.approval === 'alteracao' && t.approvalNote ? `<div class="appr-note">“${escapeHtml(t.approvalNote)}”</div>` : ''}</div>
      ${approvalBadge(t)}
      ${t.status === 'aprovacao' && !t.approval ? `<button class="btn btn-outline btn-sm" onclick="requestApproval('post','${t.id}')">Pedir aprovação</button>` : ''}
      ${['aguardando', 'alteracao'].includes(t.approval) ? `<button class="btn btn-outline btn-sm" onclick="markApproved('post','${t.id}')">Marcar aprovado</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="editPostTask('${t.id}')">${icon('edit')}</button></div>`).join('')}</div>` : ''}`;
}
