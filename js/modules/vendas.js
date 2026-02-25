import { estado } from '../core/storage.js';
import { TAXAS_ANUNCIO, FRETES } from '../core/constants.js';
import { formatarReal, formatarPercentual, mostrarNotificacao, debounce, validarNumero, validarPercentual } from '../core/utils.js';

// ===== GERENCIADOR DE VENDAS =====

class GerenciadorVendas {
    constructor() {
        this.tipoAnuncio = 'classico';
        this.contadorLinhas = 0;
        this.clienteCores = {};
        this.ultimoResultado = null;
        this.init();
    }

    // ===== INICIALIZAÇÃO =====

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initEventListeners());
        } else {
            this.initEventListeners();
        }
    }

    initEventListeners() {
        const inputs = [
            'embalagemBase',
            'outrosCustos',
            'distancia',
            'consumo',
            'precoGasolina',
            'dashboardMetaValor',
            // Novos campos de custos operacionais detalhados
            'custoFixoMensal',
            'vendasMensaisEsperadas',
            'proLaboreMensal',
            'impostoPercentual',
            'perdasPercentual',
            'marketingPercentual',
            'taxaPagamentoPercentual',
            // Novos campos de logística/deslocamento
            'custoKmVeiculo',
            'valorHoraVendedor',
            'tempoMedioPorKm',
            'custoEstacionamento',
            'custoPedagio'
        ];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', debounce(() => this.atualizarVendas(), 300));
                el.addEventListener('change', () => this.atualizarVendas());
            }
        });

        const limiteViagemEl = document.getElementById('limiteViagem');
        if (limiteViagemEl) {
            limiteViagemEl.addEventListener('change', () => this.atualizarVendas());
        }

        // Eventos do painel de confirmação
        const vendaProdutoSelect = document.getElementById('vendaProdutoSelect');
        const vendaQtd = document.getElementById('vendaQtd');

        if (vendaProdutoSelect) {
            vendaProdutoSelect.addEventListener('change', () => this.atualizarPreviewVenda());
        }
        if (vendaQtd) {
            vendaQtd.addEventListener('input', debounce(() => this.atualizarPreviewVenda(), 200));
        }

        // Toggle do resumo executivo na aba Vendas
        const toggleResumoBtn = document.getElementById('toggleResumoExecutivoBtn');
        if (toggleResumoBtn) {
            toggleResumoBtn.addEventListener('click', () => {
                const resumoExec = document.getElementById('resumoExecutivo');
                const resumoGeralGrid = document.getElementById('resumoGeralGrid');
                if (!resumoExec || !resumoGeralGrid) return;

                const mostrandoExec = resumoExec.style.display === 'grid' || resumoExec.style.display === '';
                if (mostrandoExec) {
                    // Volta para visão completa
                    resumoExec.style.display = 'none';
                    resumoGeralGrid.style.display = 'grid';
                    toggleResumoBtn.textContent = 'Ver só o essencial';
                } else {
                    // Mostra visão compacta
                    resumoExec.style.display = 'grid';
                    resumoGeralGrid.style.display = 'none';
                    toggleResumoBtn.textContent = 'Ver tudo';
                }
            });
        }
    }

    // ===== SELEÇÃO DE TIPO DE ANÚNCIO =====

    selecionarAnuncio(tipo) {
        this.tipoAnuncio = tipo;

        const classico = document.getElementById('optionClassico');
        const premium = document.getElementById('optionPremium');

        if (classico && premium) {
            if (tipo === 'classico') {
                classico.classList.add('selected');
                premium.classList.remove('selected');
            } else {
                classico.classList.remove('selected');
                premium.classList.add('selected');
            }
        }

        this.atualizarVendas();
        mostrarNotificacao(`📌 Anúncio: ${tipo === 'classico' ? 'CLÁSSICO (14%)' : 'PREMIUM (19%)'}`, 'info');
    }

    // ===== FUNÇÕES DE CÁLCULO =====

    calcularFrete(peso, valorPedido = 0) {
        if (peso <= 300) return FRETES[300] || 20;
        if (peso <= 500) return FRETES[500] || 25;
        if (peso <= 1000) return FRETES[1000] || 35;
        if (peso <= 2000) return FRETES[2000] || 50;
        if (peso <= 3000) return FRETES[3000] || 65;
        if (peso <= 4000) return FRETES[4000] || 80;
        let frete = FRETES.default || 100;

        // Regras ML 2026 (simulação)
        const taxaFixa = validarNumero(document.getElementById('mlTaxaFixaAbaixo79')?.value, 0);
        const custoPorGrama = validarNumero(document.getElementById('mlCustoPorGramaAbaixo79')?.value, 0);
        const descontoFreteAcima79 = validarPercentual(document.getElementById('mlDescontoFreteAcima79')?.value, 0);

        if (valorPedido > 0 && valorPedido < 79) {
            frete += taxaFixa + (peso * custoPorGrama);
        } else if (valorPedido >= 79 && descontoFreteAcima79 > 0) {
            frete = frete * (1 - descontoFreteAcima79 / 100);
        }

        return frete;
    }

    calcularCustoPorIda() {
        const d = validarNumero(document.getElementById('distancia')?.value, 0);
        const c = validarNumero(document.getElementById('consumo')?.value, 1);
        const g = validarNumero(document.getElementById('precoGasolina')?.value, 0);
        const custoCombustivel = c > 0 ? (d / c) * g : 0;

        // Logística 2.0: custos extras de deslocamento
        const custoKmVeiculo = validarNumero(document.getElementById('custoKmVeiculo')?.value, 0);
        const valorHoraVendedor = validarNumero(document.getElementById('valorHoraVendedor')?.value, 0);
        const tempoMedioPorKm = validarNumero(document.getElementById('tempoMedioPorKm')?.value, 0);
        const custoEstacionamento = validarNumero(document.getElementById('custoEstacionamento')?.value, 0);
        const custoPedagio = validarNumero(document.getElementById('custoPedagio')?.value, 0);

        const custoKmExtra = custoKmVeiculo * d;
        const horasDeslocamento = (d * tempoMedioPorKm) / 60; // tempoMedioPorKm em minutos
        const custoTempo = valorHoraVendedor * horasDeslocamento;
        const custosFixosViagem = custoEstacionamento + custoPedagio;

        return custoCombustivel + custoKmExtra + custoTempo + custosFixosViagem;
    }

    obterConfigCustosOperacionais() {
        const custoFixoMensal = validarNumero(document.getElementById('custoFixoMensal')?.value, 0);
        const vendasMensaisEsperadas = validarNumero(document.getElementById('vendasMensaisEsperadas')?.value, 0);
        const proLaboreMensal = validarNumero(document.getElementById('proLaboreMensal')?.value, 0);
        const impostoPercentual = validarPercentual(document.getElementById('impostoPercentual')?.value, 0);
        const perdasPercentual = validarPercentual(document.getElementById('perdasPercentual')?.value, 0);
        const marketingPercentual = validarPercentual(document.getElementById('marketingPercentual')?.value, 0);
        const taxaPagamentoPercentual = validarPercentual(document.getElementById('taxaPagamentoPercentual')?.value, 0);

        return {
            custoFixoMensal,
            vendasMensaisEsperadas,
            proLaboreMensal,
            impostoPercentual,
            perdasPercentual,
            marketingPercentual,
            taxaPagamentoPercentual
        };
    }

    // ===== GERENCIAMENTO DE LINHAS =====

    adicionarLinha() {
        this.contadorLinhas++;
        const tbody = document.getElementById('vendasBody');
        if (!tbody) return;

        const novaLinha = document.createElement('tr');
        novaLinha.id = `linha-${this.contadorLinhas}`;
        novaLinha.innerHTML = this.getTemplateLinha();
        tbody.appendChild(novaLinha);

        this.configurarEventosLinha(novaLinha);
        this.atualizarVendas();
    }

    configurarEventosLinha(linha) {
        linha.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => this.atualizarVendas());
            el.addEventListener('input', debounce(() => this.atualizarVendas(), 200));
        });

        const select = linha.querySelector('.produto-select');
        if (select) {
            select.addEventListener('change', (e) => this.carregarDadosLinha(e.target));
        }

        const confirmarBtn = linha.querySelector('.btn-confirmar-linha');
        const duplicarBtn = linha.querySelector('.btn-duplicar');
        const removerBtn = linha.querySelector('.btn-remover');

        if (confirmarBtn) {
            confirmarBtn.addEventListener('click', (e) => this.confirmarVendaLinha(e.target.closest('tr')));
        }

        if (duplicarBtn) {
            duplicarBtn.addEventListener('click', (e) => this.duplicarLinha(e.target));
        }

        if (removerBtn) {
            removerBtn.addEventListener('click', (e) => {
                const linhaEl = e.target.closest('tr');
                this.removerLinha(linhaEl.id);
            });
        }
    }

    getTemplateLinha() {
        const produtosOptions = estado.state.produtos.map(p =>
            `<option value="${p.id}" data-custo="${p.custo}" data-peso="${p.peso}" data-preco="${p.preco}" data-quantidade="${p.quantidade}">${p.nome}</option>`
        ).join('');

        return `
            <td><input type="text" class="cliente-input" value="Cliente ${this.contadorLinhas}"></td>
            <td>
                <select class="produto-select">
                    <option value="">Selecione</option>
                    ${produtosOptions}
                </select>
                <span class="estoque-info"></span>
            </td>
            <td><input type="number" class="preco" value="199.90" step="0.01"></td>
            <td><input type="number" class="peso" value="800" step="10"></td>
            <td><input type="number" class="qtd" value="1" min="1"></td>
            <td><input type="number" class="custo" value="100.00" step="0.01"></td>
            <td>
                <select class="tipo-pagamento">
                    <option value="cartao" selected>Cartão</option>
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto</option>
                </select>
            </td>
            <td class="avv-cell-actions">
                <div class="avv-vendas-actions">
                    <button class="btn-confirmar-linha avv-action-btn avv-action-btn-primary" type="button" title="Confirmar venda" aria-label="Confirmar venda desta linha">
                        <i class="fas fa-check" aria-hidden="true"></i>
                    </button>
                    <button class="btn-duplicar avv-action-btn avv-action-btn-secondary" type="button" title="Duplicar linha" aria-label="Duplicar esta linha">
                        <i class="fas fa-copy" aria-hidden="true"></i>
                    </button>
                    <button class="btn-remover avv-action-btn avv-action-btn-danger" type="button" title="Remover linha" aria-label="Remover esta linha">
                        <i class="fas fa-trash-alt" aria-hidden="true"></i>
                    </button>
                </div>
            </td>
        `;
    }

    carregarDadosLinha(select) {
        const option = select.options[select.selectedIndex];
        const linha = select.closest('tr');

        if (option.value) {
            const preco = parseFloat(option.dataset.preco) || 0;
            const peso = parseInt(option.dataset.peso) || 0;
            const custo = parseFloat(option.dataset.custo) || 0;
            const quantidade = parseInt(option.dataset.quantidade) || 0;

            linha.querySelector('.preco').value = preco.toFixed(2);
            linha.querySelector('.peso').value = peso;
            linha.querySelector('.custo').value = custo.toFixed(2);
            
            // Limitar quantidade ao estoque disponível
            const qtdInput = linha.querySelector('.qtd');
            qtdInput.max = quantidade;
            qtdInput.value = Math.min(parseInt(qtdInput.value) || 1, quantidade);

            const estoqueInfo = linha.querySelector('.estoque-info');
            this.atualizarIndicadorEstoque(estoqueInfo, quantidade);

            this.atualizarVendas();
        }
    }

    atualizarIndicadorEstoque(elemento, quantidadeEstoque) {
        if (!elemento) return;
        elemento.classList.remove('estoque-info-ok', 'estoque-info-alerta', 'estoque-info-critico');
        if (quantidadeEstoque > 5) {
            elemento.textContent = `✓ ${quantidadeEstoque} un.`;
            elemento.classList.add('estoque-info-ok');
        } else if (quantidadeEstoque > 0) {
            elemento.textContent = `⚠ ${quantidadeEstoque} un.`;
            elemento.classList.add('estoque-info-alerta');
        } else {
            elemento.textContent = '✗ Sem estoque';
            elemento.classList.add('estoque-info-critico');
        }
    }

    duplicarLinha(botao) {
        const linha = botao.closest('tr');
        const cliente = linha.querySelector('.cliente-input').value;

        this.contadorLinhas++;
        const tbody = document.getElementById('vendasBody');

        const novaLinha = document.createElement('tr');
        novaLinha.id = `linha-${this.contadorLinhas}`;
        novaLinha.innerHTML = this.getTemplateLinhaDuplicada(linha, cliente);
        tbody.appendChild(novaLinha);

        this.configurarEventosLinha(novaLinha);
        this.atualizarVendas();
    }

    getTemplateLinhaDuplicada(linhaOriginal, cliente) {
        const produtosOptions = estado.state.produtos.map(p =>
            `<option value="${p.id}" data-custo="${p.custo}" data-peso="${p.peso}" data-preco="${p.preco}" data-quantidade="${p.quantidade}">${p.nome}</option>`
        ).join('');

        const tipoPagamentoOriginal = linhaOriginal.querySelector('.tipo-pagamento')?.value || 'cartao';

        return `
            <td><input type="text" class="cliente-input" value="${cliente}"></td>
            <td>
                <select class="produto-select">
                    <option value="">Selecione</option>
                    ${produtosOptions}
                </select>
                <span class="estoque-info"></span>
            </td>
            <td><input type="number" class="preco" value="${linhaOriginal.querySelector('.preco').value}" step="0.01"></td>
            <td><input type="number" class="peso" value="${linhaOriginal.querySelector('.peso').value}" step="10"></td>
            <td><input type="number" class="qtd" value="${linhaOriginal.querySelector('.qtd').value}" min="1"></td>
            <td><input type="number" class="custo" value="${linhaOriginal.querySelector('.custo').value}" step="0.01"></td>
            <td>
                <select class="tipo-pagamento">
                    <option value="cartao" ${tipoPagamentoOriginal === 'cartao' ? 'selected' : ''}>Cartão</option>
                    <option value="pix" ${tipoPagamentoOriginal === 'pix' ? 'selected' : ''}>Pix</option>
                    <option value="boleto" ${tipoPagamentoOriginal === 'boleto' ? 'selected' : ''}>Boleto</option>
                </select>
            </td>
            <td class="avv-cell-actions">
                <div class="avv-vendas-actions">
                    <button class="btn-confirmar-linha avv-action-btn avv-action-btn-primary" type="button" title="Confirmar venda" aria-label="Confirmar venda desta linha">
                        <i class="fas fa-check" aria-hidden="true"></i>
                    </button>
                    <button class="btn-duplicar avv-action-btn avv-action-btn-secondary" type="button" title="Duplicar linha" aria-label="Duplicar esta linha">
                        <i class="fas fa-copy" aria-hidden="true"></i>
                    </button>
                    <button class="btn-remover avv-action-btn avv-action-btn-danger" type="button" title="Remover linha" aria-label="Remover esta linha">
                        <i class="fas fa-trash-alt" aria-hidden="true"></i>
                    </button>
                </div>
            </td>
        `;
    }

    removerLinha(id) {
        if (confirm('Remover esta linha?')) {
            const el = document.getElementById(id);
            if (el) {
                el.remove();
                this.atualizarVendas();
            }
        }
    }

    limparTodasLinhas() {
        if (confirm('Limpar todos os produtos da calculadora?')) {
            document.getElementById('vendasBody').innerHTML = '';
            this.contadorLinhas = 0;
            this.atualizarVendas();
        }
    }

    // ===== CONFIRMAR TODAS AS VENDAS EM LOTE (CORRIGIDO) =====
    
    confirmarTodasVendas() {
        const linhas = document.querySelectorAll('#vendasBody tr');
        
        if (linhas.length === 0) {
            mostrarNotificacao('❌ Nenhuma linha para vender', 'erro');
            return;
        }
        
        // Valida se todas as linhas têm produto selecionado
        const linhasInvalidas = [];
        const vendasParaConfirmar = [];
        
        linhas.forEach((linha, index) => {
            const select = linha.querySelector('.produto-select');
            const produtoId = parseInt(select?.value);
            const qtd = parseInt(linha.querySelector('.qtd')?.value) || 1;
            const produto = estado.state.produtos.find(p => p.id === produtoId);
            
            if (!select || !select.value) {
                linhasInvalidas.push(`Linha ${index + 1}: sem produto selecionado`);
            } else if (produto && qtd > produto.quantidade) {
                linhasInvalidas.push(`Linha ${index + 1}: ${produto.nome} - estoque insuficiente (${produto.quantidade})`);
            } else {
                vendasParaConfirmar.push({
                    linha,
                    cliente: linha.querySelector('.cliente-input')?.value || 'Cliente',
                    produtoId,
                    produtoNome: select.options[select.selectedIndex]?.text || 'Produto',
                    qtd,
                    preco: parseFloat(linha.querySelector('.preco')?.value) || 0,
                    custo: parseFloat(linha.querySelector('.custo')?.value) || 0
                });
            }
        });
        
        if (linhasInvalidas.length > 0) {
            mostrarNotificacao(`❌ ${linhasInvalidas.length} linha(s) com problemas. Verifique e tente novamente.`, 'erro');
            console.log('Problemas:', linhasInvalidas);
            return;
        }
        
        // Abre modal de confirmação em lote
        this.abrirModalConfirmacaoLote(vendasParaConfirmar);
    }

    abrirModalConfirmacaoLote(vendas) {
        const totalFaturamento = vendas.reduce((sum, v) => sum + (v.preco * v.qtd), 0);
        const totalLucro = vendas.reduce((sum, v) => {
            const taxaAnuncio = TAXAS_ANUNCIO[this.tipoAnuncio] || 0.14;
            const comissao = v.preco * taxaAnuncio;
            const lucroUnit = v.preco - v.custo - comissao;
            return sum + (lucroUnit * v.qtd);
        }, 0);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'modalLote';
        
        modal.innerHTML = `
            <div class="modal-box" style="max-width: 600px;">
                <h3><i class="fas fa-rocket" style="color:#17a2b8;"></i> Confirmar Vendas em Lote</h3>
                
                <div class="modal-resumo">
                    <div class="modal-resumo-grid" style="grid-template-columns:repeat(3,1fr);">
                        <div class="modal-resumo-item">
                            <div class="label">Linhas</div>
                            <div class="value">${vendas.length}</div>
                        </div>
                        <div class="modal-resumo-item">
                            <div class="label">Faturamento</div>
                            <div class="value">${formatarReal(totalFaturamento)}</div>
                        </div>
                        <div class="modal-resumo-item">
                            <div class="label">Lucro</div>
                            <div class="value" style="color:${totalLucro >= 0 ? '#28a745' : '#dc3545'}">${formatarReal(totalLucro)}</div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-lista" style="max-height: 250px;">
                    ${vendas.map(v => `
                        <div class="modal-lista-item">
                            <span class="produto-nome"><i class="fas fa-user"></i> ${v.cliente}</span>
                            <span class="produto-info">${v.produtoNome} × ${v.qtd}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="modal-actions">
                    <button class="btn-cancelar" id="btnCancelarLote">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-confirmar-final" id="btnConfirmarLote">
                        <i class="fas fa-check"></i> Confirmar Todos (${vendas.length})
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Adiciona eventos aos botões
        document.getElementById('btnCancelarLote').addEventListener('click', () => {
            document.getElementById('modalLote').remove();
        });
        
        document.getElementById('btnConfirmarLote').addEventListener('click', () => {
            this.processarVendasLote(vendas);
        });
    }

    processarVendasLote(vendas) {
        const modal = document.getElementById('modalLote');
        if (modal) modal.remove();
        
        let vendasConfirmadas = 0;
        let erros = [];
        let produtosComErro = [];
        
        vendas.forEach((v, index) => {
            try {
                const produto = estado.state.produtos.find(p => p.id === v.produtoId);
                if (!produto) {
                    erros.push(`Linha ${index + 1}: produto não encontrado`);
                    produtosComErro.push(v.produtoNome);
                    return;
                }
                
                if (v.qtd > produto.quantidade) {
                    erros.push(`Linha ${index + 1}: ${v.produtoNome} - estoque insuficiente (${produto.quantidade})`);
                    produtosComErro.push(v.produtoNome);
                    return;
                }
                
                // Baixa estoque
                produto.quantidade -= v.qtd;
                
                // Registra venda
                const taxaAnuncio = TAXAS_ANUNCIO[this.tipoAnuncio] || 0.14;
                const comissao = v.preco * taxaAnuncio;
                const lucroUnit = v.preco - v.custo - comissao;
                
                const venda = {
                    id: Date.now() + index + Math.random(),
                    data: new Date().toLocaleString(),
                    cliente: v.cliente,
                    produto: v.produtoNome,
                    quantidade: v.qtd,
                    precoUnitario: v.preco,
                    total: v.preco * v.qtd,
                    custo: v.custo * v.qtd,
                    lucro: lucroUnit * v.qtd,
                    margem: v.preco > 0 ? ((v.preco - v.custo) / v.preco) * 100 : 0
                };
                
                estado.state.historicoVendas.push(venda);
                
                // Remove a linha da tabela
                if (v.linha && v.linha.remove) {
                    v.linha.remove();
                }
                
                vendasConfirmadas++;
                
            } catch (error) {
                console.error('Erro ao processar venda:', error, v);
                erros.push(`Linha ${index + 1}: erro interno`);
                produtosComErro.push(v.produtoNome);
            }
        });
        
        // Salva tudo de uma vez
        if (vendasConfirmadas > 0) {
            estado.salvarProdutos();
            estado.salvarHistorico();
        }
        
        // Dispara eventos
        window.dispatchEvent(new Event('historicoAtualizado'));
        window.dispatchEvent(new Event('estoqueAtualizado'));
        
        // Atualiza interface
        this.sincronizarSelectConfirmacao();
        this.atualizarVendas();
        
        // Feedback
        if (vendasConfirmadas > 0) {
            mostrarNotificacao(`✅ ${vendasConfirmadas} venda(s) confirmadas!`, 'sucesso');
        }
        
        if (erros.length > 0) {
            const produtosUnicos = [...new Set(produtosComErro)];
            const mensagemErro = erros.length === 1 
                ? `❌ ${erros[0]}`
                : `❌ ${erros.length} erro(s): ${produtosUnicos.slice(0,3).join(', ')}${produtosUnicos.length > 3 ? '...' : ''}`;
            mostrarNotificacao(mensagemErro, 'erro');
        }
    }

    // ===== ATUALIZAÇÃO PRINCIPAL =====

    atualizarVendas() {
        const custoPorIda = this.calcularCustoPorIda();
        const custoPorIdaEl = document.getElementById('custoPorIdaDisplay');
        if (custoPorIdaEl) {
            custoPorIdaEl.innerText = custoPorIda.toFixed(2).replace('.', ',');
        }

        const resultadoAnterior = this.ultimoResultado;

        this.aplicarCoresClientes();
        const resultado = this.calcularTotais();
        this.atualizarInterface(resultado);
        this.atualizarMeta(resultado.lucroTotal);
        this.atualizarStatus(resultado);
        this.atualizarImpactoUltimaMudanca(resultadoAnterior, resultado);
        this.sincronizarSelectConfirmacao();
        // Notifica outros módulos (ex.: precificação inteligente) que os resultados foram recalculados
        window.dispatchEvent(new CustomEvent('vendasAtualizadas', { detail: resultado }));

        this.ultimoResultado = resultado;
    }

    aplicarCoresClientes() {
        this.clienteCores = {};
        let indiceCor = 0;
        const linhas = document.querySelectorAll('#vendasBody tr');
        const numTints = 5;

        linhas.forEach(linha => {
            const cliente = linha.querySelector('.cliente-input')?.value || 'Sem cliente';
            if (!this.clienteCores.hasOwnProperty(cliente)) {
                this.clienteCores[cliente] = indiceCor % numTints;
                indiceCor++;
            }
            const tintIndex = this.clienteCores[cliente];
            linha.classList.remove('avv-row-tint-0', 'avv-row-tint-1', 'avv-row-tint-2', 'avv-row-tint-3', 'avv-row-tint-4');
            linha.classList.add('avv-row-tint-' + tintIndex);
        });
    }

    calcularTotais() {
        const linhas = document.querySelectorAll('#vendasBody tr');
        let totalItens = 0;
        let somaPrecos = 0;
        let somaCustos = 0;
        let somaFretes = 0;
        let somaEmbalagem = 0;
        let somaDeslocamento = 0;
        let pesoTotal = 0;
        let somaReceitaCartao = 0;
        let somaReceitaOutros = 0;

        const pedidos = {};

        linhas.forEach(linha => {
            const cliente = linha.querySelector('.cliente-input')?.value || 'Sem cliente';
            const preco = parseFloat(linha.querySelector('.preco')?.value) || 0;
            const peso = parseInt(linha.querySelector('.peso')?.value) || 0;
            const qtd = parseInt(linha.querySelector('.qtd')?.value) || 1;
            const custo = parseFloat(linha.querySelector('.custo')?.value) || 0;
            const tipoPagamento = linha.querySelector('.tipo-pagamento')?.value || 'cartao';

            if (!pedidos[cliente]) {
                pedidos[cliente] = { itens: [], pesoTotal: 0, valorTotal: 0 };
            }

            for (let i = 0; i < qtd; i++) {
                pedidos[cliente].itens.push({ preco, peso, custo });
            }

            pedidos[cliente].pesoTotal += peso * qtd;
            pedidos[cliente].valorTotal += preco * qtd;
            totalItens += qtd;
            pesoTotal += peso * qtd;

            if (tipoPagamento === 'cartao') {
                somaReceitaCartao += preco * qtd;
            } else {
                somaReceitaOutros += preco * qtd;
            }
        });

        const embalagemBase = parseFloat(document.getElementById('embalagemBase')?.value) || 5.50;
        const custoPorIda = this.calcularCustoPorIda();
        const custosOp = this.obterConfigCustosOperacionais();

        Object.keys(pedidos).forEach(cliente => {
            const pedido = pedidos[cliente];
            const itens = pedido.itens;
            const pesoTotalPedido = pedido.pesoTotal;
            const valorTotalPedido = pedido.valorTotal;

            const fretePedido = this.calcularFrete(pesoTotalPedido, valorTotalPedido);
            const embalagemPedido = embalagemBase * itens.length;
            const deslocamentoPedido = custoPorIda;

            itens.forEach(item => {
                somaPrecos += item.preco;
                somaCustos += item.custo;
                somaFretes += fretePedido / itens.length;
                somaEmbalagem += embalagemPedido / itens.length;
                somaDeslocamento += deslocamentoPedido / itens.length;
            });
        });

        const totalPedidos = Object.keys(pedidos).length;
        const ticketMedio = totalPedidos > 0 ? somaPrecos / totalPedidos : 0;
        const itensPorPedido = totalPedidos > 0 ? totalItens / totalPedidos : 0;

        let taxaAnuncio = TAXAS_ANUNCIO[this.tipoAnuncio] || 0.14;

        // Ajuste por reputação (bônus para verde)
        const reputacao = document.getElementById('mlReputacaoVendedor')?.value || 'verde';
        const bonusVerde = validarPercentual(document.getElementById('mlBonusReputacaoVerde')?.value, 0);
        if (reputacao === 'verde' && bonusVerde > 0) {
            taxaAnuncio = taxaAnuncio * (1 - bonusVerde / 100);
        }
        const comissaoTotal = somaPrecos * taxaAnuncio;

        // Custos operacionais holísticos
        const vendasBaseRateio = Math.max(custosOp.vendasMensaisEsperadas || 0, 1);
        const custoFixoPorItem = vendasBaseRateio > 0 ? custosOp.custoFixoMensal / vendasBaseRateio : 0;
        const proLaborePorItem = vendasBaseRateio > 0 ? custosOp.proLaboreMensal / vendasBaseRateio : 0;
        const custosFixosRateados = (custoFixoPorItem + proLaborePorItem) * totalItens;

        const impostosTotal = somaPrecos * (custosOp.impostoPercentual / 100);
        const perdasTotal = somaPrecos * (custosOp.perdasPercentual / 100);
        const marketingTotal = somaPrecos * (custosOp.marketingPercentual / 100);
        const taxasPagamentoTotal = somaReceitaCartao * (custosOp.taxaPagamentoPercentual / 100);

        const custosOperacionaisTotais = custosFixosRateados + impostosTotal + perdasTotal + marketingTotal + taxasPagamentoTotal;

        const lucroAntesCustosOp = somaPrecos - somaCustos - somaFretes - somaEmbalagem - somaDeslocamento - comissaoTotal;
        const lucroTotal = lucroAntesCustosOp - custosOperacionaisTotais;
        const margemMedia = somaPrecos > 0 ? (lucroTotal / somaPrecos) * 100 : 0;

        // Simulação de canal próprio (sem comissão de plataforma, mantendo demais custos)
        const lucroCanalProprio = lucroTotal + comissaoTotal;
        const margemCanalProprio = somaPrecos > 0 ? (lucroCanalProprio / somaPrecos) * 100 : 0;

        const precoMedio = totalItens > 0 ? somaPrecos / totalItens : 0;
        const custoMedio = totalItens > 0 ? somaCustos / totalItens : 0;
        const comissaoMedia = totalItens > 0 ? comissaoTotal / totalItens : 0;
        const freteMedio = totalItens > 0 ? somaFretes / totalItens : 0;
        const deslocamentoMedio = totalItens > 0 ? somaDeslocamento / totalItens : 0;
        const custoOperacionalMedio = totalItens > 0 ? custosOperacionaisTotais / totalItens : 0;
        const lucroMedio = totalItens > 0 ? lucroTotal / totalItens : 0;
        const margemMediaItem = precoMedio > 0
            ? ((precoMedio - custoMedio - freteMedio - somaEmbalagem / Math.max(totalItens, 1) - deslocamentoMedio - comissaoMedia - custoOperacionalMedio) / precoMedio) * 100
            : 0;

        const limiteViagem = parseFloat(document.getElementById('limiteViagem')?.value) || 5;
        const totalViagens = limiteViagem > 0 ? Math.ceil((pesoTotal / 1000) / limiteViagem) : 0;

        return {
            totalItens, totalPedidos, somaPrecos, somaCustos, somaFretes,
            somaEmbalagem, somaDeslocamento, comissaoTotal, lucroAntesCustosOp, lucroTotal, margemMedia,
            ticketMedio, itensPorPedido, pesoTotal, totalViagens,
            precoMedio, custoMedio, comissaoMedia, freteMedio, deslocamentoMedio,
            lucroMedio, margemMediaItem, custosOperacionaisTotais,
            lucroCanalProprio, margemCanalProprio,
            somaReceitaCartao, somaReceitaOutros
        };
    }

    atualizarInterface(resultado) {
        this.atualizarElemento('totalItens', resultado.totalItens.toString());
        this.atualizarElemento('totalPedidos', resultado.totalPedidos.toString());
        this.atualizarElemento('ticketMedio', formatarReal(resultado.ticketMedio));
        this.atualizarElemento('itensPorPedido', resultado.itensPorPedido.toFixed(2));
        this.atualizarElemento('pesoTotal', (resultado.pesoTotal / 1000).toFixed(2) + 'kg');
        this.atualizarElemento('totalViagens', resultado.totalViagens.toString());

        this.atualizarElemento('precoMedio', formatarReal(resultado.precoMedio));
        this.atualizarElemento('custoMedio', formatarReal(resultado.custoMedio));
        this.atualizarElemento('comissaoMedia', formatarReal(resultado.comissaoMedia));
        this.atualizarElemento('freteMedio', formatarReal(resultado.freteMedio));
        this.atualizarElemento('deslocamentoMedio', formatarReal(resultado.deslocamentoMedio));
        this.atualizarElemento('lucroMedio', formatarReal(resultado.lucroMedio));
        this.atualizarElemento('margemMedia', resultado.margemMediaItem.toFixed(1) + '%');

        this.atualizarElemento('faturamentoTotal', formatarReal(resultado.somaPrecos));
        this.atualizarElemento('custoTotalProdutos', formatarReal(resultado.somaCustos));
        this.atualizarElemento('comissaoTotal', formatarReal(resultado.comissaoTotal));
        this.atualizarElemento('freteTotal', formatarReal(resultado.somaFretes));
        this.atualizarElemento('embalagemTotal', formatarReal(resultado.somaEmbalagem));
        this.atualizarElemento('deslocamentoTotal', formatarReal(resultado.somaDeslocamento));
        this.atualizarElemento('lucroAntesCustosOp', formatarReal(resultado.lucroAntesCustosOp));
        this.atualizarElemento('custosOperacionaisTotal', formatarReal(resultado.custosOperacionaisTotais));
        this.atualizarElemento('lucroTotal', formatarReal(resultado.lucroTotal));

        // Resumo executivo (compacto)
        this.atualizarElemento('resumoExecLucro', formatarReal(resultado.lucroTotal));
        this.atualizarElemento('resumoExecMargem', resultado.margemMedia.toFixed(1) + '%');
        this.atualizarElemento('resumoExecFaturamento', formatarReal(resultado.somaPrecos));

        // Comparador de canais (simples)
        this.atualizarElemento('canalAtualMargem', formatarPercentual(resultado.margemMedia || 0));
        if (typeof resultado.margemCanalProprio === 'number') {
            this.atualizarElemento('canalProprioMargem', formatarPercentual(resultado.margemCanalProprio));
            const deltaLucro = (resultado.lucroCanalProprio || 0) - (resultado.lucroTotal || 0);
            this.atualizarElemento('canalProprioDeltaLucro', formatarReal(deltaLucro));
        }

        // Distribuição dos meios de pagamento
        const resumoPagEl = document.getElementById('resumoPagamentos');
        if (resumoPagEl) {
            const totalReceita = resultado.somaPrecos || 0;
            const receitaCartao = typeof resultado.somaReceitaCartao === 'number' ? resultado.somaReceitaCartao : 0;
            const receitaOutros = totalReceita - receitaCartao;

            if (totalReceita <= 0) {
                resumoPagEl.style.display = 'none';
                resumoPagEl.textContent = '';
            } else {
                const pctCartao = (receitaCartao / totalReceita) * 100;
                const pctOutros = (receitaOutros / totalReceita) * 100;
                resumoPagEl.textContent = `Distribuição dos recebimentos: Cartão ${formatarReal(receitaCartao)} (${pctCartao.toFixed(0)}%) · Pix/Boleto ${formatarReal(receitaOutros)} (${pctOutros.toFixed(0)}%)`;
                resumoPagEl.style.display = '';
            }
        }

        // Comentário de margem dentro de "Totais da semana"
        const hintWrapper = document.getElementById('vendasMargemHintWrapper');
        const hintEl = document.getElementById('vendasMargemHint');

        if (hintWrapper && hintEl) {
            const margem = resultado.margemMedia || 0;
            const temDados = (resultado.totalItens || 0) > 0;

            if (!temDados || margem >= 30) {
                // Sem itens ou margem saudável → não mostra nada
                hintWrapper.style.display = 'none';
                hintEl.textContent = '';
            } else if (margem < 20) {
                hintEl.textContent = 'Nesta simulação, a margem líquida ficou abaixo de 20%. Considere aumentar preços ou reduzir custos logísticos/operacionais.';
                hintWrapper.style.display = '';
            } else {
                // Entre 20% e 29% → atenção leve
                hintEl.textContent = 'Nesta simulação, a margem líquida está abaixo do ideal. Pequenos ajustes de preço ou custos podem ajudar a chegar em 30%+.';
                hintWrapper.style.display = '';
            }
        }
    }

    /**
     * Mostra um resumo discreto do impacto entre o resultado anterior e o atual
     * (focado em lucro após custos e margem líquida).
     */
    atualizarImpactoUltimaMudanca(anterior, atual) {
        const el = document.getElementById('impactoUltimaMudanca');
        if (!el || !atual) return;

        // Sem histórico ou sem itens → não mostra nada
        if (!anterior || atual.totalItens === 0) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }

        const deltaLucro = atual.lucroTotal - (anterior.lucroTotal || 0);
        const deltaMargem = atual.margemMedia - (anterior.margemMedia || 0);

        const impactoLucroAbsoluto = Math.abs(deltaLucro);
        const impactoMargemAbsoluto = Math.abs(deltaMargem);

        // Variação muito pequena → esconde para não poluir
        if (impactoLucroAbsoluto < 1 && impactoMargemAbsoluto < 0.2) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }

        const prefixLucro = deltaLucro >= 0 ? '↑' : '↓';
        const prefixMargem = deltaMargem >= 0 ? '↑' : '↓';

        const textoLucro = `${prefixLucro} Lucro após custos ${formatarReal(Math.abs(deltaLucro))}`;
        const textoMargem = `${prefixMargem} Margem líquida ${deltaMargem.toFixed(1).replace('.', ',')} p.p.`;

        el.textContent = `Impacto das últimas mudanças: ${textoLucro} · ${textoMargem}`;
        el.style.display = '';
    }

    atualizarElemento(id, valor) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = valor;
    }

    atualizarMeta(lucroTotal) {
        const metaValor = (typeof window.metaConfig !== 'undefined' ? window.metaConfig.valor : 1000);
        const percentualMeta = metaValor > 0 ? (lucroTotal / metaValor) * 100 : 0;

        const metaPercentualEl = document.getElementById('vendasMetaPercentual');
        if (metaPercentualEl) metaPercentualEl.innerText = percentualMeta.toFixed(0) + '%';

        const metaFaltamEl = document.getElementById('vendasMetaFaltam');
        if (metaFaltamEl) metaFaltamEl.innerHTML = formatarReal(Math.max(0, metaValor - lucroTotal));
    }

    /**
     * Score de saúde do negócio (uso interno e priorização de alertas).
     * @returns {'critico'|'atencao'|'saudavel'}
     */
    obterSaudeMargem(margemMedia) {
        if (margemMedia < 20) return 'critico';
        if (margemMedia < 30) return 'atencao';
        return 'saudavel';
    }

    atualizarStatus(resultado) {
        const alertas = [];
        const saude = this.obterSaudeMargem(resultado.margemMedia);

        // Nenhum produto na calculadora
        if (resultado.totalItens === 0) {
            alertas.push({ nivel: 'atencao', mensagem: 'Adicione produtos à tabela para começar a calcular.', icon: 'fa-calculator' });
        }

        // Margem muito baixa (< 20%) — crítico
        if (resultado.totalItens > 0 && resultado.margemMedia < 20) {
            alertas.push({ nivel: 'critico', mensagem: 'Margem muito baixa. Aumente os preços ou reduza custos.', icon: 'fa-chart-line' });
        }

        // Margem abaixo do esperado (20–29%)
        if (resultado.totalItens > 0 && resultado.margemMedia >= 20 && resultado.margemMedia < 30) {
            alertas.push({ nivel: 'atencao', mensagem: 'Margem abaixo do esperado. Considere ajustar preços.', icon: 'fa-exclamation-triangle' });
        }

        // Dica de preço (margem < 25% e há itens)
        if (resultado.totalItens > 0 && resultado.margemMedia < 25) {
            alertas.push({ nivel: 'dica', mensagem: 'Aumente os preços em 5–10% para melhorar a margem.', icon: 'fa-lightbulb' });
        }

        // Frete alto (> 30% do faturamento)
        if (resultado.totalItens > 0 && resultado.somaPrecos > 0 && resultado.somaFretes > resultado.somaPrecos * 0.3) {
            alertas.push({ nivel: 'atencao', mensagem: 'Frete está alto. Considere negociar com transportadora.', icon: 'fa-truck' });
        }

        // Comissão alta (> 25% do faturamento)
        if (resultado.totalItens > 0 && resultado.somaPrecos > 0 && resultado.comissaoTotal > resultado.somaPrecos * 0.25) {
            alertas.push({ nivel: 'dica', mensagem: 'Comissão alta. Considere anúncio Clássico (14%).', icon: 'fa-percent' });
        }

        // Nenhum produto cadastrado no sistema
        if (estado.state.produtos.length === 0) {
            alertas.push({ nivel: 'atencao', mensagem: 'Nenhum produto cadastrado. Cadastre produtos no Estoque.', icon: 'fa-boxes' });
        }

        // Ordenar: crítico → atenção → dica
        const ordem = { critico: 0, atencao: 1, dica: 2 };
        alertas.sort((a, b) => (ordem[a.nivel] ?? 2) - (ordem[b.nivel] ?? 2));

        const containerDashboard = document.getElementById('statusContainer');
        const alertsDashboard = document.getElementById('statusAlerts');
        if (containerDashboard && alertsDashboard) {
            if (alertas.length === 0) {
                containerDashboard.style.display = 'none';
                alertsDashboard.innerHTML = '';
            } else {
                containerDashboard.style.display = '';
                alertsDashboard.innerHTML = alertas.map(a => `
                    <div class="avv-alerta avv-alerta-${a.nivel}" role="alert">
                        <i class="fas ${a.icon}" aria-hidden="true"></i>
                        <span>${a.mensagem}</span>
                    </div>
                `).join('');
            }
        }

    }

    // ===== SINCRONIZAÇÃO DO SELECT COM LINHAS DA TABELA =====

    sincronizarSelectConfirmacao() {
        const selectVenda = document.getElementById('vendaProdutoSelect');
        if (!selectVenda) return;

        const linhas = document.querySelectorAll('#vendasBody tr');
        const produtosNasLinhas = new Set();

        linhas.forEach(linha => {
            const select = linha.querySelector('.produto-select');
            if (select && select.value) {
                produtosNasLinhas.add(parseInt(select.value));
            }
        });

        const valorAtual = selectVenda.value;

        let options = '<option value="">— Selecione um produto —</option>';

        if (produtosNasLinhas.size > 0) {
            options += '<optgroup label="📋 Produtos nas linhas">';
            produtosNasLinhas.forEach(id => {
                const p = estado.state.produtos.find(prod => prod.id === id);
                if (p) {
                    options += `<option value="${p.id}" data-custo="${p.custo}" data-peso="${p.peso}" data-preco="${p.preco}" data-estoque="${p.quantidade}">${p.nome} (${p.quantidade} un.)</option>`;
                }
            });
            options += '</optgroup>';
        }

        const outrosProdutos = estado.state.produtos.filter(p => !produtosNasLinhas.has(p.id));
        if (outrosProdutos.length > 0) {
            options += '<optgroup label="📦 Todos os produtos">';
            outrosProdutos.forEach(p => {
                options += `<option value="${p.id}" data-custo="${p.custo}" data-peso="${p.peso}" data-preco="${p.preco}" data-estoque="${p.quantidade}">${p.nome} (${p.quantidade} un.)</option>`;
            });
            options += '</optgroup>';
        }

        if (estado.state.produtos.length === 0) {
            options = '<option value="">— Cadastre produtos no Estoque —</option>';
        }

        selectVenda.innerHTML = options;
        if (valorAtual) selectVenda.value = valorAtual;
        this.atualizarPreviewVenda();
    }

    // ===== PREVIEW DA VENDA =====

    atualizarPreviewVenda() {
        const selectVenda = document.getElementById('vendaProdutoSelect');
        const vendaQtd = document.getElementById('vendaQtd');
        const preview = document.getElementById('vendaPreview');

        if (!selectVenda || !vendaQtd || !preview) return;

        const option = selectVenda.options[selectVenda.selectedIndex];
        const qtd = parseInt(vendaQtd.value) || 1;

        if (!option || !option.value) {
            preview.classList.remove('visible');
            return;
        }

        const preco = parseFloat(option.dataset.preco) || 0;
        const custo = parseFloat(option.dataset.custo) || 0;
        const estoque = parseInt(option.dataset.estoque) || 0;

        const taxaAnuncio = TAXAS_ANUNCIO[this.tipoAnuncio] || 0.14;
        const comissao = preco * taxaAnuncio;
        const lucroUnit = preco - custo - comissao;
        const totalFaturamento = preco * qtd;
        const totalLucro = lucroUnit * qtd;

        const previewFaturamento = document.getElementById('previewFaturamento');
        const previewLucro = document.getElementById('previewLucro');
        const previewEstoque = document.getElementById('previewEstoque');

        if (previewFaturamento) previewFaturamento.innerHTML = formatarReal(totalFaturamento);
        if (previewLucro) {
            previewLucro.innerHTML = formatarReal(totalLucro);
            previewLucro.style.color = totalLucro >= 0 ? '#28a745' : '#dc3545';
        }
        if (previewEstoque) {
            const restante = estoque - qtd;
            previewEstoque.textContent = restante >= 0 ? `${restante} un.` : '⚠ Insuficiente';
            previewEstoque.style.color = restante >= 0 ? 'var(--primary-color)' : '#dc3545';
        }

        preview.classList.add('visible');
    }

    // ===== CONFIRMACAO DE VENDA DA LINHA =====

    confirmarVendaLinha(linhaElement) {
        const clienteInput = linhaElement.querySelector('.cliente-input');
        const selectProduto = linhaElement.querySelector('.produto-select');
        const qtdInput = linhaElement.querySelector('.qtd');
        const precoInput = linhaElement.querySelector('.preco');
        const custoInput = linhaElement.querySelector('.custo');

        const cliente = clienteInput?.value?.trim() || 'Cliente';
        const produtoId = parseInt(selectProduto?.value);
        const qtd = parseInt(qtdInput?.value) || 1;
        const preco = parseFloat(precoInput?.value) || 0;
        const custo = parseFloat(custoInput?.value) || 0;

        if (!produtoId) {
            mostrarNotificacao('Selecione um produto na linha antes de confirmar', 'erro');
            return;
        }

        if (qtd < 1) {
            mostrarNotificacao('Quantidade deve ser maior que zero', 'erro');
            return;
        }

        const produto = estado.state.produtos.find(p => p.id === produtoId);
        if (!produto) {
            mostrarNotificacao('Produto nao encontrado', 'erro');
            return;
        }

        if (qtd > produto.quantidade) {
            mostrarNotificacao(`Estoque insuficiente para "${produto.nome}". Disponivel: ${produto.quantidade}`, 'erro');
            return;
        }

        const taxaAnuncio = TAXAS_ANUNCIO[this.tipoAnuncio] || 0.14;
        const comissao = preco * taxaAnuncio;
        const lucroUnit = preco - custo - comissao;
        const totalFaturamento = preco * qtd;
        const totalLucro = lucroUnit * qtd;

        this.abrirModalConfirmacao({
            cliente,
            produto: produto.nome,
            produtoId,
            qtd,
            preco,
            custo,
            totalFaturamento,
            totalLucro,
            estoqueRestante: produto.quantidade - qtd,
            linhaElement: linhaElement
        });
    }

    // ===== CONFIRMACAO DE VENDA (COM MODAL) =====

    confirmarVenda() {
        const selectVenda = document.getElementById('vendaProdutoSelect');
        const vendaCliente = document.getElementById('vendaCliente');
        const vendaQtd = document.getElementById('vendaQtd');

        if (!selectVenda || !selectVenda.value) {
            mostrarNotificacao('❌ Selecione um produto antes de confirmar', 'erro');
            return;
        }

        const qtd = parseInt(vendaQtd?.value) || 1;
        if (qtd < 1) {
            mostrarNotificacao('❌ Quantidade deve ser maior que zero', 'erro');
            return;
        }

        const option = selectVenda.options[selectVenda.selectedIndex];
        const produtoId = parseInt(option.value);
        const produto = estado.state.produtos.find(p => p.id === produtoId);

        if (!produto) {
            mostrarNotificacao('❌ Produto não encontrado', 'erro');
            return;
        }

        if (qtd > produto.quantidade) {
            mostrarNotificacao(`❌ Estoque insuficiente para "${produto.nome}". Disponível: ${produto.quantidade}`, 'erro');
            return;
        }

        const preco = parseFloat(option.dataset.preco) || produto.preco;
        const custo = parseFloat(option.dataset.custo) || produto.custo;
        const taxaAnuncio = TAXAS_ANUNCIO[this.tipoAnuncio] || 0.14;
        const comissao = preco * taxaAnuncio;
        const lucroUnit = preco - custo - comissao;
        const totalFaturamento = preco * qtd;
        const totalLucro = lucroUnit * qtd;
        const cliente = vendaCliente?.value?.trim() || 'Cliente';

        this.abrirModalConfirmacao({
            cliente,
            produto: produto.nome,
            produtoId,
            qtd,
            preco,
            custo,
            totalFaturamento,
            totalLucro,
            estoqueRestante: produto.quantidade - qtd
        });
    }

    abrirModalConfirmacao(dados) {
        const modalExistente = document.getElementById('modalConfirmarVenda');
        if (modalExistente) modalExistente.remove();

        const modal = document.createElement('div');
        modal.id = 'modalConfirmarVenda';
        modal.className = 'modal-overlay';

        const lucroColor = dados.totalLucro >= 0 ? '#28a745' : '#dc3545';
        const tipoAnuncioLabel = this.tipoAnuncio === 'classico' ? 'Clássico 14%' : 'Premium 19%';

        modal.innerHTML = `
            <div class="modal-box">
                <h3><i class="fas fa-check-circle"></i> Confirmar Venda</h3>

                <div class="modal-resumo">
                    <div class="modal-resumo-grid">
                        <div class="modal-resumo-item">
                            <div class="label">Faturamento</div>
                            <div class="value">${formatarReal(dados.totalFaturamento)}</div>
                        </div>
                        <div class="modal-resumo-item">
                            <div class="label">Lucro estimado</div>
                            <div class="value" style="color:${lucroColor}">${formatarReal(dados.totalLucro)}</div>
                        </div>
                        <div class="modal-resumo-item">
                            <div class="label">Estoque restante</div>
                            <div class="value" style="color:${dados.estoqueRestante >= 0 ? 'var(--primary-color)' : '#dc3545'}">${dados.estoqueRestante} un.</div>
                        </div>
                    </div>
                </div>

                <div class="modal-lista">
                    <div class="modal-lista-item">
                        <span class="produto-nome"><i class="fas fa-user" style="color:var(--primary-color);"></i> ${dados.cliente}</span>
                        <span class="produto-info">${dados.produto} × ${dados.qtd}</span>
                    </div>
                    <div class="modal-lista-item">
                        <span class="produto-nome">Preço unitário</span>
                        <span class="produto-info">${formatarReal(dados.preco)}</span>
                    </div>
                    <div class="modal-lista-item">
                        <span class="produto-nome">Custo unitário</span>
                        <span class="produto-info">${formatarReal(dados.custo)}</span>
                    </div>
                    <div class="modal-lista-item">
                        <span class="produto-nome">Tipo de anúncio</span>
                        <span class="produto-info">${tipoAnuncioLabel}</span>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn-cancelar" id="modalBtnCancelar">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-confirmar-final" id="modalBtnConfirmar">
                        <i class="fas fa-check"></i> Confirmar Venda
                    </button>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        modal.querySelector('#modalBtnCancelar').addEventListener('click', () => modal.remove());
        modal.querySelector('#modalBtnConfirmar').addEventListener('click', () => this.processarVendaModal(dados));

        document.body.appendChild(modal);
    }

    processarVendaModal(dados) {
        const modal = document.getElementById('modalConfirmarVenda');
        if (modal) modal.remove();

        const produto = estado.state.produtos.find(p => p.id === dados.produtoId);
        if (!produto) {
            mostrarNotificacao('❌ Produto não encontrado', 'erro');
            return;
        }

        // Baixa estoque
        produto.quantidade -= dados.qtd;
        estado.salvarProdutos();

        // Registra no histórico
        const hoje = new Date();
        const venda = {
            id: Date.now() + Math.random(),
            data: hoje.toLocaleDateString('pt-BR'),
            hora: hoje.toLocaleTimeString('pt-BR'),
            cliente: dados.cliente,
            produto: dados.produto,
            quantidade: dados.qtd,
            precoUnitario: dados.preco,
            total: dados.totalFaturamento,
            custo: dados.custo * dados.qtd,
            lucro: dados.totalLucro,
            margem: dados.preco > 0 ? ((dados.preco - dados.custo) / dados.preco) * 100 : 0
        };

        estado.state.historicoVendas.push(venda);
        estado.salvarHistorico();

        // Dispara eventos
        window.dispatchEvent(new Event('historicoAtualizado'));
        window.dispatchEvent(new Event('estoqueAtualizado'));

        // Atualiza UI
        this.sincronizarSelectConfirmacao();
        this.atualizarPreviewVenda();

        // Se a venda veio de uma linha, remove a linha
        if (dados.linhaElement) {
            dados.linhaElement.remove();
            this.atualizarVendas();
        } else {
            const vendaQtd = document.getElementById('vendaQtd');
            if (vendaQtd) vendaQtd.value = 1;
        }

        mostrarNotificacao(`Venda confirmada! ${dados.qtd}x ${dados.produto}`, 'sucesso');
    }

    // ===== ATUALIZAR SELECT EXTERNO =====

    atualizarSelect() {
        this.sincronizarSelectConfirmacao();
    }
}

export const vendas = new GerenciadorVendas();