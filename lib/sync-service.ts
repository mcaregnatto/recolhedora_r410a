import type { EstadoAplicacao } from "./types"
import { networkDiagnostic } from "./network-diagnostic"

// Configuração
const API_URL = "/api/storage"
const SYNC_QUEUE_KEY = "gasRecolhimentoSyncQueue"
const SYNC_STATE_KEY = "gasRecolhimentoSyncState"
const MAX_RETRY_ATTEMPTS = 5
const RETRY_DELAY_BASE = 2000 // ms
const SYNC_TIMEOUT = 30000 // 30 segundos
const MAX_QUEUE_AGE = 24 * 60 * 60 * 1000 // 24 horas em ms

// Verificar se estamos no navegador
const isBrowser = typeof window !== "undefined"

// Interface para operações na fila de sincronização
interface SyncOperation {
  id: string
  timestamp: number
  operation: "save" | "delete"
  data: EstadoAplicacao
  attempts: number
  lastAttempt?: number
  errors?: string[]
}

// Interface para estado de sincronização
interface SyncState {
  inProgress: boolean
  lastSync: string | null
  lastError: string | null
  currentOperationId: string | null
  syncStartTime: number | null
  consecutiveFailures: number
}

// Serviço de sincronização com mecanismos robustos
export const syncService = {
  // Inicializar estado de sincronização
  initSyncState(): void {
    if (!isBrowser) return

    try {
      const currentState = this.getSyncState()

      // Se houver uma sincronização em andamento há mais de 30 segundos, consideramos que travou
      if (currentState.inProgress && currentState.syncStartTime) {
        const now = Date.now()
        if (now - currentState.syncStartTime > SYNC_TIMEOUT) {
          console.warn("Detectada sincronização travada. Resetando estado de sincronização.")
          this.resetSyncState()
        }
      }
    } catch (error) {
      console.error("Erro ao inicializar estado de sincronização:", error)
      this.resetSyncState()
    }
  },

  // Obter estado de sincronização
  getSyncState(): SyncState {
    if (!isBrowser) {
      return {
        inProgress: false,
        lastSync: null,
        lastError: null,
        currentOperationId: null,
        syncStartTime: null,
        consecutiveFailures: 0,
      }
    }

    try {
      const stateData = localStorage.getItem(SYNC_STATE_KEY)
      return stateData
        ? JSON.parse(stateData)
        : {
            inProgress: false,
            lastSync: null,
            lastError: null,
            currentOperationId: null,
            syncStartTime: null,
            consecutiveFailures: 0,
          }
    } catch (error) {
      console.error("Erro ao ler estado de sincronização:", error)
      return {
        inProgress: false,
        lastSync: null,
        lastError: null,
        currentOperationId: null,
        syncStartTime: null,
        consecutiveFailures: 0,
      }
    }
  },

  // Atualizar estado de sincronização
  updateSyncState(updates: Partial<SyncState>): void {
    if (!isBrowser) return

    try {
      const currentState = this.getSyncState()
      const newState = { ...currentState, ...updates }
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(newState))
    } catch (error) {
      console.error("Erro ao atualizar estado de sincronização:", error)
    }
  },

  // Resetar estado de sincronização
  resetSyncState(): void {
    if (!isBrowser) return

    try {
      const resetState: SyncState = {
        inProgress: false,
        lastSync: null,
        lastError: null,
        currentOperationId: null,
        syncStartTime: null,
        consecutiveFailures: 0,
      }
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(resetState))
      console.log("Estado de sincronização resetado")
    } catch (error) {
      console.error("Erro ao resetar estado de sincronização:", error)
    }
  },

  // Adicionar à fila de sincronização
  addToSyncQueue(data: EstadoAplicacao): void {
    if (!isBrowser) return

    try {
      // Validar dados antes de adicionar à fila
      if (!this.validateData(data)) {
        console.error("Dados inválidos, não adicionados à fila de sincronização")
        throw new Error("Dados inválidos, não foi possível adicionar à fila de sincronização")
      }

      const queue = this.getSyncQueue()
      const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // Adicionar nova operação à fila
      queue.push({
        id: operationId,
        timestamp: Date.now(),
        operation: "save",
        data: this.sanitizeData(data),
        attempts: 0,
        errors: [],
      })

      // Limitar tamanho da fila para evitar problemas de armazenamento
      if (queue.length > 100) {
        console.warn("Fila de sincronização muito grande, removendo operações antigas")
        queue.splice(0, queue.length - 100)
      }

      // Salvar fila atualizada
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
      console.log("Operação adicionada à fila de sincronização:", operationId)
    } catch (error) {
      console.error("Erro ao adicionar à fila de sincronização:", error)
    }
  },

  // Validar dados antes de adicionar à fila
  validateData(data: EstadoAplicacao): boolean {
    // Verificar se os dados têm a estrutura correta
    if (!data || typeof data !== "object") return false
    if (typeof data.acumulado !== "number") return false
    if (typeof data.rodada !== "number") return false
    if (!Array.isArray(data.historico)) return false

    // Verificar se o histórico contém entradas válidas
    for (const entrada of data.historico) {
      if (!entrada || typeof entrada !== "object") return false
      if (!entrada.id) return false
      if (typeof entrada.acumulado !== "number") return false
      if (typeof entrada.rodada !== "number") return false
      if (!entrada.data) return false

      // Se não for troca de cilindro, quantidade deve ser um número positivo
      if (!entrada.trocaCilindro && (typeof entrada.quantidade !== "number" || entrada.quantidade <= 0)) {
        return false
      }
    }

    return true
  },

  // Sanitizar dados antes de enviar
  sanitizeData(data: EstadoAplicacao): EstadoAplicacao {
    // Criar uma cópia profunda dos dados
    const sanitized = JSON.parse(JSON.stringify(data))

    // Garantir que todos os campos numéricos sejam números
    sanitized.acumulado = Number(sanitized.acumulado)
    sanitized.rodada = Number(sanitized.rodada)

    // Sanitizar cada entrada do histórico
    sanitized.historico = sanitized.historico.map((entrada: any) => {
      return {
        ...entrada,
        acumulado: Number(entrada.acumulado),
        rodada: Number(entrada.rodada),
        quantidade: entrada.quantidade !== undefined ? Number(entrada.quantidade) : undefined,
        valorFinalRodada: entrada.valorFinalRodada !== undefined ? Number(entrada.valorFinalRodada) : undefined,
        trocaCilindro: Boolean(entrada.trocaCilindro),
        operador: entrada.operador ? String(entrada.operador).trim() : "",
      }
    })

    return sanitized
  },

  // Obter fila de sincronização
  getSyncQueue(): SyncOperation[] {
    if (!isBrowser) return []

    try {
      const queueData = localStorage.getItem(SYNC_QUEUE_KEY)
      const queue = queueData ? JSON.parse(queueData) : []

      // Filtrar operações muito antigas para evitar processamento infinito
      const now = Date.now()
      return queue.filter((op: SyncOperation) => now - op.timestamp < MAX_QUEUE_AGE)
    } catch (error) {
      console.error("Erro ao ler fila de sincronização:", error)
      // Se houver erro na leitura, resetar a fila
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]))
      return []
    }
  },

  // Atualizar fila de sincronização
  updateSyncQueue(queue: SyncOperation[]): void {
    if (!isBrowser) return

    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
    } catch (error) {
      console.error("Erro ao atualizar fila de sincronização:", error)
    }
  },

  // Remover operação da fila
  removeFromQueue(operationId: string): void {
    if (!isBrowser) return

    try {
      const queue = this.getSyncQueue()
      const updatedQueue = queue.filter((op) => op.id !== operationId)
      this.updateSyncQueue(updatedQueue)
      console.log("Operação removida da fila:", operationId)
    } catch (error) {
      console.error("Erro ao remover operação da fila:", error)
    }
  },

  // Processar fila de sincronização com timeout
  async processQueue(): Promise<boolean> {
    if (!isBrowser) return false

    // Verificar conectividade antes de tentar sincronizar
    if (!navigator.onLine) {
      console.warn("Dispositivo offline, sincronização adiada")
      return false
    }

    // Verificar disponibilidade da API
    const apiStatus = await networkDiagnostic.checkApiAvailability()
    if (!apiStatus.available) {
      console.warn("API indisponível, sincronização adiada", apiStatus)
      return false
    }

    const syncState = this.getSyncState()
    if (syncState.inProgress) {
      console.log("Sincronização já em andamento, verificando timeout...")

      // Verificar se a sincronização atual está travada
      if (syncState.syncStartTime) {
        const now = Date.now()
        if (now - syncState.syncStartTime > SYNC_TIMEOUT) {
          console.warn("Sincronização travada detectada. Resetando estado.")
          this.resetSyncState()
        } else {
          console.log("Sincronização em andamento, aguardando...")
          return false
        }
      }
    }

    const queue = this.getSyncQueue()
    if (queue.length === 0) {
      console.log("Fila de sincronização vazia")
      return true
    }

    console.log(`Processando fila de sincronização (${queue.length} operações pendentes)`)

    // Marcar início da sincronização
    this.updateSyncState({
      inProgress: true,
      syncStartTime: Date.now(),
      lastError: null,
    })

    // Criar um timeout para a operação completa
    const syncTimeout = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        console.warn("Timeout de sincronização atingido")
        this.updateSyncState({
          inProgress: false,
          lastError: "Timeout de sincronização",
          consecutiveFailures: syncState.consecutiveFailures + 1,
        })
        resolve(false)
      }, SYNC_TIMEOUT)
    })

    // Processar a fila com timeout
    try {
      const syncProcess = this._processQueueInternal()
      const result = await Promise.race([syncProcess, syncTimeout])
      return result
    } catch (error) {
      console.error("Erro ao processar fila de sincronização:", error)
      this.updateSyncState({
        inProgress: false,
        lastError: String(error),
        consecutiveFailures: syncState.consecutiveFailures + 1,
      })
      return false
    }
  },

  // Implementação interna do processamento de fila
  async _processQueueInternal(): Promise<boolean> {
    const queue = this.getSyncQueue()
    if (queue.length === 0) return true

    // Ordenar por timestamp para processar na ordem correta
    queue.sort((a, b) => a.timestamp - b.timestamp)

    let success = true
    let processedCount = 0

    // Processar cada operação na fila
    for (let i = 0; i < queue.length; i++) {
      const operation = queue[i]

      // Atualizar estado com a operação atual
      this.updateSyncState({
        currentOperationId: operation.id,
      })

      // Pular operações que já tentaram muitas vezes
      if (operation.attempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(`Operação ${operation.id} excedeu o número máximo de tentativas, removendo da fila`)
        this.removeFromQueue(operation.id)
        continue
      }

      // Verificar se devemos aplicar backoff
      if (operation.lastAttempt) {
        const now = Date.now()
        const timeSinceLastAttempt = now - operation.lastAttempt
        const requiredDelay = RETRY_DELAY_BASE * Math.pow(2, operation.attempts)

        if (timeSinceLastAttempt < requiredDelay) {
          console.log(
            `Aguardando backoff para operação ${operation.id}: ${requiredDelay - timeSinceLastAttempt}ms restantes`,
          )
          continue
        }
      }

      try {
        let operationSuccess = false

        if (operation.operation === "save") {
          // Verificar novamente a conectividade antes de cada operação
          if (!navigator.onLine) {
            console.warn("Dispositivo offline durante processamento, adiando operação")
            break
          }

          operationSuccess = await this.syncToServer(operation.data)
        }

        if (operationSuccess) {
          // Remover operação da fila se for bem-sucedida
          this.removeFromQueue(operation.id)
          processedCount++
        } else {
          // Incrementar contador de tentativas
          operation.attempts++
          operation.lastAttempt = Date.now()
          if (!operation.errors) operation.errors = []
          operation.errors.push(`Falha na tentativa ${operation.attempts} em ${new Date().toISOString()}`)
          this.updateSyncQueue(queue)
          success = false
        }
      } catch (error) {
        console.error(`Erro ao processar operação ${operation.id}:`, error)
        operation.attempts++
        operation.lastAttempt = Date.now()
        if (!operation.errors) operation.errors = []
        operation.errors.push(`Erro na tentativa ${operation.attempts}: ${error.message || String(error)}`)
        this.updateSyncQueue(queue)
        success = false
      }
    }

    // Atualizar estado de sincronização
    const syncState = this.getSyncState()
    this.updateSyncState({
      inProgress: false,
      lastSync: new Date().toISOString(),
      currentOperationId: null,
      syncStartTime: null,
      consecutiveFailures: success ? 0 : syncState.consecutiveFailures + 1,
    })

    console.log(`Sincronização concluída. Processadas: ${processedCount}, Pendentes: ${queue.length - processedCount}`)
    return success && processedCount === queue.length
  },

  // Sincronizar dados com o servidor
  async syncToServer(data: EstadoAplicacao): Promise<boolean> {
    try {
      console.log("Sincronizando dados com o servidor...")

      // Verificar conectividade antes de tentar sincronizar
      if (!navigator.onLine) {
        console.warn("Dispositivo offline, não é possível sincronizar")
        return false
      }

      // Verificar disponibilidade da API
      const apiStatus = await networkDiagnostic.checkApiAvailability()
      if (!apiStatus.available) {
        console.warn("API indisponível, não é possível sincronizar", apiStatus)
        return false
      }

      // Adicionar timeout à requisição
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos

      // Preparar dados para envio
      const sanitizedData = this.sanitizeData(data)
      sanitizedData.lastUpdated = new Date().toISOString()

      // Registrar tamanho dos dados para diagnóstico
      const dataSize = JSON.stringify(sanitizedData).length
      console.log("Enviando dados para o servidor", {
        dataSize,
        historico: sanitizedData.historico.length,
      })

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": this.getClientId(),
          "X-Request-ID": `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        },
        body: JSON.stringify(sanitizedData),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Não foi possível ler o corpo da resposta")
        console.error(`Erro ao sincronizar dados: ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          errorText,
        })
        throw new Error(`Erro ao sincronizar dados: ${response.status} ${response.statusText}`)
      }

      const responseData = await response.json()
      console.log("Dados sincronizados com sucesso com o servidor", responseData)
      return true
    } catch (error) {
      if (error.name === "AbortError") {
        console.error("Timeout ao sincronizar dados com o servidor")
      } else {
        console.error("Erro ao sincronizar dados com o servidor:", error)
      }
      return false
    }
  },

  // Obter ID do cliente
  getClientId(): string {
    if (!isBrowser) return "server"

    let clientId = localStorage.getItem("clientId")
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem("clientId", clientId)
    }
    return clientId
  },

  // Limpar fila de sincronização (para casos extremos)
  clearSyncQueue(): void {
    if (!isBrowser) return

    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]))
      console.warn("Fila de sincronização limpa manualmente")
    } catch (error) {
      console.error("Erro ao limpar fila de sincronização:", error)
    }
  },

  // Verificar se há operações pendentes
  hasPendingOperations(): boolean {
    if (!isBrowser) return false

    try {
      const queue = this.getSyncQueue()
      return queue.length > 0
    } catch (error) {
      console.error("Erro ao verificar operações pendentes:", error)
      return false
    }
  },

  // Obter contagem de operações pendentes
  getPendingOperationsCount(): number {
    if (!isBrowser) return 0

    try {
      const queue = this.getSyncQueue()
      return queue.length
    } catch (error) {
      console.error("Erro ao obter contagem de operações pendentes:", error)
      return 0
    }
  },

  // Verificar se há problemas persistentes de sincronização
  hasPersistentSyncIssues(): boolean {
    if (!isBrowser) return false

    const state = this.getSyncState()
    return state.consecutiveFailures >= 3
  },
}
