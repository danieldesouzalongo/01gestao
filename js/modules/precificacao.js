import { vendas } from './vendas.js';
import { formatarReal, formatarPercentual, debounce, validarPercentual } from '../core/utils.js';

class GerenciadorPrecificacao {
    constructor() {
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.configurarListeners());
        } else {
            this.configurarListeners();
        }

        window.addEventListener('vendasAtualizadas', () => this.atualizar());
    }

    configurarListeners() {
        const margemInput = document.getElementById('precMargemDesejada');
        const concorrenciaInput = document.getElementById('precPrecoConcorrencia');

        if (margemInput) {
            margemInput.addEventListener('input', debounce(() => this.atualizar(), 200));
            margemInput.addEventListener('change', () => this.atualizar());
        }
        if (concorrenciaInput) {
            concorrenciaInput.addEventListener('input', debounce(() => this.atualizar(), 200));
            concorrenciaInput.addEventListener('change', () => this.atualizar());
        }

        this.atualizar();
    }

    atualizar() {
        const margemInput = document.getElementById('precMargemDesejada');
        const concorrenciaInput = document.getElementById('precPrecoConcorrencia');
        const precoSugeridoEl = document.getElementById('precPrecoSugerido');
        const margemResultEl = document.getElementById('precMargemResult');
        const comparacaoEl = document.getElementById('precComparacaoConcorrencia');

        if (!margemInput || !precoSugeridoEl || !margemResultEl || !comparacaoEl) return;

        const margemDesejada = validarPercentual(margemInput.value, 0);
        const precoConcorrencia = parseFloat(concorrenciaInput?.value || '0') || 0;

        const resultado = vendas.calcularTotais();
        if (!resultado || resultado.totalItens === 0 || resultado.somaPrecos === 0) {
            precoSugeridoEl.innerHTML = '—';
            margemResultEl.innerHTML = '—';
            comparacaoEl.innerHTML = 'Adicione produtos na aba Vendas para simular.';
            return;
        }

        const totalItens = Math.max(resultado.totalItens, 1);
        const embalagemPorItem = resultado.somaEmbalagem / totalItens;
        const custoOpPorItem = resultado.custosOperacionaisTotais / totalItens;

        const custoBasePorItem = resultado.custoMedio
            + resultado.freteMedio
            + resultado.deslocamentoMedio
            + embalagemPorItem
            + custoOpPorItem;

        const taxaAnuncio = resultado.somaPrecos > 0 ? (resultado.comissaoTotal / resultado.somaPrecos) : 0;
        const m = margemDesejada / 100;
        const denominador = (1 - taxaAnuncio) - m;

        if (denominador <= 0 || custoBasePorItem <= 0) {
            precoSugeridoEl.innerHTML = '—';
            margemResultEl.innerHTML = 'Margem desejada muito alta para os custos atuais.';
            comparacaoEl.innerHTML = '';
            return;
        }

        const precoSugerido = custoBasePorItem / denominador;
        const lucroUnit = precoSugerido * (1 - taxaAnuncio) - custoBasePorItem;
        const margemReal = precoSugerido > 0 ? (lucroUnit / precoSugerido) * 100 : 0;

        precoSugeridoEl.innerHTML = formatarReal(precoSugerido);
        margemResultEl.innerHTML = formatarPercentual(margemReal);

        if (precoConcorrencia > 0) {
            const diffAbs = precoSugerido - precoConcorrencia;
            const diffPct = (diffAbs / precoConcorrencia) * 100;
            let texto = '';
            if (Math.abs(diffPct) < 3) {
                texto = 'Na faixa da concorrência (diferença &lt; 3%).';
            } else if (diffPct < 0) {
                texto = `Abaixo da concorrência (~${diffPct.toFixed(1)}%).`;
            } else {
                texto = `Acima da concorrência (~+${diffPct.toFixed(1)}%). Considere ajustar margem ou custos.`;
            }
            comparacaoEl.innerHTML = texto;
        } else {
            comparacaoEl.innerHTML = 'Informe o preço da concorrência para comparação.';
        }
    }
}

export const precificacao = new GerenciadorPrecificacao();

