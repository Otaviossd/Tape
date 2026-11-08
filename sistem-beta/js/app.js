const S = {
  team: [], clients: [], socialPosts: [], videoTasks: [], postTasks: [],
  financeEntries: [], fixedExpenses: [], launches: [], lanzaEntries: [],
  financeReady: false,
};
const COLORS = ['#2F8F82','#4C6EF5','#E8590C','#9C36B5','#2F9E44','#E03131','#1098AD'];
const SERVICE_LABELS = {branding:'Branding',video:'Vídeo',trafego:'Tráfego pago',social:'Social media',web:'Site/App'};
const ROLE_LABELS = {admin:'Admin',social:'Social media',video:'Vídeo',outro:'Equipe',cliente:'Cliente'};
const WEEKDAYS_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SUPABASE_URL = 'https://dkpoqvggctglfjrhichs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcG9xdmdnY3RnbGZqcmhpY2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjkxMjcsImV4cCI6MjEwMjQwNTEyN30.va9_OpTA-8KjHiTVduReaQtFALhSALu_R9HE_19495M';
let sb = null, db = null, currentMember = null;

function fmtMoney(n){
  let v = Math.round(Number(n)||0); const neg = v<0; v = Math.abs(v);
  return (neg?'-':'') + '₲ ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function fmtDate(iso){ if(!iso) return '-'; const d = new Date(iso+'T00:00:00'); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function clientById(id){ return S.clients.find(c=>c.id===id); }
function clientName(id){ const c = clientById(id); return c ? c.name : '(cliente removido)'; }
function clientColor(id){ const c = clientById(id); return c ? c.color : '#999'; }
function todayISO(){ return localToday(); }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function initials(name){ return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''); }

/* ---- Supabase shim: same shape the rest of the app already expects ---- */
function makeSupaCollection(table){
  return {
    onSnapshot(cb, errCb){
      const load = async ()=>{
        const { data, error } = await sb.from(table).select('*');
        if(error){ errCb && errCb(error); return; }
        cb({ docs: (data||[]).map(row=>{ const {id, ...rest} = row; return {id, data:()=>rest}; }) });
      };
      load();
      sb.channel('public:'+table)
        .on('postgres_changes', {event:'*', schema:'public', table}, load)
        .subscribe();
    },
    async add(data){
      const { data: inserted, error } = await sb.from(table).insert(data).select().single();
      if(error) throw error;
      if(window.reloadTableSoon) reloadTableSoon(table);
      return { id: inserted.id };
    },
    doc(id){
      return {
        async update(data){ const { error } = await sb.from(table).update(data).eq('id', id); if(error) throw error; if(window.reloadTableSoon) reloadTableSoon(table); },
        async delete(){ const { error } = await sb.from(table).delete().eq('id', id); if(error) throw error; if(window.reloadTableSoon) reloadTableSoon(table); },
      };
    }
  };
}

function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
});

const ACCESS_DEFAULTS = {
  admin: {clientes:true, social:true, posts:true, video:true, lancamentos:true, financeiro:true, trafego:true, equipe:true},
  social: {clientes:true, social:true, posts:true, video:false, lancamentos:true, financeiro:false, trafego:false, equipe:false},
  video: {clientes:true, social:false, video:true, lancamentos:false, financeiro:false, trafego:false, equipe:false},
  outro: {clientes:true, social:false, video:false, lancamentos:false, financeiro:false, trafego:false, equipe:false},
  cliente: {},
};
function canSeeMoney(){ return !!(currentMember && (currentMember.role==='admin' || (currentMember.access && currentMember.access.financeiro))); }
function isClient(){ return !!(currentMember && currentMember.role==='cliente'); }
function setAccessCheckboxes(access){
  document.querySelectorAll('#personForm .checkchip input:not([disabled])').forEach(chk=>{
    chk.checked = !!(access && access[chk.value]);
  });
}
function syncRoleFields(){
  const isCli = document.getElementById('mRole').value==='cliente';
  document.getElementById('mClientField').style.display = isCli ? '' : 'none';
  document.getElementById('mAccessField').style.display = isCli ? 'none' : '';
  if(isCli){
    const sel = document.getElementById('mClient'); const cur = sel.value;
    sel.innerHTML = S.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if(cur) sel.value = cur;
  }
}
document.getElementById('mRole').addEventListener('change', e=>{
  if(!document.getElementById('mId').value && e.target.value!=='cliente'){ setAccessCheckboxes(ACCESS_DEFAULTS[e.target.value]); }
  syncRoleFields();
});
function fillClientSelects(){
  const opts = S.clients.filter(c=>c.status!=='encerrado').map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const optsSocial = S.clients.filter(c=>c.status!=='encerrado' && ((c.plan && c.plan.social) ? c.plan.social.on : true)).map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  ['vClient','fClient'].forEach(id=>{ document.getElementById(id).innerHTML = opts || '<option value="">Nenhum cliente cadastrado</option>'; });
  ['pClient','ptClient'].forEach(id=>{ document.getElementById(id).innerHTML = optsSocial || opts || '<option value="">Nenhum cliente cadastrado</option>'; });
  document.getElementById('socialClientFilter').innerHTML = '<option value="">Todos os clientes</option>' + opts;
  document.getElementById('videoClientFilter').innerHTML = '<option value="">Todos os clientes</option>' + opts;
  document.getElementById('postsClientFilter').innerHTML = '<option value="">Todos os clientes</option>' + opts;
}

/* ---- Link público do cronograma (sem login) ---- */
const SHARE_BASE = 'https://tapegrowth.agency/p/';
let shareClientId = null;
function slugify(t){ return (t||'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) || 'cliente'; }
function randSuffix(){ const a=new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a,b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join(''); }
function newShareSlug(name){ return slugify(name)+'-'+randToken(16); }
function refreshShareModal(){
  const c = S.clients.find(x=>x.id===shareClientId); if(!c) return;
  document.getElementById('shareTitle').textContent = 'Link do cliente: '+c.name;
  const on = !!c.shareSlug;
  document.getElementById('shareUrl').value = on ? SHARE_BASE+c.shareSlug : '';
  document.getElementById('shareUrl').placeholder = on ? '' : 'Link desativado';
  document.getElementById('shareCopy').style.display = on ? '' : 'none';
  document.getElementById('shareOff').style.display = on ? '' : 'none';
  document.getElementById('shareNew').textContent = on ? 'Gerar novo link' : 'Ativar link';
}
window.openShare = async function(id){
  const c = S.clients.find(x=>x.id===id); if(!c) return;
  shareClientId = id;
  if(!c.shareSlug){
    const slug = newShareSlug(c.name);
    const { error } = await sb.from('clients').update({shareSlug: slug}).eq('id', id);
    if(error){ alert('Não consegui criar o link. Rodou o SQL do link do cronograma? '+error.message); return; }
    c.shareSlug = slug;
  }
  refreshShareModal(); openModal('modalShare');
};
document.getElementById('shareCopy').addEventListener('click', async ()=>{
  const v = document.getElementById('shareUrl').value;
  try{ await navigator.clipboard.writeText(v); document.getElementById('shareCopy').textContent='Copiado!'; setTimeout(()=>document.getElementById('shareCopy').textContent='Copiar',1500); }
  catch(e){ document.getElementById('shareUrl').select(); }
});
document.getElementById('shareNew').addEventListener('click', async ()=>{
  const c = S.clients.find(x=>x.id===shareClientId); if(!c) return;
  if(c.shareSlug && !confirm('O link atual vai parar de funcionar. Gerar um novo?')) return;
  const slug = newShareSlug(c.name);
  const { error } = await sb.from('clients').update({shareSlug: slug}).eq('id', c.id);
  if(error){ alert(error.message); return; }
  c.shareSlug = slug; refreshShareModal();
});
document.getElementById('shareOff').addEventListener('click', async ()=>{
  const c = S.clients.find(x=>x.id===shareClientId); if(!c) return;
  if(!confirm('Desativar o link? Quem tiver o link antigo perde o acesso.')) return;
  const { error } = await sb.from('clients').update({shareSlug: null}).eq('id', c.id);
  if(error){ alert(error.message); return; }
  c.shareSlug = null; refreshShareModal();
});

let calMonth = new Date(); calMonth.setDate(1);
document.getElementById('calPrev').addEventListener('click', ()=>{ calMonth.setMonth(calMonth.getMonth()-1); renderCalendar(); });
document.getElementById('calNext').addEventListener('click', ()=>{ calMonth.setMonth(calMonth.getMonth()+1); renderCalendar(); });
document.getElementById('calToday').addEventListener('click', ()=>{ calMonth = new Date(); calMonth.setDate(1); renderCalendar(); });
document.getElementById('socialClientFilter').addEventListener('change', renderCalendar);
function fillPostRefSelect(clientId, selectedId){
  const sel = document.getElementById('pPostRef');
  const order = {entregue:0, aprovacao:1, em_criacao:2, a_fazer:3};
  const list = S.postTasks.filter(t=>t.clientId===clientId).sort((a,b)=>(order[a.status]??9)-(order[b.status]??9));
  sel.innerHTML = '<option value="">Nenhum (preencher manualmente)</option>' + list.map(t=>`<option value="${t.id}">${escapeHtml(t.title||'Post')} · ${POST_FORMAT_LABEL[t.format]||'Post'} · ${POST_STATUS_LABEL[t.status]||t.status}</option>`).join('');
  sel.value = selectedId || '';
}
function fillVideoRefSelect(clientId, selectedVideoId){
  const sel = document.getElementById('pVideoRef');
  const vids = S.videoTasks.filter(v=>v.clientId===clientId).sort((a,b)=>((b.status==='entregue')-(a.status==='entregue'))||String(b.month||'').localeCompare(String(a.month||''))||((b.number||0)-(a.number||0)));
  const opts = vids.map(v=>`<option value="${v.id}">${escapeHtml(v.title)} · ${VIDEO_STATUS_LABEL[v.status]||v.status}</option>`).join('');
  sel.innerHTML = '<option value="">Nenhum (preencher manualmente)</option>' + opts;
  sel.value = selectedVideoId || '';
}
document.getElementById('pClient').addEventListener('change', ()=>{
  fillVideoRefSelect(document.getElementById('pClient').value);
  fillPostRefSelect(document.getElementById('pClient').value);
});
document.getElementById('pPostRef').addEventListener('change', ()=>{
  const t = S.postTasks.find(x=>x.id===document.getElementById('pPostRef').value);
  if(!t) return;
  document.getElementById('pLink').value = t.finalLink || t.sourceLink || '';
  const capField = document.getElementById('pCaption');
  if(!capField.value.trim()){ capField.value = t.notes || t.title || ''; }
});
document.getElementById('pVideoRef').addEventListener('change', ()=>{
  const vid = S.videoTasks.find(v=>v.id===document.getElementById('pVideoRef').value);
  if(!vid) return;
  document.getElementById('pLink').value = vid.finalLink || vid.rawLink || '';
  const capField = document.getElementById('pCaption');
  if(!capField.value.trim()){ capField.value = vid.title; }
});
document.getElementById('btnNewPost').addEventListener('click', ()=>{
  if(S.clients.length===0){ alert('Cadastre um cliente antes de criar uma postagem.'); return; }
  openPostModal(todayISO());
});
function openPostModal(dateStr){
  document.getElementById('postModalTitle').textContent = 'Nova postagem';
  document.getElementById('postForm').reset();
  document.getElementById('pId').value='';
  document.getElementById('pDate').value = dateStr || todayISO();
  const filt = document.getElementById('socialClientFilter').value;
  if(filt) document.getElementById('pClient').value = filt;
  fillVideoRefSelect(document.getElementById('pClient').value);
  fillPostRefSelect(document.getElementById('pClient').value);
  openModal('modalPost');
}
window.editPost = function(id){
  const p = S.socialPosts.find(x=>x.id===id); if(!p) return;
  document.getElementById('postModalTitle').textContent = 'Editar postagem';
  document.getElementById('pId').value = p.id;
  document.getElementById('pClient').value = p.clientId;
  fillVideoRefSelect(p.clientId, p.videoTaskId);
  fillPostRefSelect(p.clientId, p.postTaskId);
  document.getElementById('pDate').value = p.date;
  document.getElementById('pTime').value = p.time;
  document.getElementById('pLink').value = p.driveLink||'';
  document.getElementById('pCaption').value = p.caption||'';
  closeModal('modalDay');
  openModal('modalPost');
};
window.deletePost = async function(id){
  if(!confirm('Remover esta postagem?')) return;
  await db.collection('social_posts').doc(id).delete();
  closeModal('modalDay');
};
window.togglePostStatus = async function(id, iso){
  const p = S.socialPosts.find(x=>x.id===id); if(!p) return;
  const newStatus = p.status==='feito' ? 'pendente' : 'feito';
  p.status = newStatus;
  if(iso) openDay(iso); else renderCalendar();
  await db.collection('social_posts').doc(id).update({status: newStatus});
  if(p.videoTaskId && S.videoTasks.some(v=>v.id===p.videoTaskId)){
    await db.collection('video_tasks').doc(p.videoTaskId).update({postedAt: newStatus==='feito' ? new Date().toISOString() : null});
  }
};
document.getElementById('postForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const data = {
    clientId: document.getElementById('pClient').value,
    videoTaskId: document.getElementById('pVideoRef').value || null,
    date: document.getElementById('pDate').value,
    time: document.getElementById('pTime').value,
    driveLink: document.getElementById('pLink').value.trim(),
    caption: document.getElementById('pCaption').value,
  };
  const ptRef = document.getElementById('pPostRef').value;
  const existing = id ? S.socialPosts.find(x=>x.id===id) : null;
  if(ptRef) data.postTaskId = ptRef; else if(existing && existing.postTaskId) data.postTaskId = null;
  if(id){ await db.collection('social_posts').doc(id).update(data); }
  else{ data.status='pendente'; data.createdAt = new Date().toISOString(); await db.collection('social_posts').add(data); }
  closeModal('modalPost');
});

