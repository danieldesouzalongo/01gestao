import { estado } from '../core/storage.js';
import { formatarReal, formatarPercentual, mostrarNotificacao, sanitizarTexto } from '../core/utils.js';

// ===== GERENCIADOR DE HISTÓRICO =====

class GerenciadorHistorico {
    constructor() {
        this.filtroAtual = 'todos';
        this.termoBusca = '';
        this.dataInicio = null;
        this.dataFim = null;
        this.graficoInstancia = null;
        this.init();
    }
    
    // ===== INICIALIZAÇÃO =====
    
    init() {
        // Escuta eventos de atualização
        window.addEventListener('historicoAtualizado', () => {
            this.atualizarTabela();
            this.atualizarGrafico();
        });
        
        // Configura event listeners para filtros
        this.configurarEventListeners();
    }
    
    configurarEventListeners() {
        // Busca por texto
        const inputBusca = document.getElementById('historicoSearchInput');
        if (inputBusca) {
            inputBusca.addEventListener('input', (e) => {
                this.termoBusca = e.target.value.toLowerCase();
                this.atualizarTabela();
            });
        }
        
        // Filtro de data inicial
        const inputDataInicio = document.getElementById('historicoDataInicio');
        if (inputDataInicio) {
            inputDataInicio.addEventListener('change', (e) => {
                this.dataInicio = e.target.value;
                this.atualizarTabela();
            });
        }
        
        // Filtro de data final
        const inputDataFim = document.getElementById('historicoDataFim');
        if (inputDataFim) {
            inputDataFim.addEventListener('change', (e) => {
                this.dataFim = e.target.value;
                this.atualizarTabela();
            });
        }
    }
    
    // ===== TABELA DE HISTÓRICO =====
    
    atualizarTabela(filtro = this.filtroAtual) {
        this.filtroAtual = filtro;
        
        const tbody = document.getElementById('historicoBody');
        if (!tbody) return;
        
        // Filtra os dados
        const dados = this.filtrarDados();
        
        // Renderiza tabela
        tbody.innerHTML = this.renderTabela(dados);
        
        // Atualiza resumo
        this.atualizarResumo(dados);
    }
    
    filtrarDados() {
        let dados = [...estado.state.historicoVendas];
        const hoje = new Date().toLocaleDateString();
        
        // Filtro por período
        switch(this.filtroAtual) {
            case 'hoje':
                dados = dados.filter(v => v.data.includes(hoje));
                break;
                
            case 'semana': {
                const semanaAtras = new Date();
                semanaAtras.setDate(semanaAtras.getDate() - 7);
                dados = dados.filter(v => new Date(v.data) >= semanaAtras);
                break;
            }
                
            case 'mes': {
                const mesAtras = new Date();
                mesAtras.setMonth(mesAtras.getMonth() - 1);
                dados = dados.filter(v => new Date(v.data) >= mesAtras);
                break;
            }
        }
        
        // Filtro por intervalo de datas customizado
        if (this.dataInicio) {
            const inicio = new Date(this.dataInicio);
            dados = dados.filter(v => new Date(v.data) >= inicio);
        }
        
        if (this.dataFim) {
            const fim = new Date(this.dataFim);
            fim.setHours(23, 59, 59, 999); // Inclui o dia inteiro
            dados = dados.filter(v => new Date(v.data) <= fim);
        }
        
        // Filtro por termo de busca
        if (this.termoBusca) {
            dados = dados.filter(v => 
                v.cliente.toLowerCase().includes(this.termoBusca) ||
                v.produto.toLowerCase().includes(this.termoBusca)
            );
        }
        
        // Ordena do mais recente para o mais antigo
        return dados.sort((a, b) => new Date(b.data) - new Date(a.data));
    }
    
