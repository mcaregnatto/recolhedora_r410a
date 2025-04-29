import { NextResponse } from "next/server"

// Endpoint para verificar a saúde da API
export async function GET() {
  try {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
    })
  } catch (error) {
    console.error("Erro no health check:", error)
    return NextResponse.json(
      {
        status: "error",
        error: String(error),
      },
      { status: 500 },
    )
  }
}

// Endpoint HEAD para verificações rápidas de disponibilidade
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