/* ---- Cards resumidos de postagens (equipe e cliente) ---- */
const openPostCards = new Set();
const WD = ['dom','seg','ter','qua','qui','sex','sáb'];
function postCardHtml(p, mode){
  const d = new Date(p.date+'T00:00:00');
  const ptk = p.postTaskId ? S.postTasks.find(v=>v.id===p.postTaskId) : null;
  const done = p.status==='feito';
  const badge = mode==='client' ? (done?'Publicado':'Programado') : (done?'Postado':'Pendente');
  const staffActions = mode==='staff' ? `
      <span class="badge ${done?'badge-ok':'badge-warn'}" style="cursor:pointer;" onclick="togglePostStatus('${p.id}','')"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-check"/></svg>${done?'Postado':'Marcar como postado'}</span>
      <button class="btn btn-ghost btn-sm" onclick="editPost('${p.id}')"><svg class="icon"><use href="#ic-edit"/></svg></button>
      <button class="btn btn-ghost btn-sm" onclick="deletePost('${p.id}')"><svg class="icon"><use href="#ic-trash"/></svg></button>` : '';
  return `<details class="pc" data-id="${p.id}" ${openPostCards.has(p.id)?'open':''} ontoggle="togglePostCard(this)">
    <summary>
      <div class="pc-date"><b>${d.getDate()}</b><span>${WD[d.getDay()]}</span></div>
      <div class="pc-main">
        <div class="pc-top"><span>${escapeHtml(p.time||'')}</span>${mode==='staff' ? `<span style="display:inline-flex;align-items:center;gap:5px;"><span class="client-dot" style="background:${clientColor(p.clientId)}"></span>${escapeHtml(clientName(p.clientId))}</span>` : ''}<span class="badge ${done?'badge-ok':'badge-warn'}">${badge}</span></div>
        <div class="pc-cap">${escapeHtml(p.caption||'(sem legenda)')}</div>
      </div>
      <svg class="icon pc-chev" style="width:16px;height:16px;"><use href="#ic-chevron-right"/></svg>
    </summary>
    <div class="pc-body">
      ${ptk ? `<div style="font-size:11.5px;color:var(--teal-dk);font-weight:600;margin-bottom:6px;">${escapeHtml(ptk.title||'Post')}</div>` : ''}
      <div class="pc-full">${escapeHtml(p.caption||'(sem legenda)')}</div>
      <div class="pc-actions">
        ${p.driveLink ? `<a href="${escapeHtml(p.driveLink)}" target="_blank" rel="noopener" class="drivebtn"><svg class="icon" style="width:13px;height:13px;"><use href="#ic-link"/></svg>${mode==='client'?'Ver arquivo':'Arquivo'}</a>` : ''}
        ${staffActions}
      </div>
    </div>
  </details>`;
}
window.togglePostCard = function(el){ if(el.open) openPostCards.add(el.dataset.id); else openPostCards.delete(el.dataset.id); };
function renderMonthCards(posts, ym, boxId, mode, emptyHint){
  const list = posts.filter(p=>(p.date||'').startsWith(ym)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const box = document.getElementById(boxId);
  box.innerHTML = list.length ? list.map(p=>postCardHtml(p,mode)).join('') : `<div class="card"><div class="empty"><b>Nada programado</b>${emptyHint}</div></div>`;
}

function renderCalendar(){
  document.getElementById('calTitle').textContent = MONTHS[calMonth.getMonth()] + ' ' + calMonth.getFullYear();
  const filt = document.getElementById('socialClientFilter').value;
  let posts = filt ? S.socialPosts.filter(p=>p.clientId===filt) : S.socialPosts;
  const postsByDay = {};
  posts.forEach(p=>{ (postsByDay[p.date] = postsByDay[p.date]||[]).push(p); });

  const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const startOffset = (first.getDay()+6)%7;
  const gridStart = new Date(first); gridStart.setDate(first.getDate()-startOffset);
  const todayStr = todayISO();

  let html = WEEKDAYS_SHORT.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<42;i++){
    const d = new Date(gridStart); d.setDate(gridStart.getDate()+i);
    const iso = isoOf(d);
    const isOther = d.getMonth()!==calMonth.getMonth();
    const isToday = iso===todayStr;
    const dayPosts = postsByDay[iso]||[];
    const dots = dayPosts.slice(0,4).map(p=>`<span class="cal-dot" style="background:${clientColor(p.clientId)}"></span>`).join('');
    const more = dayPosts.length>4 ? `<span class="cal-more">+${dayPosts.length-4}</span>` : '';
    html += `<div class="cal-day ${isOther?'other-month':''} ${isToday?'today':''}" onclick="openDay('${iso}')">
      <span class="daynum">${d.getDate()}</span>
      <div class="cal-dots">${dots}${more}</div>
    </div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
  const ym = calMonth.getFullYear()+'-'+String(calMonth.getMonth()+1).padStart(2,'0');
  const fn = filt ? clientName(filt) : '';
  document.getElementById('calListTitle').textContent = fn ? 'Postagens de '+fn+' em '+MONTHS[calMonth.getMonth()] : 'Postagens de '+MONTHS[calMonth.getMonth()];
  renderMonthCards(posts, ym, 'calList', 'staff', 'Sem postagens neste mês.');
}
window.openDay = function(iso){
  const filt = document.getElementById('socialClientFilter').value;
  let posts = S.socialPosts.filter(p=>p.date===iso);
  if(filt) posts = posts.filter(p=>p.clientId===filt);
  posts.sort((a,b)=>a.time.localeCompare(b.time));
  const d = new Date(iso+'T00:00:00');
  document.getElementById('dayModalTitle').textContent = d.toLocaleDateString('pt-BR',{weekday:'long', day:'2-digit', month:'long'});
  const body = document.getElementById('dayModalBody');
  if(posts.length===0){
    body.innerHTML = `<div class="empty" style="padding:20px 0;"><b>Nada programado</b>Sem postagens pra este dia ainda.</div>`;
  } else {
    body.innerHTML = posts.map(p=>{
      const vid = p.videoTaskId ? S.videoTasks.find(v=>v.id===p.videoTaskId) : null;
      const ptk = p.postTaskId ? S.postTasks.find(v=>v.id===p.postTaskId) : null;
      return `<div class="daypost-item" style="border-left:3px solid ${clientColor(p.clientId)};">
      <div class="daypost-top">
        <span class="daypost-time">${p.time}</span>
        <span style="font-size:12px;font-weight:700;color:var(--muted);">${escapeHtml(clientName(p.clientId))}</span>
      </div>
      ${ptk ? `<div style="font-size:11px;color:var(--teal-dk);font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:4px;"><svg class="icon" style="width:11px;height:11px;"><use href="#ic-image"/></svg>${escapeHtml(ptk.title||'Post')}</div>` : ''}
      ${vid ? `<div style="font-size:11px;color:var(--teal-dk);font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:4px;"><svg class="icon" style="width:11px;height:11px;"><use href="#ic-film"/></svg>${escapeHtml(vid.title)}</div>` : ''}
      <div class="daypost-caption">${escapeHtml(p.caption||'(sem legenda)')}</div>
      <div class="daypost-meta">
        <span class="badge ${p.status==='feito'?'badge-ok':'badge-warn'}" style="cursor:pointer;" onclick="togglePostStatus('${p.id}','${iso}')">
          <svg class="icon" style="width:12px;height:12px;"><use href="#ic-check"/></svg>${p.status==='feito'?'Postado':'Pendente'}
        </span>
        ${p.driveLink ? `<a href="${escapeHtml(p.driveLink)}" target="_blank" class="drivebtn"><svg class="icon" style="width:13px;height:13px;"><use href="#ic-link"/></svg>Arquivo</a>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="editPost('${p.id}')"><svg class="icon"><use href="#ic-edit"/></svg></button>
        <button class="btn btn-ghost btn-sm" onclick="deletePost('${p.id}')"><svg class="icon"><use href="#ic-trash"/></svg></button>
      </div>
    </div>`;
    }).join('');
  }
  document.getElementById('dayAddPostBtn').onclick = ()=>{ closeModal('modalDay'); openPostModal(iso); };
  openModal('modalDay');
};

