// ===== ARQUIVO PRINCIPAL - PONTO DE ENTRADA =====

// Imports dos módulos
import { estado } from './js/core/storage.js';
import { UI } from './js/core/uiState.js';
import { vendas } from './js/modules/vendas.js';
import { estoque } from './js/modules/estoque.js';
import { historico } from './js/modules/historico.js';
import { dashboard } from './js/modules/dashboard.js';
import { cenarios } from './js/modules/cenarios.js';
import { marketplace } from './js/services/marketplace.js';
import { mostrarNotificacao, formatarReal, formatarPercentual } from './js/core/utils.js';
import { TAXAS_ANUNCIO, CORES_CLIENTE, FRETES, LIMIARES } from './js/core/constants.js';

// ===== VARIÁVEIS DA META (fonte única para todo o sistema) =====
let metaConfig = {
    valor: 1000
};

// Carregar meta salva
const metaSalva = localStorage.getItem('metaConfig');
if (metaSalva) {
    metaConfig = JSON.parse(metaSalva);
}

// Expõe para dashboard, vendas e storage usarem o mesmo valor
window.metaConfig = metaConfig;

// ===== FUNÇÕES DA META =====
window.atualizarMetaValor = function(valor) {
    metaConfig.valor = parseFloat(valor) || 1000;
    localStorage.setItem('metaConfig', JSON.stringify(metaConfig));
    atualizarMetaNoDashboard();
    mostrarNotificacao('✅ Meta atualizada!', 'sucesso');
};

function calcularLucroSemana() {
    const semanaAtras = new Date();
    semanaAtras.setDate(semanaAtras.getDate() - 7);
    
    return estado.state.historicoVendas
        .filter(v => new Date(v.data) >= semanaAtras)
        .reduce((s, v) => s + v.lucro, 0);
}

function atualizarMetaCard() {
    const lucroSemana = calcularLucroSemana();
    const metaValor = metaConfig.valor;
    const progresso = metaValor > 0 ? (lucroSemana / metaValor) * 100 : 0;
    
    const metaCard = document.getElementById('dashboardMetaCard');
    const metaStatus = document.getElementById('dashboardMetaStatus');
    
    if (metaCard) metaCard.innerText = progresso.toFixed(0) + '%';
    if (metaStatus) {
        const falta = metaValor - lucroSemana;
        if (falta <= 0) {
            metaStatus.innerHTML = '🎯 Atingida!';
        } else {
            metaStatus.innerHTML = formatarReal(falta);
        }
    }
}

function atualizarMetaNoDashboard() {
    const lucroSemana = calcularLucroSemana();
    const metaValor = metaConfig.valor;
    
    const progresso = metaValor > 0 ? (lucroSemana / metaValor) * 100 : 0;
    const progressoFixed = Math.min(progresso, 100).toFixed(0);
    
    // Atualiza elementos do dashboard
    const metaProgresso = document.getElementById('dashboardMetaProgresso');
    const metaBar = document.getElementById('dashboardMetaBar');
    const lucroAtual = document.getElementById('dashboardLucroAtual');
    const faltaMeta = document.getElementById('dashboardFaltaMeta');
    const metaInput = document.getElementById('dashboardMetaValor');
    
    if (metaProgresso) metaProgresso.innerText = progressoFixed + '%';
    if (metaBar) metaBar.style.width = progressoFixed + '%';
    if (lucroAtual) lucroAtual.innerHTML = formatarReal(lucroSemana);
    if (metaInput) metaInput.value = metaValor;
    
    const falta = metaValor - lucroSemana;
    if (faltaMeta) {
        if (falta <= 0) {
            faltaMeta.innerHTML = '🎯 META ATINGIDA!';
        } else {
            faltaMeta.innerHTML = formatarReal(falta);
        }
    }
    
    // Atualiza também os elementos de meta na aba Vendas (mesma fonte de verdade)
    const vendasMetaPercentual = document.getElementById('vendasMetaPercentual');
    const vendasMetaFaltam = document.getElementById('vendasMetaFaltam');
    if (vendasMetaPercentual) {
        const pct = metaValor > 0 ? Math.min((lucroSemana / metaValor) * 100, 100) : 0;
        vendasMetaPercentual.innerText = pct.toFixed(0) + '%';
    }
    if (vendasMetaFaltam) vendasMetaFaltam.innerHTML = formatarReal(Math.max(0, falta));

    // Atualiza o card extra
    atualizarMetaCard();
}

