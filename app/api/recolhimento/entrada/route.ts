import { NextResponse } from "next/server"
import { obterDadosDB, salvarDadosDB } from "@/lib/db-service"
import type { EntradaGas } from "@/lib/types"

export async function POST(request: Request) {
  try {
    console.log("API: Recebendo nova entrada de gás")
    const entrada: EntradaGas = await request.json()
    console.log("API: Dados recebidos:", entrada)

    // Obter estado atual
    console.log("API: Obtendo estado atual do banco de dados")
    const estadoAtual = await obterDadosDB()
    console.log("API: Estado atual:", estadoAtual)

    // Adicionar nova entrada ao histórico
    const novoHistorico = [entrada, ...estadoAtual.historico]

    // Atualizar estado
    const novoEstado = {
      acumulado: entrada.acumulado,
      rodada: entrada.rodada,
      historico: novoHistorico,
    }

    console.log("API: Salvando novo estado:", novoEstado)
    // Salvar no banco de dados
    await salvarDadosDB(novoEstado)
    console.log("API: Dados salvos com sucesso")

    return NextResponse.json(novoEstado)
  } catch (error) {
    console.error("API: Erro ao adicionar entrada:", error)
    return NextResponse.json({ error: "Erro ao processar requisição" }, { status: 500 })
  }
}
