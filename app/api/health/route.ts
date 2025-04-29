import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Caminho para o arquivo de banco de dados
const DB_FILE_PATH = path.join(process.cwd(), "data", "storage.json")

export async function GET() {
  try {
    // Verificar se o arquivo de banco de dados existe
    const dbExists = fs.existsSync(DB_FILE_PATH)

    // Verificar se o diretório de dados é gravável
    const dataDir = path.dirname(DB_FILE_PATH)
    let dirWritable = false

    try {
      const testFile = path.join(dataDir, ".write-test")
      fs.writeFileSync(testFile, "test")
      fs.unlinkSync(testFile)
      dirWritable = true
    } catch (e) {
      dirWritable = false
    }

    // Obter informações do sistema
    const systemInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
    }

    return NextResponse.json({
      status: "ok",
      dbExists,
      dirWritable,
      systemInfo,
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
