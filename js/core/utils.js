// ===== FUNÇÕES DE FORMATAÇÃO =====

/**
 * Formata um valor numérico para moeda brasileira (R$)
 * @param {number} valor - Valor a ser formatado
 * @returns {string} Valor formatado (ex: R$ 1.234,56)
 */
export function formatarReal(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

/**
 * Formata um valor numérico para percentual
 * @param {number} valor - Valor a ser formatado (ex: 25.5)
 * @returns {string} Valor formatado (ex: 25,5%)
 */
export function formatarPercentual(valor) {
    return valor.toFixed(1).replace('.', ',') + '%';
}

// ===== FUNÇÕES DE NOTIFICAÇÃO =====

/**
 * Mostra uma notificação temporária na tela
 * @param {string} mensagem - Mensagem a ser exibida
 * @param {string} tipo - 'sucesso' (verde) ou 'erro' (vermelho)
 */
export function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    // Remove notificações antigas se houver muitas
    const existentes = document.querySelectorAll('.notification');
    if (existentes.length >= 3) existentes[0].remove();

    const cores = {
        sucesso: '#28a745',
        erro: '#dc3545',
        info: '#17a2b8',
        aviso: '#ffc107'
    };

    const div = document.createElement('div');
    div.className = 'notification';
    div.style.background = cores[tipo] || cores.sucesso;

    // Empilha notificações verticalmente
    const offset = existentes.length * 56;
    div.style.top = `${16 + offset}px`;

    div.innerHTML = mensagem;
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s';
        setTimeout(() => div.remove(), 300);
    }, 3500);
}

// ===== FUNÇÕES DE PERFORMANCE =====

/**
 * Debounce - limita a frequência de execução de uma função
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função com debounce aplicado
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== FUNÇÕES DE VALIDAÇÃO =====

/**
 * Valida se um valor é um número positivo
 * @param {any} valor - Valor a ser validado
 * @param {number} padrao - Valor padrão caso seja inválido
 * @returns {number} Número válido
 */
export function validarNumero(valor, padrao = 0) {
    const num = parseFloat(valor);
    return isNaN(num) || num < 0 ? padrao : num;
}

/**
 * Valida se um valor é um inteiro positivo
 * @param {any} valor - Valor a ser validado
 * @param {number} padrao - Valor padrão caso seja inválido
 * @returns {number} Inteiro válido
 */
export function validarInteiro(valor, padrao = 0) {
    const num = parseInt(valor);
    return isNaN(num) || num < 0 ? padrao : num;
}

// ===== FUNÇÕES DE SANITIZAÇÃO =====

/**
 * Sanitiza string para evitar XSS
 * @param {string} texto - Texto a ser sanitizado
 * @returns {string} Texto sanitizado
 */
export function sanitizarTexto(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

/**
 * Valida intervalo de datas
 * @param {string} dataInicio - Data inicial (formato ISO)
 * @param {string} dataFim - Data final (formato ISO)
 * @returns {boolean} Se o intervalo é válido
 */
export function validarIntervaloData(dataInicio, dataFim) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    return inicio <= fim && !isNaN(inicio) && !isNaN(fim);
}

/**
 * Valida se um valor é um preço válido
 * @param {any} valor - Valor a ser validado
 * @returns {number} Preço válido ou 0
 */
export function validarPreco(valor) {
    const num = parseFloat(valor);
    return isNaN(num) || num < 0 ? 0 : parseFloat(num.toFixed(2));
}
