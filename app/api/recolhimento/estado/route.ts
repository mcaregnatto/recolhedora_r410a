import { NextResponse } from "next/server"
import { obterDadosDB } from "@/lib/db-service"

export async function GET() {
  try {
    const dados = await obterDadosDB()
    return NextResponse.json(dados)
  } catch (error) {
    console.error("Erro ao obter estado:", error)
    return NextResponse.json({ error: "Erro ao obter dados" }, { status: 500 })
  }
}
