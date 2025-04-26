import { NextResponse } from "next/server"
import { obterDadosDB, salvarDadosDB } from "@/lib/db-service"

export async function POST() {
  try {
    // Obter estado atual
    const estadoAtual = await obterDadosDB()

    // Verificar se há entradas para desfazer
    if (estadoAtual.historico.length === 0) {
      return NextResponse.json({ error: "Não há entradas para desfazer" }, { status: 400 })
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

    // Atualizar estado
    const novoEstado = {
      acumulado: novoAcumulado,
      rodada: novaRodada,
      historico: novoHistorico,
    }

    // Salvar no banco de dados
    await salvarDadosDB(novoEstado)

    return NextResponse.json(novoEstado)
  } catch (error) {
    console.error("Erro ao desfazer entrada:", error)
    return NextResponse.json({ error: "Erro ao processar requisição" }, { status: 500 })
  }
}
