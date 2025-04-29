import { NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import fs from "fs"

// Caminho para o arquivo de banco de dados
const DB_FILE_PATH = path.join(process.cwd(), "data", "storage.json")
const LOCK_FILE_PATH = path.join(process.cwd(), "data", "storage.lock")
const LOCK_TIMEOUT = 30000 // 30 segundos
const LOG_FILE_PATH = path.join(process.cwd(), "data", "storage.log")

// Função para registrar logs
const logOperation = async (message: string): Promise<void> => {
  try {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`

    // Garantir que o diretório exista
    const dir = path.dirname(LOG_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Append ao arquivo de log
    fs.appendFileSync(LOG_FILE_PATH, logMessage)
  } catch (error) {
    console.error("Erro ao registrar log:", error)
  }
}

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
    await logOperation("Arquivo de banco de dados criado com estado inicial")
  }
}

// Adquirir bloqueio para escrita com timeout
const acquireLock = async (clientId: string, requestId: string): Promise<boolean> => {
  try {
    ensureDirectoryExists()
    await logOperation(`Tentativa de adquirir bloqueio: Cliente ${clientId}, Requisição ${requestId}`)

    // Verificar se o bloqueio já existe
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const lockContent = await readFile(LOCK_FILE_PATH, "utf8")
      let lockData

      try {
        lockData = JSON.parse(lockContent)
      } catch (error) {
        // Se o arquivo de bloqueio estiver corrompido, remover e criar novo
        await logOperation(`Arquivo de bloqueio corrompido, removendo: ${error}`)
        fs.unlinkSync(LOCK_FILE_PATH)
        return acquireLock(clientId, requestId)
      }

      // Verificar se o bloqueio expirou
      const lockTime = new Date(lockData.timestamp).getTime()
      const currentTime = Date.now()

      if (currentTime - lockTime < LOCK_TIMEOUT && lockData.clientId !== clientId) {
        await logOperation(`Bloqueio em uso por ${lockData.clientId}, não pode ser adquirido por ${clientId}`)
        return false
      }

      // Se o bloqueio expirou, podemos sobrescrevê-lo
      if (currentTime - lockTime >= LOCK_TIMEOUT) {
        await logOperation(`Bloqueio expirado de ${lockData.clientId}, será sobrescrito por ${clientId}`)
      }
    }

    // Criar novo bloqueio
    const lockData = {
      clientId,
      requestId,
      timestamp: new Date().toISOString(),
    }

    await writeFile(LOCK_FILE_PATH, JSON.stringify(lockData, null, 2), "utf8")
    await logOperation(`Bloqueio adquirido por ${clientId} para requisição ${requestId}`)
    return true
  } catch (error) {
    await logOperation(`Erro ao adquirir bloqueio: ${error}`)
    return false
  }
}

// Liberar bloqueio com verificação de propriedade
const releaseLock = async (clientId: string, requestId: string): Promise<boolean> => {
  try {
    if (!fs.existsSync(LOCK_FILE_PATH)) {
      await logOperation(`Tentativa de liberar bloqueio inexistente: Cliente ${clientId}, Requisição ${requestId}`)
      return true
    }

    const lockContent = await readFile(LOCK_FILE_PATH, "utf8")
    let lockData

    try {
      lockData = JSON.parse(lockContent)
    } catch (error) {
      // Se o arquivo de bloqueio estiver corrompido, remover
      await logOperation(`Arquivo de bloqueio corrompido ao liberar, removendo: ${error}`)
      fs.unlinkSync(LOCK_FILE_PATH)
      return true
    }

    // Só liberar se for o mesmo cliente e requisição
    if (lockData.clientId === clientId && lockData.requestId === requestId) {
      fs.unlinkSync(LOCK_FILE_PATH)
      await logOperation(`Bloqueio liberado por ${clientId} para requisição ${requestId}`)
      return true
    } else if (lockData.clientId === clientId) {
      // Se for o mesmo cliente mas requisição diferente, verificar timeout
      const lockTime = new Date(lockData.timestamp).getTime()
      const currentTime = Date.now()

      if (currentTime - lockTime >= LOCK_TIMEOUT) {
        fs.unlinkSync(LOCK_FILE_PATH)
        await logOperation(`Bloqueio expirado liberado por ${clientId} (requisição diferente)`)
        return true
      }

      await logOperation(
        `Tentativa de liberar bloqueio de outra requisição: ${clientId} atual: ${requestId}, bloqueio: ${lockData.requestId}`,
      )
      return false
    } else {
      await logOperation(
        `Tentativa de liberar bloqueio de outro cliente: solicitado por ${clientId}, pertence a ${lockData.clientId}`,
      )
      return false
    }
  } catch (error) {
    await logOperation(`Erro ao liberar bloqueio: ${error}`)
    return false
  }
}

// Endpoint GET para ler o arquivo
export async function GET(request: Request) {
  const clientId = request.headers.get("X-Client-ID") || "unknown"
  const requestId = request.headers.get("X-Request-ID") || `req_${Date.now()}`

  await logOperation(`GET recebido: Cliente ${clientId}, Requisição ${requestId}`)

  try {
    await ensureFileExists()

    // Ler o arquivo
    const data = await readFile(DB_FILE_PATH, "utf8")
    await logOperation(`GET bem-sucedido: Cliente ${clientId}, Requisição ${requestId}`)

    // Retornar o conteúdo como JSON
    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    await logOperation(`Erro em GET: Cliente ${clientId}, Requisição ${requestId}, Erro: ${error}`)

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

  await logOperation(`POST recebido: Cliente ${clientId}, Requisição ${requestId}`)

  // Tentar adquirir bloqueio
  const lockAcquired = await acquireLock(clientId, requestId)
  if (!lockAcquired) {
    await logOperation(`Cliente ${clientId} não conseguiu adquirir bloqueio para requisição ${requestId}`)
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
      await logOperation(
        `Atualizando dados: novos dados têm mais entradas (${newData.historico.length} vs ${currentData.historico.length})`,
      )
    } else if (newData.lastUpdated && currentData.lastUpdated) {
      const newDate = new Date(newData.lastUpdated).getTime()
      const currentDate = new Date(currentData.lastUpdated).getTime()
      shouldUpdate = newDate > currentDate
      if (shouldUpdate) {
        await logOperation(
          `Atualizando dados: novos dados são mais recentes (${newData.lastUpdated} vs ${currentData.lastUpdated})`,
        )
      }
    }

    if (!shouldUpdate) {
      await logOperation(
        `Dados recebidos não são mais recentes, ignorando: Cliente ${clientId}, Requisição ${requestId}`,
      )
      await releaseLock(clientId, requestId)
      return NextResponse.json({ success: true, message: "Nenhuma atualização necessária" })
    }

    // Adicionar timestamp de atualização
    newData.lastUpdated = new Date().toISOString()

    // Converter para string formatada
    const jsonString = JSON.stringify(newData, null, 2)

    // Escrever no arquivo
    await writeFile(DB_FILE_PATH, jsonString, "utf8")
    await logOperation(`Dados salvos com sucesso: Cliente ${clientId}, Requisição ${requestId}`)

    // Liberar bloqueio
    await releaseLock(clientId, requestId)

    return NextResponse.json({ success: true, message: "Dados salvos com sucesso" })
  } catch (error) {
    await logOperation(`Erro ao salvar dados: Cliente ${clientId}, Requisição ${requestId}, Erro: ${error}`)

    // Sempre tentar liberar o bloqueio, mesmo em caso de erro
    await releaseLock(clientId, requestId)

    return NextResponse.json({ success: false, message: "Erro ao salvar dados", error: String(error) }, { status: 500 })
  }
}
