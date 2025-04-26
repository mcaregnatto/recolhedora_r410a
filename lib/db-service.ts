import type { EstadoAplicacao } from "./types"

// Armazenamento em memória (não persistente entre reinicializações do servidor)
let dadosEmMemoria: EstadoAplicacao = {
  acumulado: 0,
  rodada: 1,
  historico: [],
}

// Obter dados da memória
export async function obterDadosDB(): Promise<EstadoAplicacao> {
  try {
    return { ...dadosEmMemoria }
  } catch (error) {
    console.error("Erro ao obter dados:", error)
    // Retornar estado padrão em caso de erro
    return {
      acumulado: 0,
      rodada: 1,
      historico: [],
    }
  }
}

// Salvar dados na memória
export async function salvarDadosDB(dados: EstadoAplicacao): Promise<void> {
  try {
    dadosEmMemoria = { ...dados }
    console.log("Dados salvos com sucesso na memória")
  } catch (error) {
    console.error("Erro ao salvar dados:", error)
    throw new Error("Falha ao salvar dados no banco de dados")
  }
}
