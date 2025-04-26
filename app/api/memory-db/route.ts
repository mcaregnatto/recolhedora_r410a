import { NextResponse } from "next/server"
import type { EstadoAplicacao } from "@/lib/types"

// In-memory storage (will reset on server restart)
let databaseInMemory: EstadoAplicacao = {
  acumulado: 0,
  rodada: 1,
  historico: [],
}

// GET endpoint to read data
export async function GET() {
  console.log("API: Returning in-memory data")
  return NextResponse.json(databaseInMemory)
}

// POST endpoint to write data
export async function POST(request: Request) {
  try {
    const data = await request.json()
    console.log("API: Updating in-memory data")
    databaseInMemory = { ...data }
    return NextResponse.json({ success: true, message: "Data saved successfully" })
  } catch (error) {
    console.error("API: Error updating data:", error)
    return NextResponse.json({ success: false, message: "Error saving data", error: String(error) }, { status: 500 })
  }
}
