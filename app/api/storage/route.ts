import { NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import fs from "fs"

// Caminho para o arquivo de banco de dados
const DB_FILE_PATH = path.join(process.cwd(), "data", "storage.json")
const LOCK_FILE_PATH = path.join(process.cwd(), "data", "storage.lock")
const LOCK_TIMEOUT = 30000 // 30 segundos

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
    }

    await writeFile(DB_FILE_PATH, JSON.stringify(initialState, null, 2), "utf8")
  }
}

// Adquirir bloqueio para escrita
const acquireLock = async (clientId: string): Promise<boolean> => {
  try {
    ensureDirectoryExists()

    // Verificar se o bloqueio já existe
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const lockContent = await readFile(LOCK_FILE_PATH, "utf8")
      const lockData = JSON.parse(lockContent)

      // Verificar se o bloqueio expirou
      const lockTime = new Date(lockData.timestamp).getTime()
      const currentTime = Date.now()

      if (currentTime - lockTime < LOCK_TIMEOUT && lockData.clientId !== clientId) {
        console.log(`Bloqueio em uso por ${lockData.clientId}, não pode ser adquirido por ${clientId}`)
        return false
      }
    }

    // Criar novo bloqueio
    const lockData = {
      clientId,
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    }

    await writeFile(LOCK_FILE_PATH, JSON.stringify(lockData, null, 2), "utf8")
    return true
  } catch (error) {
    console.error("Erro ao adquirir bloqueio:", error)
    return false
  }
}

// Liberar bloqueio
const releaseLock = async (clientId: string): Promise<void> => {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const lockContent = await readFile(LOCK_FILE_PATH, "utf8")
      const lockData = JSON.parse(lockContent)

      // Só liberar se for o mesmo cliente
      if (lockData.clientId === clientId) {
        fs.unlinkSync(LOCK_FILE_PATH)
      }
    }
  } catch (error) {
    console.error("Erro ao liberar bloqueio:", error)
  }
}

// Endpoint GET para ler o arquivo
export async function GET(request: Request) {
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
          error: "Erro ao ler dados",
          errorDetail: String(error),
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
  const clientId = request.headers.get("X-Client-ID") || "unknown"
  const requestId = request.headers.get("X-Request-ID") || `req_${Date.now()}`

  console.log(`Recebida requisição POST de ${clientId} (${requestId})`)

  // Tentar adquirir bloqueio
  const lockAcquired = await acquireLock(clientId)
  if (!lockAcquired) {
    console.log(`Cliente ${clientId} não conseguiu adquirir bloqueio`)
    return NextResponse.json(
      { success: false, message: "Não foi possível adquirir bloqueio. Tente novamente." },
      { status: 423 }, // Locked
    )
  }

  try {
    await ensureFileExists()

    // Obter dados do corpo da requisição
    const newData = await request.json()

    // Validar dados
    if (!newData || typeof newData !== "object" || !Array.isArray(newData.historico)) {
      throw new Error("Dados inválidos")
    }

    // Ler dados atuais para comparação
    const currentDataText = await readFile(DB_FILE_PATH, "utf8")
    const currentData = JSON.parse(currentDataText)

    // Verificar se os dados novos são mais recentes ou têm mais entradas
    let shouldUpdate = false

    if (newData.historico.length > currentData.historico.length) {
      shouldUpdate = true
    } else if (newData.lastUpdated && currentData.lastUpdated) {
      const newDate = new Date(newData.lastUpdated).getTime()
      const currentDate = new Date(currentData.lastUpdated).getTime()
      shouldUpdate = newDate > currentDate
    }

    if (!shouldUpdate) {
      console.log("Dados recebidos não são mais recentes que os atuais, ignorando")
      return NextResponse.json({ success: true, message: "Nenhuma atualização necessária" })
    }

    // Adicionar timestamp de atualização
    newData.lastUpdated = new Date().toISOString()

    // Converter para string formatada
    const jsonString = JSON.stringify(newData, null, 2)

    // Escrever no arquivo
    await writeFile(DB_FILE_PATH, jsonString, "utf8")
    console.log(`Dados salvos com sucesso por ${clientId}`)

    return NextResponse.json({ success: true, message: "Dados salvos com sucesso" })
  } catch (error) {
    console.error(`Erro ao salvar dados (cliente ${clientId}):`, error)
    return NextResponse.json({ success: false, message: "Erro ao salvar dados", error: String(error) }, { status: 500 })
  } finally {
    // Sempre liberar o bloqueio
    await releaseLock(clientId)
    console.log(`Bloqueio liberado por ${clientId}`)
  }
}
