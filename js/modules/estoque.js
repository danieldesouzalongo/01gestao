import { estado } from '../core/storage.js';
import { mostrarNotificacao, validarNumero, validarInteiro } from '../core/utils.js';
import { LIMIARES } from '../core/constants.js';

// ===== GERENCIADOR DE ESTOQUE =====

class GerenciadorEstoque {
    constructor() {
        this.init();
    }
    
    // ===== INICIALIZAÇÃO =====
    
    init() {
        // Escuta eventos de atualização
        window.addEventListener('estoqueAtualizado', () => {
            this.atualizarTabela();
        });
    }
    
    // ===== TABELA DE ESTOQUE =====
    
    atualizarTabela() {
        const tbody = document.getElementById('estoqueBody');
        if (!tbody) return;
        
        let html = '';
        
        estado.state.produtos.forEach(p => {
            html += this.getTemplateLinha(p);
        });
        
        tbody.innerHTML = html;
        
        // Atualiza alertas de estoque
        this.atualizarAlertas();
    }
    
    getTemplateLinha(produto) {
        return `<tr>
            <td><input type="text" value="${produto.nome}" 
                onchange="estoque.atualizarProduto(${produto.id}, 'nome', this.value)" 
                style="width:100%; padding:5px;"></td>
            <td><input type="number" value="${produto.quantidade}" 
                onchange="estoque.atualizarProduto(${produto.id}, 'quantidade', this.value)" 
                style="width:80px; padding:5px;" min="0"></td>
            <td><input type="number" value="${produto.custo}" step="0.01" 
                onchange="estoque.atualizarProduto(${produto.id}, 'custo', this.value)" 
                style="width:100px; padding:5px;" min="0"></td>
            <td><input type="number" value="${produto.peso}" 
                onchange="estoque.atualizarProduto(${produto.id}, 'peso', this.value)" 
                style="width:80px; padding:5px;" min="0"></td>
            <td><input type="number" value="${produto.preco}" step="0.01" 
                onchange="estoque.atualizarProduto(${produto.id}, 'preco', this.value)" 
                style="width:100px; padding:5px;" min="0"></td>
            <td>
                <button class="btn-danger" onclick="estoque.removerProduto(${produto.id})">
                    🗑️ Remover
                </button>
            </td>
        </tr>`;
    }
    
    // ===== CRUD DE PRODUTOS =====
    
    atualizarProduto(id, campo, valor) {
        const produto = estado.state.produtos.find(p => p.id === id);
        if (!produto) return;
        
        // Valida conforme o tipo de campo
        switch(campo) {
            case 'nome':
                produto.nome = valor || 'Sem nome';
                break;
            case 'quantidade':
                produto.quantidade = validarInteiro(valor, 0);
                break;
            case 'custo':
            case 'preco':
                produto[campo] = validarNumero(valor, 0);
                break;
            case 'peso':
                produto.peso = validarInteiro(valor, 0);
                break;
        }
        
        // Salva no storage
        estado.salvarProdutos();
        
        // Atualiza select de vendas se existir
        this.atualizarSelectVendas();
        
        mostrarNotificacao('✅ Produto atualizado!', 'sucesso');
    }
    
    adicionarProduto() {
        const novoProduto = {
            id: estado.proximoId(),
            nome: `Novo Produto ${estado.state.contadorId - 1}`,
            quantidade: 10,
            custo: 100.00,
            peso: 800,
            preco: 199.90
        };
        
        estado.state.produtos.push(novoProduto);
        estado.salvarProdutos();
        
        this.atualizarTabela();
        this.atualizarSelectVendas();
        
        mostrarNotificacao('✅ Produto adicionado!', 'sucesso');
    }
    
    removerProduto(id) {
        if (!confirm('Tem certeza que deseja remover este produto?')) return;
        
        estado.state.produtos = estado.state.produtos.filter(p => p.id !== id);
        estado.salvarProdutos();
        
        this.atualizarTabela();
        this.atualizarSelectVendas();
        
        mostrarNotificacao('🗑️ Produto removido!', 'sucesso');
    }
    
    // ===== UTILITÁRIOS =====
    
    atualizarSelectVendas() {
        // Atualiza o select na aba de vendas
        const selectVenda = document.getElementById('vendaProdutoSelect');
        if (selectVenda) {
            selectVenda.innerHTML = estado.state.produtos.map(p => 
                `<option value="${p.id}" data-custo="${p.custo}" data-peso="${p.peso}" data-preco="${p.preco}">
                    ${p.nome} (${p.quantidade} uni)
                </option>`
            ).join('');
        }
        
        // Atualiza os selects nas linhas da calculadora
        document.querySelectorAll('#vendasBody .produto-select').forEach(select => {
            const valorAtual = select.value;
            select.innerHTML = this.getOptionsProdutos();
            if (valorAtual) select.value = valorAtual;
        });
    }
    
    getOptionsProdutos() {
        return '<option value="">Selecione</option>' + 
            estado.state.produtos.map(p => 
                `<option value="${p.id}" data-custo="${p.custo}" data-peso="${p.peso}" data-preco="${p.preco}">
                    ${p.nome}
                </option>`
            ).join('');
    }
    
    // ===== ALERTAS =====
    
    atualizarAlertas() {
        const container = document.getElementById('alertasEstoque');
        if (!container) return;
        
        const produtosCriticos = estado.state.produtos.filter(p => p.quantidade < LIMIARES.ESTOQUE_CRITICO);
        
        if (produtosCriticos.length === 0) {
            container.innerHTML = `
                <div class="alerta-ok" style="background:#d4edda; border-left:4px solid #28a745; padding:10px;">
                    ✅ Todos os produtos com estoque OK
                </div>
            `;
            return;
        }
        
        const alertas = produtosCriticos.map(p => `
            <div class="alerta-urgente" style="background:#f8d7da; border-left:4px solid #dc3545; padding:10px; margin:5px 0;">
                🔴 <strong>${p.nome}:</strong> apenas ${p.quantidade} unidades em estoque!
            </div>
        `).join('');
        
        container.innerHTML = alertas;
    }
    
    // ===== MÉTODOS PÚBLICOS =====
    
    getProdutoPorId(id) {
        return estado.state.produtos.find(p => p.id === id);
    }
    
    getProdutosEstoqueBaixo(limiar = LIMIARES.ESTOQUE_CRITICO) {
        return estado.state.produtos.filter(p => p.quantidade < limiar);
    }
    
    getValorTotalEstoque() {
        return estado.state.produtos.reduce((total, p) => total + (p.custo * p.quantidade), 0);
    }
    
    getQuantidadeTotalItens() {
        return estado.state.produtos.reduce((total, p) => total + p.quantidade, 0);
    }
}

// Exporta uma única instância
export const estoque = new GerenciadorEstoque();