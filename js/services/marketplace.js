import { estado } from '../core/storage.js';
import { mostrarNotificacao } from '../core/utils.js';

// ===== GERENCIADOR DE MARKETPLACE =====

class GerenciadorMarketplace {
    constructor() {
        this.init();
    }
    
    // ===== INICIALIZAÇÃO =====
    
    init() {
        // Escuta eventos de estoque
        window.addEventListener('estoqueAtualizado', () => {
            if (estado.state.mlConfig.connected && estado.state.mlConfig.syncEstoque) {
                this.sincronizarEstoque();
            }
        });
    }
    
    // ===== CONEXÃO =====
    
    conectar() {
        const nickname = prompt('Digite seu nome de usuário do marketplace (para simulação):');
        if (!nickname) return;
        
        estado.state.mlConfig = {
            ...estado.state.mlConfig,
            connected: true,
            userNickname: nickname,
            userId: 'user_' + Date.now(),
            ultimaSync: new Date().toLocaleString()
        };
        
        estado.salvarMLConfig();
        this.atualizarInterface();
        
        mostrarNotificacao('✅ Conectado ao marketplace (modo simulação)!', 'sucesso');
        
        // Simula busca de produtos do ML
        this.buscarProdutosML();
    }
    
    desconectar() {
        if (!confirm('Tem certeza que deseja desconectar do marketplace?')) return;
        
        estado.state.mlConfig = {
            connected: false,
            userId: null,
            userNickname: null,
            syncVendas: true,
            syncEstoque: true,
            syncPrecos: false,
            ultimaSync: null,
            produtosVinculados: [],
            vendasHoje: 0
        };
        
        estado.salvarMLConfig();
        this.atualizarInterface();
        
        mostrarNotificacao('🔓 Desconectado do marketplace', 'sucesso');
    }
    
    // ===== CONFIGURAÇÕES =====
    
    salvarConfig() {
        const syncVendas = document.getElementById('mlSyncVendas')?.checked ?? true;
        const syncEstoque = document.getElementById('mlSyncEstoque')?.checked ?? true;
        
        estado.state.mlConfig.syncVendas = syncVendas;
        estado.state.mlConfig.syncEstoque = syncEstoque;
        
        estado.salvarMLConfig();
        mostrarNotificacao('⚙️ Configurações salvas!', 'sucesso');
    }
    
    // ===== INTERFACE =====
    
    atualizarInterface() {
        const connectBtn = document.getElementById('mlConnectBtn');
        const disconnectBtn = document.getElementById('mlDisconnectBtn');
        const configSection = document.getElementById('mlConfigSection');
        const statusBadge = document.getElementById('mlStatusBadge');
        const statusDesc = document.getElementById('mlStatusDesc');
        
        if (!connectBtn) return;
        
        if (estado.state.mlConfig.connected) {
            // Modo conectado
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-flex';
            configSection.style.display = 'block';
            
            statusBadge.className = 'ml-status-badge ml-badge-connected';
            statusBadge.innerHTML = '✅ Conectado';
            statusDesc.innerHTML = `Conectado como ${estado.state.mlConfig.userNickname || 'usuário'}`;
            
            // Atualiza estatísticas
            this.atualizarEstatisticas();
            
            // Configura checkboxes
            document.getElementById('mlSyncVendas').checked = estado.state.mlConfig.syncVendas;
            document.getElementById('mlSyncEstoque').checked = estado.state.mlConfig.syncEstoque;
            
        } else {
            // Modo desconectado
            connectBtn.style.display = 'inline-flex';
            disconnectBtn.style.display = 'none';
            configSection.style.display = 'none';
            
            statusBadge.className = 'ml-status-badge ml-badge-disconnected';
            statusBadge.innerHTML = '❌ Desconectado';
            statusDesc.innerHTML = 'Desconectado do marketplace';
        }
    }
    
    atualizarEstatisticas() {
        document.getElementById('mlUltimaSync').innerHTML = estado.state.mlConfig.ultimaSync || '--';
        
        const produtosVinculados = estado.state.produtos.filter(p => p.mlId).length;
        document.getElementById('mlProdutosVinculados').innerHTML = produtosVinculados;
    }
    
    // ===== PRODUTOS SIMULADOS DO MARKETPLACE =====
    
