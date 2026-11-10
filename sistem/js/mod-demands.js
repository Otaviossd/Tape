/* Demandas de vídeo: o que o videomaker precisa gravar, editar e entregar, com prazo.
   Uma demanda é uma linha de video_tasks que ainda não está "entregue". */
let delDemandId = null;
let demCollapsed = false;
try{ demCollapsed = localStorage.getItem('tape_dem_collapsed') === '1'; }catch(_){}
window.demToggle = function(){ demCollapsed = !demCollapsed; try{ localStorage.setItem('tape_dem_collapsed', demCollapsed ? '1' : '0'); }catch(_){} renderDemands(); };
const DEM_STEPS = [['pendente', 'A gravar'], ['gravado', 'Gravado'], ['editado', 'Editado']];
const isAdminUser = ()=>!!(currentMember && currentMember.role === 'admin');

function demOpen(){
  return S.videoTasks.filter(v=>(v.status || 'pendente') !== 'entregue').filter(v=>{ const c = clientById(v.clientId); return !c || c.status !== 'encerrado'; })
    .sort((a, b)=>(a.dueDate || '9999').localeCompare(b.dueDate || '9999') || String(a.title || '').localeCompare(String(b.title || '')));
}
function demDueInfo(v){
  if(!v.dueDate) return { lvl:'muted', txt:'Sem prazo', late:false, soon:false };
  const d = diffDays(localToday(), v.dueDate);
  if(d < 0) return { lvl:'danger', txt:'Atrasado ' + daysText(d) + ' · ' + fmtDM(v.dueDate), late:true, soon:false };
  if(d === 0) return { lvl:'warn', txt:'Entrega hoje', late:false, soon:true };
  if(d <= 2) return { lvl:'warn', txt:'Entrega ' + daysText(d) + ' · ' + fmtDM(v.dueDate), late:false, soon:true };
  return { lvl:'info', txt:'Entrega ' + daysText(d) + ' · ' + fmtDM(v.dueDate), late:false, soon:false };
}

