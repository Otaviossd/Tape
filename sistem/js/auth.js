/* =====================================================================
   Tape Sistema 2.0 | login, sessão, permissões e equipe
   Segurança: o login NÃO lista pessoas, não existe criação de conta pela tela
   e a equipe é criada/editada só pelo servidor (/api/admin-users).
   ===================================================================== */

const IDLE_LIMIT_MS = 8 * 60 * 60 * 1000;   // sai sozinho após 8 h sem uso
let lastActive = Date.now();
['click','keydown','touchstart','mousemove'].forEach(ev=>window.addEventListener(ev, ()=>{ lastActive = Date.now(); }, { passive:true }));
setInterval(()=>{ if(currentMember && Date.now() - lastActive > IDLE_LIMIT_MS){ signOutNow('Você ficou muito tempo parado e saiu por segurança.'); } }, 60000);

function loginError(msg){ const e = document.getElementById('loginError'); if(!e) return; e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }

function renderLogin(notice){
  document.getElementById('app').style.display = 'none';
  document.getElementById('pickerOverlay').style.display = 'flex';
  const area = document.getElementById('loginArea');
  area.innerHTML = `
    <h1 class="login-title">Entrar</h1>
    <p class="login-sub">Acesso da equipe Tape.</p>
    ${notice ? `<div class="login-note">${escapeHtml(notice)}</div>` : ''}
    <form id="loginForm" novalidate>
      <div class="field"><label for="liEmail">E-mail</label><input id="liEmail" type="email" autocomplete="username" inputmode="email" required></div>
      <div class="field"><label for="liPass">Senha</label><input id="liPass" type="password" autocomplete="current-password" required></div>
      <div id="loginError" class="login-err" role="alert" style="display:none"></div>
      <button class="btn btn-primary btn-block" id="liSubmit" type="submit">Entrar</button>
    </form>
    <p class="login-foot"><a href="#" id="liForgot">Esqueci minha senha</a></p>`;
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const email = document.getElementById('liEmail').value.trim();
    const pass = document.getElementById('liPass').value;
    if(!email || !pass){ loginError('Preencha e-mail e senha.'); return; }
    const btn = document.getElementById('liSubmit'); btn.disabled = true; btn.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      btn.disabled = false; btn.textContent = 'Entrar';
      loginError(/rate|too many/i.test(error.message) ? 'Muitas tentativas. Espere um pouco e tente de novo.' : 'E-mail ou senha incorretos.');
      return;
    }
    loginError('');
    await loadSessionAndStart();
  });
  document.getElementById('liForgot').addEventListener('click', async e=>{
    e.preventDefault();
    const email = document.getElementById('liEmail').value.trim();
    if(!email){ loginError('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".'); return; }
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    loginError(''); toast('Se esse e-mail estiver cadastrado, enviamos um link para criar uma nova senha.', 'ok');
  });
}

function renderNewPassword(){
  document.getElementById('app').style.display = 'none';
  document.getElementById('pickerOverlay').style.display = 'flex';
  document.getElementById('loginArea').innerHTML = `
    <h1 class="login-title">Nova senha</h1>
    <p class="login-sub">Escolha uma senha com pelo menos 8 caracteres.</p>
    <form id="npForm" novalidate>
      <div class="field"><label for="npPass">Nova senha</label><input id="npPass" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="npPass2">Repita a senha</label><input id="npPass2" type="password" autocomplete="new-password"></div>
      <div id="loginError" class="login-err" role="alert" style="display:none"></div>
      <button class="btn btn-primary btn-block" type="submit">Salvar e entrar</button>
    </form>`;
  document.getElementById('npForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const p1 = document.getElementById('npPass').value, p2 = document.getElementById('npPass2').value;
    if(p1.length < 8){ loginError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if(p1 !== p2){ loginError('As senhas não coincidem.'); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){ loginError(error.message); return; }
    history.replaceState(null, '', location.pathname);
    toast('Senha atualizada.', 'ok');
    await loadSessionAndStart();
  });
}

async function signOutNow(notice){
  try{ await sb.auth.signOut(); }catch(_){}
  currentMember = null; listenersStarted = false;
  Object.keys(S).forEach(k=>{ if(Array.isArray(S[k])) S[k] = []; });
  S.financeReady = false;
  renderLogin(notice);
}

