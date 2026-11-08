/* =====================================================================
   Tape Sistema 2.0 | roteiros por cliente (castelhano), datas de gravação e
   de publicação no mesmo lugar, salvos dentro da ficha do cliente.
   ===================================================================== */

const SCRIPT_STATUS = {
  roteiro:   { t:'Roteiro pronto', k:'muted' },
  gravar:    { t:'Gravação marcada', k:'warn' },
  gravado:   { t:'Gravado', k:'info' },
  editando:  { t:'Em edição', k:'info' },
  entregue:  { t:'Entregue', k:'ok' },
  publicado: { t:'Publicado', k:'ok' },
};
let scriptMonth = ymNow();
let scriptDay = null;
let scriptFilter = '';

function miniMonthHtml(ym, marks, selected, fnName){
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const off = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(1 - off);
  const today = localToday();
  let h = '<div class="mm-grid">' + WEEKDAYS_SHORT.map(d=>`<i class="dow">${d[0]}</i>`).join('');
  for(let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = isoOf(d); const other = d.getMonth() !== m - 1;
    const mk = marks[iso] || [];
    h += `<button type="button" class="mm-day ${other ? 'other' : ''} ${iso === today ? 'today' : ''} ${iso === selected ? 'sel' : ''}" onclick="${fnName}('${iso}')">${d.getDate()}
      <span class="mm-dots">${mk.includes('rec') ? '<b class="rec"></b>' : ''}${mk.includes('pub') ? '<b class="pub"></b>' : ''}${mk.includes('post') ? '<b class="post"></b>' : ''}</span></button>`;
  }
  return h + '</div>';
}

