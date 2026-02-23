import { mostrarNotificacao } from './utils.js';

// ===== GERENCIAMENTO DE ESTADO =====

class GerenciadorEstado {
    constructor() {
        this.state = {
            produtos: [],
            historicoVendas: [],
            mlConfig: {},
            tipoAnuncio: 'classico',
            backupAtivo: false,
            ultimoBackup: null,
            contadorId: 4
        };
        this.carregarDoStorage();
    }
    
    // ===== INICIALIZAÇÃO =====
    
    carregarDoStorage() {
        // Carrega produtos do localStorage
        const produtosSalvos = localStorage.getItem('produtos');
        if (produtosSalvos) {
            this.state.produtos = JSON.parse(produtosSalvos);
        } else {
            this.state.produtos = this.produtosPadrao();
        }
        
        // Carrega histórico do localStorage
        const historicoSalvo = localStorage.getItem('historicoVendas');
        this.state.historicoVendas = historicoSalvo ? JSON.parse(historicoSalvo) : [];
        
        // Carrega configurações do ML
        const mlSalvo = localStorage.getItem('mlConfig');
        this.state.mlConfig = mlSalvo ? JSON.parse(mlSalvo) : {
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
        
        // Carrega configurações de backup
        this.state.backupAtivo = localStorage.getItem('backupAtivo') === 'true' || false;
        this.state.ultimoBackup = localStorage.getItem('ultimoBackup') || null;
        
        // Calcula próximo ID disponível
        const ultimoId = Math.max(...this.state.produtos.map(p => p.id), 0);
        this.state.contadorId = ultimoId + 1;
    }
    
    produtosPadrao() {
        return [
            { id: 1, nome: "Produto A", quantidade: 25, custo: 100.00, peso: 800, preco: 199.90 },
            { id: 2, nome: "Produto B", quantidade: 15, custo: 100.00, peso: 800, preco: 199.90 },
            { id: 3, nome: "Produto C", quantidade: 8, custo: 100.00, peso: 800, preco: 199.90 }
        ];
    }
    
    // ===== MÉTODOS DE SALVAMENTO =====
    
    salvarProdutos() {
        localStorage.setItem('produtos', JSON.stringify(this.state.produtos));
        // Dispara evento para outros módulos saberem que estoque mudou
        window.dispatchEvent(new CustomEvent('estoqueAtualizado'));
    }
    
    salvarHistorico() {
        localStorage.setItem('historicoVendas', JSON.stringify(this.state.historicoVendas));
        window.dispatchEvent(new CustomEvent('historicoAtualizado'));
    }
    
    salvarMLConfig() {
        localStorage.setItem('mlConfig', JSON.stringify(this.state.mlConfig));
    }
    
    // ===== GERENCIAMENTO DE IDs =====
    
    proximoId() {
        return this.state.contadorId++;
    }
    
    // ===== BACKUP =====
    
    fazerBackup() {
        const backup = {
            data: new Date().toLocaleString(),
            produtos: this.state.produtos,
            historico: this.state.historicoVendas,
            mlConfig: this.state.mlConfig,
            configuracoes: this.getConfiguracoesAtuais()
        };
        
        // Cria arquivo JSON para download
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_avv_${new Date().toISOString().slice(0,10)}.json`; // <-- ALTERADO AQUI
        a.click();
        
        // Atualiza data do último backup
        this.state.ultimoBackup = new Date().toLocaleString();
        localStorage.setItem('ultimoBackup', this.state.ultimoBackup);
        
        mostrarNotificacao('✅ Backup realizado com sucesso!', 'sucesso');
    }
    
    getConfiguracoesAtuais() {
        return {
            tipoAnuncio: this.state.tipoAnuncio,
            embalagemBase: document.getElementById('embalagemBase')?.value || 5.50,
            outrosCustos: document.getElementById('outrosCustos')?.value || 1.00,
            limiteViagem: document.getElementById('limiteViagem')?.value || 5,
            distancia: document.getElementById('distancia')?.value || 3.0,
            consumo: document.getElementById('consumo')?.value || 10.0,
            precoGasolina: document.getElementById('precoGasolina')?.value || 6.00,
            metaLucro: document.getElementById('metaLucro')?.value || 1000
        };
    }
    
    restaurarBackup(arquivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    // Restaura produtos
                    if (backup.produtos) {
                        this.state.produtos = backup.produtos;
                        this.salvarProdutos();
                    }
                    
                    // Restaura histórico
                    if (backup.historico) {
                        this.state.historicoVendas = backup.historico;
                        this.salvarHistorico();
                    }
                    
                    // Restaura configurações do ML
                    if (backup.mlConfig) {
                        this.state.mlConfig = backup.mlConfig;
                        this.salvarMLConfig();
                    }
                    
                    mostrarNotificacao('✅ Backup restaurado com sucesso!', 'sucesso');
                    resolve(backup);
                    
                } catch (error) {
                    mostrarNotificacao('❌ Erro ao restaurar backup. Arquivo inválido.', 'erro');
                    reject(error);
                }
            };
            
            reader.readAsText(arquivo);
        });
    }
    
    // ===== UTILITÁRIOS =====
    
    toggleBackup(ativo) {
        this.state.backupAtivo = ativo;
        localStorage.setItem('backupAtivo', ativo);
    }
    
    atualizarTipoAnuncio(tipo) {
        this.state.tipoAnuncio = tipo;
    }
}

// Exporta uma única instância (singleton)
export const estado = new GerenciadorEstado();