async function loadSessionAndStart(){
  const { data: { session } } = await sb.auth.getSession();
  if(!session){ renderLogin(); return; }
  const { data: profile, error } = await sb.from('profiles').select('id,name,email,role,access,clientId').eq('id', session.user.id).maybeSingle();
  if(error || !profile){ await signOutNow('Esse login ainda não tem permissão no sistema. Fale com o admin.'); return; }
  if(profile.role === 'cliente'){
    // cliente usa o link de entregas (aprovação, calendário), não o painel interno
    const { data: slug } = await sb.rpc('my_share_slug');
    await sb.auth.signOut();
    if(slug){ location.replace('/p/' + encodeURIComponent(slug)); return; }
    renderLogin('Seu link de entregas ainda não foi ativado. Fale com a Tape.');
    return;
  }
  if(!profile.access) profile.access = ACCESS_DEFAULTS[profile.role] || ACCESS_DEFAULTS.outro;
  currentMember = profile;
  lastActive = Date.now();
  document.getElementById('pickerOverlay').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  applyCurrentMember();
  startDataListeners();
}

/* ---- Permissões ---- */
function hasAccess(section){
  if(!currentMember) return section === 'home';
  if(section === 'home') return true;
  if(currentMember.role === 'admin') return true;
  const a = currentMember.access || {};
  if(section === 'biblioteca') return !!(a.video || a.clientes || a.social);
  if(section === 'cliente') return !!a.clientes;
  if(section === 'trafego') return !!(a.trafego || a.financeiro);
  return !!a[section];
}
function canSeeMoney(){ return hasAccess('financeiro'); }
function isClient(){ return false; }   // clientes não entram no painel (usam o link)

function applyCurrentMember(){
  if(!currentMember) return;
  document.getElementById('whoAvatar').textContent = initials(currentMember.name);
  document.getElementById('whoName').textContent = currentMember.name;
  document.getElementById('whoRole').textContent = ROLE_LABELS[currentMember.role] || currentMember.role;
  if(!currentTab || !hasAccess(currentTab)) currentTab = 'home';
  renderSideNav(); renderView();
}

document.getElementById('btnSwitchPerson').addEventListener('click', ()=>signOutNow());

