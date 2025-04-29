import { NextResponse } from "next/server"
import { serverMemoryStore } from "@/lib/server-memory-store"
import type { EstadoAplicacao } from "@/lib/types"

// Endpoint GET para obter dados
export async function GET() {
  try {
    // Obter dados da memória
    const data = serverMemoryStore.getData()

    // Retornar dados como JSON
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao obter dados:", error)

    // Em caso de erro, retornar estado inicial
    return NextResponse.json({
      acumulado: 0,
      rodada: 1,
      historico: [],
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now(),
    })
  }
}

// Endpoint POST para atualizar dados
export async function POST(request: Request) {
  try {
    // Obter dados do corpo da requisição
    const newData: EstadoAplicacao = await request.json()

    // Validar dados recebidos
    if (!newData || typeof newData !== "object") {
      return NextResponse.json({ success: false, message: "Dados inválidos" }, { status: 400 })
    }

    // Garantir que os campos obrigatórios existam
    if (
      typeof newData.acumulado !== "number" ||
      typeof newData.rodada !== "number" ||
      !Array.isArray(newData.historico)
    ) {
      return NextResponse.json({ success: false, message: "Formato de dados inválido" }, { status: 400 })
    }

    // Adicionar timestamp se não existir
    if (!newData.timestamp) {
      newData.timestamp = Date.now()
    }

    // Atualizar dados na memória
    const updatedData = serverMemoryStore.updateData(newData)

    return NextResponse.json({
      success: true,
      message: "Dados salvos com sucesso",
      timestamp: updatedData.timestamp,
    })
  } catch (error) {
    console.error("Erro ao salvar dados:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Erro ao salvar dados",
        error: String(error),
      },
      { status: 500 },
    )
  }
}
