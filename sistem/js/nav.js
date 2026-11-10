/* =====================================================================
   Tape Sistema 2.0 | navegação, roteamento e tela inicial
   ===================================================================== */

const NAV_GROUPS = [
  { label:'Operação', tabs:[
    {id:'home', label:'Início', icon:'home'},
    {id:'clientes', label:'Clientes', icon:'users'},
    {id:'social', label:'Social Media', icon:'cal'},
    {id:'posts', label:'Posts', icon:'image'},
    {id:'video', label:'Vídeo', icon:'film'},
    {id:'biblioteca', label:'Biblioteca', icon:'star'},
  ]},
  { label:'Negócio', tabs:[
    {id:'lancamentos', label:'Lançamentos', icon:'rocket'},
    {id:'trafego', label:'Tráfego pago', icon:'chart'},
    {id:'financeiro', label:'Financeiro', icon:'wallet'},
  ]},
  { label:'Administração', tabs:[
    {id:'equipe', label:'Equipe', icon:'shield'},
  ]},
];
const ALL_TABS = NAV_GROUPS.flatMap(g=>g.tabs);
let currentTab = null;
let currentClientId = null;      // ficha aberta (aba "cliente")

function renderSideNav(){
  const nav = document.getElementById('sideNav');
  const active = currentTab === 'cliente' ? 'clientes' : currentTab;
  nav.innerHTML = NAV_GROUPS.map(g=>{
    const items = g.tabs.map(t=>{
      const unlocked = hasAccess(t.id);
      return `<button data-tab="${t.id}" class="${t.id===active?'active':''} ${unlocked?'':'locked'}" ${t.id===active?'aria-current="page"':''}>
        ${icon(t.icon)}<span>${t.label}</span>${unlocked?'':icon('lock').replace('class="icon"','class="icon lock-mini"')}
        <span class="nav-badge" id="nb-${t.id}" style="display:none"></span>
      </button>`;
    }).join('');
    return `<div class="nav-group"><div class="nav-label">${g.label}</div>${items}</div>`;
  }).join('');
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{
    if(b.classList.contains('locked')){ b.classList.add('shake'); setTimeout(()=>b.classList.remove('shake'), 400); toast('Você não tem acesso a esta área. Fale com o admin.', 'info'); return; }
    goTab(b.dataset.tab);
    closeSidebar();
  }));
  updateNavBadges();
}
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarScrim').classList.remove('open'); }
document.getElementById('btnOpenMenu').addEventListener('click', ()=>{ document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarScrim').classList.add('open'); });
document.getElementById('sidebarScrim').addEventListener('click', closeSidebar);

function setNavBadge(tab, n, kind){
  const el = document.getElementById('nb-' + tab); if(!el) return;
  el.style.display = n > 0 ? '' : 'none'; el.textContent = n > 99 ? '99+' : n; el.className = 'nav-badge ' + (kind || '');
}
function updateNavBadges(){
  if(!currentMember) return;
  const changes = S.videoTasks.filter(v=>v.approval === 'alteracao').length + S.postTasks.filter(t=>t.approval === 'alteracao').length;
  if(hasAccess('video')) setNavBadge('video', changes, 'warn');
  const ready = S.videoTasks.filter(v=>v.approval === 'aprovado' && !v.postedAt).length;
  if(hasAccess('social')) setNavBadge('social', ready, 'ok');
}

/* ---- Roteador: troca de aba e mantém o botão "voltar" do navegador ---- */
function goTab(tab, opts, fromHash){
  opts = opts || {};
  if(tab === 'cliente'){ if(!hasAccess('clientes')) return; currentClientId = opts.id || currentClientId; }
  else if(!hasAccess(tab)){ toast('Você não tem acesso a esta área.', 'error'); return; }
  currentTab = tab;
  if(opts.client !== undefined) applyClientFilter(tab, opts.client);
  if(opts.sub) window.pendingSub = opts.sub;
  renderSideNav(); renderView();
  window.scrollTo(0, 0);
  if(!fromHash){
    const h = tab === 'cliente' ? '#cliente/' + currentClientId + (opts.sub ? '/' + opts.sub : '') : '#' + tab;
    if(location.hash !== h) history.pushState(null, '', h);
  }
}
window.goTab = goTab;
function applyClientFilter(tab, clientId){
  const map = { social:'socialClientFilter', posts:'postsClientFilter', video:'videoClientFilter' };
  const el = map[tab] && document.getElementById(map[tab]); if(el) el.value = clientId || '';
}
window.addEventListener('popstate', ()=>routeFromHash());
function routeFromHash(){
  if(!currentMember) return;
  const h = location.hash.replace(/^#/, '');
  if(!h){ goTab('home', {}, true); return; }
  const parts = h.split('/');
  if(parts[0] === 'cliente' && parts[1]){ if(hasAccess('clientes')){ currentClientId = parts[1]; goTab('cliente', { id: parts[1], sub: parts[2] }, true); } return; }
  if(ALL_TABS.some(t=>t.id === parts[0]) && hasAccess(parts[0])) goTab(parts[0], {}, true);
}

function renderView(){
  if(!currentTab || !(currentTab === 'cliente' ? hasAccess('clientes') : hasAccess(currentTab))) currentTab = 'home';
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = document.getElementById('view-' + currentTab); if(el) el.classList.add('active');
  const fn = {
    home: renderHome, clientes: renderClients, cliente: renderClientFicha, social: renderCalendar, video: renderKanban,
    posts: renderPostsBoard, biblioteca: renderLibrary, lancamentos: renderLaunchesShared, trafego: renderTraffic,
    financeiro: renderFinance, equipe: renderTeam,
  }[currentTab];
  if(fn) fn();
  updateNavBadges();
}

/* ---- Início ---- */
function greeting(){ const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

function homeAlerts(){
  const out = [];
  const today = localToday();
  const nm = id=>escapeHtml(clientName(id));
  if(hasAccess('video')){
    S.videoTasks.filter(v=>v.approval === 'alteracao').forEach(v=>out.push({
      lvl:'urgent', ic:'edit', title:`${nm(v.clientId)}: ${escapeHtml(v.title || 'vídeo')} precisa de ajustes`,
      sub: v.approvalNote ? 'Cliente pediu: “' + escapeHtml(String(v.approvalNote).slice(0, 140)) + '”' : 'Alteração pedida pelo cliente',
      go:()=>goTab('video', { client: v.clientId }) }));
    S.postTasks.filter(t=>t.approval === 'alteracao').forEach(t=>out.push({
      lvl:'urgent', ic:'edit', title:`${nm(t.clientId)}: arte “${escapeHtml(t.title || '')}” precisa de ajustes`,
      sub: t.approvalNote ? 'Cliente pediu: “' + escapeHtml(String(t.approvalNote).slice(0, 140)) + '”' : 'Alteração pedida pelo cliente',
      go:()=>goTab('posts', { client: t.clientId }) }));
  }
  if(hasAccess('social')){
    const ready = S.videoTasks.filter(v=>v.approval === 'aprovado' && !v.postedAt);
    if(ready.length) out.push({ lvl:'good', ic:'send', title:`${ready.length} vídeo${ready.length>1?'s':''} aprovado${ready.length>1?'s':''} pronto${ready.length>1?'s':''} para postar`, sub: ready.slice(0, 3).map(v=>escapeHtml(clientName(v.clientId))).filter((x,i,a)=>a.indexOf(x)===i).join(', '), go:()=>goTab('social') });
    const late = S.socialPosts.filter(p=>p.status !== 'feito' && p.date < today);
    if(late.length) out.push({ lvl:'urgent', ic:'cal', title:`${late.length} postagem${late.length>1?'ns':''} atrasada${late.length>1?'s':''}`, sub:'Marque como publicada ou reagende.', go:()=>goTab('social') });
    const td = S.socialPosts.filter(p=>p.status !== 'feito' && p.date === today);
    if(td.length) out.push({ lvl:'soon', ic:'cal', title:`${td.length} postagem${td.length>1?'ns':''} para hoje`, sub: td.map(p=>escapeHtml((p.time||'').slice(0,5)+' '+clientName(p.clientId))).slice(0,3).join(' · '), go:()=>goTab('social') });
  }
  if(hasAccess('video') || hasAccess('clientes')){
    const waiting = S.videoTasks.filter(v=>v.approval === 'aguardando');
    if(waiting.length) out.push({ lvl:'info', ic:'clock', title:`${waiting.length} vídeo${waiting.length>1?'s':''} aguardando aprovação do cliente`, sub: [...new Set(waiting.map(v=>escapeHtml(clientName(v.clientId))))].slice(0, 3).join(', '), go:()=>goTab('video') });
    const rec = S.scripts.filter(s=>s.recordDate && s.status === 'gravar' && s.recordDate >= today && s.recordDate <= addDaysISO(today, 7)).sort((a,b)=>a.recordDate.localeCompare(b.recordDate));
    rec.slice(0, 3).forEach(s=>out.push({ lvl: s.recordDate === today ? 'soon' : 'info', ic:'film', title:`Gravação ${daysText(diffDays(today, s.recordDate))}: ${nm(s.clientId)}`, sub: escapeHtml(s.title) + ' · ' + fmtDM(s.recordDate), go:()=>goTab('cliente', { id: s.clientId, sub:'roteiros' }) }));
  }
  if(canSeeMoney()){
    S.contracts.forEach(k=>{
      const i = contractInfo(k); if(!i.alert) return;
      out.push({ lvl:i.level, ic:'file', title:`${nm(k.clientId)}: ${escapeHtml(i.shortLabel)}`, sub: escapeHtml(i.detail), go:()=>goTab('cliente', { id:k.clientId, sub:'contrato' }) });
    });
    clientFinanceAlerts().forEach(a=>out.push({ lvl:a.level, ic:'wallet', title:`${nm(a.clientId)}: ${escapeHtml(a.text)}`, sub: escapeHtml(a.sub), go:()=>goTab('cliente', { id:a.clientId, sub:'financeiro' }) }));
  }
  const order = { urgent:0, soon:1, good:2, info:3, ok:4, muted:5 };
  return out.sort((a,b)=>(order[a.lvl] ?? 9) - (order[b.lvl] ?? 9));
}

function renderHome(){
  const body = document.getElementById('homeBody');
  const name = currentMember ? currentMember.name.split(' ')[0] : '';
  const today = localToday(); const ym = ymNow();
  const alerts = homeAlerts();
  window.__homeAlerts = alerts;
  const activeClients = S.clients.filter(c=>c.status === 'ativo');
  const deliveredMonth = S.videoTasks.filter(v=>v.status === 'entregue' && vMonth(v) === ym).length;
  const planVideos = activeClients.reduce((a,c)=>a + planOf(c).qtyVideo, 0);
  const postsWeek = S.socialPosts.filter(p=>p.date >= addDaysISO(today, -6) && p.date <= today);
  const postsDone = postsWeek.filter(p=>p.status === 'feito').length;
  const inReview = S.videoTasks.filter(v=>v.approval === 'aguardando').length;

  const weekDays = [...Array(7)].map((_, i)=>addDaysISO(today, i));
  const agenda = weekDays.map(d=>{
    const items = [];
    S.socialPosts.filter(p=>p.date === d && p.status !== 'feito').forEach(p=>items.push({ t:'post', txt:`${(p.time||'').slice(0,5)} Post · ${clientName(p.clientId)}`, c:clientColor(p.clientId), go:()=>goTab('social') }));
    S.scripts.filter(s=>s.recordDate === d && ['roteiro','gravar'].includes(s.status)).forEach(s=>items.push({ t:'rec', txt:`Gravar · ${clientName(s.clientId)}: ${s.title}`, c:clientColor(s.clientId), go:()=>goTab('cliente', { id:s.clientId, sub:'roteiros' }) }));
    S.videoTasks.filter(v=>v.dueDate === d && v.status !== 'entregue').forEach(v=>items.push({ t:'vid', txt:`Entrega · ${clientName(v.clientId)}: ${v.title}`, c:clientColor(v.clientId), go:()=>goTab('video', { client:v.clientId }) }));
    return { d, items };
  });
  window.__agenda = agenda;

  const stat = (label, value, sub, ic)=>`<div class="card stat-card"><div class="stat-ic">${icon(ic)}</div><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
  body.innerHTML = `
    <div class="view-head"><div><h1>${greeting()}, ${escapeHtml(name)}</h1><p>${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}</p></div></div>
    <div class="grid grid-4 stat-row">
      ${stat('Clientes ativos', activeClients.length, S.clients.length + ' no total', 'users')}
      ${stat('Vídeos entregues', deliveredMonth + (planVideos ? ' <small>de ' + planVideos + '</small>' : ''), 'em ' + MONTHS[new Date().getMonth()].toLowerCase(), 'film')}
      ${stat('Em aprovação', inReview, 'aguardando o cliente', 'clock')}
      ${stat('Postagens na semana', postsDone + ' <small>de ' + postsWeek.length + '</small>', 'publicadas', 'cal')}
    </div>
    <div class="home-split">
      <section>
        <div class="section-title" style="margin-top:0">Precisa de atenção ${alerts.length ? `<span class="count-pill">${alerts.length}</span>` : ''}</div>
        <div class="card list-card">
          ${alerts.length ? alerts.slice(0, 12).map((a, i)=>`<button class="alert-row ${a.lvl}" onclick="__homeAlerts[${i}].go()">
            <span class="alert-ic">${icon(a.ic)}</span>
            <span class="alert-body"><b>${a.title}</b><small>${a.sub || ''}</small></span>
            <span class="alert-go">${icon('chevron-right')}</span></button>`).join('') : emptyBox('Tudo em dia', 'Nenhuma pendência no momento.')}
        </div>
      </section>
      <section>
        <div class="section-title" style="margin-top:0">Próximos 7 dias</div>
        <div class="card list-card agenda">
          ${agenda.some(a=>a.items.length) ? agenda.filter(a=>a.items.length).map((a, ai)=>`<div class="ag-day"><div class="ag-date"><b>${parseISO(a.d).getDate()}</b><span>${a.d === today ? 'hoje' : WD[parseISO(a.d).getDay()]}</span></div>
            <div class="ag-items">${a.items.map((it, ii)=>`<button class="ag-item" onclick="__agenda[${ai}].items[${ii}].go()"><i style="background:${it.c}"></i>${escapeHtml(it.txt)}</button>`).join('')}</div></div>`).join('') : emptyBox('Semana livre', 'Nada agendado para os próximos dias.')}
        </div>
      </section>
    </div>`;
}
