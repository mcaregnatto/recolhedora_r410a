import type { EntradaGas, EstadoAplicacao } from "./types"
import { obterEstado, salvarEstado, exportarParaCSV, downloadCSV } from "./indexeddb-service"

// Serviço para interagir com o banco de dados
export const apiService = {
  // Obter o estado atual da aplicação
  async obterEstado(): Promise<EstadoAplicacao> {
    try {
      console.log("Obtendo estado do IndexedDB")
      return await obterEstado()
    } catch (error) {
      console.error("Erro ao obter estado:", error)
      // Retornar estado padrão em caso de erro
      return { acumulado: 0, rodada: 1, historico: [] }
    }
  },

  // Adicionar uma nova entrada de gás
  async adicionarEntrada(entrada: EntradaGas): Promise<EstadoAplicacao> {
    try {
      // Obter estado atual
      const estadoAtual = await obterEstado()

      // Atualizar estado
      const novoEstado = {
        acumulado: entrada.acumulado,
        rodada: entrada.rodada,
        historico: [entrada, ...estadoAtual.historico],
      }

      // Salvar no IndexedDB
      await salvarEstado(novoEstado)
      console.log("Entrada adicionada com sucesso")

      return novoEstado
    } catch (error) {
      console.error("Erro ao adicionar entrada:", error)
      throw error
    }
  },

  // Desfazer a última entrada
  async desfazerUltimaEntrada(): Promise<EstadoAplicacao> {
    try {
      // Obter estado atual
      const estadoAtual = await obterEstado()
      if (estadoAtual.historico.length === 0) {
        throw new Error("Não há entradas para desfazer")
      }

      // Remover a última entrada
      const ultimaEntrada = estadoAtual.historico[0]
      const novoHistorico = [...estadoAtual.historico]
      novoHistorico.shift()

      // Calcular novo acumulado e rodada
      let novoAcumulado = estadoAtual.acumulado
      let novaRodada = estadoAtual.rodada

      // Se o último registro foi uma troca de cilindro
      if (ultimaEntrada.trocaCilindro) {
        novaRodada = novaRodada - 1
        novoAcumulado = ultimaEntrada.valorFinalRodada || 0
      }
      // Se o último registro causou uma mudança de rodada
      else if (ultimaEntrada.valorFinalRodada) {
        novaRodada = novaRodada - 1
        novoAcumulado = ultimaEntrada.valorFinalRodada - ultimaEntrada.quantidade
      } else {
        novoAcumulado = novoAcumulado - ultimaEntrada.quantidade
      }

      const novoEstado = {
        acumulado: novoAcumulado,
        rodada: novaRodada,
        historico: novoHistorico,
      }

      // Salvar no IndexedDB
      await salvarEstado(novoEstado)
      console.log("Última entrada desfeita com sucesso")

      return novoEstado
    } catch (error) {
      console.error("Erro ao desfazer entrada:", error)
      throw error
    }
  },

  // Registrar troca de cilindro
  async trocarCilindro(valorFinalRodada: number, operador: string): Promise<EstadoAplicacao> {
    try {
      // Obter estado atual
      const estadoAtual = await obterEstado()

      // Criar nova entrada para troca de cilindro
      const novaEntrada: EntradaGas = {
        id: Date.now().toString(),
        quantidade: 0,
        acumulado: 0,
        rodada: estadoAtual.rodada + 1,
        data: new Date().toISOString(),
        operador: operador,
        valorFinalRodada: valorFinalRodada,
        trocaCilindro: true,
      }

      const novoEstado = {
        acumulado: 0,
        rodada: estadoAtual.rodada + 1,
        historico: [novaEntrada, ...estadoAtual.historico],
      }

      // Salvar no IndexedDB
      await salvarEstado(novoEstado)
      console.log("Cilindro trocado com sucesso")

      return novoEstado
    } catch (error) {
      console.error("Erro ao trocar cilindro:", error)
      throw error
    }
  },

  // Exportar histórico para CSV
  exportarHistorico(historico: EntradaGas[]): void {
    try {
      const csvString = exportarParaCSV(historico)
      const dataAtual = new Date().toISOString().split("T")[0]
      downloadCSV(csvString, `recolhimento-r410a-${dataAtual}.csv`)
      console.log("Histórico exportado com sucesso")
    } catch (error) {
      console.error("Erro ao exportar histórico:", error)
      throw error
    }
  },
}
