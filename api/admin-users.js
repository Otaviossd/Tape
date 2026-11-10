// Cria, edita e remove pessoas da equipe. Roda no servidor com a chave secreta
// (SUPABASE_SERVICE_ROLE_KEY), que NUNCA vai para o navegador. Só admin chama.
const { SUPABASE_URL, SERVICE_KEY, send, readBody, originOk, rest, caller, isAdmin } = require('./_lib');

const ROLES = ['admin', 'social', 'video', 'outro', 'cliente'];
const KEYS = ['home', 'clientes', 'social', 'posts', 'video', 'lancamentos', 'financeiro', 'trafego', 'equipe'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanAccess(role, access) {
  if (role === 'cliente') return {};
  const out = { home: true };
  KEYS.forEach(k => { if (k !== 'home') out[k] = !!(access && access[k] === true); });
  if (role === 'admin') KEYS.forEach(k => { out[k] = true; });
  return out;
}

async function authAdmin(path, method, body) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/admin/' + path, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = { message: text }; }
  return { ok: r.ok, status: r.status, data };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!originOk(req)) return send(res, 403, { error: 'Origem não permitida.' });
  if (!SERVICE_KEY) return send(res, 500, { error: 'Servidor sem a chave secreta. Configure SUPABASE_SERVICE_ROLE_KEY na Vercel. (Variáveis vistas pelo servidor: ' + (Object.keys(process.env).filter(k => /supabase|service|meta_|vercel_env/i.test(k)).map(k => JSON.stringify(k)).join(', ') || 'nenhuma') + ')' });

  const me = await caller(req);
  if (!me) return send(res, 401, { error: 'Sessão inválida. Entre de novo.' });
  if (!isAdmin(me)) return send(res, 403, { error: 'Só admin pode gerenciar a equipe.' });

  const b = readBody(req);
  const action = String(b.action || '');

  try {
    if (action === 'status') {
      return send(res, 200, { ok: true, serviceKey: true, meta: !!process.env.META_ACCESS_TOKEN });
    }

    if (action === 'create') {
      const name = String(b.name || '').trim().slice(0, 80);
      const email = String(b.email || '').trim().toLowerCase();
      const password = String(b.password || '');
      const role = String(b.role || '');
      if (!name) return send(res, 400, { error: 'Informe o nome.' });
      if (!EMAIL.test(email)) return send(res, 400, { error: 'E-mail inválido.' });
      if (password.length < 8) return send(res, 400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
      if (!ROLES.includes(role)) return send(res, 400, { error: 'Função inválida.' });
      let clientId = null;
      if (role === 'cliente') {
        clientId = String(b.clientId || '');
        if (!clientId) return send(res, 400, { error: 'Escolha o cliente vinculado a este login.' });
        const c = await rest('/rest/v1/clients?id=eq.' + encodeURIComponent(clientId) + '&select=id');
        if (!c.ok || !c.data || !c.data[0]) return send(res, 400, { error: 'Cliente não encontrado.' });
      }
      const created = await authAdmin('users', 'POST', { email, password, email_confirm: true, user_metadata: { name } });
      if (!created.ok) {
        const m = (created.data && (created.data.msg || created.data.message || created.data.error_description)) || 'Não consegui criar o login.';
        return send(res, created.status === 422 ? 409 : 400, { error: /already|registered|exists/i.test(m) ? 'Já existe um login com esse e-mail.' : m });
      }
      const id = created.data.id;
      const row = { id, name, email, role, access: cleanAccess(role, b.access), clientId };
      const up = await rest('/rest/v1/profiles?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) });
      if (!up.ok) {
        await authAdmin('users/' + id, 'DELETE');
        return send(res, 500, { error: 'Login criado, mas o perfil falhou e foi desfeito: ' + JSON.stringify(up.data).slice(0, 200) });
      }
      return send(res, 200, { ok: true, id });
    }

    if (action === 'update') {
      const id = String(b.id || '');
      if (!id) return send(res, 400, { error: 'Pessoa não informada.' });
      const cur = await rest('/rest/v1/profiles?id=eq.' + encodeURIComponent(id) + '&select=id,role');
      if (!cur.ok || !cur.data || !cur.data[0]) return send(res, 404, { error: 'Pessoa não encontrada.' });
      const role = String(b.role || cur.data[0].role);
      if (!ROLES.includes(role)) return send(res, 400, { error: 'Função inválida.' });
      if (cur.data[0].role === 'admin' && role !== 'admin') {
        const admins = await rest('/rest/v1/profiles?role=eq.admin&select=id');
        if (!admins.ok || (admins.data || []).length <= 1) return send(res, 400, { error: 'Precisa sobrar pelo menos um admin.' });
      }
      const patch = { name: String(b.name || '').trim().slice(0, 80), role, access: cleanAccess(role, b.access), clientId: role === 'cliente' ? (String(b.clientId || '') || null) : null };
      if (!patch.name) return send(res, 400, { error: 'Informe o nome.' });
      if (role === 'cliente' && !patch.clientId) return send(res, 400, { error: 'Escolha o cliente vinculado.' });
      const up = await rest('/rest/v1/profiles?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) });
      if (!up.ok) return send(res, 500, { error: 'Não consegui salvar.' });
      if (b.password) {
        const pw = String(b.password);
        if (pw.length < 8) return send(res, 400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
        const r = await authAdmin('users/' + id, 'PUT', { password: pw });
        if (!r.ok) return send(res, 500, { error: 'Dados salvos, mas a senha não mudou.' });
      }
      return send(res, 200, { ok: true });
    }

    if (action === 'delete') {
      const id = String(b.id || '');
      if (!id) return send(res, 400, { error: 'Pessoa não informada.' });
      if (id === me.user.id) return send(res, 400, { error: 'Você não pode remover a si mesmo.' });
      await rest('/rest/v1/profiles?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      const r = await authAdmin('users/' + id, 'DELETE');
      if (!r.ok && r.status !== 404) return send(res, 500, { error: 'Não consegui remover o login.' });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'Ação desconhecida.' });
  } catch (e) {
    return send(res, 500, { error: 'Erro no servidor.' });
  }
};