/* ---- Equipe ---- */
const ACCESS_LABELS = {clientes:'Clientes', social:'Social Media', posts:'Posts', video:'Vídeo', lancamentos:'Lançamentos', financeiro:'Financeiro', trafego:'Tráfego', equipe:'Equipe'};
function renderTeam(){
  const grid = document.getElementById('teamGrid');
  if(!S.team.length){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><b>Ninguém cadastrado</b></div>`; return; }
  grid.innerHTML = S.team.map(m=>{
    const acc = m.role === 'admin' ? ACCESS_DEFAULTS.admin : (m.access || {});
    const chips = Object.keys(ACCESS_LABELS).map(k=>`<span class="tag ${acc[k]?'tag-on':''}">${acc[k]?icon('check',10):''}${ACCESS_LABELS[k]}</span>`).join('');
    const mine = currentMember && m.id === currentMember.id;
    return `<div class="card client-card">
      <div class="client-top">
        <div style="display:flex;gap:10px;align-items:center;min-width:0;">
          <div class="who-avatar" style="width:36px;height:36px;">${escapeHtml(initials(m.name))}</div>
          <div style="min-width:0"><div class="client-name">${escapeHtml(m.name)}${mine?' <span class="muted-s">(você)</span>':''}</div><div class="muted-s">${escapeHtml(ROLE_LABELS[m.role]||m.role)} · ${escapeHtml(m.email||'')}</div></div>
        </div>
      </div>
      <div class="client-tags">${m.role==='cliente' ? `<span class="tag">Cliente: ${escapeHtml(clientName(m.clientId))}</span>` : chips}</div>
      <div class="client-actions"><button class="btn btn-ghost btn-sm" onclick="openEditPerson('${m.id}')">${icon('edit')}Editar</button></div>
    </div>`;
  }).join('');
}

function setPersonFormMode(editing){
  document.getElementById('personModalTitle').textContent = editing ? 'Editar pessoa' : 'Cadastrar pessoa';
  document.getElementById('personSubmitBtn').textContent = editing ? 'Salvar' : 'Cadastrar';
  document.getElementById('mPasswordLabel').textContent = editing ? 'Nova senha (deixe vazio para manter a atual)' : 'Senha de acesso';
  document.getElementById('mPassword').required = !editing;
  document.getElementById('mEmail').disabled = editing;
  document.getElementById('personDeleteBtn').style.display = editing ? '' : 'none';
}
document.getElementById('btnNewPersonAdmin').addEventListener('click', ()=>{
  document.getElementById('personForm').reset();
  document.getElementById('mId').value = '';
  setPersonFormMode(false);
  setAccessCheckboxes(ACCESS_DEFAULTS.outro);
  syncRoleFields();
  openModal('modalPerson');
});
window.openEditPerson = function(id){
  const m = S.team.find(x=>x.id === id); if(!m) return;
  document.getElementById('personForm').reset();
  document.getElementById('mId').value = m.id;
  document.getElementById('mName').value = m.name || '';
  document.getElementById('mEmail').value = m.email || '';
  document.getElementById('mRole').value = m.role;
  setPersonFormMode(true);
  setAccessCheckboxes(m.access || ACCESS_DEFAULTS[m.role] || ACCESS_DEFAULTS.outro);
  syncRoleFields();
  if(m.role === 'cliente' && m.clientId) document.getElementById('mClient').value = m.clientId;
  openModal('modalPerson');
};
document.getElementById('personDeleteBtn').addEventListener('click', async ()=>{
  const id = document.getElementById('mId').value; const m = S.team.find(x=>x.id === id); if(!m) return;
  if(!(await askConfirm('Remover ' + m.name + '?', 'O login será apagado e a pessoa perde o acesso na hora.', 'Remover', true))) return;
  try{ await apiCall('admin-users', { action:'delete', id }); closeModal('modalPerson'); toast('Pessoa removida.', 'ok'); await reloadTeam(); }
  catch(e){ toast(e.message, 'error'); }
});
async function reloadTeam(){
  const { data, error } = await sb.from('profiles').select('id,name,email,role,access,clientId');
  if(error) return;
  S.team = (data || []).map(p=>({ ...p, access: p.access || ACCESS_DEFAULTS[p.role] || ACCESS_DEFAULTS.outro }));
  if(currentTab === 'equipe') renderTeam();
}
document.getElementById('personForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('mId').value;
  const name = document.getElementById('mName').value.trim();
  const role = document.getElementById('mRole').value;
  const access = {};
  document.querySelectorAll('#personForm .checkchip input').forEach(chk=>{ access[chk.value] = chk.checked || chk.disabled; });
  const body = { name, role, access, clientId: role === 'cliente' ? (document.getElementById('mClient').value || null) : null };
  const pass = document.getElementById('mPassword').value;
  if(!name){ toast('Informe o nome.', 'error'); return; }
  if(!id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById('mEmail').value.trim())){ toast('Informe um e-mail válido.', 'error'); return; }
  if((!id || pass) && pass.length < 8){ toast('A senha precisa ter pelo menos 8 caracteres.', 'error'); return; }
  if(role === 'cliente' && !body.clientId){ toast('Escolha o cliente vinculado a este login.', 'error'); return; }
  const btn = document.getElementById('personSubmitBtn'); btn.disabled = true;
  try{
    if(id){
      if(pass) body.password = pass;
      await apiCall('admin-users', { action:'update', id, ...body });
      toast('Alterações salvas.', 'ok');
    } else {
      body.email = document.getElementById('mEmail').value.trim();
      body.password = pass;
      await apiCall('admin-users', { action:'create', ...body });
      toast(name + ' foi cadastrado(a).', 'ok');
    }
    closeModal('modalPerson');
    await reloadTeam();
    if(id && currentMember && currentMember.id === id){ await loadSessionAndStart(); }
  }catch(err){
    toast(err.code === 'not_configured' ? 'Servidor sem configuração.' : err.message, 'error');
  }finally{ btn.disabled = false; }
});