    renderTabela(dados) {
        if (dados.length === 0) {
            return '<tr><td colspan="8" style="text-align:center; padding:20px;">Nenhuma venda encontrada</td></tr>';
        }
        
        return dados.map(v => `
            <tr>
                <td>${v.data}</td>
                <td>${sanitizarTexto(v.cliente)}</td>
                <td>${sanitizarTexto(v.produto)}</td>
                <td>${v.quantidade}</td>
                <td>${formatarReal(v.precoUnitario)}</td>
                <td>${formatarReal(v.total)}</td>
                <td>${formatarReal(v.lucro)}</td>
                <td>
                    <button class="btn-excluir" onclick="historico.excluirVenda(${v.id})">
                        🗑️ Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    // ===== RESUMO DO HISTÓRICO =====
    
    atualizarResumo(dados) {
        const totalVendas = dados.length;
        const totalItens = dados.reduce((s, v) => s + v.quantidade, 0);
        const faturamento = dados.reduce((s, v) => s + v.total, 0);
        const lucro = dados.reduce((s, v) => s + v.lucro, 0);
        const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;
        
        document.getElementById('totalVendasHist').innerText = totalVendas;
        document.getElementById('totalItensHist').innerText = totalItens;
        document.getElementById('faturamentoHist').innerHTML = formatarReal(faturamento);
        document.getElementById('lucroHist').innerHTML = formatarReal(lucro);
        document.getElementById('margemHist').innerHTML = formatarPercentual(margem);
    }
    
    // ===== GRÁFICO COM CHART.JS =====
    
    atualizarGrafico() {
        const container = document.getElementById('graficoMaisVendidos');
        if (!container) return;
        
        const dados = this.filtrarDados();
        
        // Agrupa por produto
        const vendasPorProduto = {};
        dados.forEach(v => {
            if (!vendasPorProduto[v.produto]) {
                vendasPorProduto[v.produto] = 0;
            }
            vendasPorProduto[v.produto] += v.quantidade;
        });
        
        // Ordena e pega top 5
        const top5 = Object.entries(vendasPorProduto)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        this.renderGraficoChart(top5);
    }
    
    renderGraficoChart(top5) {
        const container = document.getElementById('graficoMaisVendidos');
        
        if (top5.length === 0) {
            container.innerHTML = '<p style="color:var(--text-primary); text-align:center;">Nenhuma venda no período</p>';
            return;
        }
        
        // Remove gráfico anterior se existir
        if (this.graficoInstancia) {
            try {
                this.graficoInstancia.destroy();
            } catch (e) {
                console.log('Gráfico anterior já destruído');
            }
        }
        
        // Cria canvas para o gráfico
        container.innerHTML = '<canvas id="chartMaisVendidos"></canvas>';
        
        const ctx = document.getElementById('chartMaisVendidos').getContext('2d');
        
        const labels = top5.map(([produto]) => produto);
        const valores = top5.map(([, qtd]) => qtd);
        
        // Cores gradientes
        const cores = [
            'rgba(0, 113, 227, 0.8)',
            'rgba(52, 152, 219, 0.8)',
            'rgba(46, 204, 113, 0.8)',
            'rgba(241, 196, 15, 0.8)',
            'rgba(230, 126, 34, 0.8)'
        ];
        
        this.graficoInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: valores,
                    backgroundColor: cores.slice(0, valores.length),
                    borderColor: cores.slice(0, valores.length).map(c => c.replace('0.8', '1')),
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: 'var(--text-primary)',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'var(--text-secondary)',
                            stepSize: 1
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'var(--text-secondary)'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // ===== CRUD DE VENDAS =====
    
    excluirVenda(id) {
        if (!confirm('Tem certeza que deseja excluir esta venda? O estoque será devolvido.')) return;
        
        const venda = estado.state.historicoVendas.find(v => v.id === id);
        if (!venda) return;
        
        // Devolve ao estoque
        const produto = estado.state.produtos.find(p => p.nome === venda.produto);
        if (produto) {
            produto.quantidade += venda.quantidade;
            estado.salvarProdutos();
        }
        
        // Remove do histórico
        estado.state.historicoVendas = estado.state.historicoVendas.filter(v => v.id !== id);
        estado.salvarHistorico();
        
        // Atualiza interface
        this.atualizarTabela();
        
        mostrarNotificacao('🗑️ Venda excluída!', 'sucesso');
    }
    
    // ===== FILTROS =====
    
    filtrarHoje() {
        this.atualizarTabela('hoje');
    }
    
    filtrarSemana() {
        this.atualizarTabela('semana');
    }
    
    filtrarMes() {
        this.atualizarTabela('mes');
    }
    
    filtrarTodos() {
        this.atualizarTabela('todos');
    }
    
    // ===== EXPORTAÇÃO =====
    
    exportarCSV() {
        const dados = this.filtrarDados();
        
        if (dados.length === 0) {
            alert('Nenhum dado para exportar');
            return;
        }
        
        // Cabeçalho do CSV
        let csv = "Data,Cliente,Produto,Quantidade,Preço Unit.,Total,Lucro,Margem\n";
        
        // Linhas de dados
        dados.forEach(v => {
            csv += `"${v.data}","${v.cliente}","${v.produto}",${v.quantidade},${v.precoUnitario},${v.total},${v.lucro},${v.margem}\n`;
        });
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `historico_vendas_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        
        mostrarNotificacao('📥 CSV exportado!', 'sucesso');
    }
    
    // ===== PDF =====
    
    async gerarPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const dados = this.filtrarDados();
        const resumo = this.calcularResumo(dados);
        
        // Cabeçalho
        doc.setFillColor(0, 102, 204);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('AVV - Relatório de Vendas', 15, 20); // <-- ALTERADO AQUI
        
        // Período
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Período: ${this.getNomeFiltro()}`, 15, 40);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 15, 48);
        
        // Resumo
        doc.setFontSize(14);
        doc.text('📊 RESUMO DO PERÍODO', 15, 65);
        doc.setFontSize(12);
        doc.text(`Total de vendas: ${resumo.totalVendas}`, 20, 80);
        doc.text(`Itens vendidos: ${resumo.totalItens}`, 20, 90);
        doc.text(`Faturamento: ${formatarReal(resumo.faturamento)}`, 20, 100);
        doc.text(`Lucro total: ${formatarReal(resumo.lucro)}`, 20, 110);
        doc.text(`Margem média: ${formatarPercentual(resumo.margem)}`, 20, 120);
        
        // Top produtos
        const topProdutos = this.calcularTopProdutos(dados);
        
        doc.setFontSize(14);
        doc.text('🏆 TOP 5 PRODUTOS', 15, 140);
        doc.setFontSize(12);
        
        let y = 155;
        topProdutos.forEach(([produto, qtd], i) => {
            doc.text(`${i+1}. ${produto}: ${qtd} unidades`, 20, y);
            y += 10;
        });
        
        doc.save(`relatorio_avv_${new Date().toISOString().slice(0,10)}.pdf`); // <-- ALTERADO AQUI
        mostrarNotificacao('📄 PDF gerado!', 'sucesso');
    }
    
    // ===== UTILITÁRIOS =====
    
    getNomeFiltro() {
        const nomes = {
            'hoje': 'Hoje',
            'semana': 'Últimos 7 dias',
            'mes': 'Últimos 30 dias',
            'todos': 'Todo histórico'
        };
        return nomes[this.filtroAtual] || 'Todo histórico';
    }
    
    calcularResumo(dados) {
        return {
            totalVendas: dados.length,
            totalItens: dados.reduce((s, v) => s + v.quantidade, 0),
            faturamento: dados.reduce((s, v) => s + v.total, 0),
            lucro: dados.reduce((s, v) => s + v.lucro, 0),
            margem: dados.reduce((s, v) => s + v.total, 0) > 0 
                ? (dados.reduce((s, v) => s + v.lucro, 0) / dados.reduce((s, v) => s + v.total, 0)) * 100 
                : 0
        };
    }
    
    calcularTopProdutos(dados, limite = 5) {
        const vendasPorProduto = {};
        dados.forEach(v => {
            if (!vendasPorProduto[v.produto]) vendasPorProduto[v.produto] = 0;
            vendasPorProduto[v.produto] += v.quantidade;
        });
        
        return Object.entries(vendasPorProduto)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limite);
    }
}

// Exporta uma única instância
export const historico = new GerenciadorHistorico();