    buscarProdutosML() {
        const tbody = document.getElementById('mlProductsBody');
        if (!tbody) return;
        
        // Produtos simulados do marketplace
        const mlProdutos = [
            { id: 'MLB123456789', title: 'Produto A - 500g', price: 199.90, quantity: 25 },
            { id: 'MLB123456790', title: 'Produto B - 1kg', price: 299.90, quantity: 15 },
            { id: 'MLB123456791', title: 'Produto C - 2kg', price: 399.90, quantity: 8 },
            { id: 'MLB123456792', title: 'Produto D - Premium', price: 499.90, quantity: 3 },
            { id: 'MLB123456793', title: 'Produto E - Básico', price: 99.90, quantity: 50 }
        ];
        
        let html = '';
        
        mlProdutos.forEach(item => {
            const produtoVinculado = estado.state.produtos.find(p => p.mlId === item.id);
            
            const statusClass = produtoVinculado ? 'ml-status-ok' : 'ml-status-pending';
            const statusText = produtoVinculado ? 'Vinculado' : 'Não vinculado';
            const nomeVinculado = produtoVinculado ? produtoVinculado.nome : '---';
            
            html += `<tr>
                <td>${nomeVinculado}</td>
                <td>${item.id}</td>
                <td>${item.quantity}</td>
                <td><span class="ml-sync-status ${statusClass}">${statusText}</span></td>
                <td>
                    ${!produtoVinculado 
                        ? `<button class="btn-duplicar" onclick="marketplace.vincularProduto('${item.id}', '${item.title}')">🔗 Vincular</button>`
                        : `<button class="btn-secondary" onclick="marketplace.sincronizarProduto('${item.id}')">🔄 Sinc.</button>
                           <button class="btn-danger" onclick="marketplace.desvincularProduto('${item.id}')" style="margin-left:5px;">✕</button>`
                    }
                </td>
            </tr>`;
        });
        
        tbody.innerHTML = html;
    }
    
    // ===== VINCULAÇÃO DE PRODUTOS =====
    
    vincularProduto(mlId, mlTitle) {
        // Tenta encontrar produto com nome similar
        let produto = estado.state.produtos.find(p => 
            mlTitle.toLowerCase().includes(p.nome.toLowerCase())
        );
        
        if (!produto) {
            // Mostra lista para escolher
            const options = estado.state.produtos.map((p, i) => `${i + 1}. ${p.nome}`).join('\n');
            const escolha = prompt(
                `Escolha o produto para vincular com "${mlTitle}":\n\n${options}\n\nDigite o número:`
            );
            
            if (escolha) {
                const idx = parseInt(escolha) - 1;
                if (idx >= 0 && idx < estado.state.produtos.length) {
                    produto = estado.state.produtos[idx];
                }
            }
        }
        
        if (produto) {
            produto.mlId = mlId;
            produto.mlTitle = mlTitle;
            estado.salvarProdutos();
            
            this.buscarProdutosML();
            this.atualizarEstatisticas();
            
            mostrarNotificacao(`✅ Produto "${produto.nome}" vinculado!`, 'sucesso');
        }
    }
    
    desvincularProduto(mlId) {
        if (!confirm('Desvincular este produto do marketplace?')) return;
        
        const produto = estado.state.produtos.find(p => p.mlId === mlId);
        if (produto) {
            delete produto.mlId;
            delete produto.mlTitle;
            estado.salvarProdutos();
            
            this.buscarProdutosML();
            this.atualizarEstatisticas();
            
            mostrarNotificacao('🔓 Produto desvinculado', 'sucesso');
        }
    }
    
    // ===== SINCRONIZAÇÃO =====
    
    sincronizarProduto(mlId) {
        const produto = estado.state.produtos.find(p => p.mlId === mlId);
        if (!produto) return;
        
        // Simula sincronização
        estado.state.mlConfig.ultimaSync = new Date().toLocaleString();
        estado.salvarMLConfig();
        
        this.atualizarEstatisticas();
        mostrarNotificacao(`🔄 Produto "${produto.nome}" sincronizado!`, 'sucesso');
    }
    
    sincronizarEstoque() {
        const produtosVinculados = estado.state.produtos.filter(p => p.mlId);
        
        if (produtosVinculados.length === 0) return;
        
        // Simula sincronização em lote
        estado.state.mlConfig.ultimaSync = new Date().toLocaleString();
        estado.salvarMLConfig();
        
        this.atualizarEstatisticas();
        
        // Mostra notificação apenas se não for silenciosa
        if (document.visibilityState === 'visible') {
            mostrarNotificacao(`🔄 Estoque sincronizado (${produtosVinculados.length} produtos)`, 'sucesso');
        }
    }
    
