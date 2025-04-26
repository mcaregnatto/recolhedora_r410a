import { NextResponse } from "next/server"
import type { EstadoAplicacao } from "@/lib/types"

// Armazenamento em memória (não persistente entre reinicializações do servidor)
let dadosEmMemoria: EstadoAplicacao = {
  acumulado: 0,
  rodada: 1,
  historico: [],
}

// Endpoint para obter o estado atual
export async function GET() {
  console.log("API: Retornando dados em memória:", dadosEmMemoria)
  return NextResponse.json(dadosEmMemoria)
}

// Endpoint para atualizar o estado
export async function POST(request: Request) {
  try {
    const novoEstado = await request.json()
    console.log("API: Atualizando dados em memória:", novoEstado)
    dadosEmMemoria = { ...novoEstado }
    return NextResponse.json(dadosEmMemoria)
  } catch (error) {
    console.error("API: Erro ao atualizar estado:", error)
    return NextResponse.json({ error: "Erro ao processar requisição" }, { status: 500 })
  }
}
