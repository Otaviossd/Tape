/* =====================================================================
   Tape Sistema 2.0 | núcleo: avisos, chamadas ao servidor, datas, atalhos
   ===================================================================== */

/* ---- Avisos (toast) no lugar de alert() ---- */
function toast(msg, kind){
  let box = document.getElementById('toasts');
  if(!box){ box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role','status'); box.setAttribute('aria-live','polite'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || 'info');
  t.textContent = String(msg == null ? '' : msg);
  box.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('in'));
  const ms = kind === 'error' ? 6000 : 3200;
  setTimeout(()=>{ t.classList.remove('in'); setTimeout(()=>t.remove(), 300); }, ms);
}
window.alert = function(m){
  const s = String(m == null ? '' : m);
  toast(s, /não|erro|falh|inválid|precis|escolha|preencha|informe|cole/i.test(s) ? 'error' : 'info');
};

/* ---- Chamadas às rotas do servidor (/api) com o token do login ---- */
async function apiCall(route, body){
  const { data } = await sb.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if(!token) throw new Error('Sessão expirada. Entre de novo.');
  let r;
  try{
    r = await fetch('/api/' + route, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + token }, body: JSON.stringify(body || {}) });
  }catch(e){ throw new Error('Sem conexão com o servidor.'); }
  let j = null; try{ j = await r.json(); }catch(_){}
  if(!r.ok){
    const err = new Error((j && (j.message || j.error)) || ('Erro ' + r.status));
    err.code = j && j.error; err.status = r.status; throw err;
  }
  return j;
}

/* ---- Banco: atalhos que avisam o erro ---- */
async function dbInsert(table, row){
  const { data, error } = await sb.from(table).insert(row).select().single();
  if(error){ toast('Não consegui salvar: ' + error.message, 'error'); throw error; }
  if(window.reloadTableSoon) reloadTableSoon(table);
  return data;
}
async function dbUpdate(table, id, patch){
  const { error } = await sb.from(table).update(patch).eq('id', id);
  if(error){ toast('Não consegui salvar: ' + error.message, 'error'); throw error; }
  if(window.reloadTableSoon) reloadTableSoon(table);
}
async function dbDelete(table, id){
  const { error } = await sb.from(table).delete().eq('id', id);
  if(error){ toast('Não consegui remover: ' + error.message, 'error'); throw error; }
  if(window.reloadTableSoon) reloadTableSoon(table);
}

/* ---- Datas (sempre em ISO AAAA-MM-DD, sem fuso) ---- */
function isoOf(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function localToday(){ return isoOf(new Date()); }
function parseISO(s){ const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function addDaysISO(iso, n){ const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); }
function addMonthsISO(iso, n){
  const d = parseISO(iso); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return isoOf(d);
}
function diffDays(aISO, bISO){ return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000); }   // b - a
function ymOf(iso){ return String(iso || '').slice(0, 7); }
function ymNow(){ return localToday().slice(0, 7); }
function ymAdd(ym, n){ return addMonthsISO(ym + '-01', n).slice(0, 7); }
function ymLabel(ym){ const [y, m] = ym.split('-'); return MONTHS[+m - 1] + ' ' + y; }
function ymLabelShort(ym){ const [y, m] = ym.split('-'); return MONTHS_SHORT[+m - 1] + '/' + String(y).slice(2); }
function daysText(n){
  if(n === 0) return 'hoje';
  if(n === 1) return 'amanhã';
  if(n === -1) return 'ontem';
  return n > 0 ? 'em ' + n + ' dias' : 'há ' + Math.abs(n) + ' dias';
}
function fmtDM(iso){ if(!iso) return '-'; const d = parseISO(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }

/* ---- Números ---- */
function fmtNum(n){ return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function fmtDec(n, d){ return (Number(n) || 0).toFixed(d == null ? 1 : d).replace('.', ','); }
function fmtPct(n, d){ return fmtDec(n, d == null ? 1 : d) + '%'; }
function fmtCur(n, cur){
  const c = (cur || 'PYG').toUpperCase();
  if(c === 'USD') return 'US$ ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if(c === 'BRL') return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '₲ ' + fmtNum(n);
}
function safeDiv(a, b){ return b > 0 ? a / b : 0; }

/* ---- Utilidades de interface ---- */
async function copyText(text){
  try{ await navigator.clipboard.writeText(text); toast('Copiado.', 'ok'); return true; }
  catch(_){
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try{ ok = document.execCommand('copy'); }catch(_e){}
    ta.remove(); toast(ok ? 'Copiado.' : 'Não consegui copiar.', ok ? 'ok' : 'error'); return ok;
  }
}
function badge(text, kind){ return '<span class="badge badge-' + (kind || 'muted') + '">' + escapeHtml(text) + '</span>'; }
function icon(name, size){ return '<svg class="icon"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '><use href="#ic-' + name + '"/></svg>'; }
function emptyBox(title, hint){ return '<div class="empty"><b>' + escapeHtml(title) + '</b>' + (hint ? escapeHtml(hint) : '') + '</div>'; }
function debounce(fn, ms){ let t; return function(){ const a = arguments; clearTimeout(t); t = setTimeout(()=>fn.apply(null, a), ms); }; }
function isHttpUrl(u){ return /^https?:\/\/[^\s]+$/i.test(String(u || '').trim()); }
function safeUrl(u){ return isHttpUrl(u) ? String(u).trim() : ''; }
function downloadText(filename, text, mime){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
  a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function randToken(n){ const a = new Uint8Array(n || 8); crypto.getRandomValues(a); return Array.from(a, b=>'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); }

/* ---- Confirmação elegante (retorna Promise<boolean>) ---- */
function askConfirm(title, text, okLabel, danger){
  return new Promise(resolve=>{
    const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = 400;
    ov.innerHTML = '<div class="modal" style="max-width:420px"><h2>' + escapeHtml(title) + '</h2><p style="color:var(--muted);font-size:13.5px;margin-bottom:6px;white-space:pre-line">' + escapeHtml(text || '') + '</p>' +
      '<div class="modal-actions"><button class="btn btn-outline" data-r="0">Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-r="1">' + escapeHtml(okLabel || 'Confirmar') + '</button></div></div>';
    const done = v=>{ ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e=>{ if(e.key === 'Escape') done(false); };
    ov.addEventListener('click', e=>{ const r = e.target.dataset && e.target.dataset.r; if(r === '1') done(true); else if(r === '0' || e.target === ov) done(false); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    const b = ov.querySelector('[data-r="1"]'); if(b) b.focus();
  });
}

/* ---- Estado das chamadas de dados (rótulo "carregando") ---- */
function skeleton(lines){ return '<div class="skel">' + '<i></i>'.repeat(lines || 3) + '</div>'; }
