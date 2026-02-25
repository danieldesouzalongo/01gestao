import { estado } from '../core/storage.js';
import { formatarReal, formatarPercentual } from '../core/utils.js';
import { LIMIARES } from '../core/constants.js';

// ===== GERENCIADOR DE DASHBOARD =====

class GerenciadorDashboard {
    constructor() {
        this.graficoFaturamento = null;
        this.graficoMargemDiaria = null;
        this.init();
    }
    
    // ===== INICIALIZAÇÃO =====
    
    init() {
        window.addEventListener('historicoAtualizado', () => this.atualizar());
        window.addEventListener('estoqueAtualizado', () => this.atualizar());
        this.configurarNavegacaoCards();
    }
    
    // ===== NAVEGAÇÃO INTERATIVA =====
    
    configurarNavegacaoCards() {
        const cards = document.querySelectorAll('.resumo-card');
        cards.forEach((card, index) => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => this.navegarParaAba(index));
        });
    }
    
    navegarParaAba(indice) {
        const abas = ['aba-vendas', 'aba-estoque', 'aba-historico', 'aba-cenarios'];
        const abaDestino = abas[indice] || 'aba-vendas';
        
        // Remove classe ativa de todas as abas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Ativa a aba destino
        const abaElement = document.getElementById(abaDestino);
        if (abaElement) {
            abaElement.classList.add('active');
        }
    }
    
    // ===== ATUALIZAÇÃO PRINCIPAL =====
    
    atualizar() {
        this.atualizarCards();
        this.atualizarComparativoSemanal();
        this.atualizarTopProdutos();
        this.atualizarAlertas();
        this.atualizarGraficoFaturamento();
        this.atualizarGraficoMargemDiaria();
    }
    
    // ===== CARDS PRINCIPAIS =====
    
    atualizarCards() {
        const hoje = new Date().toLocaleDateString();
        const ontem = new Date(Date.now() - 86400000).toLocaleDateString();
        
        const vendasHoje = estado.state.historicoVendas.filter(v => v.data.includes(hoje));
        const totalVendasHoje = vendasHoje.length;
        const faturamentoHoje = vendasHoje.reduce((s, v) => s + v.total, 0);
        const lucroHoje = vendasHoje.reduce((s, v) => s + v.lucro, 0);
        const margemHoje = faturamentoHoje > 0 ? (lucroHoje / faturamentoHoje) * 100 : 0;
        
        const vendasOntem = estado.state.historicoVendas.filter(v => v.data.includes(ontem));
        const totalVendasOntem = vendasOntem.length;
        const faturamentoOntem = vendasOntem.reduce((s, v) => s + v.total, 0);
        
        const trendVendas = this.calcularTrend(totalVendasOntem, totalVendasHoje);
        const trendFaturamento = this.calcularTrend(faturamentoOntem, faturamentoHoje);
        
        const meta = (typeof window.metaConfig !== 'undefined' ? window.metaConfig.valor : 1000);
        const lucroSemana = this.calcularLucroSemana();
        const progressoMeta = meta > 0 ? Math.min((lucroSemana / meta) * 100, 100) : 0;
        
        document.getElementById('dashboardVendasHoje').innerText = totalVendasHoje;
        document.getElementById('dashboardFaturamentoHoje').innerHTML = formatarReal(faturamentoHoje);
        document.getElementById('dashboardMargemHoje').innerHTML = formatarPercentual(margemHoje);
        
        this.atualizarTrend('dashboardTrendVendas', trendVendas);
        this.atualizarTrend('dashboardTrendFaturamento', trendFaturamento);
        
        document.getElementById('dashboardMetaProgresso').innerHTML = progressoMeta.toFixed(0) + '%';
        document.getElementById('dashboardMetaFaltam').innerHTML = `Faltam ${formatarReal(Math.max(0, meta - lucroSemana))}`;
    }
    
    calcularTrend(valorOntem, valorHoje) {
        if (valorOntem === 0) return 100;
        return ((valorHoje - valorOntem) / valorOntem) * 100;
    }
    
    atualizarTrend(elementId, valor) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        const sinal = valor > 0 ? '📈 +' : '📉 ';
        el.innerHTML = `${sinal}${Math.abs(valor).toFixed(1)}% vs ontem`;
    }
    
    // ===== COMPARATIVO SEMANAL =====
    
    atualizarComparativoSemanal() {
        const semanaAtual = this.calcularDadosSemana(0);
        const semanaPassada = this.calcularDadosSemana(1);
        
        document.getElementById('dashboardSemanaAtualItens').innerText = semanaAtual.itens;
        document.getElementById('dashboardSemanaAtualLucro').innerHTML = formatarReal(semanaAtual.lucro);
        
        document.getElementById('dashboardSemanaPassadaItens').innerText = semanaPassada.itens;
        document.getElementById('dashboardSemanaPassadaLucro').innerHTML = formatarReal(semanaPassada.lucro);
        
        const variacao = semanaPassada.itens > 0 
            ? ((semanaAtual.itens - semanaPassada.itens) / semanaPassada.itens) * 100 
            : 100;
        
        const msgEl = document.getElementById('dashboardComparativoMsg');
        if (msgEl) {
            const sinal = variacao > 0 ? '▲' : '▼';
            const classe = variacao > 0 ? 'resultado-bom' : 'resultado-ruim';
            msgEl.innerHTML = `Comparado à semana passada: <span class="${classe}">${sinal} ${Math.abs(variacao).toFixed(1)}%</span>`;
        }
    }
    
    calcularDadosSemana(semanaOffset) {
        const hoje = new Date();
        const dataInicio = new Date(hoje);
        dataInicio.setDate(dataInicio.getDate() - (hoje.getDay() + 7 * semanaOffset));
        
        const dataFim = new Date(dataInicio);
        dataFim.setDate(dataFim.getDate() + 6);
        
        const vendas = estado.state.historicoVendas.filter(v => {
            const dataVenda = new Date(v.data);
            return dataVenda >= dataInicio && dataVenda <= dataFim;
        });
        
        return {
            itens: vendas.reduce((s, v) => s + v.quantidade, 0),
            lucro: vendas.reduce((s, v) => s + v.lucro, 0)
        };
    }
    
    // ===== TOP PRODUTOS =====
    
    atualizarTopProdutos() {
        const hoje = new Date().toLocaleDateString();
        const vendasHoje = estado.state.historicoVendas.filter(v => v.data.includes(hoje));
        
        const vendasPorProduto = {};
        vendasHoje.forEach(v => {
            if (!vendasPorProduto[v.produto]) {
                vendasPorProduto[v.produto] = 0;
            }
            vendasPorProduto[v.produto] += v.quantidade;
        });
        
        const top3 = Object.entries(vendasPorProduto)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        
        const container = document.getElementById('dashboardTopProdutos');
        if (!container) return;
        
        if (top3.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);">Nenhuma venda hoje</p>';
            return;
        }
        
        container.innerHTML = top3.map(([produto, qtd], i) => `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
                <span><strong>${i+1}. ${produto}</strong></span>
                <span style="color:var(--primary-color); font-weight:bold;">${qtd} uni</span>
            </div>
        `).join('');
    }
    
    // ===== ALERTAS =====
    
    atualizarAlertas() {
        const alertas = [];
        
        // Produtos com estoque baixo
        estado.state.produtos.forEach(p => {
            if (p.quantidade <= LIMIARES.estoqueMinimo) {
                alertas.push({
                    tipo: 'aviso',
                    mensagem: `⚠️ ${p.nome}: apenas ${p.quantidade} uni em estoque`
                });
            }
        });
        
        // Meta não atingida (usa fonte única window.metaConfig)
        const meta = (typeof window.metaConfig !== 'undefined' ? window.metaConfig.valor : 1000);
        const lucroSemana = this.calcularLucroSemana();
        if (lucroSemana < meta * 0.5) {
            alertas.push({
                tipo: 'erro',
                mensagem: `❌ Meta em risco: apenas ${formatarReal(lucroSemana)} de ${formatarReal(meta)}`
            });
        }
        
        const container = document.getElementById('dashboardAlertas');
        if (!container) return;
        
        if (alertas.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);">✓ Tudo certo!</p>';
            return;
        }
        
        container.innerHTML = alertas.map(a => `
            <div style="padding:12px; margin-bottom:10px; border-radius:8px; background-color:${a.tipo === 'erro' ? '#ffe6e6' : '#fff3cd'}; border-left:4px solid ${a.tipo === 'erro' ? '#dc3545' : '#ffc107'};">
                ${a.mensagem}
            </div>
        `).join('');
    }
    
    // ===== GRÁFICOS COM CHART.JS =====
    
    atualizarGraficoFaturamento() {
        const container = document.getElementById('graficoFaturamentoDiario');
        if (!container) return;
        
        const dados = this.calcularFaturamentoPorDia();
        
        if (this.graficoFaturamento) {
            this.graficoFaturamento.destroy();
        }
        
        container.innerHTML = '<canvas id="chartFaturamento"></canvas>';
        
        const ctx = document.getElementById('chartFaturamento').getContext('2d');
        
        this.graficoFaturamento = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dados.labels,
                datasets: [{
                    label: 'Faturamento (R$)',
                    data: dados.valores,
                    borderColor: 'rgba(0, 113, 227, 1)',
                    backgroundColor: 'rgba(0, 113, 227, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: 'rgba(0, 113, 227, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: 'var(--text-primary)' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: 'var(--text-secondary)' },
                        grid: { color: 'var(--border-color)' }
                    },
                    x: {
                        ticks: { color: 'var(--text-secondary)' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    atualizarGraficoMargemDiaria() {
        const container = document.getElementById('graficoMargemDiaria');
        if (!container) return;
        
        const dados = this.calcularMargemPorDia();
        
        if (this.graficoMargemDiaria) {
            this.graficoMargemDiaria.destroy();
        }
        
        container.innerHTML = '<canvas id="chartMargem"></canvas>';
        
        const ctx = document.getElementById('chartMargem').getContext('2d');
        
        this.graficoMargemDiaria = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.labels,
                datasets: [{
                    label: 'Margem de Lucro (%)',
                    data: dados.valores,
                    backgroundColor: dados.valores.map(v => v >= 30 ? 'rgba(46, 204, 113, 0.8)' : 'rgba(230, 126, 34, 0.8)'),
                    borderColor: dados.valores.map(v => v >= 30 ? 'rgba(46, 204, 113, 1)' : 'rgba(230, 126, 34, 1)'),
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, labels: { color: 'var(--text-primary)' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: 'var(--text-secondary)' },
                        grid: { color: 'var(--border-color)' }
                    },
                    x: {
                        ticks: { color: 'var(--text-secondary)' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    // ===== UTILITÁRIOS =====
    
    calcularLucroSemana() {
        const hoje = new Date();
        const semanaAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        return estado.state.historicoVendas
            .filter(v => new Date(v.data) >= semanaAtras)
            .reduce((s, v) => s + v.lucro, 0);
    }
    
    calcularFaturamentoPorDia() {
        const dias = {};
        const hoje = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const data = new Date(hoje);
            data.setDate(data.getDate() - i);
            const chave = data.toLocaleDateString();
            dias[chave] = 0;
        }
        
        estado.state.historicoVendas.forEach(v => {
            if (dias.hasOwnProperty(v.data)) {
                dias[v.data] += v.total;
            }
        });
        
        return {
            labels: Object.keys(dias),
            valores: Object.values(dias)
        };
    }
    
    calcularMargemPorDia() {
        const dias = {};
        const hoje = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const data = new Date(hoje);
            data.setDate(data.getDate() - i);
            const chave = data.toLocaleDateString();
            dias[chave] = { lucro: 0, total: 0 };
        }
        
        estado.state.historicoVendas.forEach(v => {
            if (dias.hasOwnProperty(v.data)) {
                dias[v.data].lucro += v.lucro;
                dias[v.data].total += v.total;
            }
        });
        
        return {
            labels: Object.keys(dias),
            valores: Object.values(dias).map(d => d.total > 0 ? (d.lucro / d.total) * 100 : 0)
        };
    }
}

export const dashboard = new GerenciadorDashboard();