function renderScriptsPanel(clientId){
  const banner = schemaBanner('scripts');
  const list = S.scripts.filter(s=>String(s.clientId) === String(clientId));
  const marks = {};
  const add = (d, k)=>{ if(d){ (marks[d] = marks[d] || []).push(k); } };
  list.forEach(s=>{ add(s.recordDate, 'rec'); add(s.publishDate, 'pub'); });
  S.socialPosts.filter(p=>String(p.clientId) === String(clientId)).forEach(p=>add(p.date, 'post'));
  let shown = list;
  if(scriptFilter) shown = shown.filter(s=>s.status === scriptFilter);
  if(scriptDay) shown = shown.filter(s=>s.recordDate === scriptDay || s.publishDate === scriptDay);
  shown = [...shown].sort((a, b)=>(a.recordDate || a.publishDate || '9999').localeCompare(b.recordDate || b.publishDate || '9999') || String(b.createdAt).localeCompare(String(a.createdAt)));
  const counts = {}; list.forEach(s=>{ counts[s.status] = (counts[s.status] || 0) + 1; });
  const today = localToday();
  return banner + `<div class="split-cal">
    <div class="card pad">
      <div class="cal-nav sm"><button onclick="scriptNav(-1)" aria-label="Mês anterior">${icon('chevron-left')}</button><b>${ymLabel(scriptMonth)}</b><button onclick="scriptNav(1)" aria-label="Próximo mês">${icon('chevron-right')}</button></div>
      ${miniMonthHtml(scriptMonth, marks, scriptDay, 'scriptPickDay')}
      <div class="legend"><span><b class="rec"></b>Gravação</span><span><b class="pub"></b>Publicação do roteiro</span><span><b class="post"></b>Post agendado</span></div>
      ${scriptDay ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="scriptPickDay(null)">Limpar dia ${fmtDM(scriptDay)}</button>` : ''}
    </div>
    <div>
      <div class="row-between" style="margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div class="chips">
          <button class="chip-btn ${scriptFilter === '' ? 'on' : ''}" onclick="scriptSetFilter('')">Todos <small>${list.length}</small></button>
          ${Object.keys(SCRIPT_STATUS).map(k=>counts[k] ? `<button class="chip-btn ${scriptFilter === k ? 'on' : ''}" onclick="scriptSetFilter('${k}')">${SCRIPT_STATUS[k].t} <small>${counts[k]}</small></button>` : '').join('')}
        </div>
        <button class="btn btn-primary btn-sm" onclick="openScriptModal('${clientId}')">${icon('plus')}Novo roteiro</button>
      </div>
      ${shown.length ? shown.map(s=>{
        const st = SCRIPT_STATUS[s.status] || SCRIPT_STATUS.roteiro;
        const vt = s.videoTaskId ? S.videoTasks.find(v=>String(v.id) === String(s.videoTaskId)) : null;
        const late = s.recordDate && s.recordDate < today && ['roteiro', 'gravar'].includes(s.status);
        return `<div class="card script-card" onclick="openScriptModal('${clientId}','${s.id}')">
          <div class="script-top"><b>${escapeHtml(s.title)}</b>${badge(st.t, st.k)}${vt ? approvalBadge(vt) : ''}</div>
          <div class="script-dates">
            <span class="${late ? 'late' : ''}">${icon('film', 13)} Gravar: <b>${s.recordDate ? fmtDM(s.recordDate) : 'sem data'}</b></span>
            <span>${icon('cal', 13)} Publicar: <b>${s.publishDate ? fmtDM(s.publishDate) : 'sem data'}</b></span>
            ${vt ? `<span>${icon('link', 13)} ${escapeHtml(vt.title)}</span>` : ''}
          </div>
          <div class="script-prev">${escapeHtml(String(s.body || '').slice(0, 170))}${String(s.body || '').length > 170 ? '…' : ''}</div></div>`;
      }).join('') : emptyBox(list.length ? 'Nada com esse filtro' : 'Nenhum roteiro ainda', list.length ? 'Limpe o filtro ou o dia selecionado.' : 'Crie o primeiro roteiro: texto, data de gravação e de publicação ficam juntos.')}
    </div></div>`;
}
window.scriptNav = function(n){ scriptMonth = ymAdd(scriptMonth, n); renderClientFicha(); };
window.scriptPickDay = function(iso){ scriptDay = iso === scriptDay ? null : iso; renderClientFicha(); };
window.scriptSetFilter = function(k){ scriptFilter = k; renderClientFicha(); };

window.openScriptModal = function(clientId, id){
  const s = id ? S.scripts.find(x=>x.id === id) : null;
  document.getElementById('scriptModalTitle').textContent = (s ? 'Roteiro' : 'Novo roteiro') + ' · ' + clientName(clientId);
  document.getElementById('sId').value = s ? s.id : '';
  document.getElementById('sClient').value = clientId;
  document.getElementById('sTitle').value = s ? s.title : '';
  document.getElementById('sStatus').value = s ? s.status : 'roteiro';
  document.getElementById('sRecord').value = s ? (s.recordDate || '') : (scriptDay || '');
  document.getElementById('sPublish').value = s ? (s.publishDate || '') : '';
  document.getElementById('sBody').value = s ? (s.body || '') : '';
  const vids = S.videoTasks.filter(v=>String(v.clientId) === String(clientId)).sort((a, b)=>(vMonth(b) + pad2(vNum(b))).localeCompare(vMonth(a) + pad2(vNum(a))));
  document.getElementById('sVideo').innerHTML = '<option value="">Nenhum ainda</option>' + vids.map(v=>`<option value="${v.id}">${escapeHtml(monthLabel(vMonth(v)))} · ${escapeHtml(v.title || 'Vídeo')}</option>`).join('');
  document.getElementById('sVideo').value = s && s.videoTaskId ? s.videoTaskId : '';
  document.getElementById('scriptDeleteBtn').style.display = s ? '' : 'none';
  document.getElementById('scriptCopyBtn').style.display = s ? '' : 'inline-flex';
  openModal('modalScript');
};
document.getElementById('scriptCopyBtn').addEventListener('click', ()=>copyText(document.getElementById('sBody').value));
document.getElementById('scriptDeleteBtn').addEventListener('click', async ()=>{
  const id = document.getElementById('sId').value; if(!id) return;
  if(!(await askConfirm('Apagar este roteiro?', 'O texto será removido de vez.', 'Apagar', true))) return;
  try{ await dbDelete('scripts', id); closeModal('modalScript'); toast('Roteiro apagado.', 'ok'); await reloadScripts(); }catch(_){}
});
async function reloadScripts(){ const { data } = await sb.from('scripts').select('*'); if(data){ S.scripts = data; safeRender(); } }
document.getElementById('scriptForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('sId').value;
  const rec = document.getElementById('sRecord').value || null, pub = document.getElementById('sPublish').value || null;
  let status = document.getElementById('sStatus').value;
  if(rec && pub && pub < rec){ toast('A publicação não pode ser antes da gravação.', 'error'); return; }
  if(!id && rec && status === 'roteiro') status = 'gravar';
  const row = {
    clientId: document.getElementById('sClient').value,
    title: document.getElementById('sTitle').value.trim(),
    body: document.getElementById('sBody').value,
    status, recordDate: rec, publishDate: pub,
    videoTaskId: document.getElementById('sVideo').value || null,
    updatedAt: new Date().toISOString(),
  };
  if(!row.title){ toast('Dê um título ao roteiro.', 'error'); return; }
  try{
    if(id) await dbUpdate('scripts', id, row); else await dbInsert('scripts', row);
    closeModal('modalScript'); toast('Roteiro salvo.', 'ok'); await reloadScripts();
  }catch(_){}
});