// ===== FUNÇÃO PARA CONFIGURAÇÕES RECOLHÍVEIS =====
window.toggleConfig = function() {
    const panel = document.getElementById('configPanel');
    const icon = document.getElementById('configToggleIcon');
    
    if (!panel || !icon) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        icon.innerHTML = '▼';
    } else {
        panel.style.display = 'none';
        icon.innerHTML = '▶';
    }
};

window.toggleCustosAvancados = function() {
    const panel = document.getElementById('custosPanel');
    const icon = document.getElementById('custosToggleIcon');
    
    if (!panel || !icon) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        icon.innerHTML = '▼';
    } else {
        panel.style.display = 'none';
        icon.innerHTML = '▶';
    }
};

// ===== FUNÇÃO PARA RESULTADOS RECOLHÍVEIS (COM MEMÓRIA) =====
window.toggleResultados = function() {
    const panel = document.getElementById('resultadosPanel');
    const icon = document.getElementById('resultadosToggleIcon');
    
    if (!panel || !icon) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        icon.innerHTML = '▼';
        localStorage.setItem('resultadosExpandido', 'true');
    } else {
        panel.style.display = 'none';
        icon.innerHTML = '▶';
        localStorage.setItem('resultadosExpandido', 'false');
    }
};

// ===== TORNANDO FUNÇÕES GLOBAIS PARA O HTML =====

// Módulos
window.vendas = vendas;
window.estoque = estoque;
window.historico = historico;
window.dashboard = dashboard;
window.cenarios = cenarios;
window.marketplace = marketplace;
window.estado = estado;

// Utilitários
window.mostrarNotificacao = mostrarNotificacao;
window.formatarReal = formatarReal;
window.formatarPercentual = formatarPercentual;

// ===== FUNÇÕES DE ABA =====

window.mudarAba = function(aba) {
    // Remove active de todas as abas de conteúdo
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Remove active dos itens do sidebar (TailAdmin)
    document.querySelectorAll('.avv-nav-item').forEach(el => el.classList.remove('avv-nav-active'));
    
    // Ativa a aba selecionada
    const content = document.getElementById(`aba-${aba}`);
    if (content) content.classList.add('active');
    
    // Ativa o item correspondente no sidebar
    const navEl = document.getElementById(`nav-${aba}`);
    if (navEl) navEl.classList.add('avv-nav-active');
    
    // Atualiza dados quando mudar de aba (config agora é painel lateral)
    switch(aba) {
        case 'vendas':
            vendas.atualizarSelect();
            vendas.atualizarVendas();
            break;
        case 'estoque':
            estoque.atualizarTabela();
            break;
        case 'historico':
            historico.atualizarTabela();
            historico.atualizarGrafico();
            break;
        case 'dashboard':
            dashboard.atualizar();
            atualizarMetaNoDashboard();
            break;
        case 'cenarios':
            cenarios.atualizar();
            break;
    }
};

// ===== PAINEL DE CONFIGURAÇÕES (lateral) =====
window.toggleSettingsPanel = function() {
    UI.toggleSettings();
    if (UI.isSettingsOpen()) {
        atualizarConfiguracoes();
        marketplace.atualizarInterface();
    }
};

window.closeSettingsPanel = function() {
    UI.closeSettings();
};

// ===== FUNÇÕES DE TEMA =====

