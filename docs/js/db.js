/* Acesso aos dados (Supabase) do painel da loja */
'use strict';

const DB = (() => {
  const sb = Base.sb;
  const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
  const ok = ({ data, error }) => { if (error) throw new Error(Base.erroAmigavel(error)); return data; };
  const falha = m => { throw new Error(m); };
  const SEL = '*, clientes(nome, telefone), orcamento_itens(*), pagamentos(*)';
  const ATIVOS = ['Aprovado', 'EmAndamento'];

  const fotoUrl = p => p ? sb.storage.from('produtos').getPublicUrl(p).data.publicUrl : null;

  // ---------- mapeamento ----------
  function mapOrc(r) {
    const o = {
      id: r.id, clienteId: r.cliente_id, clienteNome: r.clientes?.nome || '', clienteTelefone: r.clientes?.telefone || '',
      dataEvento: r.data_evento, horario: r.horario, local: r.local_evento, tipoFesta: r.tipo_festa, tema: r.tema,
      observacoes: r.observacoes, taxaEntrega: +r.taxa_entrega, desconto: +r.desconto, sinalPercentual: +r.sinal_percentual,
      status: r.status, token: r.token, criadoEm: r.criado_em, enviadoEm: r.enviado_em, aprovadoEm: r.aprovado_em,
      finalizadoEm: r.finalizado_em, motivoRecusa: r.motivo_recusa,
    };
    o.itens = (r.orcamento_itens || []).sort((a, b) => a.id - b.id).map(i => ({
      id: i.id, produtoId: i.produto_id, descricao: i.descricao, foto: i.foto_path, fotoUrl: fotoUrl(i.foto_path),
      quantidade: +i.quantidade, valorUnitario: +i.valor_unitario, custoUnitario: +i.custo_unitario,
      subtotal: r2(i.quantidade * i.valor_unitario),
    }));
    o.pagamentos = (r.pagamentos || []).sort((a, b) => String(a.data).localeCompare(b.data)).map(p => ({
      id: p.id, orcamentoId: p.orcamento_id, valor: +p.valor, data: p.data, tipo: p.tipo, origem: p.origem, status: p.status,
      forma: p.forma, observacao: p.observacao, comprovante: p.comprovante_path, mime: p.comprovante_mime, url: null,
      clienteNome: o.clienteNome,
    }));
    o.subtotal = r2(o.itens.reduce((s, i) => s + i.subtotal, 0));
    o.total = Math.max(0, r2(o.subtotal + o.taxaEntrega - o.desconto));
    o.custo = r2(o.itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0));
    o.lucro = r2(o.total - o.custo);
    o.sinal = r2(o.total * o.sinalPercentual / 100);
    o.pago = r2(o.pagamentos.filter(p => p.status === 'Confirmado').reduce((s, p) => s + p.valor, 0));
    o.aConfirmar = r2(o.pagamentos.filter(p => p.status === 'AguardandoConfirmacao').reduce((s, p) => s + p.valor, 0));
    o.saldo = Math.max(0, r2(o.total - o.pago));
    o.situacaoPag = o.total > 0 && o.pago >= o.total ? 'Quitado' : o.pago >= o.sinal && o.pago > 0 ? 'Sinal pago' : 'Aguardando sinal';
    o.capa = o.itens.find(i => i.fotoUrl)?.fotoUrl || null;
    return o;
  }

  async function assinar(pags) {
    const caminhos = [...new Set(pags.map(p => p.comprovante).filter(Boolean))];
    if (!caminhos.length) return pags;
    const { data } = await sb.storage.from('comprovantes').createSignedUrls(caminhos, 3600);
    const mapa = Object.fromEntries((data || []).filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]));
    pags.forEach(p => { if (p.comprovante) p.url = mapa[p.comprovante] || null; });
    return pags;
  }

  async function enviarArquivo(bucket, pasta, arquivo, tipos, maxMb) {
    const ext = tipos[arquivo.type];
    if (!ext || arquivo.size > maxMb * 1024 * 1024) falha(`Envie ${Object.values(tipos).join('/').toUpperCase()} de até ${maxMb} MB.`);
    const caminho = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    ok(await sb.storage.from(bucket).upload(caminho, arquivo, { contentType: arquivo.type }));
    return caminho;
  }
  const IMG = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const COMP = { ...IMG, 'image/heic': 'heic', 'application/pdf': 'pdf' };

  function validarCliente(c) {
    if (!c?.nome?.trim()) falha('Informe o nome do cliente.');
    const t = Base.normalizarTelefone(c.telefone);
    if (t.length < 12 || t.length > 13) falha('Telefone inválido. Use DDD + número, ex.: (11) 98888-7777.');
    return { nome: c.nome.trim(), telefone: t, observacao: c.observacao?.trim() || null };
  }

  return {
    r2, fotoUrl,

    // ---------- sessão ----------
    async sessao() { return (await sb.auth.getSession()).data.session; },
    async entrar(email, senha, criar) {
      const r = criar ? await sb.auth.signUp({ email, password: senha }) : await sb.auth.signInWithPassword({ email, password: senha });
      if (r.error) throw new Error(Base.erroAmigavel(r.error));
      if (criar && !r.data.session) return 'confirmar';
      const membro = ok(await sb.rpc('entrar_na_loja'));
      if (!membro) { await sb.auth.signOut(); falha('Esta conta não tem acesso à loja. Peça para a dona liberar.'); }
      return 'ok';
    },
    sair: () => sb.auth.signOut(),
    async trocarSenha(atual, nova) {
      if (!nova || nova.length < 6) falha('A nova senha precisa ter pelo menos 6 caracteres.');
      const s = await this.sessao();
      const t = await sb.auth.signInWithPassword({ email: s.user.email, password: atual });
      if (t.error) falha('Senha atual incorreta.');
      ok(await sb.auth.updateUser({ password: nova }));
    },
    async esqueci(email) {
      ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] }));
    },

    // ---------- loja ----------
    async loja() { return ok(await sb.from('loja_config').select('*').eq('id', 1).single()); },
    async salvarLoja(l) {
      if (!l.nome?.trim()) falha('Informe o nome da loja.');
      let tel = '';
      if (l.telefone_whatsapp?.trim()) {
        tel = Base.normalizarTelefone(l.telefone_whatsapp);
        if (tel.length < 12 || tel.length > 13) falha('WhatsApp da loja inválido. Use DDD + número.');
      }
      const url = (l.url_publica || '').trim();
      if (url && !/^https?:\/\/\S+$/i.test(url)) falha('Endereço público inválido.');
      const pct = Number(String(l.sinal_percentual).replace(',', '.'));
      if (!(pct >= 0 && pct <= 100)) falha('Sinal deve ser entre 0 e 100%.');
      ok(await sb.from('loja_config').update({
        nome: l.nome.trim(), telefone_whatsapp: tel, chave_pix: (l.chave_pix || '').trim(),
        nome_recebedor_pix: (l.nome_recebedor_pix || '').trim(), cidade: (l.cidade || '').trim(), url_publica: url, sinal_percentual: pct,
      }).eq('id', 1));
    },
    linkCliente: (l, token) => `${Base.baseSite(l.url_publica)}/orcamento.html?t=${token}`,

    // ---------- clientes ----------
    async clientes() {
      const lista = ok(await sb.from('clientes').select('*, orcamentos(status)').order('nome'));
      return lista.map(c => ({ ...c, pedidos: (c.orcamentos || []).filter(o => !['Rascunho', 'Recusado', 'Cancelado'].includes(o.status)).length }));
    },
    async salvarCliente(id, c) {
      const v = validarCliente(c);
      if (!id) {
        const todos = ok(await sb.from('clientes').select('id, nome, telefone'));
        const existe = todos.find(x => Base.chaveTelefone(x.telefone) === Base.chaveTelefone(v.telefone));
        if (existe) falha(`Já existe um cliente com esse telefone: ${existe.nome}.`);
        return ok(await sb.from('clientes').insert(v).select('id').single()).id;
      }
      ok(await sb.from('clientes').update(v).eq('id', id));
      return id;
    },
    async excluirCliente(id) {
      const { count } = await sb.from('orcamentos').select('id', { count: 'exact', head: true }).eq('cliente_id', id);
      if (count > 0) falha('Cliente possui orçamentos e não pode ser excluído.');
      ok(await sb.from('clientes').delete().eq('id', id));
    },

    // ---------- produtos ----------
    async produtos(todos = false) {
      let q = sb.from('produtos').select('*').order('categoria').order('nome');
      if (!todos) q = q.eq('ativo', true);
      return ok(await q).map(p => ({ ...p, preco: +p.preco, custo: +p.custo, fotoUrl: fotoUrl(p.foto_path) }));
    },
    async salvarProduto(id, p, arquivo) {
      if (!p.nome?.trim()) falha('Informe o nome do produto.');
      const preco = r2(String(p.preco).replace(',', '.')), custo = r2(String(p.custo || 0).replace(',', '.'));
      if (preco < 0 || custo < 0) falha('Valores não podem ser negativos.');
      const dados = { nome: p.nome.trim(), categoria: p.categoria || 'Outros', descricao: p.descricao?.trim() || null, preco, custo, ativo: p.ativo !== false };
      if (arquivo && arquivo.size) dados.foto_path = await enviarArquivo('produtos', 'fotos', arquivo, IMG, 5);
      if (id) { ok(await sb.from('produtos').update(dados).eq('id', id)); return id; }
      return ok(await sb.from('produtos').insert(dados).select('id').single()).id;
    },
    async excluirProduto(id) {
      // mantém o histórico dos orçamentos: só desativa
      ok(await sb.from('produtos').update({ ativo: false }).eq('id', id));
    },

    // ---------- orçamentos ----------
    async orcamentos({ status, clienteId, id, de, ate } = {}) {
      let q = sb.from('orcamentos').select(SEL).order('id', { ascending: false });
      if (status) q = q.in('status', status.split(','));
      if (clienteId) q = q.eq('cliente_id', clienteId);
      if (id) q = q.eq('id', id);
      if (de) q = q.gte('data_evento', de);
      if (ate) q = q.lte('data_evento', ate);
      return ok(await q).map(mapOrc);
    },
    async orcamento(id) {
      const o = (await this.orcamentos({ id }))[0];
      if (!o) falha('Orçamento não encontrado.');
      await assinar(o.pagamentos);
      return o;
    },

    /** Produtos já reservados (Aprovado/Em andamento; Pendente como aviso) na data. */
    async reservasNaData(data, ignorarId) {
      if (!data) return {};
      const lista = (await this.orcamentos({ de: data, ate: data, status: 'Pendente,Aprovado,EmAndamento' })).filter(o => o.id !== ignorarId);
      const mapa = {};
      lista.forEach(o => o.itens.forEach(i => {
        if (!i.produtoId) return;
        (mapa[i.produtoId] ||= []).push({ id: o.id, cliente: o.clienteNome, firme: ATIVOS.includes(o.status) });
      }));
      return mapa;
    },

    async salvarOrcamento(id, f) {
      const itens = (f.itens || []).filter(i => i.descricao?.trim() && i.quantidade > 0);
      if (!itens.length) falha('Escolha pelo menos um produto.');
      let clienteId = f.clienteId;
      if (!clienteId) clienteId = await this.salvarCliente(null, f.novoCliente || {});
      const dados = {
        cliente_id: clienteId, data_evento: f.dataEvento || null, horario: f.horario || null, local_evento: f.local?.trim() || null,
        tipo_festa: f.tipoFesta || null, tema: f.tema?.trim() || null, observacoes: f.observacoes?.trim() || null,
        taxa_entrega: r2(f.taxaEntrega), desconto: r2(f.desconto), sinal_percentual: r2(f.sinalPercentual),
      };
      if (id) {
        ok(await sb.from('orcamentos').update(dados).eq('id', id));
        ok(await sb.from('orcamento_itens').delete().eq('orcamento_id', id));
      } else id = ok(await sb.from('orcamentos').insert(dados).select('id').single()).id;
      ok(await sb.from('orcamento_itens').insert(itens.map(i => ({
        orcamento_id: id, produto_id: i.produtoId || null, descricao: i.descricao.trim(), foto_path: i.foto || null,
        quantidade: i.quantidade, valor_unitario: r2(i.valorUnitario), custo_unitario: r2(i.custoUnitario),
      }))));
      return id;
    },
    async status(id, status, motivo) {
      const upd = { status };
      if (motivo) upd.motivo_recusa = motivo;
      ok(await sb.from('orcamentos').update(upd).eq('id', id));
    },
    async excluirOrcamento(id) {
      const o = await this.orcamento(id);
      const arqs = o.pagamentos.map(p => p.comprovante).filter(Boolean);
      if (arqs.length) await sb.storage.from('comprovantes').remove(arqs);
      ok(await sb.from('orcamentos').delete().eq('id', id));
    },

    // ---------- pagamentos ----------
    async registrarPagamento(o, { valor, tipo, forma, data, observacao, arquivo }) {
      valor = r2(String(valor).replace(',', '.'));
      if (!(valor > 0)) falha('Informe um valor válido.');
      if (['Rascunho', 'Pendente'].includes(o.status)) await this.status(o.id, 'Aprovado');
      const caminho = arquivo && arquivo.size ? await enviarArquivo('comprovantes', o.token, arquivo, COMP, 10) : null;
      ok(await sb.from('pagamentos').insert({
        orcamento_id: o.id, valor, tipo: tipo || 'Sinal', forma: forma || null, observacao: observacao || null,
        data: data ? new Date(data + 'T12:00:00').toISOString() : new Date().toISOString(),
        origem: 'Manual', status: 'Confirmado', comprovante_path: caminho, comprovante_mime: caminho ? arquivo.type : null,
      }));
    },
    async pagamentos(status) {
      const pags = (await this.orcamentos()).flatMap(o => o.pagamentos).filter(p => p.status === status)
        .sort((a, b) => String(b.data).localeCompare(a.data)).slice(0, 200);
      return assinar(pags);
    },
    async confirmarPagamento(id, valor) {
      const upd = { status: 'Confirmado' };
      if (valor > 0) upd.valor = r2(valor);
      ok(await sb.from('pagamentos').update(upd).eq('id', id));
    },
    async rejeitarPagamento(id) { ok(await sb.from('pagamentos').update({ status: 'Rejeitado' }).eq('id', id)); },
  };
})();
