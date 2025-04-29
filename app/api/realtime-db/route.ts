import { NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import fs from "fs"

// Caminho para o arquivo de banco de dados
const DB_FILE_PATH = path.join(process.cwd(), "data", "realtime-db.json")

// Garantir que o diretório exista
const ensureDirectoryExists = () => {
  const dir = path.dirname(DB_FILE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Garantir que o arquivo exista
const ensureFileExists = async () => {
  ensureDirectoryExists()

  if (!fs.existsSync(DB_FILE_PATH)) {
    const initialState = {
      acumulado: 0,
      rodada: 1,
      historico: [],
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now(),
    }

    await writeFile(DB_FILE_PATH, JSON.stringify(initialState, null, 2), "utf8")
  }
}

// Endpoint GET para ler o arquivo
export async function GET() {
  try {
    await ensureFileExists()

    // Ler o arquivo
    const data = await readFile(DB_FILE_PATH, "utf8")

    // Retornar o conteúdo como JSON
    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Erro ao ler arquivo de banco de dados:", error)

    // Se ocorrer qualquer erro, retornar um objeto vazio
    return new Response(
      JSON.stringify(
        {
          acumulado: 0,
          rodada: 1,
          historico: [],
          lastUpdated: new Date().toISOString(),
          timestamp: Date.now(),
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  }
}

// Endpoint POST para escrever no arquivo
export async function POST(request: Request) {
  try {
    await ensureFileExists()

    // Obter dados do corpo da requisição
    const newData = await request.json()

    // Ler dados atuais para comparação
    let currentData = { timestamp: 0 }
    try {
      const currentDataText = await readFile(DB_FILE_PATH, "utf8")
      currentData = JSON.parse(currentDataText)
    } catch (error) {
      console.error("Erro ao ler dados atuais:", error)
    }

    // Verificar se os dados novos são mais recentes
    if (!newData.timestamp || newData.timestamp <= currentData.timestamp) {
      return NextResponse.json({
        success: false,
        message: "Dados mais recentes já existem no servidor",
      })
    }

    // Converter para string formatada
    const jsonString = JSON.stringify(newData, null, 2)

    // Escrever no arquivo
    await writeFile(DB_FILE_PATH, jsonString, "utf8")

    return NextResponse.json({
      success: true,
      message: "Dados salvos com sucesso",
      timestamp: newData.timestamp,
    })
  } catch (error) {
    console.error("Erro ao salvar dados no arquivo:", error)
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
