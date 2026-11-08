/* =====================================================================
   Tape Sistema 2.0 | aprovação do cliente: selos, painéis e ações da equipe
   Fluxo: vídeo entregue -> "aguardando" -> cliente aprova ou pede alteração
   pelo link -> aprovado fica "pronto para postar" (social) e visível ao
   editor de vídeo; pedido de alteração volta pro editor com o recado.
   ===================================================================== */

const APPROVAL = {
  aguardando: { label:'Aguardando cliente', kind:'warn' },
  aprovado:   { label:'Aprovado', kind:'ok' },
  alteracao:  { label:'Alteração pedida', kind:'danger' },
};
function approvalBadge(item){ const a = item && APPROVAL[item.approval]; return a ? badge(a.label, a.kind) : ''; }
function approvalHtml(item){
  if(!item || !item.approval) return '';
  const note = item.approval === 'alteracao' && item.approvalNote
    ? `<div class="appr-note">“${escapeHtml(item.approvalNote)}”</div>` : '';
  return `<div class="appr-line">${approvalBadge(item)}${item.approvalAt ? `<span class="muted-s">${fmtDM(String(item.approvalAt).slice(0,10))}</span>` : ''}</div>${note}`;
}
const KIND_TABLE = { video:'video_tasks', post:'post_tasks' };
const KIND_LIST = { video:()=>S.videoTasks, post:()=>S.postTasks };

async function staffSetApproval(kind, id, state, note){
  const it = KIND_LIST[kind]().find(x=>x.id === id); if(!it) return;
  const log = [...(it.approvalLog || []), { at:new Date().toISOString(), action:state, by:'staff', note: note || null }];
  const patch = { approval: state, approvalAt: new Date().toISOString(), approvalNote: state === 'alteracao' ? note : null, approvalLog: log };
  if(kind === 'video' && state !== 'aprovado') patch.postedAt = null;
  await dbUpdate(KIND_TABLE[kind], id, patch);
  Object.assign(it, patch); safeRender();
}
window.requestApproval = async function(kind, id){ await staffSetApproval(kind, id, 'aguardando'); toast('Enviado para aprovação do cliente.', 'ok'); };
window.markApproved = async function(kind, id){
  if(!(await askConfirm('Marcar como aprovado?', 'Use quando o cliente já aprovou por outro canal (ex.: WhatsApp). Fica registrado no histórico.', 'Marcar aprovado'))) return;
  await staffSetApproval(kind, id, 'aprovado', 'Aprovado manualmente pela equipe'); toast('Aprovado.', 'ok');
};
window.markPosted = async function(id){
  const v = S.videoTasks.find(x=>x.id === id); if(!v) return;
  const patch = { postedAt: new Date().toISOString() };
  await dbUpdate('video_tasks', id, patch); Object.assign(v, patch); safeRender();
  toast('Marcado como postado.', 'ok');
};
window.unmarkPosted = async function(id){
  const v = S.videoTasks.find(x=>x.id === id); if(!v) return;
  await dbUpdate('video_tasks', id, { postedAt:null }); v.postedAt = null; safeRender();
};

function videoThumb(v, h){
  const id = driveIdOf(v.finalLink);
  const st = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
  if(v.filePath) return `<video muted playsinline preload="metadata" src="${escapeHtml(fileUrlOf(v.filePath))}#t=0.1" style="${st}pointer-events:none"></video>`;
  if(id) return `<img loading="lazy" alt="" src="https://drive.google.com/thumbnail?id=${escapeHtml(id)}&sz=w${h||320}" style="${st}" onerror="this.remove()">`;
  return '';
}

