/* Festas & Decorações — painel da loja (JavaScript puro, sem build) */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const conteudo = $('#conteudo');
let LOJA = null;
let USUARIO = null;

// ================= utilidades =================
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moeda = v => fmtMoeda.format(Number(v || 0));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dia = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '';
const diaHora = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const num = v => { const s = String(v ?? '').trim(); if (/^\d+(\.\d{1,2})?$/.test(s)) return +s; const n = parseFloat(s.replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const dec = v => v ? String(v).replace('.', ',') : '';
const qtdTxt = q => Number(q) % 1 === 0 ? String(Number(q)) : Number(q).toLocaleString('pt-BR');
const iniciais = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const fone = t => {
  const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
};
const STATUS = { Rascunho: 'Rascunho', Pendente: 'Pendente', Aprovado: 'Aprovado', EmAndamento: 'Em andamento', Finalizado: 'Finalizado', Recusado: 'Recusado', Cancelado: 'Cancelado', AguardandoConfirmacao: 'A confirmar', Confirmado: 'Confirmado', Rejeitado: 'Rejeitado' };
const chip = s => `<span class="chip st-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
const chipPag = o => o.total <= 0 || ['Rascunho', 'Pendente', 'Recusado', 'Cancelado'].includes(o.status) ? '' :
  `<span class="chip ${o.situacaoPag === 'Quitado' ? 'pag-ok' : o.situacaoPag === 'Sinal pago' ? 'pag-sinal' : 'pag-aberto'}">${o.situacaoPag}</span>`;
const fotoHtml = (url, cls = '') => `<div class="foto ${cls}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : '🎈'}</div>`;
const CATEGORIAS = ['Fachadas', 'Painéis', 'Temas', 'Mesas', 'Balões', 'Outros'];
const TIPOS_FESTA = ['Aniversário Infantil', 'Aniversário Adulto', 'Chá de Bebê', 'Chá Revelação', 'Batizado', '15 Anos', 'Casamento', 'Noivado', 'Formatura', 'Corporativo', 'Outro'];

function toast(msg, erro = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (erro ? ' erro' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), erro ? 4500 : 2600);
}
function modal(html) {
  const f = document.createElement('div');
  f.className = 'modal-fundo';
  f.innerHTML = `<div class="modal">${html}</div>`;
  const fechar = () => f.remove();
  f.addEventListener('click', e => { if (e.target === f || e.target.closest('[data-fechar]')) fechar(); });
  document.body.appendChild(f);
  return { el: f, fechar };
}
function confirmar(msg, ok = 'Confirmar') {
  return new Promise(res => {
    const m = modal(`<h2>${esc(msg)}</h2><div class="botoes dois"><button class="btn claro" data-fechar>Voltar</button><button class="btn" id="ok">${esc(ok)}</button></div>`);
    $('#ok', m.el).onclick = () => { m.fechar(); res(true); };
    m.el.addEventListener('click', e => { if (e.target === m.el || e.target.closest('[data-fechar]')) res(false); });
  });
}
async function tentar(fn, msgOk) {
  try { const r = await fn(); if (msgOk) toast(msgOk); return r; } catch (e) { toast(e.message, true); throw e; }
}
function copiar(texto) { navigator.clipboard?.writeText(texto).then(() => toast('Copiado!'), () => prompt('Copie:', texto)); }
/** Abre o WhatsApp numa aba (aberta já no clique para não ser bloqueada). */
function abrirWhats(telefone, texto) {
  window.open(`https://wa.me/${Base.normalizarTelefone(telefone)}?text=${encodeURIComponent(texto)}`, '_blank');
}

function topo(titulo, voltar = null, direita = '') {
  $('#titulo').textContent = titulo;
  $('#btnEsq').innerHTML = voltar ? '‹' : '☰';
  $('#btnEsq').onclick = () => voltar ? (location.hash = voltar) : abrirGaveta();
  $('#topoDir').innerHTML = direita;
  document.title = `${titulo} · ${LOJA?.nome || 'Festas & Decorações'}`;
}

// ================= textos do WhatsApp =================
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0];
function textoOrcamento(o, link) {
  const l = [`Olá, ${primeiroNome(o.clienteNome)}! 🎉`, `Segue seu orçamento *#${o.id}* da *${LOJA.nome}*:`, ''];
  if (o.tipoFesta || o.tema) l.push(`🎈 ${[o.tipoFesta, o.tema && `tema *${o.tema}*`].filter(Boolean).join(' — ')}`);
  if (o.dataEvento) l.push(`📅 ${dia(o.dataEvento)}${o.horario ? ' às ' + o.horario : ''}`);
  if (o.local) l.push(`📍 ${o.local}`);
  l.push('');
  o.itens.forEach(i => l.push(`• ${qtdTxt(i.quantidade)}x ${i.descricao} — ${moeda(i.subtotal)}`));
  if (o.taxaEntrega > 0) l.push(`• Entrega e montagem — ${moeda(o.taxaEntrega)}`);
  if (o.desconto > 0) l.push(`Desconto: -${moeda(o.desconto)}`);
  l.push('', `*Total: ${moeda(o.total)}*`);
  if (o.sinalPercentual > 0 && o.sinalPercentual < 100) l.push(`Sinal para reservar a data (${o.sinalPercentual}%): ${moeda(o.sinal)}`);
  l.push('', 'Veja as fotos, aprove e pague pelo link:', link, '', 'Qualquer dúvida, estou à disposição! 💕');
  return l.join('\n');
}
function textoCobranca(o, link) {
  const falta = o.pago < o.sinal ? o.sinal - o.pago : o.saldo;
  const oque = o.pago < o.sinal ? `o sinal (${moeda(falta)})` : `o restante (${moeda(o.saldo)})`;
  return `Olá, ${primeiroNome(o.clienteNome)}! Passando para lembrar ${oque} da sua festa${o.dataEvento ? ' do dia ' + dia(o.dataEvento) : ''} — pedido *#${o.id}*.\n\nPIX e envio do comprovante:\n${link}`;
}
const textoAgradecimento = o => `Olá, ${primeiroNome(o.clienteNome)}! Muito obrigada por escolher a *${LOJA.nome}* para a sua festa${o.tema ? ' de ' + o.tema : ''}! 🎉💕\nEsperamos que tenha sido inesquecível. Se puder, mande fotos para a gente!`;

// ================= gaveta =================
function abrirGaveta() {
  const r = (location.hash.split('/')[1] || 'inicio').split('?')[0];
  const itens = [['inicio', '🏠', 'Início'], ['clientes', '👥', 'Clientes'], ['orcamentos', '📝', 'Orçamentos'], ['produtos', '🎀', 'Produtos'],
    ['financeiro', '💰', 'Financeiro'], ['agenda', '📅', 'Agenda'], ['config', '⚙️', 'Configurações']];
  const f = document.createElement('div');
  f.innerHTML = `<div class="gaveta-fundo"></div><nav class="gaveta">
    <div class="marca"><div class="logo">🎈🎂</div><div class="nome">${esc(LOJA?.nome || 'Festas & Decorações')}</div></div>
    ${itens.map(([k, i, t]) => `<a href="#/${k}" class="${r === k ? 'ativo' : ''}"><span>${i}</span>${t}</a>`).join('')}
    <div style="flex:1"></div><a href="#" id="gSair"><span>↩️</span>Sair</a></nav>`;
  document.body.appendChild(f);
  const fechar = () => f.remove();
  $('.gaveta-fundo', f).onclick = fechar;
  $$('a', f).forEach(a => a.addEventListener('click', fechar));
  $('#gSair', f).onclick = async e => { e.preventDefault(); await DB.sair(); location.hash = ''; mostrarLogin(); };
}

