import { NextResponse } from "next/server"
import { obterDadosDB, salvarDadosDB } from "@/lib/db-service"
import type { EntradaGas } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const { valorFinalRodada } = await request.json()

    // Obter estado atual
    const estadoAtual = await obterDadosDB()

    // Criar nova entrada para troca de cilindro
    const novaEntrada: EntradaGas = {
      id: Date.now().toString(),
      quantidade: 0,
      acumulado: 0,
      rodada: estadoAtual.rodada + 1,
      data: new Date().toISOString(),
      valorFinalRodada: valorFinalRodada,
      trocaCilindro: true,
    }

    // Adicionar ao histórico
    const novoHistorico = [novaEntrada, ...estadoAtual.historico]

    // Atualizar estado
    const novoEstado = {
      acumulado: 0,
      rodada: estadoAtual.rodada + 1,
      historico: novoHistorico,
    }

    // Salvar no banco de dados
    await salvarDadosDB(novoEstado)

    return NextResponse.json(novoEstado)
  } catch (error) {
    console.error("Erro ao trocar cilindro:", error)
    return NextResponse.json({ error: "Erro ao processar requisição" }, { status: 500 })
  }
}
