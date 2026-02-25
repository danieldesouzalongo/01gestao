import { estado } from '../core/storage.js';
import { TAXAS_ANUNCIO } from '../core/constants.js';
import { formatarReal, formatarPercentual } from '../core/utils.js';
import { vendas } from './vendas.js';

// ===== GERENCIADOR DE CENÁRIOS =====

class GerenciadorCenarios {
    constructor() {
        this.init();
    }
    
    // ===== INICIALIZAÇÃO =====
    
    init() {
        // Atualiza quando as vendas mudarem
        window.addEventListener('estoqueAtualizado', () => this.atualizar());
        window.addEventListener('vendasAtualizadas', () => this.atualizar());

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.renderizarCenariosSalvos());
        } else {
            this.renderizarCenariosSalvos();
        }
    }
    
    // ===== ATUALIZAÇÃO PRINCIPAL =====
    
    atualizar() {
        const linhas = document.querySelectorAll('#vendasBody tr');
        const dados = this.calcularDadosBase(linhas);
        
        this.atualizarCardsBase(dados);
        this.atualizarPrevisaoIA(dados);
        this.atualizarDicas(dados);
    }
    
    // ===== CÁLCULOS BASE =====
    
    calcularDadosBase(linhas) {
        let totalItens = 0;
        let somaPrecos = 0;
        let somaCustos = 0;
        
        linhas.forEach(linha => {
            const preco = parseFloat(linha.querySelector('.preco')?.value) || 0;
            const custo = parseFloat(linha.querySelector('.custo')?.value) || 0;
            const qtd = parseFloat(linha.querySelector('.qtd')?.value) || 1;
            
            totalItens += qtd;
            somaPrecos += preco * qtd;
            somaCustos += custo * qtd;
        });
        
        const precoMedio = totalItens > 0 ? somaPrecos / totalItens : 0;
        const custoMedio = totalItens > 0 ? somaCustos / totalItens : 0;
        const lucroMedio = precoMedio - custoMedio;
        const margemMedia = precoMedio > 0 ? (lucroMedio / precoMedio) * 100 : 0;
        
        return {
            totalItens,
            precoMedio,
            custoMedio,
            lucroMedio,
            margemMedia,
            somaPrecos,
            somaCustos
        };
    }

    // ===== CENÁRIOS SALVOS =====

    salvarCenarioAtual(nome) {
        const nomeInput = document.getElementById('cenarioNome');
        const nomeFinal = (nome || nomeInput?.value || '').trim() || 'Cenário sem nome';

        const resultadoVendas = vendas.calcularTotais();
        const configAtual = estado.getConfiguracoesAtuais();

        const resumo = {
            faturamento: resultadoVendas.somaPrecos,
            lucroAntesCustosOp: resultadoVendas.lucroAntesCustosOp,
            lucroLiquido: resultadoVendas.lucroTotal,
            margem: resultadoVendas.margemMedia,
            custosOperacionais: resultadoVendas.custosOperacionaisTotais
        };

        const cenario = {
            id: Date.now(),
            nome: nomeFinal,
            criadoEm: new Date().toLocaleString(),
            config: configAtual,
            resumo
        };

        estado.state.cenarios.push(cenario);
        estado.salvarCenarios();
        this.renderizarCenariosSalvos();

        if (nomeInput) nomeInput.value = '';
    }

    aplicarCenario(id) {
        const cenario = estado.state.cenarios.find(c => c.id === id);
        if (!cenario) return;

        const cfg = cenario.config || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val != null) el.value = val;
        };

        setVal('embalagemBase', cfg.embalagemBase);
        setVal('outrosCustos', cfg.outrosCustos);
        setVal('limiteViagem', cfg.limiteViagem);
        setVal('distancia', cfg.distancia);
        setVal('consumo', cfg.consumo);
        setVal('precoGasolina', cfg.precoGasolina);
        setVal('dashboardMetaValor', cfg.metaLucro);

        setVal('custoFixoMensal', cfg.custoFixoMensal);
        setVal('vendasMensaisEsperadas', cfg.vendasMensaisEsperadas);
        setVal('proLaboreMensal', cfg.proLaboreMensal);
        setVal('impostoPercentual', cfg.impostoPercentual);
        setVal('perdasPercentual', cfg.perdasPercentual);
        setVal('marketingPercentual', cfg.marketingPercentual);
        setVal('taxaPagamentoPercentual', cfg.taxaPagamentoPercentual);

        setVal('custoKmVeiculo', cfg.custoKmVeiculo);
        setVal('valorHoraVendedor', cfg.valorHoraVendedor);
        setVal('tempoMedioPorKm', cfg.tempoMedioPorKm);
        setVal('custoEstacionamento', cfg.custoEstacionamento);
        setVal('custoPedagio', cfg.custoPedagio);

        if (cfg.tipoAnuncio) {
            window.selecionarAnuncio?.(cfg.tipoAnuncio);
        }

        window.atualizarMetaValor?.(cfg.metaLucro);
        vendas.atualizarVendas();
    }

    excluirCenario(id) {
        estado.state.cenarios = estado.state.cenarios.filter(c => c.id !== id);
        estado.salvarCenarios();
        this.renderizarCenariosSalvos();
    }

    compararCenario(id) {
        const cenario = estado.state.cenarios.find(c => c.id === id);
        if (!cenario) return;

        const atual = vendas.calcularTotais();
        const alvo = cenario.resumo;

        const container = document.getElementById('cenariosComparacaoContainer');
        if (!container) return;

        const linha = (label, a, b, formatter) => {
            const va = formatter ? formatter(a) : a;
            const vb = formatter ? formatter(b) : b;
            return `<tr><td>${label}</td><td>${va}</td><td>${vb}</td></tr>`;
        };

        const html = `
            <h4 class="avv-card-title" style="margin-bottom:10px;"><i class="fas fa-balance-scale"></i> Comparação de cenários</h4>
            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Atual vs "${cenario.nome}"</p>
            <div class="tabela-container overflow-x-auto">
                <table class="tabela-produtos text-sm">
                    <thead>
                        <tr>
                            <th>Métrica</th>
                            <th>Atual</th>
                            <th>${cenario.nome}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linha('Faturamento', atual.somaPrecos, alvo.faturamento, formatarReal)}
                        ${linha('Lucro antes custos op.', atual.lucroAntesCustosOp, alvo.lucroAntesCustosOp, formatarReal)}
                        ${linha('Custos operacionais', atual.custosOperacionaisTotais, alvo.custosOperacionais, formatarReal)}
                        ${linha('Lucro líquido', atual.lucroTotal, alvo.lucroLiquido, formatarReal)}
                        ${linha('Margem média', atual.margemMedia, alvo.margem, formatarPercentual)}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    renderizarCenariosSalvos() {
        const container = document.getElementById('cenariosSalvosContainer');
        if (!container) return;

        const lista = estado.state.cenarios || [];
        if (lista.length === 0) {
            container.innerHTML = `<p style="font-size:12px; color:var(--text-secondary);">Nenhum cenário salvo ainda. Use o campo acima para salvar o cenário atual.</p>`;
            return;
        }

        const html = lista.map(c => `
            <div class="cenario-salvo-card">
                <div class="cenario-salvo-header">
                    <strong>${c.nome}</strong>
                    <span class="cenario-salvo-data">${c.criadoEm}</span>
                </div>
                <div class="cenario-salvo-body">
                    <div>Lucro líquido: <span>${formatarReal(c.resumo?.lucroLiquido || 0)}</span></div>
                    <div>Margem: <span>${formatarPercentual(c.resumo?.margem || 0)}</span></div>
                </div>
                <div class="cenario-salvo-actions">
                    <button class="btn-secondary" type="button" onclick="aplicarCenario(${c.id})">Aplicar</button>
                    <button class="btn-primary" type="button" onclick="compararCenario(${c.id})">Comparar</button>
                    <button class="btn-danger" type="button" onclick="excluirCenario(${c.id})">Excluir</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }
    
    atualizarCardsBase(dados) {
        document.getElementById('basePreco').innerHTML = formatarReal(dados.precoMedio);
        document.getElementById('baseCusto').innerHTML = formatarReal(dados.custoMedio);
        document.getElementById('baseLucro').innerHTML = formatarReal(dados.lucroMedio);
        document.getElementById('baseMargem').innerHTML = formatarPercentual(dados.margemMedia);
    }
    
    // ===== CENÁRIO 1: AUMENTAR PREÇO =====
    
    simularPreco(percentual) {
        const linhas = document.querySelectorAll('#vendasBody tr');
        const dados = this.calcularDadosBase(linhas);
        
        const novoPreco = dados.precoMedio * (1 + percentual / 100);
        const novoLucro = novoPreco - dados.custoMedio;
        const novaMargem = (novoLucro / novoPreco) * 100;
        
        document.getElementById('cenarioPrecoLucro').innerHTML = formatarReal(novoLucro);
        document.getElementById('cenarioPrecoMargem').innerHTML = formatarPercentual(novaMargem);
        
        return { novoLucro, novaMargem };
    }
    
    // ===== CENÁRIO 2: REDUZIR CUSTO =====
    
    simularCusto(percentual) {
        const linhas = document.querySelectorAll('#vendasBody tr');
        const dados = this.calcularDadosBase(linhas);
        
        const novoCusto = dados.custoMedio * (1 - percentual / 100);
        const novoLucro = dados.precoMedio - novoCusto;
        const novaMargem = (novoLucro / dados.precoMedio) * 100;
        
        document.getElementById('cenarioCustoLucro').innerHTML = formatarReal(novoLucro);
        document.getElementById('cenarioCustoMargem').innerHTML = formatarPercentual(novaMargem);
        
        return { novoLucro, novaMargem };
    }
    
    // ===== CENÁRIO 3: TROCAR ANÚNCIO =====
    
    simularAnuncio(tipo) {
        const linhas = document.querySelectorAll('#vendasBody tr');
        const dados = this.calcularDadosBase(linhas);
        
        const embalagemBase = parseFloat(document.getElementById('embalagemBase')?.value) || 0;
        const outros = parseFloat(document.getElementById('outrosCustos')?.value) || 0;
        const comissao = TAXAS_ANUNCIO[tipo];
        
        const comissaoValor = dados.precoMedio * comissao;
        const lucro = dados.precoMedio - dados.custoMedio - comissaoValor - embalagemBase - outros;
        const margem = dados.precoMedio > 0 ? (lucro / dados.precoMedio) * 100 : 0;
        
        document.getElementById('cenarioAnuncioLucro').innerHTML = formatarReal(lucro);
        document.getElementById('cenarioAnuncioMargem').innerHTML = formatarPercentual(margem);
        
        return { lucro, margem };
    }
    
    // ===== PREVISÃO INTELIGENTE (IA Simulada) =====
    
    atualizarPrevisaoIA(dadosBase) {
        const container = document.getElementById('previsaoIA');
        if (!container) return;
        
        const historico = estado.state.historicoVendas;
        
        if (historico.length < 4) {
            container.innerHTML = `
                <p class="cenario-texto">
                    📊 Precisamos de pelo menos 4 semanas de histórico para fazer previsões.
                    Atualmente temos ${historico.length} venda(s).
                </p>
            `;
            return;
        }
        
        // Análise de tendência
        const vendasPorSemana = this.agruparVendasPorSemana(historico);
        const tendencia = this.calcularTendencia(vendasPorSemana);
        const media = vendasPorSemana.reduce((a, b) => a + b, 0) / vendasPorSemana.length;
        
        // Previsões para as próximas 3 semanas
        const previsoes = [];
        for (let i = 1; i <= 3; i++) {
            const fator = 1 + (tendencia / 100) * i;
            previsoes.push(Math.round(media * fator));
        }
        
        // Estoque
        const estoqueTotal = estado.state.produtos.reduce((s, p) => s + p.quantidade, 0);
        const semanasRestantes = previsoes[0] > 0 ? (estoqueTotal / previsoes[0]).toFixed(1) : '∞';
        
        // Classe da tendência
        const tendenciaClass = tendencia > 0 ? 'resultado-bom' : 'resultado-ruim';
        const tendenciaSinal = tendencia > 0 ? '📈 +' : '📉 ';
        
        // HTML da previsão (classes em style.css)
        const html = `
            <div class="cenario-secao">
                <h4 class="cenario-titulo">📈 ANÁLISE DE TENDÊNCIA</h4>
                <p class="cenario-texto">Baseado nas últimas ${vendasPorSemana.length} semanas:</p>
                <p class="cenario-texto">• Média de vendas: <strong>${media.toFixed(1)} itens/semana</strong></p>
                <p class="cenario-texto">• Tendência: <strong class="${tendenciaClass}">${tendenciaSinal}${Math.abs(tendencia).toFixed(1)}%</strong></p>
            </div>
            <div class="cenario-secao">
                <h4 class="cenario-titulo">🔮 PREVISÕES</h4>
                <div class="cenario-previsoes-grid">
                    <div class="cenario-previsoes-card">
                        <div class="cenario-previsoes-label">Semana 1</div>
                        <div class="cenario-previsoes-valor">${previsoes[0]}</div>
                        <div class="cenario-previsoes-unidade">itens</div>
                    </div>
                    <div class="cenario-previsoes-card">
                        <div class="cenario-previsoes-label">Semana 2</div>
                        <div class="cenario-previsoes-valor">${previsoes[1]}</div>
                        <div class="cenario-previsoes-unidade">itens</div>
                    </div>
                    <div class="cenario-previsoes-card">
                        <div class="cenario-previsoes-label">Semana 3</div>
                        <div class="cenario-previsoes-valor">${previsoes[2]}</div>
                        <div class="cenario-previsoes-unidade">itens</div>
                    </div>
                </div>
            </div>
            <div class="cenario-secao">
                <h4 class="cenario-titulo">⚠️ ALERTA DE ESTOQUE</h4>
                <p class="cenario-texto">• Estoque atual: <strong>${estoqueTotal} unidades</strong></p>
                <p class="cenario-texto">• Duração estimada: <strong>${semanasRestantes} semanas</strong></p>
                ${this.getAlertaEstoque(semanasRestantes)}
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    agruparVendasPorSemana(historico) {
        const semanas = {};
        
        historico.forEach(v => {
            const data = new Date(v.data);
            const semana = Math.floor(data.getTime() / (7 * 24 * 60 * 60 * 1000));
            
            if (!semanas[semana]) {
                semanas[semana] = 0;
            }
            semanas[semana] += v.quantidade;
        });
        
        return Object.values(semanas).slice(-8); // Últimas 8 semanas
    }
    
    calcularTendencia(vendasPorSemana) {
        if (vendasPorSemana.length < 2) return 0;
        
        const primeira = vendasPorSemana[0];
        const ultima = vendasPorSemana[vendasPorSemana.length - 1];
        
        return primeira > 0 ? ((ultima - primeira) / primeira) * 100 : 0;
    }
    
    getAlertaEstoque(semanasRestantes) {
        if (semanasRestantes === '∞') {
            return '<div class="alerta-ok">✅ Estoque adequado.</div>';
        }
        const semanas = parseFloat(semanasRestantes);
        if (semanas < 2) {
            return '<div class="alerta-urgente">🔴 Estoque crítico! Compre mais produtos urgentemente.</div>';
        }
        if (semanas < 3) {
            return '<div class="alerta-atencao">🟡 Estoque acabará em breve. Programe compras.</div>';
        }
        return '<div class="alerta-ok">✅ Estoque adequado para as próximas semanas.</div>';
    }
    
    // ===== DICAS PERSONALIZADAS =====
    
    atualizarDicas(dadosBase) {
        const container = document.getElementById('dicasContainer');
        if (!container) return;
        
        const dicas = [];
        
        // Dica baseada na margem
        if (dadosBase.margemMedia >= 35) {
            dicas.push({
                icone: '💰',
                titulo: 'Margem excelente!',
                texto: 'Sua margem está ótima. Considere investir em anúncios Premium para aumentar vendas.'
            });
        } else if (dadosBase.margemMedia >= 25) {
            dicas.push({
                icone: '📈',
                titulo: 'Margem boa',
                texto: 'Sua margem está saudável. Teste aumentar preços em 5-10% para melhorar ainda mais.'
            });
        } else if (dadosBase.margemMedia >= 15) {
            dicas.push({
                icone: '⚠️',
                titulo: 'Margem média',
                texto: 'Sua margem poderia ser melhor. Avalie reduzir custos ou aumentar preços.'
            });
        } else if (dadosBase.margemMedia > 0) {
            dicas.push({
                icone: '🔴',
                titulo: 'Margem baixa',
                texto: 'Margem muito baixa. Reveja seus preços ou negocie com fornecedores urgentemente.'
            });
        }
        
        // Dica de estoque
        const produtosBaixo = estado.state.produtos.filter(p => p.quantidade < 5);
        if (produtosBaixo.length > 0) {
            dicas.push({
                icone: '📦',
                titulo: 'Estoque baixo',
                texto: `${produtosBaixo.length} produto(s) com estoque baixo: ${produtosBaixo.map(p => p.nome).join(', ')}`
            });
        }
        
        // Dica de histórico
        const vendasRecentes = estado.state.historicoVendas.slice(-10);
        if (vendasRecentes.length > 0) {
            const produtosMaisVendidos = this.calcularMaisVendidos(vendasRecentes);
            if (produtosMaisVendidos.length > 0) {
                dicas.push({
                    icone: '🔥',
                    titulo: 'Produto destaque',
                    texto: `Seu produto mais vendido é ${produtosMaisVendidos[0][0]} (${produtosMaisVendidos[0][1]} unidades)`
                });
            }
        }
        
        // Se não houver dicas
        if (dicas.length === 0) {
            dicas.push({
                icone: '💡',
                titulo: 'Comece a vender!',
                texto: 'Adicione produtos na aba Vendas para receber dicas personalizadas.'
            });
        }
        
        // Renderiza dicas
        const html = dicas.map(d => `
            <div class="dica-item">
                <div class="dica-icone">${d.icone}</div>
                <div class="dica-texto">
                    <div class="dica-titulo">${d.titulo}</div>
                    <div class="dica-descricao">${d.texto}</div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    calcularMaisVendidos(vendas) {
        const contador = {};
        vendas.forEach(v => {
            if (!contador[v.produto]) contador[v.produto] = 0;
            contador[v.produto] += v.quantidade;
        });
        
        return Object.entries(contador)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 1);
    }
}

// Exporta uma única instância
export const cenarios = new GerenciadorCenarios();