// ================= rotas =================
const rotas = [
  [/^#\/inicio$/, () => telaInicio()],
  [/^#\/clientes$/, () => telaClientes()],
  [/^#\/clientes\/(\d+)$/, m => telaCliente(+m[1])],
  [/^#\/orcamentos\/novo(\?.*)?$/, () => telaPasso1(true)],
  [/^#\/orcamentos\/dados$/, () => telaPasso1(false)],
  [/^#\/orcamentos\/produtos$/, () => telaPasso2()],
  [/^#\/orcamentos\/resumo$/, () => telaPasso3()],
  [/^#\/orcamentos\/(\d+)\/editar$/, m => editarOrcamento(+m[1])],
  [/^#\/orcamentos\/(\d+)\/enviado$/, m => telaEnviado(+m[1])],
  [/^#\/orcamentos\/(\d+)$/, m => telaOrcamento(+m[1])],
  [/^#\/orcamentos(?:\?status=(\w*))?$/, m => telaOrcamentos(m[1] || '')],
  [/^#\/produtos$/, () => telaProdutos()],
  [/^#\/financeiro(?:\/(\w+))?$/, m => telaFinanceiro(m[1] || 'receber')],
  [/^#\/agenda(?:\/(\d{4}-\d{2}-\d{2}))?$/, m => telaAgenda(m[1])],
  [/^#\/config$/, () => telaConfig()],
];
async function navegar() {
  const h = location.hash || '#/inicio';
  const raiz = h.split('/')[1]?.split('?')[0];
  $$('.nav button').forEach(b => b.classList.toggle('ativo', b.dataset.rota === raiz));
  for (const [re, fn] of rotas) {
    const m = h.match(re);
    if (!m) continue;
    conteudo.innerHTML = '<div class="spinner">Carregando…</div>';
    window.scrollTo(0, 0);
    try { await fn(m); } catch (e) { console.error(e); conteudo.innerHTML = `<div class="vazio">⚠️ ${esc(e.message)}</div>`; }
    atualizarBadge();
    return;
  }
  location.hash = '#/inicio';
}
async function atualizarBadge() {
  try {
    const n = (await DB.pagamentos('AguardandoConfirmacao')).length;
    const b = $('#badgeMais'); b.textContent = n; b.classList.toggle('oculto', !n);
  } catch { /* ignora */ }
}

// ================= INÍCIO =================
async function telaInicio() {
  topo('Início', null, `<a class="bt" href="#/financeiro/confirmar" title="Comprovantes">🔔</a>`);
  const todos = await DB.orcamentos();
  const mes = hojeISO().slice(0, 7), hoje = hojeISO();
  const noMes = d => d && String(d).slice(0, 7) === mes;
  const pend = todos.filter(o => o.status === 'Pendente').length;
  const aprov = todos.filter(o => ['Aprovado', 'EmAndamento', 'Finalizado'].includes(o.status) && noMes(o.aprovadoEm)).length;
  const andam = todos.filter(o => o.status === 'EmAndamento').length;
  const final = todos.filter(o => o.status === 'Finalizado' && noMes(o.finalizadoEm)).length;
  const proximos = todos.filter(o => ['Aprovado', 'EmAndamento'].includes(o.status) && o.dataEvento >= hoje)
    .sort((a, b) => a.dataEvento.localeCompare(b.dataEvento)).slice(0, 4);
  const faltas = [!LOJA.telefone_whatsapp && 'o WhatsApp da loja', !LOJA.chave_pix && 'a chave PIX'].filter(Boolean);

  conteudo.innerHTML = `
    <div class="ola"><h2>Olá! 👋</h2>
      <div class="suave">Hoje é um ótimo dia para criar momentos especiais! ✨</div></div>
    ${faltas.length ? `<a href="#/config" style="text-decoration:none"><div class="aviso" style="margin-top:12px">⚙️ Falta cadastrar ${faltas.join(' e ')}. Toque para configurar.</div></a>` : ''}
    <div class="kpis">
      <a class="kpi k1" href="#/orcamentos?status=Pendente"><div class="ic">📋</div><div><div class="rot">Orçamentos</div><b>${pend}</b><small>pendentes</small></div></a>
      <a class="kpi k2" href="#/orcamentos?status=Aprovado"><div class="ic">✔</div><div><div class="rot">Aprovados</div><b>${aprov}</b><small>este mês</small></div></a>
      <a class="kpi k3" href="#/orcamentos?status=EmAndamento"><div class="ic">🛠</div><div><div class="rot">Em andamento</div><b>${andam}</b><small>decoração</small></div></a>
      <a class="kpi k4" href="#/orcamentos?status=Finalizado"><div class="ic">🏁</div><div><div class="rot">Finalizados</div><b>${final}</b><small>este mês</small></div></a>
    </div>
    <a class="btn bloco" href="#/orcamentos/novo">＋ Novo Orçamento</a>
    ${proximos.length ? `<div class="secao">Próximos eventos <a href="#/agenda">Ver agenda</a></div>
      <div class="lista">${proximos.map(o => `<div class="li item-lista clicavel" onclick="location.hash='#/orcamentos/${o.id}'">
        <div class="av" style="border-radius:12px;flex-direction:column;font-size:.7rem;line-height:1.1"><b style="font-size:1.05rem">${o.dataEvento.slice(8)}</b>${new Date(o.dataEvento + 'T12:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
        <div class="info"><div class="forte">${esc(o.tema || o.tipoFesta || 'Festa')}</div><div class="suave">${esc(o.clienteNome)}${o.horario ? ' · ' + esc(o.horario) : ''}</div></div>
        ${chipPag(o)}</div>`).join('')}</div>` : ''}
    <div class="secao">Últimos orçamentos <a href="#/orcamentos">Ver todos</a></div>
    ${todos.length ? todos.slice(0, 5).map(cardOrcamento).join('') : `<div class="vazio"><span class="grande">🎈</span>Nenhum orçamento ainda.</div>`}`;
}

function cardOrcamento(o) {
  return `<div class="card clicavel item-lista" onclick="location.hash='#/orcamentos/${o.id}'">
    ${fotoHtml(o.capa)}
    <div class="info">
      <div class="forte">${esc(o.tema ? 'Festa ' + o.tema : o.tipoFesta || 'Orçamento #' + o.id)}</div>
      <div class="suave">Cliente: ${esc(o.clienteNome)}</div>
      <div class="valor" style="font-size:.95rem">${moeda(o.total)}</div>
    </div>
    <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
      ${chip(o.status)}<span class="suave" style="font-size:.76rem">${o.dataEvento ? dia(o.dataEvento) : ''}</span>${chipPag(o)}
    </div></div>`;
}

// ================= CLIENTES =================
async function telaClientes() {
  topo('Clientes', null, `<button class="btn-redondo" id="novoCli" title="Novo cliente">＋</button>`);
  const lista = await DB.clientes();
  conteudo.innerHTML = `<input class="ctl busca" id="busca" placeholder="🔎 Buscar cliente..."><div class="lista" id="lista"></div>`;
  const desenhar = t => {
    t = t.trim().toLowerCase(); const d = t.replace(/\D/g, '');
    const f = lista.filter(c => !t || c.nome.toLowerCase().includes(t) || (d && c.telefone.includes(d)));
    $('#lista').innerHTML = f.length ? f.map(c => `<div class="li item-lista clicavel" onclick="location.hash='#/clientes/${c.id}'">
      <div class="av">${esc(iniciais(c.nome))}</div>
      <div class="info"><div class="forte">${esc(c.nome)}</div><div class="suave">${esc(fone(c.telefone))}</div><div class="suave">${c.pedidos} orçamento(s)</div></div>
      <span class="suave">›</span></div>`).join('') : '<div class="vazio"><span class="grande">👥</span>Nenhum cliente.</div>';
  };
  $('#busca').oninput = e => desenhar(e.target.value);
  $('#novoCli').onclick = () => modalCliente(null, () => telaClientes());
  desenhar('');
}
function modalCliente(c, depois) {
  const m = modal(`<h2>${c ? 'Editar cliente' : 'Novo cliente'}</h2>
    <form id="fCli">
      <div class="campo"><label>Nome</label><input name="nome" required value="${esc(c?.nome || '')}"></div>
      <div class="campo"><label>WhatsApp (DDD + número)</label><input name="telefone" inputmode="tel" required placeholder="(11) 98888-7777" value="${esc(c ? fone(c.telefone) : '')}"></div>
      <div class="campo"><label>Observação</label><input name="observacao" value="${esc(c?.observacao || '')}"></div>
      <div class="botoes dois"><button type="button" class="btn claro" data-fechar>Cancelar</button><button class="btn">Salvar</button></div>
    </form>`);
  $('#fCli', m.el).onsubmit = async e => {
    e.preventDefault();
    const id = await tentar(() => DB.salvarCliente(c?.id, Object.fromEntries(new FormData(e.target))), 'Cliente salvo!');
    m.fechar(); depois(id);
  };
}
async function telaCliente(id) {
  const [lista, pedidos] = await Promise.all([DB.clientes(), DB.orcamentos({ clienteId: id })]);
  const c = lista.find(x => x.id === id);
  if (!c) throw new Error('Cliente não encontrado.');
  topo(c.nome, '#/clientes');
  const total = pedidos.filter(o => ['Aprovado', 'EmAndamento', 'Finalizado'].includes(o.status)).reduce((s, o) => s + o.total, 0);
  conteudo.innerHTML = `
    <div class="card"><div class="item-lista"><div class="av" style="width:54px;height:54px;font-size:1.2rem">${esc(iniciais(c.nome))}</div>
      <div class="info"><div class="forte" style="font-size:1.1rem">${esc(c.nome)}</div><div class="suave">📱 ${esc(fone(c.telefone))}</div></div>
      <div class="valor">${moeda(total)}</div></div>
      ${c.observacao ? `<div class="suave" style="margin-top:8px">${esc(c.observacao)}</div>` : ''}
      <div class="botoes dois"><a class="btn verde peq" href="https://wa.me/${esc(c.telefone)}" target="_blank">WhatsApp</a><a class="btn peq" href="#/orcamentos/novo?cliente=${c.id}">＋ Orçamento</a></div>
      <div class="botoes dois"><button class="btn claro peq" id="edit">✏️ Editar</button><button class="btn perigo peq" id="del">Excluir</button></div>
    </div>
    <div class="secao">Orçamentos</div>
    ${pedidos.length ? pedidos.map(cardOrcamento).join('') : '<div class="vazio">Nenhum orçamento ainda.</div>'}`;
  $('#edit').onclick = () => modalCliente(c, () => telaCliente(id));
  $('#del').onclick = async () => {
    if (!await confirmar(`Excluir ${c.nome}?`, 'Excluir')) return;
    await tentar(() => DB.excluirCliente(id), 'Cliente excluído'); location.hash = '#/clientes';
  };
}

// ================= ORÇAMENTOS: lista =================
async function telaOrcamentos(status) {
  topo('Orçamentos', null, `<a class="btn-redondo" href="#/orcamentos/novo" title="Novo" style="text-decoration:none">＋</a>`);
  const lista = await DB.orcamentos(status ? { status } : {});
  const f = [['', 'Todos'], ['Pendente', 'Pendentes'], ['Aprovado', 'Aprovados'], ['EmAndamento', 'Em andamento'], ['Finalizado', 'Finalizados'], ['Rascunho', 'Rascunhos'], ['Recusado,Cancelado', 'Recusados']];
  conteudo.innerHTML = `
    <div class="filtros">${f.map(([v, t]) => `<button class="${v === status ? 'ativo' : ''}" data-st="${v}">${t}</button>`).join('')}</div>
    <input class="ctl busca" id="busca" placeholder="🔎 Buscar por cliente, tema ou nº">
    <div id="lista"></div>`;
  $$('.filtros button').forEach(b => b.onclick = () => location.hash = '#/orcamentos' + (b.dataset.st ? `?status=${b.dataset.st}` : ''));
  const desenhar = t => {
    t = t.trim().toLowerCase().replace('#', '');
    const r = lista.filter(o => !t || o.clienteNome.toLowerCase().includes(t) || (o.tema || '').toLowerCase().includes(t) || String(o.id) === t);
    $('#lista').innerHTML = r.length ? r.map(cardOrcamento).join('') : `<div class="vazio"><span class="grande">🎈</span>Nenhum orçamento aqui.<br><br><a class="btn" href="#/orcamentos/novo">Criar orçamento</a></div>`;
  };
  $('#busca').oninput = e => desenhar(e.target.value);
  desenhar('');
}

// ================= ORÇAMENTOS: assistente (3 passos) =================
let R = null; // rascunho do orçamento em edição
const novoRascunho = () => ({ id: null, clienteId: null, novoCliente: null, dataEvento: '', horario: '', local: '', tipoFesta: '', tema: '', observacoes: '', itens: [], taxaEntrega: 0, desconto: 0, sinalPercentual: +LOJA.sinal_percentual });
const passos = n => `<div class="passos">${[1, 2, 3].map(i => `<i class="${i <= n ? 'ok' : ''}"></i>`).join('')}</div>`;

async function editarOrcamento(id) {
  const o = await DB.orcamento(id);
  if (o.status === 'Finalizado') throw new Error('Orçamento finalizado não pode ser editado.');
  R = { id: o.id, clienteId: o.clienteId, novoCliente: null, dataEvento: o.dataEvento || '', horario: o.horario || '', local: o.local || '',
    tipoFesta: o.tipoFesta || '', tema: o.tema || '', observacoes: o.observacoes || '', taxaEntrega: o.taxaEntrega, desconto: o.desconto,
    sinalPercentual: o.sinalPercentual, itens: o.itens.map(i => ({ produtoId: i.produtoId, descricao: i.descricao, foto: i.foto, fotoUrl: i.fotoUrl, quantidade: i.quantidade, valorUnitario: i.valorUnitario, custoUnitario: i.custoUnitario })) };
  location.replace('#/orcamentos/dados');
}

async function telaPasso1(novo) {
  if (novo || !R) {
    R = novoRascunho();
    const c = new URLSearchParams(location.hash.split('?')[1] || '').get('cliente');
    if (c) R.clienteId = +c;
  }
  topo(R.id ? `Editar #${R.id}` : 'Novo Orçamento', R.id ? `#/orcamentos/${R.id}` : '#/orcamentos');
  const clientes = await DB.clientes();
  conteudo.innerHTML = `${passos(1)}
    <form id="f1" autocomplete="off">
      <div class="campo"><label>Cliente</label>
        <select id="cliente" required><option value="">Selecione o cliente</option><option value="novo">＋ Novo cliente</option>
          ${clientes.map(c => `<option value="${c.id}">${esc(c.nome)} · ${esc(fone(c.telefone))}</option>`).join('')}</select></div>
      <div id="novoCli" class="grade2 oculto"><input class="ctl" id="ncNome" placeholder="Nome"><input class="ctl" id="ncTel" placeholder="WhatsApp" inputmode="tel"></div>
      <div class="grade2">
        <div class="campo"><label>Data do evento</label><input type="date" id="data" required value="${esc(R.dataEvento)}"></div>
        <div class="campo"><label>Horário</label><input type="time" id="hora" value="${esc(R.horario)}"></div>
      </div>
      <div class="campo"><label>Local do evento</label><input id="local" placeholder="Endereço ou salão" value="${esc(R.local)}"></div>
      <div class="campo"><label>Tipo de festa</label><select id="tipo"><option value="">Selecione</option>${TIPOS_FESTA.map(t => `<option ${t === R.tipoFesta ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="campo"><label>Tema da festa</label><input id="tema" list="temas" placeholder="Ex.: Princesas, Safari, Fundo do Mar" value="${esc(R.tema)}">
        <datalist id="temas">${['Princesas', 'Safari', 'Fundo do Mar', 'Super-heróis', 'Unicórnio', 'Jardim Encantado', 'Circo', 'Futebol', 'Boho', 'Floresta'].map(t => `<option value="${t}">`).join('')}</datalist></div>
      <div class="campo"><label>Observações</label><textarea id="obs" placeholder="Ex.: tons rosa e lilás, detalhes especiais...">${esc(R.observacoes)}</textarea></div>
      <button class="btn bloco" style="margin-top:10px">Próximo →</button>
    </form>`;
  const sel = $('#cliente');
  if (R.clienteId) sel.value = R.clienteId;
  if (R.novoCliente) { sel.value = 'novo'; $('#ncNome').value = R.novoCliente.nome; $('#ncTel').value = R.novoCliente.telefone; }
  const mostrar = () => $('#novoCli').classList.toggle('oculto', sel.value !== 'novo');
  sel.onchange = mostrar; mostrar();
  $('#f1').onsubmit = e => {
    e.preventDefault();
    if (sel.value === 'novo') {
      if (!$('#ncNome').value.trim() || Base.normalizarTelefone($('#ncTel').value).length < 12) return toast('Informe nome e WhatsApp do novo cliente.', true);
      R.clienteId = null; R.novoCliente = { nome: $('#ncNome').value, telefone: $('#ncTel').value };
    } else { R.clienteId = +sel.value; R.novoCliente = null; }
    Object.assign(R, { dataEvento: $('#data').value, horario: $('#hora').value, local: $('#local').value, tipoFesta: $('#tipo').value, tema: $('#tema').value, observacoes: $('#obs').value });
    location.hash = '#/orcamentos/produtos';
  };
}

async function telaPasso2() {
  if (!R) return location.replace('#/orcamentos/novo');
  topo('Selecionar Produtos', '#/orcamentos/dados');
  const [produtos, reservas] = await Promise.all([DB.produtos(), DB.reservasNaData(R.dataEvento, R.id)]);
  let cat = '';
  conteudo.innerHTML = `${passos(2)}
    <input class="ctl busca" id="busca" placeholder="🔎 Buscar produto...">
    <div class="filtros" id="cats"></div>
    <div id="lista"></div><div style="height:70px"></div>
    <div class="barra-fixa"><div><div style="font-size:.8rem;opacity:.85" id="qtdSel"></div><b id="totSel"></b></div><button class="btn peq" id="cont">Continuar →</button></div>`;
  const cats = ['', ...CATEGORIAS.filter(c => produtos.some(p => p.categoria === c))];
  const qtdDe = id => R.itens.find(i => i.produtoId === id)?.quantidade || 0;
  const alterar = (p, d) => {
    let it = R.itens.find(i => i.produtoId === p.id);
    if (!it && d > 0) R.itens.push(it = { produtoId: p.id, descricao: p.nome, foto: p.foto_path, fotoUrl: p.fotoUrl, quantidade: 0, valorUnitario: p.preco, custoUnitario: p.custo });
    if (!it) return;
    it.quantidade = Math.max(0, it.quantidade + d);
    if (!it.quantidade) R.itens = R.itens.filter(i => i !== it);
    desenhar();
  };
  const rodape = () => {
    const n = R.itens.reduce((s, i) => s + i.quantidade, 0);
    $('#qtdSel').textContent = `${n} item(ns) selecionado(s)`;
    $('#totSel').textContent = moeda(R.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0));
  };
  function desenhar() {
    $('#cats').innerHTML = cats.map(c => `<button class="${c === cat ? 'ativo' : ''}" data-c="${c}">${c || 'Todos'}</button>`).join('');
    $$('#cats button').forEach(b => b.onclick = () => { cat = b.dataset.c; desenhar(); });
    const t = $('#busca').value.trim().toLowerCase();
    const f = produtos.filter(p => (!cat || p.categoria === cat) && (!t || p.nome.toLowerCase().includes(t)));
    $('#lista').innerHTML = f.length ? `<div class="lista">${f.map(p => {
      const q = qtdDe(p.id), res = reservas[p.id] || [];
      const firme = res.find(r => r.firme);
      return `<div class="li item-lista">${fotoHtml(p.fotoUrl, 'g')}
        <div class="info"><div class="forte">${esc(p.nome)}</div><div class="suave">${esc(p.categoria)}</div><div class="valor">${moeda(p.preco)}</div>
          ${firme ? `<div class="conflito">⚠ Já reservado nesta data (#${firme.id} ${esc(firme.cliente)})</div>` : res.length ? `<div class="conflito" style="color:#a35c00">⚠ Em orçamento pendente nesta data (#${res[0].id})</div>` : ''}</div>
        ${q ? `<div class="qtd"><button data-m="${p.id}">−</button><span>${qtdTxt(q)}</span><button data-p="${p.id}">＋</button></div>`
            : `<button class="btn-redondo claro" data-p="${p.id}" title="Adicionar">＋</button>`}
      </div>`;
    }).join('')}</div>` : `<div class="vazio"><span class="grande">🎀</span>${produtos.length ? 'Nenhum produto encontrado.' : 'Cadastre seus produtos primeiro.'}<br><br><a class="btn" href="#/produtos">Ir para Produtos</a></div>`;
    $$('[data-p]').forEach(b => b.onclick = () => alterar(produtos.find(p => p.id === +b.dataset.p), 1));
    $$('[data-m]').forEach(b => b.onclick = () => alterar(produtos.find(p => p.id === +b.dataset.m), -1));
    rodape();
  }
  $('#busca').oninput = desenhar;
  $('#cont').onclick = () => {
    if (!R.itens.length) return toast('Escolha pelo menos um produto (ou adicione um item avulso no resumo).', true);
    location.hash = '#/orcamentos/resumo';
  };
  desenhar();
}

async function telaPasso3() {
  if (!R) return location.replace('#/orcamentos/novo');
  topo('Resumo do Orçamento', '#/orcamentos/produtos');
  const clientes = await DB.clientes();
  const cli = R.clienteId ? clientes.find(c => c.id === R.clienteId) : R.novoCliente;
  conteudo.innerHTML = `${passos(3)}
    <div class="card item-lista"><div class="av">${esc(iniciais(cli?.nome))}</div>
      <div class="info"><div class="forte">${esc(cli?.nome || '')}</div><div class="suave">📱 ${esc(fone(cli?.telefone))}</div>
      <div class="suave">📅 ${dia(R.dataEvento)}${R.horario ? ' às ' + esc(R.horario) : ''}${R.tema ? ' · 🎈 ' + esc(R.tema) : ''}</div></div>
      <a class="suave" href="#/orcamentos/dados">✏️</a></div>
    <div class="secao">Itens selecionados <a href="#/orcamentos/produtos">＋ Produtos</a></div>
    <div class="lista" id="itens"></div>
    <button class="btn claro peq" id="avulso" style="margin-top:10px">＋ Item avulso</button>
    <div class="card" style="margin-top:14px">
      <div class="grade2">
        <div class="campo"><label>Entrega / montagem (R$)</label><input id="taxa" inputmode="decimal" value="${dec(R.taxaEntrega)}" placeholder="0,00"></div>
        <div class="campo"><label>Desconto (R$)</label><input id="desc" inputmode="decimal" value="${dec(R.desconto)}" placeholder="0,00"></div>
      </div>
      <div class="campo"><label>Sinal para reservar a data (%)</label><input id="sinal" inputmode="decimal" value="${dec(R.sinalPercentual)}"></div>
      <div class="linha"><span class="suave">Subtotal</span><span id="vSub"></span></div>
      <div class="linha"><span class="suave">Sinal</span><span id="vSinal"></span></div>
      <div class="total" style="margin-top:8px"><span>Total</span><strong id="vTot"></strong></div>
    </div>
    ${R.observacoes ? `<div class="card"><div class="forte">Observações</div><div class="suave">${esc(R.observacoes)}</div></div>` : ''}
    <div class="botoes dois"><a class="btn claro" href="#/orcamentos/produtos">✏️ Editar</a><button class="btn" id="gerar">Gerar Orçamento</button></div>`;
  const recalcular = () => {
    R.taxaEntrega = num($('#taxa').value); R.desconto = num($('#desc').value); R.sinalPercentual = Math.min(100, Math.max(0, num($('#sinal').value)));
    const sub = R.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
    const tot = Math.max(0, sub + R.taxaEntrega - R.desconto);
    $('#vSub').textContent = moeda(sub); $('#vTot').textContent = moeda(tot);
    $('#vSinal').textContent = `${moeda(tot * R.sinalPercentual / 100)} (${dec(R.sinalPercentual)}%)`;
  };
  function desenharItens() {
    $('#itens').innerHTML = R.itens.length ? R.itens.map((i, k) => `<div class="li item-lista">${fotoHtml(i.fotoUrl)}
      <div class="info"><div class="forte">${esc(i.descricao)}</div>
        <div class="linha" style="justify-content:flex-start;gap:6px"><span class="suave">R$</span><input class="ctl" data-v="${k}" inputmode="decimal" value="${dec(i.valorUnitario)}" style="width:96px;padding:6px 8px"></div></div>
      <div class="qtd"><button data-m="${k}">−</button><span>${qtdTxt(i.quantidade)}</span><button data-p="${k}">＋</button></div></div>`).join('')
      : '<div class="li suave">Nenhum item. Volte e escolha os produtos.</div>';
    $$('[data-p]', $('#itens')).forEach(b => b.onclick = () => { R.itens[+b.dataset.p].quantidade++; desenharItens(); });
    $$('[data-m]', $('#itens')).forEach(b => b.onclick = () => { const it = R.itens[+b.dataset.m]; if (--it.quantidade <= 0) R.itens.splice(+b.dataset.m, 1); desenharItens(); });
    $$('[data-v]', $('#itens')).forEach(inp => inp.oninput = () => { R.itens[+inp.dataset.v].valorUnitario = num(inp.value); recalcular(); });
    recalcular();
  }
  ['#taxa', '#desc', '#sinal'].forEach(s => $(s).oninput = recalcular);
  $('#avulso').onclick = () => {
    const m = modal(`<h2>Item avulso</h2><form id="fAv">
      <div class="campo"><label>Descrição</label><input name="d" required placeholder="Ex.: Arranjo de flores"></div>
      <div class="grade2"><div class="campo"><label>Quantidade</label><input name="q" inputmode="decimal" value="1"></div><div class="campo"><label>Valor un. (R$)</label><input name="v" inputmode="decimal" required></div></div>
      <div class="botoes dois"><button type="button" class="btn claro" data-fechar>Cancelar</button><button class="btn">Adicionar</button></div></form>`);
    $('#fAv', m.el).onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      R.itens.push({ produtoId: null, descricao: f.get('d'), foto: null, fotoUrl: null, quantidade: num(f.get('q')) || 1, valorUnitario: num(f.get('v')), custoUnitario: 0 });
      m.fechar(); desenharItens(); };
  };
  $('#gerar').onclick = async () => {
    recalcular();
    const b = $('#gerar'); b.disabled = true;
    try {
      const id = await tentar(() => DB.salvarOrcamento(R.id, R), 'Orçamento salvo!');
      R = null; location.hash = `#/orcamentos/${id}`;
    } catch { b.disabled = false; }
  };
  desenharItens();
}

// ================= ORÇAMENTO: detalhe =================
async function telaOrcamento(id) {
  const o = await DB.orcamento(id);
  const link = DB.linkCliente(LOJA, o.token);
  topo(`Orçamento #${o.id}`, '#/orcamentos');
  const ativo = ['Aprovado', 'EmAndamento', 'Finalizado'].includes(o.status);
  const aberto = ['Rascunho', 'Pendente'].includes(o.status);
  conteudo.innerHTML = `
    <div class="hero">${o.capa ? `<img src="${esc(o.capa)}" alt="">` : '🎈🎀🎂'}<span class="selo">${chip(o.status)}</span></div>
    <div class="card" style="margin-top:12px">
      <div class="item-lista"><div class="av">${esc(iniciais(o.clienteNome))}</div>
        <div class="info"><a class="forte" href="#/clientes/${o.clienteId}" style="text-decoration:none">${esc(o.clienteNome)}</a><div class="suave">📱 ${esc(fone(o.clienteTelefone))}</div></div>${chipPag(o)}</div>
      <hr class="sep">
      ${o.dataEvento ? `<div class="linha"><span class="suave">Data do evento</span><b>${dia(o.dataEvento)}${o.horario ? ' · ' + esc(o.horario) : ''}</b></div>` : ''}
      ${o.tipoFesta ? `<div class="linha"><span class="suave">Tipo</span><span>${esc(o.tipoFesta)}</span></div>` : ''}
      ${o.tema ? `<div class="linha"><span class="suave">Tema</span><span>${esc(o.tema)}</span></div>` : ''}
      ${o.local ? `<div class="linha"><span class="suave">Local</span><span style="text-align:right">${esc(o.local)}</span></div>` : ''}
      ${o.motivoRecusa ? `<div class="suave" style="margin-top:6px">Motivo: ${esc(o.motivoRecusa)}</div>` : ''}
    </div>
    <div class="secao">Itens</div>
    <div class="lista">${o.itens.map(i => `<div class="li item-lista">${fotoHtml(i.fotoUrl)}<div class="info"><div class="forte">${esc(i.descricao)}</div><div class="suave">${qtdTxt(i.quantidade)} × ${moeda(i.valorUnitario)}</div></div><span class="valor">${moeda(i.subtotal)}</span></div>`).join('')}
      ${o.taxaEntrega > 0 ? `<div class="li linha"><span class="suave">Entrega / montagem</span><span class="valor">${moeda(o.taxaEntrega)}</span></div>` : ''}
      ${o.desconto > 0 ? `<div class="li linha"><span class="suave">Desconto</span><span class="valor">− ${moeda(o.desconto)}</span></div>` : ''}</div>
    <div class="total"><span>Total</span><strong>${moeda(o.total)}</strong></div>
    <div class="card">
      <div class="linha"><span>Sinal (${dec(o.sinalPercentual)}%)</span><span class="valor">${moeda(o.sinal)}</span></div>
      <div class="linha"><span>Pago</span><span class="valor" style="color:var(--verde)">${moeda(o.pago)}</span></div>
      ${o.aConfirmar > 0 ? `<div class="linha"><span>A confirmar</span><span class="valor" style="color:#a35c00">${moeda(o.aConfirmar)}</span></div>` : ''}
      <div class="linha"><span>Falta receber</span><span class="valor">${moeda(o.saldo)}</span></div>
      ${o.custo > 0 ? `<hr class="sep"><div class="linha suave"><span>Custo ${moeda(o.custo)}</span><span>Lucro <b>${moeda(o.lucro)}</b></span></div>` : ''}
    </div>
    ${o.observacoes ? `<div class="card"><div class="forte">Observações</div><div class="suave">${esc(o.observacoes)}</div></div>` : ''}

    <div class="botoes">
      ${aberto ? `<button class="btn bloco verde" id="bEnviar">🟢 Enviar via WhatsApp</button><button class="btn bloco claro" id="bShare">📤 Compartilhar</button>` : ''}
      ${ativo && o.saldo > 0 ? `<button class="btn bloco verde" id="bCobrar">🟢 Cobrar ${o.pago < o.sinal ? 'sinal' : 'restante'} via WhatsApp</button>` : ''}
      ${o.saldo > 0 && !['Recusado', 'Cancelado'].includes(o.status) ? `<button class="btn bloco" id="bPagar">💰 Registrar pagamento</button>` : ''}
      ${o.status === 'Aprovado' ? `<button class="btn bloco claro" id="bAndamento">🛠 Iniciar montagem (Em andamento)</button>` : ''}
      ${o.status === 'EmAndamento' ? `<button class="btn bloco claro" id="bFinalizar">🏁 Finalizar evento</button>` : ''}
      ${o.status === 'Finalizado' ? `<button class="btn bloco verde" id="bObrigado">🟢 Enviar agradecimento</button>` : ''}
    </div>
    <div class="card" style="margin-top:14px"><div class="suave" style="margin-bottom:6px">Link do cliente (fotos, aprovação, PIX e comprovante)</div>
      <div class="linha"><input class="ctl" value="${esc(link)}" readonly style="font-size:.8rem"><button class="btn claro peq" id="bCopiar">Copiar</button></div></div>
    ${o.pagamentos.length ? `<div class="secao">Pagamentos</div>${o.pagamentos.map(p => cardPagamento(p)).join('')}` : ''}
    <div class="botoes dois" style="margin-top:20px">
      ${o.status !== 'Finalizado' ? `<a class="btn claro" href="#/orcamentos/${o.id}/editar">✏️ Editar</a>` : ''}
      ${aberto ? `<button class="btn claro" id="bAprovar">✔ Aprovar</button>` : ''}
      ${aberto ? `<button class="btn perigo" id="bRecusar">Recusado</button>` : ''}
      ${['Aprovado', 'EmAndamento'].includes(o.status) ? `<button class="btn perigo" id="bCancelar">Cancelar</button>` : ''}
      ${['Recusado', 'Cancelado'].includes(o.status) ? `<button class="btn claro" id="bReabrir">↩ Reabrir</button>` : ''}
      <button class="btn perigo" id="bExcluir">🗑 Excluir</button>
    </div>`;
  const on = (s, f) => { const el = $(s); if (el) el.onclick = f; };
  const rec = () => telaOrcamento(id);
  const st = async (s, motivo) => { await tentar(() => DB.status(id, s, motivo)); rec(); };
  on('#bEnviar', async () => {
    abrirWhats(o.clienteTelefone, textoOrcamento(o, link));
    if (o.status === 'Rascunho') await DB.status(id, 'Pendente');
    location.hash = `#/orcamentos/${id}/enviado`;
  });
  on('#bShare', async () => {
    const texto = textoOrcamento(o, link);
    if (navigator.share) { try { await navigator.share({ title: `Orçamento #${o.id}`, text: texto }); } catch { return; } }
    else copiar(texto);
    if (o.status === 'Rascunho') { await DB.status(id, 'Pendente'); rec(); }
  });
  on('#bCobrar', () => abrirWhats(o.clienteTelefone, textoCobranca(o, link)));
  on('#bObrigado', () => abrirWhats(o.clienteTelefone, textoAgradecimento(o)));
  on('#bPagar', () => modalPagamento(o, rec));
  on('#bCopiar', () => copiar(link));
  on('#bAprovar', () => st('Aprovado'));
  on('#bAndamento', () => st('EmAndamento'));
  on('#bFinalizar', async () => { if (await confirmar(o.saldo > 0 ? `Ainda faltam ${moeda(o.saldo)}. Finalizar mesmo assim?` : 'Finalizar este evento?', 'Finalizar')) st('Finalizado'); });
  on('#bReabrir', () => st('Pendente'));
  on('#bRecusar', async () => { if (await confirmar('Marcar como recusado?')) st('Recusado', 'Recusado pelo cliente'); });
  on('#bCancelar', async () => { if (await confirmar('Cancelar este evento?', 'Cancelar evento')) st('Cancelado'); });
  on('#bExcluir', async () => {
    if (!await confirmar(`Excluir o orçamento #${id} e seus pagamentos?`, 'Excluir')) return;
    await tentar(() => DB.excluirOrcamento(id), 'Excluído'); location.hash = '#/orcamentos';
  });
  ligarPagamentos(conteudo, rec);
}

async function telaEnviado(id) {
  topo('Orçamento enviado', `#/orcamentos/${id}`);
  conteudo.innerHTML = `<div class="ok-tela"><div class="grande">✓</div>
    <h2 style="color:var(--vinho);margin:6px 0">Orçamento Enviado!</h2>
    <p class="suave">Seu orçamento foi enviado para o cliente via WhatsApp.<br>Quando ele aprovar ou mandar o comprovante, aparece aqui.</p>
    <div class="botoes"><a class="btn bloco" href="#/orcamentos/${id}">Ver orçamento</a><a class="btn bloco claro" href="#/inicio">Voltar para o início</a></div>
    <div style="font-size:3.4rem;margin-top:20px">🎂</div></div>`;
}

// ================= pagamentos =================
function cardPagamento(p, comPedido = false) {
  const img = p.mime?.startsWith('image/');
  return `<div class="card item-lista" style="align-items:flex-start">
    ${p.url ? `<a class="thumb" href="${esc(p.url)}" target="_blank">${img ? `<img src="${esc(p.url)}" alt="comprovante">` : '📄'}</a>` : `<div class="thumb">${p.comprovante ? '📎' : '💵'}</div>`}
    <div class="info">
      <div class="linha"><span class="forte">${comPedido ? `<a href="#/orcamentos/${p.orcamentoId}">#${p.orcamentoId}</a> · ${esc(p.clienteNome)}` : esc(p.tipo)}</span><span class="valor">${moeda(p.valor)}</span></div>
      <div class="linha suave"><span>${diaHora(p.data)} · ${esc(comPedido ? p.tipo : p.forma || p.origem)}</span>${chip(p.status)}</div>
      ${p.observacao ? `<div class="suave">“${esc(p.observacao)}”</div>` : ''}
      ${p.status === 'AguardandoConfirmacao' ? `<div class="linha" style="justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn perigo peq" data-rej="${p.id}">Rejeitar</button><button class="btn verde peq" data-conf="${p.id}" data-v="${p.valor}">✔ Confirmar</button></div>` : ''}
    </div></div>`;
}
function ligarPagamentos(raiz, depois) {
  $$('[data-conf]', raiz).forEach(b => b.onclick = () => {
    const m = modal(`<h2>Confirmar recebimento</h2><p class="suave">Confira o comprovante e ajuste o valor se precisar.</p>
      <div class="campo"><label>Valor recebido (R$)</label><input id="vc" inputmode="decimal" value="${dec(b.dataset.v)}"></div>
      <div class="botoes dois"><button class="btn claro" data-fechar>Voltar</button><button class="btn verde" id="ok">Confirmar</button></div>`);
    $('#ok', m.el).onclick = async () => { await tentar(() => DB.confirmarPagamento(+b.dataset.conf, num($('#vc', m.el).value)), 'Pagamento confirmado!'); m.fechar(); depois(); };
  });
  $$('[data-rej]', raiz).forEach(b => b.onclick = async () => {
    if (!await confirmar('Rejeitar este comprovante?', 'Rejeitar')) return;
    await tentar(() => DB.rejeitarPagamento(+b.dataset.rej), 'Comprovante rejeitado'); depois();
  });
}
function modalPagamento(o, depois) {
  const falta = o.pago < o.sinal ? o.sinal - o.pago : o.saldo;
  const m = modal(`<h2>Registrar pagamento · #${o.id}</h2><div class="suave">${esc(o.clienteNome)} — falta ${moeda(o.saldo)}</div>
    <form id="fPag">
      <div class="grade2">
        <div class="campo"><label>Tipo</label><select name="tipo"><option ${o.pago < o.sinal ? 'selected' : ''}>Sinal</option><option ${o.pago >= o.sinal ? 'selected' : ''}>Restante</option><option>Total</option></select></div>
        <div class="campo"><label>Valor (R$)</label><input name="valor" inputmode="decimal" required value="${dec(DB.r2(falta))}"></div>
      </div>
      <div class="grade2">
        <div class="campo"><label>Forma</label><select name="forma"><option>PIX</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option></select></div>
        <div class="campo"><label>Data</label><input type="date" name="data" value="${hojeISO()}"></div>
      </div>
      <div class="campo"><label>Comprovante (opcional)</label><input type="file" name="arquivo" accept="image/*,application/pdf"></div>
      <div class="campo"><label>Observação</label><input name="observacao"></div>
      <div class="botoes dois"><button type="button" class="btn claro" data-fechar>Cancelar</button><button class="btn verde">Registrar</button></div>
    </form>`);
  const tipo = $('[name=tipo]', m.el), val = $('[name=valor]', m.el);
  tipo.onchange = () => { val.value = dec(DB.r2(tipo.value === 'Sinal' ? Math.max(0, o.sinal - o.pago) : o.saldo)); };
  $('#fPag', m.el).onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await tentar(() => DB.registrarPagamento(o, { valor: num(f.get('valor')), tipo: f.get('tipo'), forma: f.get('forma'), data: f.get('data'), observacao: f.get('observacao'), arquivo: f.get('arquivo') }), 'Pagamento registrado!');
    m.fechar(); depois();
  };
}

// ================= PRODUTOS =================
async function telaProdutos() {
  topo('Produtos', null, `<button class="btn-redondo" id="novoProd" title="Novo produto">＋</button>`);
  const lista = await DB.produtos();
  let cat = '';
  conteudo.innerHTML = `<input class="ctl busca" id="busca" placeholder="🔎 Buscar produto..."><div class="filtros" id="cats"></div><div id="lista"></div>`;
  function desenhar() {
    const cats = ['', ...CATEGORIAS.filter(c => lista.some(p => p.categoria === c))];
    $('#cats').innerHTML = cats.map(c => `<button class="${c === cat ? 'ativo' : ''}" data-c="${c}">${c || 'Todos'}</button>`).join('');
    $$('#cats button').forEach(b => b.onclick = () => { cat = b.dataset.c; desenhar(); });
    const t = $('#busca').value.trim().toLowerCase();
    const f = lista.filter(p => (!cat || p.categoria === cat) && (!t || p.nome.toLowerCase().includes(t)));
    $('#lista').innerHTML = f.length ? `<div class="lista">${f.map(p => `<div class="li item-lista">${fotoHtml(p.fotoUrl, 'g')}
      <div class="info"><div class="forte">${esc(p.nome)}</div><div class="suave">${esc(p.categoria)}</div><div class="valor">${moeda(p.preco)}</div></div>
      <button class="btn claro peq" data-ed="${p.id}">✏️</button><button class="btn perigo peq" data-del="${p.id}">🗑</button></div>`).join('')}</div>`
      : `<div class="vazio"><span class="grande">🎀</span>Nenhum produto cadastrado.<br>Cadastre suas fachadas, painéis e temas com foto e preço.</div>`;
    $$('[data-ed]').forEach(b => b.onclick = () => modalProduto(lista.find(p => p.id === +b.dataset.ed)));
    $$('[data-del]').forEach(b => b.onclick = async () => {
      const p = lista.find(x => x.id === +b.dataset.del);
      if (!await confirmar(`Remover "${p.nome}" do catálogo?`, 'Remover')) return;
      await tentar(() => DB.excluirProduto(p.id), 'Produto removido'); telaProdutos();
    });
  }
  $('#busca').oninput = desenhar;
  $('#novoProd').onclick = () => modalProduto(null);
  desenhar();
}
function modalProduto(p) {
  const m = modal(`<h2>${p ? 'Editar produto' : 'Novo produto'}</h2>
    <form id="fProd">
      <label class="foto-prev"><span id="prev" style="display:contents">${p?.fotoUrl ? `<img src="${esc(p.fotoUrl)}">` : '<span style="text-align:center">📷<br><span class="suave" style="font-size:.85rem">Toque para escolher a foto</span></span>'}</span>
        <input type="file" name="foto" accept="image/jpeg,image/png,image/webp" hidden></label>
      <div class="campo"><label>Nome</label><input name="nome" required value="${esc(p?.nome || '')}" placeholder="Ex.: Fachada com Painel"></div>
      <div class="campo"><label>Categoria</label><select name="categoria">${CATEGORIAS.map(c => `<option ${c === (p?.categoria || 'Fachadas') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="grade2">
        <div class="campo"><label>Preço (R$)</label><input name="preco" inputmode="decimal" required value="${dec(p?.preco)}"></div>
        <div class="campo"><label>Custo (R$) <span class="suave">opcional</span></label><input name="custo" inputmode="decimal" value="${dec(p?.custo)}"></div>
      </div>
      <div class="campo"><label>Descrição</label><textarea name="descricao" placeholder="Medidas, o que inclui...">${esc(p?.descricao || '')}</textarea></div>
      <div class="botoes dois"><button type="button" class="btn claro" data-fechar>Cancelar</button><button class="btn" id="salvarProd">Salvar</button></div>
    </form>`);
  const inp = $('[name=foto]', m.el);
  inp.onchange = () => { const f = inp.files[0]; if (f) $('#prev', m.el).innerHTML = `<img src="${URL.createObjectURL(f)}">`; };
  $('#fProd', m.el).onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const b = $('#salvarProd', m.el); b.disabled = true; b.textContent = 'Salvando…';
    try {
      await tentar(() => DB.salvarProduto(p?.id, { nome: f.get('nome'), categoria: f.get('categoria'), preco: num(f.get('preco')), custo: num(f.get('custo')), descricao: f.get('descricao') }, inp.files[0]), 'Produto salvo!');
      m.fechar(); telaProdutos();
    } catch { b.disabled = false; b.textContent = 'Salvar'; }
  };
}

// ================= FINANCEIRO =================
let mesFin = null;
async function telaFinanceiro(aba) {
  topo('Financeiro');
  if (!mesFin) mesFin = hojeISO().slice(0, 7);
  const [a, mm] = mesFin.split('-').map(Number);
  const nomeMes = new Date(a, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
  const todos = await DB.orcamentos();
  const noMes = d => d && String(d).slice(0, 7) === mesFin;
  const pags = todos.flatMap(o => o.pagamentos);
  const recebido = pags.filter(p => p.status === 'Confirmado' && noMes(new Date(p.data).toISOString())).reduce((s, p) => s + p.valor, 0);
  const vivos = todos.filter(o => ['Aprovado', 'EmAndamento', 'Finalizado'].includes(o.status));
  const aReceber = vivos.filter(o => o.saldo > 0);
  const eventosMes = vivos.filter(o => noMes(o.dataEvento));
  const faturMes = eventosMes.reduce((s, o) => s + o.total, 0);
  const lucroMes = eventosMes.reduce((s, o) => s + o.lucro, 0);
  const semSinal = aReceber.filter(o => o.pago < o.sinal && o.status !== 'Finalizado').length;
  const aConf = pags.filter(p => p.status === 'AguardandoConfirmacao').length;

  conteudo.innerHTML = `
    <div class="mes"><button id="mA">‹</button><span>${nomeMes}</span><button id="mP">›</button></div>
    <div class="big a"><div class="rot">Recebido no mês</div><div class="num">${moeda(recebido)}</div><div class="sub">Pagamentos confirmados</div><div class="ilu">💰</div></div>
    <div class="big b"><div class="rot">Eventos do mês</div><div class="num">${moeda(faturMes)}</div><div class="sub">${eventosMes.length} evento(s) · lucro estimado ${moeda(lucroMes)}</div><div class="ilu">🎉</div></div>
    <div class="big c"><div class="rot">A receber (todos)</div><div class="num" style="color:#b0473f">${moeda(aReceber.reduce((s, o) => s + o.saldo, 0))}</div><div class="sub">${aReceber.length} pedido(s)${semSinal ? ` · <b>${semSinal} sem sinal</b>` : ''}</div><div class="ilu">🧾</div></div>
    <div class="abas">
      <button data-a="receber" class="${aba === 'receber' ? 'ativo' : ''}">A receber</button>
      <button data-a="confirmar" class="${aba === 'confirmar' ? 'ativo' : ''}">A confirmar${aConf ? ` <span class="badge">${aConf}</span>` : ''}</button>
      <button data-a="recebidos" class="${aba === 'recebidos' ? 'ativo' : ''}">Recebidos</button>
      <button data-a="ranking" class="${aba === 'ranking' ? 'ativo' : ''}">Ranking</button>
    </div><div id="corpo"></div>`;
  const mudar = d => { const dt = new Date(a, mm - 1 + d, 1); mesFin = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; telaFinanceiro(aba); };
  $('#mA').onclick = () => mudar(-1); $('#mP').onclick = () => mudar(1);
  $$('.abas button').forEach(b => b.onclick = () => location.hash = `#/financeiro/${b.dataset.a}`);
  const corpo = $('#corpo'), rec = () => telaFinanceiro(aba);

  if (aba === 'receber') {
    const l = aReceber.sort((x, y) => (x.dataEvento || '9').localeCompare(y.dataEvento || '9'));
    corpo.innerHTML = l.length ? l.map(o => `<div class="card">
      <div class="linha"><a class="forte" href="#/orcamentos/${o.id}" style="text-decoration:none">#${o.id} · ${esc(o.clienteNome)}</a><span class="valor">${moeda(o.saldo)}</span></div>
      <div class="linha suave"><span>🎈 ${esc(o.tema || o.tipoFesta || '')} · ${dia(o.dataEvento)}</span>${chipPag(o)}</div>
      <div class="linha" style="justify-content:flex-end;gap:6px;margin-top:8px"><button class="btn verde peq" data-cob="${o.id}">Cobrar</button><button class="btn peq" data-pag="${o.id}">Registrar Pagamento</button></div></div>`).join('')
      : '<div class="vazio"><span class="grande">🎉</span>Nada a receber.</div>';
    $$('[data-pag]', corpo).forEach(b => b.onclick = () => modalPagamento(l.find(o => o.id === +b.dataset.pag), rec));
    $$('[data-cob]', corpo).forEach(b => b.onclick = () => { const o = l.find(x => x.id === +b.dataset.cob); abrirWhats(o.clienteTelefone, textoCobranca(o, DB.linkCliente(LOJA, o.token))); });
  }
  if (aba === 'confirmar' || aba === 'recebidos') {
    const l = await DB.pagamentos(aba === 'confirmar' ? 'AguardandoConfirmacao' : 'Confirmado');
    corpo.innerHTML = l.length ? l.map(p => cardPagamento(p, true)).join('') : `<div class="vazio"><span class="grande">${aba === 'confirmar' ? '🧾' : '💰'}</span>${aba === 'confirmar' ? 'Nenhum comprovante aguardando.' : 'Nenhum pagamento ainda.'}</div>`;
    ligarPagamentos(corpo, rec);
  }
  if (aba === 'ranking') {
    const grp = (arr, k) => arr.reduce((acc, x) => { (acc[k(x)] ||= []).push(x); return acc; }, {});
    const prods = Object.values(grp(eventosMes.flatMap(o => o.itens), i => i.descricao.toLowerCase())).map(g => ({ n: g[0].descricao, f: g[0].fotoUrl, q: g.reduce((s, i) => s + i.quantidade, 0) })).sort((x, y) => y.q - x.q).slice(0, 5);
    const clis = Object.values(grp(vivos, o => o.clienteId)).map(g => ({ n: g[0].clienteNome, q: g.length, v: g.reduce((s, o) => s + o.total, 0) })).sort((x, y) => y.q - x.q || y.v - x.v).slice(0, 5);
    corpo.innerHTML = `<div class="secao">➜ Mais alugados no mês</div>
      <div class="lista">${prods.length ? prods.map(p => `<div class="li item-lista">${fotoHtml(p.f)}<div class="info forte">${esc(p.n)}</div><span class="suave">${qtdTxt(p.q)}×</span></div>`).join('') : '<div class="li suave">Sem eventos no mês.</div>'}</div>
      <div class="secao">➜ Melhores clientes</div>
      <div class="lista">${clis.length ? clis.map(c => `<div class="li item-lista"><div class="av">${esc(iniciais(c.n))}</div><div class="info forte">${esc(c.n)}</div><span class="suave">${c.q} festa(s)</span></div>`).join('') : '<div class="li suave">Sem clientes ainda.</div>'}</div>`;
  }
}

// ================= AGENDA =================
let mesAg = null;
async function telaAgenda(diaSel) {
  topo('Agenda');
  if (diaSel) mesAg = diaSel.slice(0, 7);
  if (!mesAg) mesAg = hojeISO().slice(0, 7);
  const [a, m] = mesAg.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const de = `${mesAg}-01`, ate = `${mesAg}-${String(ultimo).padStart(2, '0')}`;
  const eventos = (await DB.orcamentos({ de, ate })).filter(o => !['Rascunho', 'Recusado', 'Cancelado'].includes(o.status));
  const porDia = {};
  eventos.forEach(o => (porDia[o.dataEvento] ||= []).push(o));
  // conflito: mesmo produto em 2+ eventos confirmados no mesmo dia
  const conflitos = {};
  Object.entries(porDia).forEach(([d, l]) => {
    const usos = {};
    l.filter(o => ['Aprovado', 'EmAndamento'].includes(o.status)).forEach(o => o.itens.forEach(i => { if (i.produtoId) (usos[i.produtoId] ||= { nome: i.descricao, ids: [] }).ids.push(o.id); }));
    const c = Object.values(usos).filter(u => u.ids.length > 1);
    if (c.length) conflitos[d] = c;
  });
  diaSel = diaSel || (mesAg === hojeISO().slice(0, 7) ? hojeISO() : null);
  const primeiroSem = new Date(a, m - 1, 1).getDay();
  const nomeMes = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
  const cells = [];
  for (let i = 0; i < primeiroSem; i++) cells.push('<button class="fora"></button>');
  for (let d = 1; d <= ultimo; d++) {
    const iso = `${mesAg}-${String(d).padStart(2, '0')}`;
    const ev = porDia[iso] || [];
    cells.push(`<button data-d="${iso}" class="${iso === hojeISO() ? 'hoje' : ''} ${iso === diaSel ? 'sel' : ''}">${d}
      ${ev.length ? `<span class="pontos">${ev.slice(0, 3).map(() => `<i class="${conflitos[iso] ? 'c' : ''}"></i>`).join('')}</span>` : ''}</button>`);
  }
  const doDia = diaSel ? (porDia[diaSel] || []) : [];
  conteudo.innerHTML = `
    <div class="mes"><button id="mA">‹</button><span>${nomeMes}</span><button id="mP">›</button></div>
    <div class="cal">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(s => `<div class="dsem">${s}</div>`).join('')}${cells.join('')}</div>
    ${Object.keys(conflitos).length ? `<div class="aviso erro" style="margin-top:12px">⚠ Há produto reservado em dois eventos no mesmo dia: ${Object.keys(conflitos).map(d => `<a href="#/agenda/${d}">${dia(d)}</a>`).join(', ')}</div>` : ''}
    <div class="secao">${diaSel ? `Eventos em ${dia(diaSel)}` : 'Escolha um dia'} ${diaSel ? `<a href="#/orcamentos/novo">＋ Novo</a>` : ''}</div>
    ${conflitos[diaSel] ? conflitos[diaSel].map(c => `<div class="aviso erro">⚠ <b>${esc(c.nome)}</b> está em ${c.ids.map(i => `#${i}`).join(' e ')}</div>`).join('') : ''}
    ${diaSel ? (doDia.length ? doDia.map(cardOrcamento).join('') : '<div class="vazio">Nenhum evento neste dia.</div>') : ''}
    <div class="secao">Eventos do mês</div>
    ${eventos.length ? `<div class="lista">${eventos.sort((x, y) => x.dataEvento.localeCompare(y.dataEvento)).map(o => `<div class="li item-lista clicavel" onclick="location.hash='#/orcamentos/${o.id}'">
      <div class="av" style="border-radius:12px"><b>${o.dataEvento.slice(8)}</b></div>
      <div class="info"><div class="forte">${esc(o.tema || o.tipoFesta || 'Festa')}</div><div class="suave">${esc(o.clienteNome)}${o.horario ? ' · ' + esc(o.horario) : ''}</div></div>${chip(o.status)}</div>`).join('')}</div>` : '<div class="vazio">Nenhum evento neste mês.</div>'}`;
  const mudar = d => { const dt = new Date(a, m - 1 + d, 1); mesAg = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; if (location.hash === '#/agenda') telaAgenda(); else location.hash = '#/agenda'; };
  $('#mA').onclick = () => mudar(-1); $('#mP').onclick = () => mudar(1);
  $$('.cal [data-d]').forEach(b => b.onclick = () => location.hash = `#/agenda/${b.dataset.d}`);
}

// ================= CONFIGURAÇÕES =================
async function telaConfig() {
  topo('Configurações');
  const l = LOJA = await DB.loja();
  const s = await DB.sessao();
  conteudo.innerHTML = `
    <form id="fLoja" autocomplete="off">
      <div class="secao">🏪 Dados da loja</div>
      <div class="card">
        <div class="campo"><label>Nome da loja</label><input name="nome" required value="${esc(l.nome)}"></div>
        <div class="campo"><label>WhatsApp da loja</label><input name="telefone_whatsapp" inputmode="tel" placeholder="(11) 98888-7777" value="${esc(l.telefone_whatsapp ? fone(l.telefone_whatsapp) : '')}">
          <div class="suave" style="margin-top:4px">Depois de enviar o comprovante, o cliente volta para esta conversa.</div></div>
        <div class="campo"><label>Cidade</label><input name="cidade" value="${esc(l.cidade)}"></div>
        <div class="campo"><label>Sinal padrão para reservar a data (%)</label><input name="sinal_percentual" inputmode="decimal" value="${dec(+l.sinal_percentual)}"></div>
      </div>
      <div class="secao">💠 PIX</div>
      <div class="card">
        <div class="campo"><label>Chave PIX</label><input name="chave_pix" value="${esc(l.chave_pix)}" placeholder="CPF, CNPJ, e-mail, +5511999998888 ou aleatória">
          <div class="suave" style="margin-top:4px">Telefone no formato +55DDDnúmero, sem espaços. CPF/CNPJ só números.</div></div>
        <div class="campo"><label>Nome do recebedor</label><input name="nome_recebedor_pix" value="${esc(l.nome_recebedor_pix)}" placeholder="Opcional — usa o nome da loja"></div>
      </div>
      <div class="secao">🌐 Endereço do app</div>
      <div class="card"><div class="campo"><label>Endereço público (links enviados ao cliente)</label>
        <input name="url_publica" inputmode="url" value="${esc(l.url_publica)}" placeholder="Em branco = ${esc(Base.baseSite(''))}"></div></div>
      <button class="btn bloco" style="margin-top:14px">💾 Salvar</button>
    </form>
    <form id="fSenha" autocomplete="off">
      <div class="secao">🔒 Senha de acesso</div>
      <div class="card">
        <div class="suave">Conta: <b>${esc(s?.user?.email || '')}</b></div>
        <div class="campo"><label>Senha atual</label><input type="password" name="atual" required autocomplete="current-password"></div>
        <div class="grade2"><div class="campo"><label>Nova senha</label><input type="password" name="nova" required minlength="6" autocomplete="new-password"></div>
          <div class="campo"><label>Repita</label><input type="password" name="rep" required autocomplete="new-password"></div></div>
      </div>
      <button class="btn bloco claro" style="margin-top:14px">🔒 Trocar senha</button>
    </form>
    <button class="btn bloco perigo" id="sair" style="margin-top:26px">Sair do app</button>`;
  $('#fLoja').onsubmit = async e => {
    e.preventDefault();
    await tentar(() => DB.salvarLoja(Object.fromEntries(new FormData(e.target))), 'Dados salvos!');
    LOJA = await DB.loja(); telaConfig();
  };
  $('#fSenha').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.nova !== f.rep) return toast('As senhas novas não conferem.', true);
    await tentar(() => DB.trocarSenha(f.atual, f.nova), 'Senha alterada!'); e.target.reset();
  };
  $('#sair').onclick = async () => { await DB.sair(); location.hash = ''; mostrarLogin(); };
}

// ================= login / início =================
function mostrarLogin() {
  $('#telaApp').classList.add('oculto');
  $('#telaLogin').classList.remove('oculto');
}
let criarConta = false;
function modoLogin(criar) {
  criarConta = criar;
  $('#formLogin').classList.remove('oculto');
  $('#escolha').classList.add('oculto');
  $('#btnEntrar').textContent = criar ? 'Criar conta' : 'Entrar';
  $('#senha').autocomplete = criar ? 'new-password' : 'current-password';
  $('#trocarModo').textContent = criar ? 'Já tenho conta — entrar' : 'Primeiro acesso? Criar conta';
  setTimeout(() => $('#email').focus(), 50);
}
$('#irEntrar').onclick = () => modoLogin(false);
$('#irCadastrar').onclick = () => modoLogin(true);
$('#trocarModo').onclick = e => { e.preventDefault(); modoLogin(!criarConta); };
$('#esqueci').onclick = async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  if (!email) return toast('Digite seu e-mail e toque em "Esqueci a senha" de novo.', true);
  await tentar(() => DB.esqueci(email), 'Enviamos um link para redefinir a senha no seu e-mail.');
};
$('#formLogin').onsubmit = async e => {
  e.preventDefault();
  const b = $('#btnEntrar'); b.disabled = true;
  try {
    const r = await DB.entrar($('#email').value.trim(), $('#senha').value, criarConta);
    if (r === 'confirmar') { toast('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.'); modoLogin(false); return; }
    $('#senha').value = '';
    iniciar();
  } catch (err) { toast(err.message, true); } finally { b.disabled = false; }
};
Base.sb?.auth.onAuthStateChange(ev => {
  if (ev !== 'PASSWORD_RECOVERY') return;
  setTimeout(() => {
    const m = modal(`<h2>Nova senha</h2><form id="fN"><div class="campo"><label>Digite a nova senha</label><input type="password" id="nv" minlength="6" required></div><div class="botoes"><button class="btn">Salvar</button></div></form>`);
    $('#fN', m.el).onsubmit = async ev2 => {
      ev2.preventDefault();
      const { error } = await Base.sb.auth.updateUser({ password: $('#nv', m.el).value });
      if (error) return toast(Base.erroAmigavel(error), true);
      m.fechar(); toast('Senha alterada!'); iniciar();
    };
  }, 300);
});

$$('.nav button').forEach(b => b.onclick = () => b.dataset.rota === 'mais' ? abrirGaveta() : (location.hash = '#/' + b.dataset.rota));
window.addEventListener('hashchange', navegar);

async function iniciar() {
  if (!Base.configurado) {
    document.body.innerHTML = `<div class="boas"><div class="capa"><div class="baloes">🛠️</div><h2>Quase lá!</h2>
      <p>Preencha o endereço e a chave do Supabase em <b>js/config.js</b> e publique de novo.</p></div></div>`;
    return;
  }
  const s = await DB.sessao();
  if (!s) return mostrarLogin();
  try {
    if (!await Base.sb.rpc('entrar_na_loja').then(r => r.data)) { await DB.sair(); return mostrarLogin(); }
    LOJA = await DB.loja(); USUARIO = s.user;
  } catch (e) { toast(e.message, true); return mostrarLogin(); }
  $('#telaLogin').classList.add('oculto');
  $('#telaApp').classList.remove('oculto');
  $$('.nomeLoja').forEach(el => el.textContent = LOJA.nome);
  navegar();
}
iniciar();