window.mudarTema = function(tema) {
    const valid = ['light', 'dark', 'smart', 'nature', 'ocean', 'sunset'].includes(tema) ? tema : 'dark';
    document.body.setAttribute('data-theme', valid);
    localStorage.setItem('tema', valid);
    
    const lightBtn = document.getElementById('temaLightBtn');
    const darkBtn = document.getElementById('temaDarkBtn');
    const smartBtn = document.getElementById('temaSmartBtn');
    const natureBtn = document.getElementById('temaNatureBtn');
    const oceanBtn = document.getElementById('temaOceanBtn');
    const sunsetBtn = document.getElementById('temaSunsetBtn');
    
    if (lightBtn) lightBtn.classList.remove('active');
    if (darkBtn) darkBtn.classList.remove('active');
    if (smartBtn) smartBtn.classList.remove('active');
    if (natureBtn) natureBtn.classList.remove('active');
    if (oceanBtn) oceanBtn.classList.remove('active');
    if (sunsetBtn) sunsetBtn.classList.remove('active');
    
    if (valid === 'light' && lightBtn) lightBtn.classList.add('active');
    if (valid === 'dark' && darkBtn) darkBtn.classList.add('active');
    if (valid === 'smart' && smartBtn) smartBtn.classList.add('active');
    if (valid === 'nature' && natureBtn) natureBtn.classList.add('active');
    if (valid === 'ocean' && oceanBtn) oceanBtn.classList.add('active');
    if (valid === 'sunset' && sunsetBtn) sunsetBtn.classList.add('active');
    
    const indicator = document.getElementById('temaIndicator');
    if (indicator) {
        const nomes = { light: 'Light', dark: 'Dark', smart: 'Smart', nature: 'Nature', ocean: 'Ocean', sunset: 'Sunset' };
        indicator.textContent = nomes[valid] || 'Dark';
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        const cores = { light: '#FAFAFA', dark: '#0A0A0B', smart: '#FAFAF9', nature: '#FAFAF8', ocean: '#F0F9FF', sunset: '#FFF7ED' };
        metaTheme.setAttribute('content', cores[valid] || '#0A0A0B');
    }
};

window.toggleTemaAuto = function() {
    const auto = document.getElementById('temaAuto')?.checked;
    if (auto && window.matchMedia) {
        mudarTema(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
};

// ===== FUNÇÕES DE BACKUP =====

window.fazerBackup = function() {
    estado.fazerBackup();
    atualizarConfiguracoes();
};

window.restaurarBackup = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        if (e.target.files[0]) {
            estado.restaurarBackup(e.target.files[0]).then(() => {
                setTimeout(() => location.reload(), 1500);
            });
        }
    };
    
    input.click();
};

window.toggleBackup = function(ativo) {
    estado.toggleBackup(ativo);
    atualizarConfiguracoes();
};

// ===== FUNÇÕES DE CONFIGURAÇÃO =====

function atualizarConfiguracoes() {
    const ultimoBackupEl = document.getElementById('ultimoBackup');
    if (ultimoBackupEl) {
        ultimoBackupEl.innerText = estado.state.ultimoBackup || 'Nunca';
    }
    
    const backupAtivoBtn = document.getElementById('backupAtivoBtn');
    const backupInativoBtn = document.getElementById('backupInativoBtn');
    
    if (backupAtivoBtn && backupInativoBtn) {
        if (estado.state.backupAtivo) {
            backupAtivoBtn.classList.add('active');
            backupInativoBtn.classList.remove('active');
        } else {
            backupAtivoBtn.classList.remove('active');
            backupInativoBtn.classList.add('active');
        }
    }
}

// ===== FUNÇÕES AUXILIARES =====

// Vendas
window.selecionarAnuncio = (tipo) => vendas.selecionarAnuncio(tipo);
window.adicionarLinhaVendas = () => vendas.adicionarLinha();
window.limparTodasLinhas = () => vendas.limparTodasLinhas();
window.confirmarVenda = () => vendas.confirmarVenda();
window.confirmarVendaLinha = (linha) => vendas.confirmarVendaLinha(linha);
window.carregarDadosLinha = (select) => vendas.carregarDadosLinha(select);
window.duplicarLinha = (botao) => vendas.duplicarLinha(botao);
window.removerLinha = (id) => vendas.removerLinha(id);

// Estoque
window.adicionarProdutoEstoque = () => estoque.adicionarProduto();
window.removerProdutoEstoque = (id) => estoque.removerProduto(id);
window.atualizarProduto = (id, campo, valor) => estoque.atualizarProduto(id, campo, valor);

// Histórico
window.filtrarHistorico = (tipo) => historico.atualizarTabela(tipo);
window.exportarCSV = () => historico.exportarCSV();
window.gerarPDF = () => historico.gerarPDF();
window.excluirVenda = (id) => historico.excluirVenda(id);