/* ---- Social Media: painel "aprovados, prontos para postar" ---- */
function renderReadyPanel(){
  const box = document.getElementById('readyPanel'); if(!box) return;
  const filt = (document.getElementById('socialClientFilter') || {}).value;
  const ready = S.videoTasks.filter(v=>v.approval === 'aprovado' && !v.postedAt && (!filt || v.clientId === filt))
    .sort((a,b)=>String(a.approvalAt || '').localeCompare(String(b.approvalAt || '')));
  if(!ready.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="section-title" style="margin-top:0">Aprovados pelo cliente, prontos para postar <span class="count-pill ok">${ready.length}</span></div>
    <div class="ready-grid">${ready.map(v=>{
      const sched = S.socialPosts.find(p=>p.videoTaskId === v.id && p.status !== 'feito');
      return `<div class="card ready-card">
        <div class="ready-thumb">${videoThumb(v)}<span class="ready-ok">${icon('check', 12)} Aprovado</span></div>
        <div class="ready-body">
          <div class="kb-client"><span class="client-dot" style="background:${clientColor(v.clientId)}"></span>${escapeHtml(clientName(v.clientId))}</div>
          <div class="ready-title">${escapeHtml(v.title || 'Vídeo')}</div>
          <div class="muted-s">${sched ? 'Agendado para ' + fmtDM(sched.date) + ' às ' + escapeHtml((sched.time || '').slice(0,5)) : 'Ainda não agendado'}</div>
          <div class="ready-actions">
            ${v.finalLink ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(v.finalLink)}" target="_blank" rel="noopener">${icon('external')}Abrir</a>` : ''}
            ${sched ? `<button class="btn btn-outline btn-sm" onclick="editPost('${sched.id}')">${icon('edit')}Agendamento</button>` : `<button class="btn btn-primary btn-sm" onclick="scheduleFromVideo('${v.id}')">${icon('cal')}Agendar</button>`}
            <button class="btn btn-ghost btn-sm" onclick="markPosted('${v.id}')">${icon('check')}Já postei</button>
          </div></div></div>`;
    }).join('')}</div>`;
}
window.scheduleFromVideo = function(id){
  const v = S.videoTasks.find(x=>x.id === id); if(!v) return;
  openPostModal(addDaysISO(localToday(), 1));
  document.getElementById('pClient').value = v.clientId;
  fillVideoRefSelect(v.clientId, v.id); fillPostRefSelect(v.clientId);
  document.getElementById('pVideoRef').value = v.id;
  document.getElementById('pLink').value = v.finalLink || '';
  document.getElementById('pCaption').value = v.title || '';
  const sc = S.scripts.find(s=>s.videoTaskId === v.id);
  if(sc && sc.publishDate) document.getElementById('pDate').value = sc.publishDate;
};
const _renderCalendarLegacy = renderCalendar;
renderCalendar = function(){ _renderCalendarLegacy(); renderReadyPanel(); };

/* ---- Vídeo: faixa de pedidos de alteração e aguardando ---- */
function renderApprovalStrip(){
  const box = document.getElementById('approvalStrip'); if(!box) return;
  const filt = document.getElementById('videoClientFilter').value;
  const f = x=>!filt || x.clientId === filt;
  const changes = S.videoTasks.filter(v=>v.approval === 'alteracao' && f(v));
  const waiting = S.videoTasks.filter(v=>v.approval === 'aguardando' && f(v));
  if(!changes.length && !waiting.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="appr-strip">
    ${changes.length ? `<div class="card appr-card danger"><div class="appr-head">${icon('edit')}<b>Alterações pedidas pelo cliente</b><span class="count-pill danger">${changes.length}</span></div>
      ${changes.map(v=>`<div class="appr-item"><div class="appr-item-main"><div class="kb-client"><span class="client-dot" style="background:${clientColor(v.clientId)}"></span>${escapeHtml(clientName(v.clientId))} · ${escapeHtml(v.title || '')}</div>
        <div class="appr-note">“${escapeHtml(v.approvalNote || '(sem texto)')}”</div></div>
        <div class="appr-item-act"><button class="btn btn-primary btn-sm" onclick="delAttach('${v.id}')">${icon('film')}Enviar nova versão</button></div></div>`).join('')}</div>` : ''}
    ${waiting.length ? `<div class="card appr-card"><div class="appr-head">${icon('clock')}<b>Aguardando aprovação do cliente</b><span class="count-pill">${waiting.length}</span></div>
      <div class="appr-chips">${waiting.slice(0, 18).map(v=>`<span class="chip"><i style="background:${clientColor(v.clientId)}"></i>${escapeHtml(clientName(v.clientId))} · ${escapeHtml(v.title || '')}</span>`).join('')}${waiting.length > 18 ? `<span class="chip">+${waiting.length - 18}</span>` : ''}</div></div>` : ''}
  </div>`;
}
const _renderKanbanLegacy = renderKanban;
renderKanban = function(){ renderApprovalStrip(); _renderKanbanLegacy(); };

/* Arte que entra na coluna "Em aprovação" já fica aguardando o cliente */
function postApprovalPatch(prev, newStatus){
  if(newStatus === 'aprovacao' && (!prev || !['aguardando', 'aprovado'].includes(prev.approval))){
    return { approval:'aguardando', approvalNote:null, approvalAt:null };
  }
  return {};
}