    // ===== IMPORTAÇÃO DE VENDAS (SIMULADA) =====
    
    importarVendasML() {
        if (!estado.state.mlConfig.connected || !estado.state.mlConfig.syncVendas) {
            mostrarNotificacao('❌ Sincronização de vendas desativada', 'erro');
            return;
        }
        
        // Simula vendas do marketplace
        const vendasML = this.gerarVendasSimuladas();
        
        if (vendasML.length === 0) {
            mostrarNotificacao('📭 Nenhuma venda nova encontrada', 'sucesso');
            return;
        }
        
        // Adiciona ao histórico
        vendasML.forEach(venda => {
            estado.state.historicoVendas.push(venda);
        });
        
        estado.salvarHistorico();
        estado.state.mlConfig.ultimaSync = new Date().toLocaleString();
        estado.salvarMLConfig();
        
        this.atualizarEstatisticas();
        mostrarNotificacao(`📥 ${vendasML.length} venda(s) importada(s)!`, 'sucesso');
    }
    
    gerarVendasSimuladas() {
        // Gera 1-3 vendas aleatórias
        const numVendas = Math.floor(Math.random() * 3) + 1;
        const vendas = [];
        
        const produtosVinculados = estado.state.produtos.filter(p => p.mlId);
        
        if (produtosVinculados.length === 0) return [];
        
        for (let i = 0; i < numVendas; i++) {
            const produto = produtosVinculados[Math.floor(Math.random() * produtosVinculados.length)];
            const quantidade = Math.floor(Math.random() * 3) + 1;
            
            vendas.push({
                id: Date.now() + i,
                data: new Date().toLocaleString(),
                cliente: `ML_Cliente_${Math.floor(Math.random() * 1000)}`,
                produto: produto.nome,
                quantidade: quantidade,
                precoUnitario: produto.preco,
                custoUnitario: produto.custo,
                total: produto.preco * quantidade,
                lucro: (produto.preco - produto.custo) * quantidade,
                margem: ((produto.preco - produto.custo) / produto.preco) * 100,
                origem: 'marketplace'
            });
        }
        
        return vendas;
    }
    
    // ===== EXPORTAÇÃO DE PRODUTOS =====
    
    exportarProdutosParaML() {
        if (!estado.state.mlConfig.connected) {
            mostrarNotificacao('❌ Conecte-se ao marketplace primeiro', 'erro');
            return;
        }
        
        const produtosNaoVinculados = estado.state.produtos.filter(p => !p.mlId);
        
        if (produtosNaoVinculados.length === 0) {
            mostrarNotificacao('📦 Todos os produtos já estão vinculados', 'sucesso');
            return;
        }
        
        // Simula exportação
        produtosNaoVinculados.forEach(produto => {
            produto.mlId = `MLB${Date.now()}${produto.id}`;
            produto.mlTitle = produto.nome;
        });
        
        estado.salvarProdutos();
        this.buscarProdutosML();
        this.atualizarEstatisticas();
        
        mostrarNotificacao(`📤 ${produtosNaoVinculados.length} produto(s) exportados!`, 'sucesso');
    }
    
    // ===== DASHBOARD DO ML =====
    
    getVendasHoje() {
        const hoje = new Date().toLocaleDateString();
        return estado.state.historicoVendas.filter(v => 
            v.origem === 'marketplace' && v.data.includes(hoje)
        ).length;
    }
    
    getFaturamentoML() {
        return estado.state.historicoVendas
            .filter(v => v.origem === 'marketplace')
            .reduce((s, v) => s + v.total, 0);
    }
}

// Exporta uma única instância
export const marketplace = new GerenciadorMarketplace();

// ===== FUNÇÕES GLOBAIS PARA BOTÕES DO HTML =====

window.conectarMarketplace = () => marketplace.conectar();
window.desconectarMarketplace = () => marketplace.desconectar();
window.salvarConfigML = () => marketplace.salvarConfig();
window.vincularProdutoMarketplace = (mlId, mlTitle) => marketplace.vincularProduto(mlId, mlTitle);
window.sincronizarProdutoMarketplace = (mlId) => marketplace.sincronizarProduto(mlId);
window.importarVendasML = () => marketplace.importarVendasML();
window.exportarProdutosParaML = () => marketplace.exportarProdutosParaML();