// Cenários
window.simularPreco = (percentual) => cenarios.simularPreco(percentual);
window.simularCusto = (percentual) => cenarios.simularCusto(percentual);
window.simularAnuncio = (tipo) => cenarios.simularAnuncio(tipo);
window.salvarCenarioAtual = () => cenarios.salvarCenarioAtual();
window.aplicarCenario = (id) => cenarios.aplicarCenario(id);
window.compararCenario = (id) => cenarios.compararCenario(id);
window.excluirCenario = (id) => cenarios.excluirCenario(id);

// Marketplace
window.conectarMarketplace = () => marketplace.conectar();
window.desconectarMarketplace = () => marketplace.desconectar();
window.salvarConfigML = () => marketplace.salvarConfig();
window.vincularProdutoMarketplace = (mlId, mlTitle) => marketplace.vincularProduto(mlId, mlTitle);
window.sincronizarProdutoMarketplace = (mlId) => marketplace.sincronizarProduto(mlId);
window.importarVendasML = () => marketplace.importarVendasML();
window.exportarProdutosParaML = () => marketplace.exportarProdutosParaML();

// ===== INICIALIZAÇÃO =====

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 AVV - Copiloto de margem iniciado');
    
    // Tema padrão: Dark Premium
    const temaSalvo = localStorage.getItem('tema') || 'dark';
    mudarTema(temaSalvo);

    // Painel de configurações: botão engrenagem
    const btnSettings = document.getElementById('avv-btn-settings');
    if (btnSettings) btnSettings.addEventListener('click', toggleSettingsPanel);

    // Fechar painel: botão X, overlay, ESC
    const btnClose = document.getElementById('avv-settings-close');
    if (btnClose) btnClose.addEventListener('click', closeSettingsPanel);
    const overlay = document.getElementById('avv-settings-overlay');
    if (overlay) overlay.addEventListener('click', closeSettingsPanel);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && UI.isSettingsOpen()) closeSettingsPanel();
    });
    
    // ===== RECUPERA ESTADO DOS RESULTADOS =====
    const resultadosExpandido = localStorage.getItem('resultadosExpandido') !== 'false';
    const panelResultados = document.getElementById('resultadosPanel');
    const iconResultados = document.getElementById('resultadosToggleIcon');
    
    if (panelResultados && iconResultados) {
        if (resultadosExpandido) {
            panelResultados.style.display = 'block';
            iconResultados.innerHTML = '▼';
        } else {
            panelResultados.style.display = 'none';
            iconResultados.innerHTML = '▶';
        }
    }
    
    // Inicializa módulos
    if (document.getElementById('vendasBody')) {
        vendas.adicionarLinha();
        vendas.adicionarLinha();
        vendas.atualizarSelect();
        vendas.atualizarVendas();
    }
    
    // Atualiza dados iniciais
    if (document.getElementById('aba-dashboard')) {
        dashboard.atualizar();
        atualizarMetaNoDashboard();
    }
    
    if (document.getElementById('aba-estoque')) {
        estoque.atualizarTabela();
    }
    
    if (document.getElementById('aba-historico')) {
        historico.atualizarTabela();
        historico.atualizarGrafico();
    }
    
    if (document.getElementById('aba-cenarios')) {
        cenarios.atualizar();
    }
    
    // Configura backup automático
    if (estado.state.backupAtivo) {
        const frequenciaSelect = document.getElementById('backupFrequencia');
        if (frequenciaSelect) {
            const dias = parseInt(frequenciaSelect.value) || 1;
            const intervalMs = dias * 24 * 60 * 60 * 1000;
            setInterval(() => estado.fazerBackup(), intervalMs);
        }
    }
    
    // Atualiza dados exibidos no painel (quando aberto)
    atualizarConfiguracoes();

    console.log('✅ AVV pronto');
});

// Hook para atualizar meta quando vendas mudarem
window.addEventListener('historicoAtualizado', () => {
    if (document.getElementById('aba-dashboard')?.classList.contains('active')) {
        atualizarMetaNoDashboard();
    }
});

// Hook para atualizar quando o dashboard estiver ativo
window.addEventListener('estoqueAtualizado', () => {
    if (document.getElementById('aba-dashboard')?.classList.contains('active')) {
        dashboard.atualizar();
        atualizarMetaNoDashboard();
    }
});