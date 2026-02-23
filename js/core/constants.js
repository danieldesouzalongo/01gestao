// ===== CONSTANTES GLOBAIS =====
// Cores para identificar clientes na tabela
export const CORES_CLIENTE = ['#fff4e6', '#e6f7ff', '#f0f0f0', '#fff0f0', '#f0fff0', '#f0f0ff'];

// Taxas de comissão por tipo de anúncio
export const TAXAS_ANUNCIO = {
    classico: 0.14,  // 14%
    premium: 0.19    // 19%
};

// Tabela de fretes por peso (gramas)
export const FRETES = {
    300: 11.97,   // até 300g
    500: 12.87,   // até 500g
    1000: 13.47,  // até 1kg
    2000: 14.07,  // até 2kg
    3000: 14.97,  // até 3kg
    4000: 16.17,  // até 4kg
    default: 17.07 // acima de 4kg
};

// Limiares para alertas e classificações
export const LIMIARES = {
    ESTOQUE_CRITICO: 5,           // abaixo disso é crítico
    MARGEM_EXCELENTE: 35,         // acima disso é excelente
    MARGEM_BOA: 25,               // acima disso é bom
    MARGEM_MEDIA: 15,             // acima disso é médio
    DIAS_SEM_BACKUP: 7            // dias sem backup para alerta
};

// Configurações padrão do sistema
export const CONFIG_PADRAO = {
    embalagemBase: 5.50,
    outrosCustos: 1.00,
    limiteViagem: 5,              // kg por viagem
    distancia: 3.0,               // km
    consumo: 10.0,                // km/l
    precoGasolina: 6.00,
    metaLucro: 1000
};