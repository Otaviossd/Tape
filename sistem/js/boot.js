/* =====================================================================
   Tape Sistema 2.0 | carregamento de dados (tempo real) e inicialização
   Cada pessoa só carrega as tabelas que o cargo dela permite. O banco
   (RLS) é a barreira de verdade; isto só evita pedidos desnecessários.
   ===================================================================== */

let listenersStarted = false;
S.contracts = []; S.scripts = []; S.reports = []; S.launchTerms = []; S.missing = {};

function schemaMissing(error){
  const m = (error && (error.message || '') + ' ' + (error.code || '')) || '';
  return /42P01|does not exist|schema cache|Could not find the table/i.test(m);
}
function schemaBanner(...tables){
  const miss = tables.filter(t=>S.missing[t]);
  if(!miss.length) return '';
  return `<div class="banner warn"><b>Falta instalar a estrutura nova do banco.</b> Rode o arquivo <code>01_schema_novo.sql</code> no Supabase (SQL Editor) e recarregue esta página. Tabela: ${miss.join(', ')}.</div>`;
}

const REFRESH_TABS = {
  clients:['clientes','cliente','social','video','posts','financeiro','trafego','home','biblioteca'],
  social_posts:['social','cliente','home'],
  post_tasks:['posts','cliente','home'],
  video_tasks:['video','cliente','biblioteca','social','home'],
  launches:['lancamentos','financeiro'],
  scripts:['cliente','home'],
  contracts:['cliente','financeiro','home','clientes'],
  finance_entries:['cliente','financeiro','home'],
  finance_fixed:['financeiro'],
  finance_lanza:['financeiro','lancamentos'],
  launch_terms:['financeiro','lancamentos'],
  client_reports:['cliente','trafego'],
};

function startDataListeners(){
  if(listenersStarted) return; listenersStarted = true;
  const a = k=>hasAccess(k);
  let pendingFinance = 0;
  const finTables = [];

  const watch = (table, key, allowed)=>{
    if(!allowed) return;
    if(['finance_entries','finance_fixed','finance_lanza','contracts','launch_terms'].includes(table)){ pendingFinance++; finTables.push(table); }
    let timer = null, first = true;
    const load = async ()=>{
      const { data, error } = await sb.from(table).select('*');
      if(error){
        if(schemaMissing(error)) S.missing[table] = true; else console.error(table, error.message);
        S[key] = [];
      } else { S[key] = data || []; delete S.missing[table]; }
      if(first){ first = false; if(finTables.includes(table)){ pendingFinance--; if(pendingFinance <= 0) S.financeReady = true; } }
      if(S.financeReady || !finTables.includes(table)){
        if(table === 'clients') fillClientSelects();
        if((REFRESH_TABS[table] || []).includes(currentTab)) safeRender();
        updateNavBadges();
      }
    };
    const sched = ()=>{ clearTimeout(timer); timer = setTimeout(load, 250); };
    load();
    sb.channel('rt:' + table).on('postgres_changes', { event:'*', schema:'public', table }, sched).subscribe();
  };

  if(currentMember.role === 'admin') reloadTeam();
  watch('clients', 'clients', true);
  watch('social_posts', 'socialPosts', true);
  watch('post_tasks', 'postTasks', true);
  watch('video_tasks', 'videoTasks', true);
  watch('scripts', 'scripts', true);
  watch('launches', 'launches', a('lancamentos'));
  watch('finance_entries', 'financeEntries', a('financeiro'));
  watch('finance_fixed', 'fixedExpenses', a('financeiro'));
  watch('finance_lanza', 'lanzaEntries', a('financeiro'));
  watch('contracts', 'contracts', a('financeiro'));
  watch('launch_terms', 'launchTerms', a('financeiro'));
  watch('client_reports', 'reports', a('trafego') || a('financeiro'));
  if(pendingFinance === 0) S.financeReady = true;
}


/* Depois de cada gravação, recarrega a tabela na hora (não depende só do tempo real) */
const TABLE_KEY = { clients:'clients', social_posts:'socialPosts', post_tasks:'postTasks', video_tasks:'videoTasks', launches:'launches',
  finance_entries:'financeEntries', finance_fixed:'fixedExpenses', finance_lanza:'lanzaEntries', contracts:'contracts', scripts:'scripts',
  launch_terms:'launchTerms', client_reports:'reports' };
const _reloadTimers = {};
function reloadTableSoon(table){
  const key = TABLE_KEY[table]; if(!key || !sb) return;
  clearTimeout(_reloadTimers[table]);
  _reloadTimers[table] = setTimeout(async ()=>{
    const { data, error } = await sb.from(table).select('*');
    if(error) return;
    S[key] = data || [];
    if(table === 'clients') fillClientSelects();
    if((REFRESH_TABS[table] || []).includes(currentTab)) safeRender();
    updateNavBadges();
  }, 120);
}

let renderTimer = null;
function safeRender(){
  clearTimeout(renderTimer);
  renderTimer = setTimeout(()=>{
    // não atrapalha quem está digitando num campo da própria tela
    const ae = document.activeElement;
    if(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest('.view.active') && !ae.closest('.modal-overlay')) { renderTimer = setTimeout(safeRender, 1500); return; }
    try{ renderView(); }catch(e){ console.error(e); }
  }, 120);
}

/* Revalida o perfil de tempos em tempos: se o admin mudou o acesso ou removeu a pessoa, vale na hora */
async function revalidateProfile(){
  if(!currentMember) return;
  const { data: { session } } = await sb.auth.getSession();
  if(!session){ signOutNow('Sua sessão expirou. Entre de novo.'); return; }
  const { data, error } = await sb.from('profiles').select('id,name,email,role,access,clientId').eq('id', session.user.id).maybeSingle();
  if(error) return;
  if(!data){ signOutNow('Seu acesso foi removido.'); return; }
  if(data.role === 'cliente'){ signOutNow(); return; }
  const changed = JSON.stringify([data.role, data.access, data.name]) !== JSON.stringify([currentMember.role, currentMember.access, currentMember.name]);
  if(changed){ currentMember = { ...data, access: data.access || ACCESS_DEFAULTS[data.role] || ACCESS_DEFAULTS.outro }; applyCurrentMember(); toast('Seu acesso foi atualizado.', 'info'); }
}
setInterval(revalidateProfile, 5 * 60 * 1000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) revalidateProfile(); });

window.addEventListener('unhandledrejection', e=>{
  const m = e.reason && (e.reason.message || String(e.reason));
  if(m){ console.error(e.reason); if(!/AbortError|ResizeObserver/i.test(m)) toast('Algo deu errado: ' + m, 'error'); }
});

async function boot(){
  if(!window.supabase){
    document.getElementById('loginArea').innerHTML = `<div class="empty"><b>Não carregou</b>Recarregue a página.</div>`;
    return;
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { broadcast: false, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  db = { collection: makeSupaCollection };
  let recovery = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange((event)=>{
    if(event === 'PASSWORD_RECOVERY'){ recovery = true; renderNewPassword(); }
    if(event === 'SIGNED_OUT'){ listenersStarted = false; try{ sb.removeAllChannels(); }catch(_){} }
  });
  if(recovery){ await new Promise(r=>setTimeout(r, 400)); renderNewPassword(); return; }
  await loadSessionAndStart();
  if(currentMember) routeFromHash();
}
boot();
