/* =====================================================================
   Tape Sistema 2.0 | biblioteca de trabalhos
   Vídeo entregue + "mostrar no site" alimenta a página Trabajos do site,
   sem subir arquivo à mão. Só entra quem tem a prévia no sistema.
   ===================================================================== */

let libFilter = 'todos', libClient = '', libQuery = '';
const SITE_CATS = ['Contenido para redes', 'Loteamientos', 'Eventos', 'Institucional', 'Publicidad', 'Otro'];

function renderLibrary(){
  const box = document.getElementById('libraryBody');
  const delivered = S.videoTasks.filter(v=>v.status === 'entregue');
  const q = libQuery.trim().toLowerCase();
  let list = delivered.filter(v=>(!libClient || String(v.clientId) === libClient)
    && (libFilter === 'todos' || (libFilter === 'site' ? v.showOnSite : !v.showOnSite))
    && (!q || ((v.title || '') + ' ' + clientName(v.clientId)).toLowerCase().includes(q)));
  list = list.sort((a, b)=>(b.showOnSite ? 1 : 0) - (a.showOnSite ? 1 : 0) || (a.siteOrder || 0) - (b.siteOrder || 0) || String(vMonth(b)).localeCompare(vMonth(a)) || vNum(b) - vNum(a));
  const onSite = delivered.filter(v=>v.showOnSite).length;
  const clientsWith = [...new Set(delivered.map(v=>String(v.clientId)))].map(id=>clientById(id)).filter(Boolean);
  box.innerHTML = `
    <div class="view-head"><div><h1>Biblioteca de trabalhos</h1><p>Marque os vídeos que devem aparecer na página <b>Trabajos</b> do site. Atualiza sozinho, sem subir arquivo.</p></div>
      <a class="btn btn-outline" href="/trabajos/" target="_blank" rel="noopener">${icon('external')}Ver no site</a></div>
    ${schemaBanner('video_tasks') }
    <div class="toolbar">
      <div class="chips">
        <button class="chip-btn ${libFilter === 'todos' ? 'on' : ''}" onclick="libSet('todos')">Todos <small>${delivered.length}</small></button>
        <button class="chip-btn ${libFilter === 'site' ? 'on' : ''}" onclick="libSet('site')">No site <small>${onSite}</small></button>
        <button class="chip-btn ${libFilter === 'fora' ? 'on' : ''}" onclick="libSet('fora')">Fora do site <small>${delivered.length - onSite}</small></button>
      </div>
      <div class="toolbar-r"><select onchange="libClient=this.value;renderLibrary()" aria-label="Cliente"><option value="">Todos os clientes</option>${clientsWith.map(c=>`<option value="${c.id}" ${libClient === String(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      <input type="search" placeholder="Buscar vídeo" value="${escapeHtml(libQuery)}" oninput="libQuery=this.value;debLib()"></div></div>
    ${list.length ? `<div class="lib-grid">${list.map(v=>{
      const canSite = !!v.filePath;
      return `<div class="card lib-card ${v.showOnSite ? 'on' : ''}">
        <a class="lib-thumb" href="${escapeHtml(v.finalLink || '#')}" target="_blank" rel="noopener">${videoThumb(v, 400)}${v.showOnSite ? `<span class="lib-flag">${icon('check', 12)} No site</span>` : ''}</a>
        <div class="lib-body">
          <div class="kb-client"><span class="client-dot" style="background:${clientColor(v.clientId)}"></span>${escapeHtml(clientName(v.clientId))}</div>
          <div class="lib-title">${escapeHtml(v.showOnSite && v.siteTitle ? v.siteTitle : (v.title || 'Vídeo'))}</div>
          <div class="muted-s">${ymLabelShort(vMonth(v) || ymNow())}${v.showOnSite && v.siteCategory ? ' · ' + escapeHtml(v.siteCategory) : ''}</div>
          <label class="switch-row ${canSite ? '' : 'off'}"><input type="checkbox" ${v.showOnSite ? 'checked' : ''} ${canSite ? '' : 'disabled'} onchange="toggleShowOnSite('${v.id}',this.checked)"><span class="sw"></span>Mostrar no site</label>
          ${canSite ? '' : '<div class="muted-s">Sem prévia no sistema. Edite a entrega e suba o arquivo.</div>'}
          ${v.showOnSite ? `<button class="btn btn-outline btn-sm" onclick="openSiteModal('${v.id}')">${icon('edit')}Detalhes no site</button>` : ''}
        </div></div>`; }).join('')}</div>` : emptyBox(delivered.length ? 'Nada com esse filtro' : 'Nenhum vídeo entregue ainda', 'Os vídeos entregues aparecem aqui.')}`;
}
const debLib = debounce(()=>renderLibrary(), 250);
window.libSet = function(f){ libFilter = f; renderLibrary(); };

window.toggleShowOnSite = async function(id, on){
  const v = S.videoTasks.find(x=>x.id === id); if(!v) return;
  const patch = { showOnSite: !!on };
  if(on && !v.siteLabel) patch.siteLabel = clientName(v.clientId);
  try{
    await dbUpdate('video_tasks', id, patch); Object.assign(v, patch);
    toast(on ? 'Vai aparecer na página Trabajos do site.' : 'Removido do site.', 'ok');
    if(on) openSiteModal(id); else safeRender();
  }catch(_){ safeRender(); }
};
window.openSiteModal = function(id){
  const v = S.videoTasks.find(x=>x.id === id); if(!v) return;
  document.getElementById('siteId').value = id;
  document.getElementById('siteLabel').value = v.siteLabel || clientName(v.clientId);
  document.getElementById('siteTitle').value = v.siteTitle || '';
  document.getElementById('siteOrder').value = v.siteOrder || 0;
  document.getElementById('siteCat').innerHTML = SITE_CATS.map(c=>`<option ${c === (v.siteCategory || 'Contenido para redes') ? 'selected' : ''}>${c}</option>`).join('');
  openModal('modalSite');
};
document.getElementById('siteForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const id = document.getElementById('siteId').value;
  const patch = {
    siteLabel: document.getElementById('siteLabel').value.trim().slice(0, 60) || null,
    siteTitle: document.getElementById('siteTitle').value.trim().slice(0, 80) || null,
    siteCategory: document.getElementById('siteCat').value,
    siteOrder: parseInt(document.getElementById('siteOrder').value, 10) || 0,
  };
  try{ await dbUpdate('video_tasks', id, patch); const v = S.videoTasks.find(x=>x.id === id); if(v) Object.assign(v, patch); closeModal('modalSite'); toast('Salvo. O site atualiza em instantes.', 'ok'); safeRender(); }catch(_){}
});