function renderDemands(){
  const box = document.getElementById('demandsPanel'); if(!box) return;
  const nb = document.getElementById('btnNewVideo');
  if(nb){ nb.style.display = isAdminUser() ? '' : 'none'; nb.innerHTML = '<svg class="icon"><use href="#ic-plus"/></svg>Nova demanda'; }
  const filt = document.getElementById('videoClientFilter') ? document.getElementById('videoClientFilter').value : '';
  const all = demOpen().filter(v=>!filt || String(v.clientId) === String(filt));
  const late = all.filter(v=>demDueInfo(v).late).length;
  const rows = all.map(v=>{
    const di = demDueInfo(v), st = v.status || 'pendente';
    const steps = DEM_STEPS.map(s=>`<button type="button" class="${st === s[0] ? 'on' : ''}" onclick="demSet('${v.id}','${s[0]}')">${s[1]}</button>`).join('');
    return `<div class="dem ${di.late ? 'late' : ''}">
      <div class="dem-main">
        <div class="dem-client"><span class="client-dot" style="background:${clientColor(v.clientId)}"></span>${escapeHtml(clientName(v.clientId))}</div>
        <div class="dem-title">${escapeHtml(v.title || 'Vídeo')}</div>
        <div class="dem-meta">${badge(di.txt, di.lvl)}${v.notes ? `<span class="dem-note-t">${escapeHtml(String(v.notes).slice(0, 120))}</span>` : ''}</div>
      </div>
      <div class="seg dem-st" role="group" aria-label="Etapa">${steps}</div>
      <div class="dem-act">
        ${v.rawLink && isHttpUrl(v.rawLink) ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(v.rawLink)}" target="_blank" rel="noopener">${icon('folder', 14)}Bruto</a>` : ''}
        <button type="button" class="btn btn-primary btn-sm" onclick="demDeliver('${v.id}')">Entregar</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="editVideo('${v.id}')" aria-label="Editar">${icon('edit', 14)}</button>
        ${isAdminUser() ? `<button type="button" class="btn btn-ghost btn-sm" onclick="deleteVideo('${v.id}')" aria-label="Remover">${icon('trash', 14)}</button>` : ''}
      </div>
    </div>`;
  }).join('');
  const cnt = late ? badge(late + (late > 1 ? ' atrasadas' : ' atrasada'), 'danger') : (all.length ? badge(all.length + (all.length > 1 ? ' abertas' : ' aberta'), 'muted') : '');
  box.innerHTML = `<div class="dp dem-wrap ${demCollapsed ? 'collapsed' : ''}">
    <button type="button" class="dem-head" onclick="demToggle()" aria-expanded="${demCollapsed ? 'false' : 'true'}">
      <span class="dem-chev">${icon('chevron-right', 16)}</span><h3>Demandas de edição</h3>${late && all.length > late ? badge(all.length + ' abertas', 'muted') : ''}${cnt}
      <span class="dem-hint">${demCollapsed ? 'Mostrar' : 'Minimizar'}</span>
    </button>
    ${demCollapsed ? '' : (all.length ? rows : `<div class="dem-empty">Nenhuma demanda aberta.${isAdminUser() ? ' Crie uma em “Nova demanda”, com o nome do vídeo do roteiro e o prazo.' : ''}</div>`)}
  </div>`;
}
window.demSet = async function(id, st){
  const v = S.videoTasks.find(x=>String(x.id) === String(id)); if(!v || (v.status || 'pendente') === st) return;
  try{ await db.collection('video_tasks').doc(id).update({ status:st }); toast(st === 'gravado' ? 'Marcado como gravado. Agora é editar.' : st === 'editado' ? 'Marcado como editado. Falta entregar.' : 'Voltou para “a gravar”.', 'ok'); }
  catch(e){ toast('Não consegui salvar: ' + (e.message || 'erro'), 'error'); }
};
window.demDeliver = function(id){
  const v = S.videoTasks.find(x=>String(x.id) === String(id)); if(!v) return;
  delDemandId = v.id; delMonth = vMonth(v) || delMonth; delNumSel = null;
  const f = document.getElementById('videoClientFilter'); f.value = v.clientId;
  renderKanban();
  const t = document.getElementById('delTitle'); if(t) t.value = v.title || '';
  const l = document.getElementById('delLink'); if(l && v.finalLink && isHttpUrl(v.finalLink)) l.value = v.finalLink;
  const p = document.getElementById('deliveryPanel'); if(p && p.scrollIntoView) p.scrollIntoView({ behavior:'smooth', block:'start' });
};
window.demCancelDeliver = function(){ delDemandId = null; renderKanban(); };

/* a demanda some quando o vídeo é entregue (a entrega vira a linha “entregue”) */
const _saveDeliveryBase = saveDelivery;
saveDelivery = async function(a){
  await _saveDeliveryBase(a);
  if(!a.existing && delDemandId){
    const dem = S.videoTasks.find(x=>String(x.id) === String(delDemandId));
    const id = delDemandId; delDemandId = null;
    if(dem && String(dem.clientId) === String(a.clientId) && (dem.status || 'pendente') !== 'entregue'){
      try{ await db.collection('video_tasks').doc(id).delete(); }catch(_){}
    }
  }
};

const _renderKanbanBase = renderKanban;
renderKanban = function(){
  _renderKanbanBase();
  renderDemands();
  if(delDemandId){
    const dem = S.videoTasks.find(x=>String(x.id) === String(delDemandId));
    const dp = document.querySelector('#deliveryPanel .dp');
    if(dem && dp) dp.insertAdjacentHTML('afterbegin', `<div class="dem-banner">Esta entrega fecha a demanda <b>${escapeHtml(dem.title || 'Vídeo')}</b>. <button type="button" onclick="demCancelDeliver()">Cancelar</button></div>`);
    else if(!dem) delDemandId = null;
  }
};

const _homeAlertsBase = homeAlerts;
homeAlerts = function(){
  const out = _homeAlertsBase();
  if(hasAccess('video')){
    const open = demOpen();
    const late = open.filter(v=>demDueInfo(v).late), soon = open.filter(v=>demDueInfo(v).soon);
    const names = l=>l.slice(0, 3).map(v=>escapeHtml(clientName(v.clientId)) + ': ' + escapeHtml(v.title || 'vídeo')).join(' · ');
    if(late.length) out.push({ lvl:'urgent', ic:'film', title:`${late.length} demanda${late.length > 1 ? 's' : ''} de vídeo atrasada${late.length > 1 ? 's' : ''}`, sub:names(late), go:()=>goTab('video') });
    if(soon.length) out.push({ lvl:'soon', ic:'film', title:`${soon.length} demanda${soon.length > 1 ? 's' : ''} de vídeo para entregar em breve`, sub:names(soon), go:()=>goTab('video') });
  }
  const order = { urgent:0, soon:1, good:2, info:3, ok:4, muted:5 };
  return out.sort((a, b)=>(order[a.lvl] ?? 9) - (order[b.lvl] ?? 9));
};

const _updateNavBadgesBase = updateNavBadges;
updateNavBadges = function(){
  _updateNavBadgesBase();
  if(currentMember && hasAccess('video')){
    const n = S.videoTasks.filter(v=>v.approval === 'alteracao').length + demOpen().filter(v=>demDueInfo(v).late).length;
    setNavBadge('video', n, 'warn');
  }
};