document.getElementById('videoClientFilter').addEventListener('change', renderKanban);
document.getElementById('btnBulkVideo').addEventListener('click', ()=>{
  if(S.clients.length===0){ alert('Cadastre um cliente primeiro.'); return; }
  document.getElementById('bulkForm').reset();
  document.getElementById('bClient').innerHTML = document.getElementById('vClient').innerHTML;
  const filt = document.getElementById('videoClientFilter').value;
  if(filt) document.getElementById('bClient').value = filt;
  const n = new Date();
  document.getElementById('bMonth').value = n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  document.getElementById('bPrefix').value = 'Vídeo';
  openModal('modalBulk');
});
document.getElementById('bulkForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const clientId = document.getElementById('bClient').value;
  const month = document.getElementById('bMonth').value;
  const prefix = document.getElementById('bPrefix').value.trim() || 'Vídeo';
  const links = document.getElementById('bLinks').value.split(/\s*\n\s*/).map(x=>x.trim()).filter(Boolean);
  if(!links.length) return;
  if(links.some(l=>!/^https?:\/\//i.test(l))){ alert('Cada linha precisa ser um link completo (https://...).'); return; }
  let max = 0;
  S.videoTasks.filter(v=>v.clientId===clientId && vMonth(v)===month).forEach(v=>{ if(vNum(v)>max) max=vNum(v); });
  for(let i=0;i<links.length;i++){
    const num = max+i+1;
    await db.collection('video_tasks').add({
      clientId, month, number:num, title: prefix+' '+pad2(num), status:'entregue',
      finalLink: links[i], approval:'aguardando', createdAt: new Date().toISOString()
    });
  }
  closeModal('modalBulk');
});
document.getElementById('btnNewVideo').addEventListener('click', ()=>{
  if(S.clients.length===0){ alert('Cadastre um cliente antes de criar uma entrega.'); return; }
  document.getElementById('videoModalTitle').textContent = 'Nova entrega de vídeo';
  document.getElementById('videoForm').reset();
  document.getElementById('vId').value='';
  const filt = document.getElementById('videoClientFilter').value;
  if(filt) document.getElementById('vClient').value = filt;
  openModal('modalVideo');
});
window.editVideo = function(id){
  const v = S.videoTasks.find(x=>x.id===id); if(!v) return;
  document.getElementById('videoModalTitle').textContent = 'Editar entrega';
  document.getElementById('vId').value = v.id;
  document.getElementById('vClient').value = v.clientId;
  document.getElementById('vTitle').value = v.title;
  document.getElementById('vDue').value = v.dueDate||'';
  document.getElementById('vStatus').value = v.status||'pendente';
  document.getElementById('vRaw').value = v.rawLink||'';
  document.getElementById('vFinal').value = v.finalLink||'';
  document.getElementById('vNotes').value = v.notes||'';
  openModal('modalVideo');
};
window.deleteVideo = async function(id){
  if(!confirm('Remover esta entrega?')) return;
  const v = S.videoTasks.find(x=>x.id===id);
  if(v && v.filePath){ try{ await sb.storage.from('entregas').remove([v.filePath]); }catch(_){} }
  await db.collection('video_tasks').doc(id).delete();
};
document.getElementById('videoForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('vId').value;
  const data = {
    clientId: document.getElementById('vClient').value,
    title: document.getElementById('vTitle').value.trim(),
    dueDate: document.getElementById('vDue').value,
    status: document.getElementById('vStatus').value,
    rawLink: document.getElementById('vRaw').value.trim(),
    finalLink: document.getElementById('vFinal').value.trim(),
    notes: document.getElementById('vNotes').value.trim(),
  };
  { const prev = id ? S.videoTasks.find(x=>x.id===id) : null; data.month = (prev && prev.month) || String(data.dueDate||localToday()).slice(0,7); }
  if(id){ await db.collection('video_tasks').doc(id).update(data); }
  else{ data.createdAt = new Date().toISOString(); await db.collection('video_tasks').add(data); }
  closeModal('modalVideo');
});
const VIDEO_STATUSES = ['pendente','gravado','editado','entregue'];
const VIDEO_STATUS_LABEL = {pendente:'Pendente',gravado:'Gravado',editado:'Editado',entregue:'Entregue'};
let draggedVideoId = null;
let delMonth = (()=>{const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');})();
const pad2 = n=>String(n).padStart(2,'0');
function vNum(v){ const m=String(v.title||'').match(/^v[ií]deo\s*0*(\d+)\s*$/i); return m?+m[1]:(v.number||0); }
function vMonth(v){ return v.month || String(v.dueDate||v.createdAt||'').slice(0,7); }
function driveIdOf(u){ const m=String(u||'').match(/\/d\/([\w-]+)/)||String(u||'').match(/[?&]id=([\w-]+)/); return m?m[1]:''; }
function monthLabel(ym){ const [y,m]=ym.split('-'); return MONTHS[+m-1]+' '+y; }
window.delPick = function(id){ delNumSel = null; const f=document.getElementById('videoClientFilter'); f.value=id; renderKanban(); };
window.delMonthChange = function(v){ if(v){ delNumSel=null; delMonth=v; renderDeliveryPanel(); renderPostsDemand(); } };
window.delAdd = async function(){
  const clientId = document.getElementById('videoClientFilter').value; if(!clientId) return;
  const link = document.getElementById('delLink').value.trim();
  if(!/^https?:\/\//i.test(link)){ alert('Cole o link completo do Drive (https://...).'); return; }
  let max=0; S.videoTasks.filter(v=>v.clientId===clientId && vMonth(v)===delMonth).forEach(v=>{ if(vNum(v)>max) max=vNum(v); });
  const num = max+1;
  const title = document.getElementById('delTitle').value.trim() || ('Vídeo '+pad2(num));
  document.getElementById('delLink').value=''; document.getElementById('delTitle').value='';
  await db.collection('video_tasks').add({clientId, month:delMonth, number:num, title, status:'entregue', approval:'aguardando', finalLink:link, createdAt:new Date().toISOString()});
};
function demandCard(color,name,done,qty,unit,onclick){
  const pct = qty ? Math.min(100,Math.round(done/qty*100)) : 0;
  const full = qty>0 && done>=qty;
  const left = qty ? Math.max(0,qty-done) : 0;
  return `<button type="button" class="dc ${full?'full':''}" onclick="${onclick}">
    <div class="dc-top"><div class="dc-name"><span class="client-dot" style="background:${color||'#999'}"></span><span class="n">${escapeHtml(name)}</span></div>
    <div class="dc-count">${done}${qty?` <small>de ${qty}</small>`:` <small>${unit}</small>`}</div></div>
    ${qty?`<div class="pbar"><i style="width:${pct}%"></i></div><div class="dc-foot"><span>${full?'<b>Completo</b>':`Faltam <b>${left}</b> ${unit}`}</span><span>${pct}%</span></div>`:`<div class="dc-foot"><span>Defina a quantidade por mês no cadastro do cliente</span></div>`}
  </button>`;
}
function monthInputHtml(fn){ return `<input type="month" class="mi" value="${delMonth}" onchange="${fn}(this.value)">`; }
function renderDeliveryPanel(){
  const box = document.getElementById('deliveryPanel'); if(!box) return;
  const filt = document.getElementById('videoClientFilter').value;
  const keep = {t:(document.getElementById('delTitle')||{}).value||'', l:(document.getElementById('delLink')||{}).value||''};
  const vcs = S.clients.filter(c=>(c.services||[]).includes('video') && c.status!=='encerrado');
  const countFor = id => S.videoTasks.filter(v=>v.clientId===id && vMonth(v)===delMonth && v.status==='entregue').length;
  if(!filt){
    if(!vcs.length){ box.innerHTML=''; return; }
    let totalQ=0,totalD=0; vcs.forEach(c=>{ const q=planOf(c).qtyVideo; totalQ+=q; totalD+=Math.min(countFor(c.id),q||countFor(c.id)); });
    box.innerHTML = `<div class="dp"><div class="dp-head"><h3>Demanda do mês</h3>${monthInputHtml('delMonthChange')}</div>
      <div class="dp-sub">${totalQ?`${Math.max(0,totalQ-totalD)} vídeos para entregar em ${monthLabel(delMonth)}`:'Escolha um cliente para subir os vídeos'}</div>
      ${vcs.map(c=>demandCard(c.color,c.name,countFor(c.id),planOf(c).qtyVideo,'vídeos',`delPick('${c.id}')`)).join('')}</div>`;
    return;
  }
  const c = clientById(filt); if(!c){ box.innerHTML=''; return; }
  const list = S.videoTasks.filter(v=>v.clientId===filt && vMonth(v)===delMonth).sort((a,b)=>vNum(a)-vNum(b));
  const done = list.filter(v=>v.status==='entregue').length;
  const q = planOf(c).qtyVideo; const pct = q?Math.min(100,Math.round(done/q*100)):0;
  let max=0; list.forEach(v=>{ if(vNum(v)>max) max=vNum(v); });
  box.innerHTML = `<div class="dp">
    <div class="dp-head"><h3>${escapeHtml(c.name)}</h3>${monthInputHtml('delMonthChange')}</div>
    <div class="dp-sub">${monthLabel(delMonth)}</div>
    ${demandCard(c.color,'Vídeos entregues',done,q,'vídeos','void(0)')}
    <div class="dp-form" style="margin-top:16px;">
      <div class="field" style="margin:0;"><label>Qual vídeo é</label><select id="delNum" onchange="delNumSel=+this.value">${numOptionsHtml(filt, delMonth, delNumSel, null)}</select></div>
      <div class="field" style="margin:0;"><label>Nome (opcional)</label><input id="delTitle" placeholder="Vídeo"></div>
    </div>
    <div class="field" style="margin:10px 0 0;"><label>Link do Drive (original em alta qualidade)</label><input id="delLink" type="url" placeholder="https://drive.google.com/..."></div>
    <div class="field" style="margin:10px 0 0;"><label>Arquivo do vídeo (o sistema comprime sozinho para a prévia)</label>
      <label class="btn btn-outline" style="cursor:pointer;width:100%;justify-content:center;"><svg class="icon"><use href="#ic-folder"/></svg>Escolher arquivo<input type="file" accept="video/*" hidden onchange="delPickFile(this)"></label>
      <div id="delFileName" style="font-size:12px;color:var(--muted);margin-top:6px;word-break:break-all;">${delPickedFile?escapeHtml(delPickedFile.name):'Nenhum arquivo escolhido'}</div>
    </div>
    <div class="dp-actions">
      <button class="btn btn-primary" id="delBtn" onclick="delAddFull()" ${delBtnLabel?'disabled':''}>${delBtnLabel?`<span class="spin"></span>${delBtnLabel}`:'<svg class="icon"><use href="#ic-plus"/></svg>Adicionar vídeo'}</button>
      <button class="btn btn-outline" onclick="openShare('${c.id}')"><svg class="icon"><use href="#ic-link"/></svg>Link para o cliente</button>
      <button class="btn btn-ghost" onclick="delPick('')">Voltar</button>
    </div>
    ${list.length?`<div class="vgrid2">${list.map(v=>{const id=driveIdOf(v.finalLink);return `<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff;"><a href="${escapeHtml(v.finalLink||'#')}" target="_blank" style="display:block;aspect-ratio:9/12;background:#10201d;position:relative;">${v.filePath?`<video muted playsinline preload="metadata" src="${fileUrlOf(v.filePath)}#t=0.1" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>`:(id?`<img loading="lazy" alt="" src="https://drive.google.com/thumbnail?id=${id}&sz=w320" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onerror="this.remove()">`:'')}</a><div style="padding:8px 10px;font-size:12.5px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:6px;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.title)}</span><button class="btn btn-ghost btn-sm" onclick="deleteVideo('${v.id}')" style="padding:3px 5px;"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-trash"/></svg></button></div><div style="padding:0 10px 10px;">${v.filePath?'<span class="badge badge-ok">Prévia ok</span> ':''}${approvalBadge(v)} <button class="btn btn-outline btn-sm" style="width:100%;justify-content:center;margin-top:6px;" onclick="delEdit('${v.id}')"><svg class="icon"><use href="#ic-edit"/></svg>Editar</button>}</div></div>`;}).join('')}</div>`:''}
  </div>`;
  if(keep.t && document.getElementById('delTitle')) document.getElementById('delTitle').value=keep.t;
  if(keep.l && document.getElementById('delLink')) document.getElementById('delLink').value=keep.l;
}
function postMonthOf(t){ return String(t.dueDate||t.createdAt||'').slice(0,7); }
window.postsPick = function(id){ document.getElementById('postsClientFilter').value=id; renderPostsBoard(); };
window.postsMonthChange = function(v){ if(v){ delMonth=v; renderPostsDemand(); renderDeliveryPanel(); } };
function renderPostsDemand(){
  const box = document.getElementById('postsDemand'); if(!box) return;
  const filt = document.getElementById('postsClientFilter').value;
  let cs = S.clients.filter(c=>c.status!=='encerrado' && (c.services||[]).includes('social'));
  if(filt) cs = cs.filter(c=>c.id===filt);
  if(!cs.length){ box.innerHTML=''; return; }
  const countFor = id => S.postTasks.filter(t=>t.clientId===id && t.status==='entregue' && postMonthOf(t)===delMonth).length;
  let tq=0,td=0; cs.forEach(c=>{ const q=planOf(c).qtySocial; tq+=q; td+=Math.min(countFor(c.id),q||countFor(c.id)); });
  box.innerHTML = `<div class="dp"><div class="dp-head"><h3>Demanda do mês</h3>${monthInputHtml('postsMonthChange')}</div>
    <div class="dp-sub">${tq?`${Math.max(0,tq-td)} posts para entregar em ${monthLabel(delMonth)}`:monthLabel(delMonth)}</div>
    ${cs.map(c=>demandCard(c.color,c.name,countFor(c.id),planOf(c).qtySocial,'posts',`postsPick('${c.id}')`)).join('')}</div>`;
}
const fileUrlOf = fp => SUPABASE_URL+'/storage/v1/object/public/entregas/'+String(fp).split('/').map(encodeURIComponent).join('/');
function uploadWithProgress(file, path, onPct){
  return new Promise(async (resolve,reject)=>{
    const { data } = await sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if(!token){ reject(new Error('Sessão expirada. Entre de novo.')); return; }
    const x = new XMLHttpRequest();
    x.open('POST', SUPABASE_URL+'/storage/v1/object/entregas/'+path.split('/').map(encodeURIComponent).join('/'));
    x.setRequestHeader('Authorization','Bearer '+token);
    x.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    x.setRequestHeader('x-upsert','false');
    x.setRequestHeader('Content-Type', file.type || 'video/mp4');
    x.upload.onprogress = e=>{ if(e.lengthComputable) onPct(Math.round(e.loaded/e.total*100)); };
    x.onload = ()=>{
      if(x.status>=200 && x.status<300) return resolve();
      let msg=''; try{ msg = JSON.parse(x.responseText).message||''; }catch(_){}
      if(x.status===413 || /size|exceed/i.test(msg)) msg = 'Arquivo maior que o limite do plano do Supabase.';
      reject(new Error(msg || ('Erro '+x.status)));
    };
    x.onerror = ()=>reject(new Error('Falha de conexão no envio.'));
    x.send(file);
  });
}
let delBtnLabel = null;
function setBtnLabel(t){
  delBtnLabel = t;
  const b=document.getElementById('delBtn'); if(!b) return;
  b.disabled = !!t;
  b.innerHTML = t ? `<span class="spin"></span>${t}` : '<svg class="icon"><use href="#ic-plus"/></svg>Adicionar vídeo';
}
function setUpStatus(html){
  const b=document.getElementById('delUpStatus'); if(!b) return;
  b.innerHTML = html ? `<div class="dp" style="margin-top:-6px;">${html}</div>` : '';
}
let delPickedFile = null, delBusy = false, ffmpegInst = null;
const FFMPEG_BASE = location.origin + location.pathname.replace(/index\.html$/,'').replace(/\/+$/,'') + '/ffmpeg/';
async function getFFmpeg(onLoad){
  if(ffmpegInst) return ffmpegInst;
  if(!window.FFmpegWASM){
    await new Promise((ok,err)=>{ const sc=document.createElement('script'); sc.src=FFMPEG_BASE+'ffmpeg.js'; sc.onload=ok; sc.onerror=()=>err(new Error('Não foi possível carregar o compressor.')); document.head.appendChild(sc); });
  }
  const ff = new window.FFmpegWASM.FFmpeg();
  await ff.load({ classWorkerURL: FFMPEG_BASE+'814.ffmpeg.js', coreURL: FFMPEG_BASE+'ffmpeg-core.js', wasmURL: FFMPEG_BASE+'ffmpeg-core.wasm' });
  ffmpegInst = ff; return ff;
}
async function compressVideo(file, onPct){
  const ff = await getFFmpeg();
  const ext = (file.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp4';
  const inName = 'in.'+ext;
  const handler = ({progress})=>{ if(progress>=0 && progress<=1) onPct(Math.round(progress*100)); };
  ff.on('progress', handler);
  try{
    await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
    const rc = await ff.exec(['-i',inName,'-vf',"scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'",'-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','out.mp4']);
    if(rc!==0) throw new Error('Falha ao comprimir.');
    const out = await ff.readFile('out.mp4');
    return new Blob([out.buffer], {type:'video/mp4'});
  } finally {
    ff.off('progress', handler);
    try{ await ff.deleteFile(inName); }catch(_){}
    try{ await ff.deleteFile('out.mp4'); }catch(_){}
  }
}
window.delPickFile = function(input){ delPickedFile = input.files[0]||null; const l=document.getElementById('delFileName'); if(l) l.textContent = delPickedFile ? delPickedFile.name : 'Nenhum arquivo escolhido'; };
window.delAttach = function(id){
  if(delBusy) return;
  const v = S.videoTasks.find(x=>x.id===id); if(!v) return;
  const inp = document.createElement('input'); inp.type='file'; inp.accept='video/*';
  inp.onchange = async ()=>{
    const file = inp.files[0]; if(!file) return;
    delBusy = true;
    try{
      setUpStatus('<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Preparando compressor...</div><div class="pbar"><i style="width:3%"></i></div>');
      let blob = file;
      try{ blob = await compressVideo(file, pct=>setUpStatus(`<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Comprimindo a prévia: ${pct}%</div><div class="pbar"><i style="width:${pct}%"></i></div>`)); }
      catch(e){ if(file.size>50*1024*1024) throw new Error('Não deu para comprimir e o arquivo é grande. Tente pelo computador.'); }
      const path = `${v.clientId}/${vMonth(v)||delMonth}/${Date.now()}-${randToken(6)}-${pad2(vNum(v))}.mp4`;
      await uploadWithProgress(blob, path, pct=>setUpStatus(`<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Enviando prévia: ${pct}%</div><div class="pbar"><i style="width:${pct}%"></i></div>`));
      if(v.filePath){ try{ await sb.storage.from('entregas').remove([v.filePath]); }catch(_){} }
      const upd = {filePath:path}; if(!v.finalLink) upd.finalLink = fileUrlOf(path);
      await db.collection('video_tasks').doc(id).update(upd);
      setUpStatus('<div style="color:#1f7a47;font-weight:700;font-size:13px;">Prévia adicionada.</div>'); setTimeout(()=>setUpStatus(''),3000);
    }catch(err){ setUpStatus(`<div style="color:#b3261e;font-weight:700;font-size:13px;">Falhou: ${escapeHtml(err.message||'erro')}</div>`); }
    finally{ delBusy=false; }
  };
  inp.click();
};
let delNumSel = null;
function numOptionsHtml(clientId, month, selected, excludeId){
  const c = clientById(clientId); const q = c ? planOf(c).qtyVideo : 0;
  const tasks = S.videoTasks.filter(v=>v.clientId===clientId && vMonth(v)===month && v.id!==excludeId);
  const taken = new Set(tasks.map(v=>vNum(v))); let max=0; tasks.forEach(v=>{ if(vNum(v)>max) max=vNum(v); });
  const N = q ? Math.max(q,max,selected||0) : Math.max(max+3,6,selected||0);
  let sel = selected;
  if(!sel){ for(let i=1;i<=N;i++){ if(!taken.has(i)){ sel=i; break; } } if(!sel) sel=N; }
  let h=''; for(let i=1;i<=N;i++){ h+=`<option value="${i}" ${i===sel?'selected':''}>Vídeo ${pad2(i)}${taken.has(i)?' (já enviado)':''}</option>`; }
  return h;
}
async function saveDelivery({clientId, month, number, title, link, file, existing}){
  const data = {clientId, month, number, title, status:'entregue'};
  let finalLink = link || (existing ? (existing.finalLink||'') : '');
  let oldPath = null;
  if(file){
    let blob = file;
    try{
      setBtnLabel('Preparando...');
      setUpStatus(`<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Preparando compressor...</div><div class="pbar"><i style="width:3%"></i></div>`);
      blob = await compressVideo(file, pct=>{ setBtnLabel('Comprimindo '+pct+'%'); setUpStatus(`<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Comprimindo a prévia: ${pct}%</div><div class="pbar"><i style="width:${pct}%"></i></div>`); });
    }catch(err){
      if(file.size > 50*1024*1024) throw new Error('Não deu para comprimir e o arquivo é grande. Tente de novo no computador ou use só o link do Drive.');
      blob = file;
    }
    const path = `${clientId}/${month}/${Date.now()}-${randToken(6)}-${pad2(number)}.mp4`;
    const label = pct=>`<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Enviando prévia (${(blob.size/1048576).toFixed(1)} MB): ${pct}%</div><div class="pbar"><i style="width:${pct}%"></i></div>`;
    setBtnLabel('Enviando 0%'); setUpStatus(label(0));
    await uploadWithProgress(blob, path, pct=>{ setBtnLabel('Enviando '+pct+'%'); setUpStatus(label(pct)); });
    data.filePath = path;
    if(existing && existing.filePath) oldPath = existing.filePath;
    if(!finalLink || (existing && existing.filePath && finalLink===fileUrlOf(existing.filePath))) finalLink = fileUrlOf(path);
  }
  data.finalLink = finalLink;
  if(!existing){ data.approval = 'aguardando'; }
  else if((file || (finalLink && finalLink !== existing.finalLink)) && ['alteracao','aprovado'].includes(existing.approval)){
    data.approval = 'aguardando'; data.approvalNote = null; data.postedAt = null;
    data.approvalLog = [...(existing.approvalLog||[]), {at:new Date().toISOString(), action:'resubmitted', by:'staff'}];
  }
  if(existing){ await db.collection('video_tasks').doc(existing.id).update(data); }
  else { data.createdAt = new Date().toISOString(); await db.collection('video_tasks').add(data); }
  if(oldPath){ try{ await sb.storage.from('entregas').remove([oldPath]); }catch(_){} }
}
window.delAddFull = async function(){
  if(delBusy) return;
  const clientId = document.getElementById('videoClientFilter').value; if(!clientId) return;
  const link = (document.getElementById('delLink').value||'').trim();
  const typed = (document.getElementById('delTitle').value||'').trim();
  const number = +document.getElementById('delNum').value;
  const file = delPickedFile;
  if(!link && !file){ alert('Cole o link do Drive e/ou escolha o arquivo do vídeo.'); return; }
  if(link && !/^https?:\/\//i.test(link)){ alert('Cole o link completo do Drive (https://...).'); return; }
  if(!link && !confirm('Sem o link do Drive, o cliente NÃO poderá baixar o original (só assistir a prévia). Continuar mesmo assim?')) return;
  const existing = S.videoTasks.find(v=>v.clientId===clientId && vMonth(v)===delMonth && vNum(v)===number);
  if(existing && !confirm('O Vídeo '+pad2(number)+' já foi enviado. Substituir pelo novo?')) return;
  delBusy = true; setBtnLabel('Iniciando...');
  try{
    await saveDelivery({clientId, month:delMonth, number, title: typed || ('Vídeo '+pad2(number)), link, file, existing});
    delPickedFile = null; delNumSel = null;
    document.getElementById('delTitle').value=''; document.getElementById('delLink').value='';
    const l=document.getElementById('delFileName'); if(l) l.textContent='Nenhum arquivo escolhido';
    setUpStatus('<div style="color:#1f7a47;font-weight:700;font-size:13px;">Vídeo adicionado.</div>'); setTimeout(()=>setUpStatus(''),3000);
    renderDeliveryPanel();
  }catch(err){
    setUpStatus(`<div style="color:#b3261e;font-weight:700;font-size:13px;">Falhou: ${escapeHtml(err.message||'erro')}</div>`);
  }finally{ delBusy=false; setBtnLabel(null); }
};
window.delEdit = function(id){
  const v = S.videoTasks.find(x=>x.id===id); if(!v) return;
  document.getElementById('deId').value = id;
  document.getElementById('deNum').innerHTML = numOptionsHtml(v.clientId, vMonth(v), vNum(v)||1, null);
  document.getElementById('deTitle').value = v.title||'';
  document.getElementById('deLink').value = (v.filePath && v.finalLink===fileUrlOf(v.filePath)) ? '' : (v.finalLink||'');
  document.getElementById('deFile').value = '';
  openModal('modalDelEdit');
};
document.getElementById('delEditForm').addEventListener('submit', async e=>{
  e.preventDefault();
  if(delBusy) return;
  const id = document.getElementById('deId').value;
  const v = S.videoTasks.find(x=>x.id===id); if(!v) return;
  const link = document.getElementById('deLink').value.trim();
  if(link && !/^https?:\/\//i.test(link)){ alert('Cole o link completo do Drive (https://...).'); return; }
  const number = +document.getElementById('deNum').value;
  const file = document.getElementById('deFile').files[0] || null;
  const month = vMonth(v);
  const other = S.videoTasks.find(x=>x.id!==id && x.clientId===v.clientId && vMonth(x)===month && vNum(x)===number);
  if(other && !confirm('O Vídeo '+pad2(number)+' já existe. Trocar a posição dos dois?')) return;
  const typed = document.getElementById('deTitle').value.trim();
  const autoOld = 'Vídeo '+pad2(vNum(v));
  const title = (typed && typed!==autoOld) ? typed : ('Vídeo '+pad2(number));
  closeModal('modalDelEdit');
  delBusy = true;
  try{
    await saveDelivery({clientId:v.clientId, month, number, title, link, file, existing:v});
    if(other){ await db.collection('video_tasks').doc(other.id).update({number:vNum(v), title: (other.title===('Vídeo '+pad2(vNum(other))))?('Vídeo '+pad2(vNum(v))):other.title}); }
    setUpStatus('<div style="color:#1f7a47;font-weight:700;font-size:13px;">Entrega atualizada.</div>'); setTimeout(()=>setUpStatus(''),3000);
  }catch(err){
    setUpStatus(`<div style="color:#b3261e;font-weight:700;font-size:13px;">Falhou: ${escapeHtml(err.message||'erro')}</div>`);
  }finally{ delBusy=false; setBtnLabel(null); }
});
function renderKanban(){
  renderDeliveryPanel();
  const filt = document.getElementById('videoClientFilter').value;
  let tasks = [...S.videoTasks];
  if(filt) tasks = tasks.filter(t=>t.clientId===filt);
  const kb = document.getElementById('videoKanban');
  kb.innerHTML = VIDEO_STATUSES.map(st=>{
    const items = tasks.filter(t=>(t.status||'pendente')===st);
    return `<div class="kanban-col" data-status="${st}">
      <div class="kanban-col-head"><b>${VIDEO_STATUS_LABEL[st]}</b><span class="kanban-count">${items.length}</span></div>
      <div class="kanban-col-body" style="min-height:60px;">
        ${items.map(t=>`<div class="kb-card" draggable="true" data-id="${t.id}" onclick="editVideo('${t.id}')">
          <div class="kb-client"><span class="client-dot" style="background:${clientColor(t.clientId)}"></span>${escapeHtml(clientName(t.clientId))}</div>
          <div class="kb-title">${escapeHtml(t.title)}</div>
          ${approvalHtml(t)}
          ${t.dueDate ? `<div class="kb-due">Prazo: ${fmtDate(t.dueDate)}</div>` : ''}
          <div class="kb-links" onclick="event.stopPropagation()">
            ${t.rawLink ? `<a href="${escapeHtml(t.rawLink)}" target="_blank" class="drivebtn"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-folder"/></svg>Bruto</a>` : ''}
            ${t.finalLink ? `<a href="${escapeHtml(t.finalLink)}" target="_blank" class="drivebtn"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-check"/></svg>Final</a>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="deleteVideo('${t.id}')" style="padding:4px 6px;"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-trash"/></svg></button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  kb.querySelectorAll('.kb-card').forEach(card=>{
    card.addEventListener('dragstart', ()=>{ draggedVideoId = card.dataset.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', ()=>{ card.classList.remove('dragging'); });
  });
  kb.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', ()=>col.classList.remove('dragover'));
    col.addEventListener('drop', async e=>{
      e.preventDefault(); col.classList.remove('dragover');
      if(draggedVideoId){ await db.collection('video_tasks').doc(draggedVideoId).update({status: col.dataset.status}); draggedVideoId=null; }
    });
  });
}


/* ---- Posts (artes): quadro por status, com Drive ---- */
const POST_STATUSES = ['a_fazer','em_criacao','aprovacao','entregue'];
const POST_STATUS_LABEL = {a_fazer:'A fazer', em_criacao:'Em criação', aprovacao:'Em aprovação', entregue:'Entregue'};
const POST_FORMAT_LABEL = {feed:'Feed', carrossel:'Carrossel', stories:'Stories', reels:'Capa de Reels', outro:'Outro'};
let draggedPostTaskId = null;
document.getElementById('postsClientFilter').addEventListener('change', renderPostsBoard);
document.getElementById('btnNewPostTask').addEventListener('click', ()=>{
  if(S.clients.length===0){ alert('Cadastre um cliente antes de criar um post.'); return; }
  document.getElementById('postTaskModalTitle').textContent = 'Novo post';
  document.getElementById('postTaskForm').reset();
  document.getElementById('ptId').value='';
  const filt = document.getElementById('postsClientFilter').value;
  if(filt) document.getElementById('ptClient').value = filt;
  openModal('modalPostTask');
});
window.editPostTask = function(id){
  const t = S.postTasks.find(x=>x.id===id); if(!t) return;
  document.getElementById('postTaskModalTitle').textContent = 'Editar post';
  document.getElementById('ptId').value = t.id;
  document.getElementById('ptClient').value = t.clientId;
  document.getElementById('ptTitle').value = t.title||'';
  document.getElementById('ptFormat').value = t.format||'feed';
  document.getElementById('ptDue').value = t.dueDate||'';
  document.getElementById('ptStatus').value = t.status||'a_fazer';
  document.getElementById('ptSource').value = t.sourceLink||'';
  document.getElementById('ptFinal').value = t.finalLink||'';
  document.getElementById('ptNotes').value = t.notes||'';
  openModal('modalPostTask');
};
window.deletePostTask = async function(id){
  if(!confirm('Remover este post?')) return;
  await db.collection('post_tasks').doc(id).delete();
};
document.getElementById('postTaskForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('ptId').value;
  const data = {
    clientId: document.getElementById('ptClient').value,
    title: document.getElementById('ptTitle').value.trim(),
    format: document.getElementById('ptFormat').value,
    dueDate: document.getElementById('ptDue').value || null,
    status: document.getElementById('ptStatus').value,
    sourceLink: document.getElementById('ptSource').value.trim(),
    finalLink: document.getElementById('ptFinal').value.trim(),
    notes: document.getElementById('ptNotes').value.trim(),
  };
  { const prev = id ? S.postTasks.find(x=>x.id===id) : null; Object.assign(data, postApprovalPatch(prev, data.status)); }
  try{
    if(id){ await db.collection('post_tasks').doc(id).update(data); }
    else{ data.createdAt = new Date().toISOString(); await db.collection('post_tasks').add(data); }
    closeModal('modalPostTask');
  }catch(err){ alert('Não consegui salvar: '+(err.message||err)); }
});
function renderPostsBoard(){
  renderPostsDemand();
  const filt = document.getElementById('postsClientFilter').value;
  let tasks = [...S.postTasks];
  if(filt) tasks = tasks.filter(t=>t.clientId===filt);
  const kb = document.getElementById('postsKanban');
  kb.innerHTML = POST_STATUSES.map(st=>{
    const items = tasks.filter(t=>(t.status||'a_fazer')===st).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
    return `<div class="kanban-col" data-status="${st}">
      <div class="kanban-col-head"><b>${POST_STATUS_LABEL[st]}</b><span class="kanban-count">${items.length}</span></div>
      <div class="kanban-col-body" style="min-height:60px;">
        ${items.map(t=>`<div class="kb-card" draggable="true" data-id="${t.id}" onclick="editPostTask('${t.id}')">
          <div class="kb-client"><span class="client-dot" style="background:${clientColor(t.clientId)}"></span>${escapeHtml(clientName(t.clientId))}</div>
          <div class="kb-title">${escapeHtml(t.title||'')}</div>
          ${approvalHtml(t)}
          <div class="kb-due">${POST_FORMAT_LABEL[t.format]||'Post'}${t.dueDate ? ' · Prazo: '+fmtDate(t.dueDate) : ''}</div>
          <div class="kb-links" onclick="event.stopPropagation()">
            ${t.sourceLink ? `<a href="${escapeHtml(t.sourceLink)}" target="_blank" rel="noopener" class="drivebtn"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-folder"/></svg>Editável</a>` : ''}
            ${t.finalLink ? `<a href="${escapeHtml(t.finalLink)}" target="_blank" rel="noopener" class="drivebtn"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-check"/></svg>Final</a>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="deletePostTask('${t.id}')" style="padding:4px 6px;"><svg class="icon" style="width:12px;height:12px;"><use href="#ic-trash"/></svg></button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
  kb.querySelectorAll('.kb-card').forEach(card=>{
    card.addEventListener('dragstart', ()=>{ draggedPostTaskId = card.dataset.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', ()=>{ card.classList.remove('dragging'); });
  });
  kb.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', ()=>col.classList.remove('dragover'));
    col.addEventListener('drop', async e=>{
      e.preventDefault(); col.classList.remove('dragover');
      if(draggedPostTaskId){ const id=draggedPostTaskId; draggedPostTaskId=null; const t=S.postTasks.find(x=>x.id===id); const patch=Object.assign({status: col.dataset.status}, postApprovalPatch(t, col.dataset.status)); if(t){ Object.assign(t, patch); renderPostsBoard(); } try{ await db.collection('post_tasks').doc(id).update(patch); }catch(err){ alert(err.message||err); } }
    });
  });
}

let financeSub = 'geral';
let currentLaunchId = null;
function renderFinance(){
  const gate = document.getElementById('financeGate');
  if(!hasAccess('financeiro')){
    gate.innerHTML = `<div class="card lock-screen">
      <svg class="icon"><use href="#ic-lock"/></svg>
      <h2>Área restrita</h2>
      <p>O financeiro da Tape é visível só pra quem tem esse acesso liberado. Se você acha que deveria ter acesso, fala com o admin.</p>
    </div>`;
    return;
  }
  if(!S.financeReady){
    gate.innerHTML = `<div class="empty"><b>Carregando financeiro...</b></div>`;
    return;
  }
  gate.innerHTML = `
    <div class="view-head"><div><h1>Financeiro</h1><p>Contratos, cobranças e caixa da Tape. Só quem tem acesso vê.</p></div></div>
    <div class="subtabs" id="financeSubtabs">
      <button data-s="cobrancas">Cobranças</button>
      <button data-s="contratos">Contratos</button>
      <button data-s="geral">Visão geral</button>
      <button data-s="entradas">Entradas por cliente</button>
      <button data-s="fixos">Gastos fixos</button>
      <button data-s="lancamentos">Tape Lanza</button>
    </div>
    <div id="financeBody"></div>
  `;
  gate.querySelectorAll('#financeSubtabs button').forEach(b=>{
    b.classList.toggle('active', b.dataset.s===financeSub);
    b.addEventListener('click', ()=>{ financeSub = b.dataset.s; currentLaunchId=null; renderFinance(); });
  });
  const body = document.getElementById('financeBody');
  if(financeSub==='cobrancas') renderFinanceCobrancas(body);
  if(financeSub==='contratos') renderContractsOverview(body);
  if(financeSub==='geral') renderFinanceGeral(body);
  if(financeSub==='entradas') renderFinanceEntradas(body);
  if(financeSub==='fixos') renderFinanceFixos(body);
  if(financeSub==='lancamentos') renderFinanceLanza(body);
}

function monthKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function clientPaidThisMonth(clientId){
  const now = new Date(); const mk = monthKey(now);
  return S.financeEntries.some(e=>e.clientId===clientId && e.date && monthKey(new Date(e.date+'T00:00:00'))===mk);
}
function renderFinanceGeral(body){
  const now = new Date(); const year = now.getFullYear(); const curMonth = now.getMonth();
  const monthTotals = new Array(12).fill(0);
  S.financeEntries.forEach(e=>{
    if(!e.date) return; const d = new Date(e.date+'T00:00:00');
    if(d.getFullYear()===year) monthTotals[d.getMonth()] += Number(e.amount)||0;
  });
  const yearTotal = monthTotals.reduce((a,b)=>a+b,0);
  const monthTotal = monthTotals[curMonth];
  const prevMonthTotal = curMonth>0 ? monthTotals[curMonth-1] : 0;
  const growthPct = prevMonthTotal>0 ? Math.round(((monthTotal-prevMonthTotal)/prevMonthTotal)*100) : (monthTotal>0?100:0);
  const fixedTotal = S.fixedExpenses.reduce((a,e)=>a+(Number(e.amount)||0),0);
  const maxMonth = Math.max(...monthTotals, 1);
  const activeClients = S.clients.filter(c=>c.status==='ativo').length;
  const avgPerClient = activeClients>0 ? monthTotal/activeClients : 0;
  const expenseRatio = monthTotal>0 ? Math.round((fixedTotal/monthTotal)*100) : 0;

  const byClient = {};
  S.financeEntries.forEach(e=>{ if(!e.date) return; const d=new Date(e.date+'T00:00:00'); if(d.getFullYear()===year){ byClient[e.clientId]=(byClient[e.clientId]||0)+(Number(e.amount)||0); } });
  const topClients = Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const byCategory = {};
  S.fixedExpenses.forEach(x=>{ const cat = x.category || 'Sem categoria'; byCategory[cat] = (byCategory[cat]||0) + (Number(x.amount)||0); });
  const catEntries = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  const maxCat = Math.max(...catEntries.map(c=>c[1]), 1);

  body.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:22px;">
      <div class="card stat-card"><div class="label">Faturamento do mês</div><div class="value">${fmtMoney(monthTotal)}</div><div class="sub">${MONTHS[curMonth]} de ${year}</div></div>
      <div class="card stat-card"><div class="label">Faturamento anual</div><div class="value">${fmtMoney(yearTotal)}</div><div class="sub">soma de ${year}</div></div>
      <div class="card stat-card"><div class="label">Gastos fixos por mês</div><div class="value">${fmtMoney(fixedTotal)}</div><div class="sub">${S.fixedExpenses.length} itens</div></div>
      <div class="card stat-card"><div class="label">Líquido do mês</div><div class="value">${fmtMoney(monthTotal-fixedTotal)}</div><div class="sub">faturamento − fixos</div></div>
    </div>
    <div class="grid grid-3" style="margin-bottom:22px;">
      <div class="card stat-card">
        <div class="label">Crescimento vs. mês anterior</div>
        <div class="value" style="color:${growthPct>=0?'var(--ok)':'var(--danger)'};">${growthPct>=0?'+':''}${growthPct}%</div>
        <div class="sub">${fmtMoney(prevMonthTotal)} em ${curMonth>0?MONTHS_SHORT[curMonth-1]:'Dez'}</div>
      </div>
      <div class="card stat-card"><div class="label">Média por cliente ativo</div><div class="value">${fmtMoney(avgPerClient)}</div><div class="sub">${activeClients} cliente${activeClients===1?'':'s'} ativo${activeClients===1?'':'s'}</div></div>
      <div class="card stat-card">
        <div class="label">Gastos fixos / faturamento</div>
        <div class="value" style="color:${expenseRatio>40?'var(--danger)':expenseRatio>20?'var(--warn)':'var(--ok)'};">${expenseRatio}%</div>
        <div class="sub">quanto do faturamento vai pra fixos</div>
      </div>
    </div>
    <div class="card" style="padding:20px;margin-bottom:22px;">
      <div class="section-title">Faturamento mensal de ${year}</div>
      <div class="bars">
        ${monthTotals.map((v,i)=>`<div class="bar-col ${i===curMonth?'current':''}">
          <div class="bar" style="height:${Math.max((v/maxMonth)*130,2)}px" title="${fmtMoney(v)}"></div>
          <div class="bar-label">${MONTHS_SHORT[i]}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card" style="padding:20px;">
        <div class="section-title">Clientes que mais faturaram em ${year}</div>
        ${topClients.length===0 ? '<div class="empty"><b>Sem lançamentos ainda</b>Adicione entradas na aba "Entradas por cliente".</div>' :
          topClients.map(([id,val])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);">
            <span style="display:flex;align-items:center;gap:8px;"><span class="client-dot" style="background:${clientColor(id)}"></span>${escapeHtml(clientName(id))}</span>
            <b>${fmtMoney(val)}</b>
          </div>`).join('')}
      </div>
      <div class="card" style="padding:20px;">
        <div class="section-title">Gastos fixos por categoria</div>
        ${catEntries.length===0 ? '<div class="empty"><b>Nenhum gasto fixo</b>Cadastre na aba "Gastos fixos".</div>' :
          catEntries.map(([cat,val])=>`<div style="margin-bottom:11px;">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;"><span>${escapeHtml(cat)}</span><b>${fmtMoney(val)}</b></div>
            <div style="height:6px;background:var(--line);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${(val/maxCat)*100}%;background:var(--teal);border-radius:4px;"></div></div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

function renderFinanceEntradas(body){
  fillClientSelects();
  const entries = [...S.financeEntries].sort((a,b)=>b.date.localeCompare(a.date));
  body.innerHTML = `
    <div class="view-head" style="margin-bottom:14px;">
      <div></div>
      <button class="btn btn-primary btn-sm" onclick="openFinanceModal()"><svg class="icon"><use href="#ic-plus"/></svg>Nova entrada</button>
    </div>
    <div class="card table-wrap">
      <table><thead><tr><th>Data</th><th>Cliente</th><th>Categoria</th><th>Valor</th><th></th></tr></thead>
      <tbody>
        ${entries.length===0 ? `<tr><td colspan="5"><div class="empty"><b>Nenhuma entrada registrada</b>Adicione o primeiro recebimento de um cliente.</div></td></tr>` :
        entries.map(e=>`<tr>
          <td>${fmtDate(e.date)}</td>
          <td>${escapeHtml(clientName(e.clientId))}</td>
          <td>${escapeHtml(e.category||'-')}</td>
          <td class="amount-in">${fmtMoney(e.amount)}</td>
          <td style="text-align:right;">
            ${e.receiptLink ? `<a href="${escapeHtml(e.receiptLink)}" target="_blank" class="btn btn-ghost btn-sm"><svg class="icon"><use href="#ic-folder"/></svg></a>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="editFinanceEntry('${e.id}')"><svg class="icon"><use href="#ic-edit"/></svg></button>
            <button class="btn btn-ghost btn-sm" onclick="deleteFinanceEntry('${e.id}')"><svg class="icon"><use href="#ic-trash"/></svg></button>
          </td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  `;
}
window.openFinanceModal = function(clientId, ym, amount){
  document.getElementById('financeModalTitle').textContent = 'Registrar pagamento';
  document.getElementById('financeForm').reset();
  fillClientSelects();
  document.getElementById('fId').value=''; document.getElementById('fDate').value = todayISO();
  if(clientId) document.getElementById('fClient').value = clientId;
  document.getElementById('fMonth').value = ym || ymNow();
  if(amount) document.getElementById('fAmount').value = Math.round(amount);
  document.getElementById('fCategory').value = 'Mensalidade';
  openModal('modalFinance');
};
window.editFinanceEntry = function(id){
  const e = S.financeEntries.find(x=>x.id===id); if(!e) return;
  document.getElementById('financeModalTitle').textContent = 'Editar entrada';
  document.getElementById('fId').value = e.id;
  document.getElementById('fClient').value = e.clientId;
  document.getElementById('fAmount').value = e.amount;
  document.getElementById('fDate').value = e.date;
  document.getElementById('fCategory').value = e.category||'';
  document.getElementById('fReceipt').value = e.receiptLink||'';
  document.getElementById('fNote').value = e.note||'';
  document.getElementById('fMonth').value = e.chargeMonth || ymOf(e.date);
  document.getElementById('fMethod').value = e.method || '';
  openModal('modalFinance');
};
window.deleteFinanceEntry = async function(id){
  if(!confirm('Remover esta entrada?')) return;
  await db.collection('finance_entries').doc(id).delete();
};
document.getElementById('financeForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('fId').value;
  const data = {
    clientId: document.getElementById('fClient').value,
    amount: parseFloat(document.getElementById('fAmount').value)||0,
    date: document.getElementById('fDate').value,
    category: document.getElementById('fCategory').value.trim(),
    receiptLink: document.getElementById('fReceipt').value.trim(),
    note: document.getElementById('fNote').value.trim(),
    chargeMonth: document.getElementById('fMonth').value || null,
    method: document.getElementById('fMethod').value || null,
  };
  if(data.receiptLink && !isHttpUrl(data.receiptLink)){ toast('Cole o link completo do comprovante (https://...).', 'error'); return; }
  if(!(data.amount > 0)){ toast('Informe o valor do pagamento.', 'error'); return; }
  try{
    if(id){ await db.collection('finance_entries').doc(id).update(data); }
    else{ await db.collection('finance_entries').add(data); }
    closeModal('modalFinance'); toast('Pagamento salvo.', 'ok');
  }catch(err){ toast('Não consegui salvar: ' + (err.message || err), 'error'); }
});

function renderFinanceFixos(body){
  const total = S.fixedExpenses.reduce((a,e)=>a+(Number(e.amount)||0),0);
  body.innerHTML = `
    <div class="view-head" style="margin-bottom:14px;">
      <div><b>${fmtMoney(total)}</b><span style="color:var(--muted);font-size:12.5px;"> por mês em gastos fixos</span></div>
      <button class="btn btn-primary btn-sm" onclick="openFixedModal()"><svg class="icon"><use href="#ic-plus"/></svg>Novo gasto fixo</button>
    </div>
    <div class="card table-wrap">
      <table><thead><tr><th>Nome</th><th>Categoria</th><th>Dia</th><th>Valor</th><th></th></tr></thead>
      <tbody>
        ${S.fixedExpenses.length===0 ? `<tr><td colspan="5"><div class="empty"><b>Nenhum gasto fixo cadastrado</b>Adicione assinaturas, ferramentas ou salários recorrentes.</div></td></tr>` :
        S.fixedExpenses.map(x=>`<tr>
          <td>${escapeHtml(x.name)}</td>
          <td>${escapeHtml(x.category||'-')}</td>
          <td>${x.dayOfMonth ? 'dia '+x.dayOfMonth : '-'}</td>
          <td class="amount-out">${fmtMoney(x.amount)}</td>
          <td style="text-align:right;">
            <button class="btn btn-ghost btn-sm" onclick="editFixed('${x.id}')"><svg class="icon"><use href="#ic-edit"/></svg></button>
            <button class="btn btn-ghost btn-sm" onclick="deleteFixed('${x.id}')"><svg class="icon"><use href="#ic-trash"/></svg></button>
          </td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  `;
}
window.openFixedModal = function(){
  document.getElementById('fixedModalTitle').textContent = 'Novo gasto fixo';
  document.getElementById('fixedForm').reset(); document.getElementById('xId').value='';
  openModal('modalFixed');
};
window.editFixed = function(id){
  const x = S.fixedExpenses.find(e=>e.id===id); if(!x) return;
  document.getElementById('fixedModalTitle').textContent = 'Editar gasto fixo';
  document.getElementById('xId').value = x.id;
  document.getElementById('xName').value = x.name;
  document.getElementById('xAmount').value = x.amount;
  document.getElementById('xDay').value = x.dayOfMonth||'';
  document.getElementById('xCategory').value = x.category||'';
  openModal('modalFixed');
};
window.deleteFixed = async function(id){
  if(!confirm('Remover este gasto fixo?')) return;
  await db.collection('finance_fixed').doc(id).delete();
};
document.getElementById('fixedForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('xId').value;
  const data = {
    name: document.getElementById('xName').value.trim(),
    amount: parseFloat(document.getElementById('xAmount').value)||0,
    dayOfMonth: parseInt(document.getElementById('xDay').value)||null,
    category: document.getElementById('xCategory').value.trim(),
  };
  if(id){ await db.collection('finance_fixed').doc(id).update(data); }
  else{ await db.collection('finance_fixed').add(data); }
  closeModal('modalFixed');
});

function fillLaunchSelect(){
  const opts = S.launches.map(l=>`<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  document.getElementById('lLaunch').innerHTML = '<option value="">Geral (sem lançamento específico)</option>' + opts;
}
const LAUNCH_STATUS_LABEL = {planejamento:'Planejamento',andamento:'Em andamento',lancado:'Lançado',encerrado:'Encerrado'};
const LAUNCH_STATUS_BADGE = {planejamento:'badge-muted',andamento:'badge-warn',lancado:'badge-ok',encerrado:'badge-danger'};

function launchProgress(l){
  const nodes = (l.mindmap && l.mindmap.nodes) || [];
  if(nodes.length===0) return null;
  const done = nodes.filter(n=>n.status==='done').length;
  return Math.round((done/nodes.length)*100);
}

/* ---- Shared Lançamentos tab (visible to whoever has access, no money figures) ---- */
let currentLaunchIdShared = null;
function renderLaunchesShared(){
  const body = document.getElementById('launchesBody');
  if(currentLaunchIdShared){ renderLaunchDetailShared(body, currentLaunchIdShared); return; }
  body.innerHTML = `
    <div class="view-head">
      <div><h1>Lançamentos</h1><p>Estrutura e progresso de cada lançamento, compartilhado com a equipe</p></div>
      <button class="btn btn-primary" onclick="openLaunchModal()"><svg class="icon"><use href="#ic-plus"/></svg>Novo lançamento</button>
    </div>
    <div class="grid grid-3">
      ${S.launches.length===0 ? `<div class="empty" style="grid-column:1/-1;"><b>Nenhum lançamento cadastrado</b>Crie o primeiro pra montar a estrutura e acompanhar as etapas com a equipe.</div>` :
      S.launches.map(l=>{
        const prog = launchProgress(l);
        return `<div class="card launch-card" onclick="openLaunchShared('${l.id}')">
          <div class="launch-top"><span class="launch-name">${escapeHtml(l.name)}</span><span class="badge ${LAUNCH_STATUS_BADGE[l.status]||'badge-muted'}">${LAUNCH_STATUS_LABEL[l.status]||l.status}</span></div>
          <div class="launch-sub">${l.startDate ? 'Início em '+fmtDate(l.startDate) : 'Sem data de início'}</div>
          ${prog===null ? `<div class="launch-sub" style="margin-top:8px;">Sem blocos ainda</div>` : `
          <div style="margin-top:10px;">
            <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:4px;"><span>Progresso</span><b style="color:var(--ink);">${prog}%</b></div>
            <div style="height:6px;background:var(--line);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${prog}%;background:var(--teal);"></div></div>
          </div>`}
        </div>`;
      }).join('')}
    </div>
  `;
}
window.openLaunchShared = function(id){ currentLaunchIdShared = id; renderLaunchesShared(); };
function renderLaunchDetailShared(body, id){
  const l = S.launches.find(x=>x.id===id);
  if(!l){ currentLaunchIdShared=null; renderLaunchesShared(); return; }
  const nodes = (l.mindmap && l.mindmap.nodes) || [];
  const done = nodes.filter(n=>n.status==='done').length;
  const doing = nodes.filter(n=>n.status==='doing').length;
  body.innerHTML = `
    <a class="back-link" href="javascript:void(0)" onclick="currentLaunchIdShared=null;renderLaunchesShared()"><svg class="icon"><use href="#ic-arrow-left"/></svg>Todos os lançamentos</a>
    <div class="launch-detail-head">
      <div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <h1 style="font-size:21px;font-weight:800;">${escapeHtml(l.name)}</h1>
          <span class="badge ${LAUNCH_STATUS_BADGE[l.status]||'badge-muted'}">${LAUNCH_STATUS_LABEL[l.status]||l.status}</span>
        </div>
        <p style="color:var(--muted);font-size:13px;margin-top:4px;">${l.startDate ? 'Início em '+fmtDate(l.startDate) : 'Sem data de início'}</p>
      </div>
      <div style="display:flex;gap:8px;">
        ${l.landingLink ? `<a href="${escapeHtml(l.landingLink)}" target="_blank" class="btn btn-outline btn-sm"><svg class="icon"><use href="#ic-external"/></svg>Landing page</a>` : ''}
        <button class="btn btn-outline btn-sm" onclick="editLaunchMeta('${l.id}')"><svg class="icon"><use href="#ic-edit"/></svg>Editar</button>
      </div>
    </div>
    ${l.notes ? `<div class="card" style="padding:14px 16px;margin-bottom:18px;font-size:13px;color:var(--muted);">${escapeHtml(l.notes)}</div>` : ''}
    <div class="grid grid-3" style="margin-bottom:22px;">
      <div class="card stat-card"><div class="label">Blocos no total</div><div class="value">${nodes.length}</div></div>
      <div class="card stat-card"><div class="label">Em andamento</div><div class="value" style="color:var(--warn);">${doing}</div></div>
      <div class="card stat-card"><div class="label">Concluídos</div><div class="value" style="color:var(--ok);">${done}</div></div>
    </div>

    ${canSeeMoney() ? '<div id="lanzaPanelBox"></div>' : ''}
    <div id="funnelBox">${renderFunnelBlock(l)}</div>
    <div class="section-title">Estrutura do lançamento</div>
    <div class="mm-toolbar">
      <button class="btn btn-outline btn-sm" id="mmAddNode"><svg class="icon"><use href="#ic-plus"/></svg>Novo bloco</button>
      <button class="btn btn-outline btn-sm" id="mmConnect"><svg class="icon"><use href="#ic-link"/></svg>Conectar blocos</button>
      <span class="hint" id="mmHint">Arraste pra organizar. Clique na bolinha de um bloco pra mudar o status. "Conectar" liga dois blocos.</span>
    </div>
    <div class="mm-canvas-wrap"><div class="mm-canvas" id="mmCanvas"><svg class="mm-svg" id="mmSvg"><defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2F8F82"/></marker>
    </defs></svg></div></div>
  `;
  initMindmap(l);
  if(canSeeMoney()) renderLanzaPanel(l);
}

function renderFinanceLanza(body){
  fillLaunchSelect();
  const totalIncome = S.lanzaEntries.filter(e=>e.type==='income').reduce((a,e)=>a+(Number(e.amount)||0),0);
  const totalExpense = S.lanzaEntries.filter(e=>e.type==='expense').reduce((a,e)=>a+(Number(e.amount)||0),0);
  body.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="card stat-card"><div class="label">Entradas Tape Lanza</div><div class="value" style="color:var(--ok);">${fmtMoney(totalIncome)}</div></div>
      <div class="card stat-card"><div class="label">Gastos Tape Lanza</div><div class="value" style="color:var(--danger);">${fmtMoney(totalExpense)}</div></div>
      <div class="card stat-card"><div class="label">Líquido</div><div class="value">${fmtMoney(totalIncome-totalExpense)}</div></div>
    </div>
    <div class="view-head" style="margin-bottom:14px;">
      <div><b>Lançamentos financeiros</b></div>
      <button class="btn btn-primary btn-sm" onclick="openLanzaModal()"><svg class="icon"><use href="#ic-plus"/></svg>Novo lançamento financeiro</button>
    </div>
    ${renderLanzaTable(S.lanzaEntries)}
  `;
}
function renderLanzaTable(entries){
  entries = [...entries].sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="card table-wrap">
    <table><thead><tr><th>Data</th><th>Descrição</th><th>Lançamento</th><th>Tipo</th><th>Valor</th><th></th></tr></thead>
    <tbody>
      ${entries.length===0 ? `<tr><td colspan="6"><div class="empty"><b>Nenhum lançamento financeiro</b>Registre entradas e gastos do Tape Lanza aqui.</div></td></tr>` :
      entries.map(e=>`<tr>
        <td>${fmtDate(e.date)}</td>
        <td>${escapeHtml(e.name)}${e.note?`<div style="color:var(--muted);font-size:11.5px;">${escapeHtml(e.note)}</div>`:''}</td>
        <td>${escapeHtml(e.launchId ? (S.launches.find(l=>l.id===e.launchId)?.name || '(removido)') : 'Geral')}</td>
        <td>${e.type==='income'?'<span class="badge badge-ok">Entrada</span>':'<span class="badge badge-danger">Gasto</span>'}</td>
        <td class="${e.type==='income'?'amount-in':'amount-out'}">${fmtMoney(e.amount)}</td>
        <td style="text-align:right;">
          ${e.receiptLink ? `<a href="${escapeHtml(e.receiptLink)}" target="_blank" class="btn btn-ghost btn-sm"><svg class="icon"><use href="#ic-folder"/></svg></a>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="editLanza('${e.id}')"><svg class="icon"><use href="#ic-edit"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteLanza('${e.id}')"><svg class="icon"><use href="#ic-trash"/></svg></button>
        </td>
      </tr>`).join('')}
    </tbody></table>
  </div>`;
}
window.openLaunchModal = function(){
  document.getElementById('launchModalTitle').textContent = 'Novo lançamento';
  document.getElementById('launchForm').reset(); document.getElementById('luId').value='';
  openModal('modalLaunch');
};
window.editLaunchMeta = function(id){
  const l = S.launches.find(x=>x.id===id); if(!l) return;
  document.getElementById('launchModalTitle').textContent = 'Editar lançamento';
  document.getElementById('luId').value = l.id;
  document.getElementById('luName').value = l.name;
  document.getElementById('luStatus').value = l.status||'planejamento';
  document.getElementById('luDate').value = l.startDate||'';
  document.getElementById('luLanding').value = l.landingLink||'';
  document.getElementById('luNotes').value = l.notes||'';
  openModal('modalLaunch');
};
document.getElementById('launchForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('luId').value;
  const data = {
    name: document.getElementById('luName').value.trim(),
    status: document.getElementById('luStatus').value,
    startDate: document.getElementById('luDate').value,
    landingLink: document.getElementById('luLanding').value.trim(),
    notes: document.getElementById('luNotes').value.trim(),
  };
  if(id){ await db.collection('launches').doc(id).update(data); }
  else{ data.mindmap = {nodes:[], edges:[]}; data.createdAt = new Date().toISOString(); const ref = await db.collection('launches').add(data); currentLaunchIdShared = ref.id; }
  closeModal('modalLaunch');
  if(currentTab==='lancamentos') renderLaunchesShared();
  if(currentTab==='financeiro') renderFinance();
});

window.openLanzaModal = function(launchId){
  fillLaunchSelect();
  document.getElementById('lanzaModalTitle').textContent = 'Novo lançamento financeiro';
  document.getElementById('lanzaForm').reset(); document.getElementById('lId').value='';
  document.getElementById('lDate').value = todayISO();
  document.getElementById('lLaunch').value = launchId||'';
  syncLanzaCat();
  openModal('modalLanza');
};
window.editLanza = function(id){
  fillLaunchSelect();
  const e = S.lanzaEntries.find(x=>x.id===id); if(!e) return;
  document.getElementById('lanzaModalTitle').textContent = 'Editar lançamento financeiro';
  document.getElementById('lId').value = e.id;
  document.getElementById('lLaunch').value = e.launchId||'';
  document.getElementById('lType').value = e.type;
  document.getElementById('lName').value = e.name;
  document.getElementById('lAmount').value = e.amount;
  document.getElementById('lDate').value = e.date;
  document.getElementById('lReceipt').value = e.receiptLink||'';
  document.getElementById('lNote').value = e.note||'';
  document.getElementById('lCat').value = e.category || 'outros';
  syncLanzaCat();
  openModal('modalLanza');
};
window.deleteLanza = async function(id){
  if(!confirm('Remover este lançamento?')) return;
  await db.collection('finance_lanza').doc(id).delete();
};
document.getElementById('lanzaForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('lId').value;
  const data = {
    launchId: document.getElementById('lLaunch').value || null,
    category: document.getElementById('lType').value === 'expense' ? (document.getElementById('lCat').value || 'outros') : null,
    type: document.getElementById('lType').value,
    name: document.getElementById('lName').value.trim(),
    amount: parseFloat(document.getElementById('lAmount').value)||0,
    date: document.getElementById('lDate').value,
    receiptLink: document.getElementById('lReceipt').value.trim(),
    note: document.getElementById('lNote').value.trim(),
  };
  if(id){ await db.collection('finance_lanza').doc(id).update(data); }
  else{ await db.collection('finance_lanza').add(data); }
  if(data.receiptLink && !isHttpUrl(data.receiptLink)){ toast('Cole o link completo do comprovante (https://...).', 'error'); return; }
  closeModal('modalLanza'); toast('Lançamento salvo.', 'ok');
});

/* ---- Mind map engine (shared, with node status tracking) ---- */
const NODE_STATUS_ORDER = ['todo','doing','done'];
const NODE_STATUS_COLOR = {todo:'#b7bfbc', doing:'#b8791f', done:'#2f8f52'};
let mm = {nodes:[], edges:[], launchId:null, connectMode:false, connectFrom:null, saveTimer:null};
function initMindmap(launch){
  mm.nodes = (launch.mindmap?.nodes || []).map(n=>({status:'todo', ...n}));
  mm.edges = (launch.mindmap?.edges || []).map(e=>({...e}));
  mm.launchId = launch.id; mm.connectMode=false; mm.connectFrom=null;
  renderMindmap();
  document.getElementById('mmAddNode').onclick = ()=>{
    const id = 'n'+Date.now();
    mm.nodes.push({id, x:60+Math.random()*200, y:60+Math.random()*200, label:'Novo bloco', status:'todo'});
    renderMindmap(); saveMindmap();
  };
  document.getElementById('mmConnect').onclick = (e)=>{
    mm.connectMode = !mm.connectMode; mm.connectFrom = null;
    const btn = e.target.closest('button');
    btn.classList.toggle('btn-primary', mm.connectMode);
    btn.classList.toggle('btn-outline', !mm.connectMode);
    document.getElementById('mmHint').textContent = mm.connectMode ? 'Clique em dois blocos, em sequência, pra ligá-los.' : 'Arraste pra organizar. Clique na bolinha de um bloco pra mudar o status. "Conectar" liga dois blocos.';
    renderMindmap();
  };
}
function saveMindmap(){
  clearTimeout(mm.saveTimer);
  mm.saveTimer = setTimeout(async ()=>{
    if(!mm.launchId || !db) return;
    await db.collection('launches').doc(mm.launchId).update({mindmap:{nodes:mm.nodes, edges:mm.edges}});
  }, 500);
}
function renderMindmap(){
  const canvas = document.getElementById('mmCanvas'); if(!canvas) return;
  canvas.querySelectorAll('.mm-node, .mm-empty-hint').forEach(n=>n.remove());
  if(mm.nodes.length===0){
    const hint = document.createElement('div');
    hint.className = 'mm-empty-hint';
    hint.innerHTML = '<b>Nada montado ainda</b>Clique em "Novo bloco" pra começar a estrutura.';
    canvas.appendChild(hint);
  }
  mm.nodes.forEach(n=>{
    if(!n.status) n.status='todo';
    const el = document.createElement('div');
    el.className = 'mm-node' + (mm.connectFrom===n.id ? ' connecting-src' : '');
    el.style.left = n.x+'px'; el.style.top = n.y+'px';
    el.dataset.id = n.id;
    el.innerHTML = `<div class="mm-node-handle"></div><div class="mm-node-body"><span class="mm-status-dot" data-id="${n.id}" style="background:${NODE_STATUS_COLOR[n.status]};" title="Clique pra mudar o status"></span><input value="${escapeHtml(n.label)}" data-id="${n.id}"></div><div class="mm-node-del" data-id="${n.id}"><svg class="icon"><use href="#ic-x"/></svg></div>`;
    canvas.appendChild(el);

    const inp = el.querySelector('input');
    inp.addEventListener('click', e=>e.stopPropagation());
    inp.addEventListener('change', ()=>{ n.label = inp.value; saveMindmap(); });

    el.querySelector('.mm-status-dot').addEventListener('click', e=>{
      e.stopPropagation();
      const idx = NODE_STATUS_ORDER.indexOf(n.status);
      n.status = NODE_STATUS_ORDER[(idx+1)%NODE_STATUS_ORDER.length];
      e.target.style.background = NODE_STATUS_COLOR[n.status];
      saveMindmap();
    });

    el.querySelector('.mm-node-del').addEventListener('click', e=>{
      e.stopPropagation();
      mm.nodes = mm.nodes.filter(x=>x.id!==n.id);
      mm.edges = mm.edges.filter(x=>x.from!==n.id && x.to!==n.id);
      renderMindmap(); saveMindmap();
    });

    const dragTarget = mm.connectMode ? el : el.querySelector('.mm-node-handle');
    dragTarget.addEventListener('pointerdown', e=>{
      if(mm.connectMode){
        if(!mm.connectFrom){ mm.connectFrom = n.id; renderMindmap(); }
        else if(mm.connectFrom!==n.id){
          mm.edges.push({id:'e'+Date.now(), from:mm.connectFrom, to:n.id});
          mm.connectFrom = null; renderMindmap(); saveMindmap();
        }
        return;
      }
      const startX = e.clientX, startY = e.clientY, ox = n.x, oy = n.y;
      dragTarget.setPointerCapture(e.pointerId);
      function onMove(ev){
        n.x = Math.max(0, ox + (ev.clientX-startX));
        n.y = Math.max(0, oy + (ev.clientY-startY));
        el.style.left = n.x+'px'; el.style.top = n.y+'px';
        drawEdges();
      }
      function onUp(){
        dragTarget.removeEventListener('pointermove', onMove);
        dragTarget.removeEventListener('pointerup', onUp);
        saveMindmap();
      }
      dragTarget.addEventListener('pointermove', onMove);
      dragTarget.addEventListener('pointerup', onUp);
    });
  });
  drawEdges();
}
function drawEdges(){
  const svg = document.getElementById('mmSvg'); if(!svg) return;
  const canvas = document.getElementById('mmCanvas');
  [...svg.querySelectorAll('line')].forEach(l=>l.remove());
  mm.edges.forEach(e=>{
    const a = mm.nodes.find(n=>n.id===e.from), b = mm.nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    const aEl = canvas.querySelector(`.mm-node[data-id="${a.id}"]`);
    const bEl = canvas.querySelector(`.mm-node[data-id="${b.id}"]`);
    const aw = aEl?aEl.offsetWidth:140, ah = aEl?aEl.offsetHeight:36;
    const bw = bEl?bEl.offsetWidth:140, bh = bEl?bEl.offsetHeight:36;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', a.x+aw/2); line.setAttribute('y1', a.y+ah/2);
    line.setAttribute('x2', b.x+bw/2); line.setAttribute('y2', b.y+bh/2);
    line.setAttribute('stroke', '#2F8F82'); line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(line);
  });
}


