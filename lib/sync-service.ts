import type { EstadoAplicacao } from "./types"

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
}

// Interface para estado de sincronização
interface SyncState {
  inProgress: boolean
  lastSync: string | null
  lastError: string | null
  currentOperationId: string | null
  syncStartTime: number | null
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
          }
    } catch (error) {
      console.error("Erro ao ler estado de sincronização:", error)
      return {
        inProgress: false,
        lastSync: null,
        lastError: null,
        currentOperationId: null,
        syncStartTime: null,
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
      const queue = this.getSyncQueue()
      const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // Adicionar nova operação à fila
      queue.push({
        id: operationId,
        timestamp: Date.now(),
        operation: "save",
        data: data,
        attempts: 0,
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
    if (!isBrowser || !navigator.onLine) return false

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
          this.updateSyncQueue(queue)
          success = false
        }
      } catch (error) {
        console.error(`Erro ao processar operação ${operation.id}:`, error)
        operation.attempts++
        operation.lastAttempt = Date.now()
        this.updateSyncQueue(queue)
        success = false
      }
    }

    // Atualizar estado de sincronização
    this.updateSyncState({
      inProgress: false,
      lastSync: new Date().toISOString(),
      currentOperationId: null,
      syncStartTime: null,
    })

    console.log(`Sincronização concluída. Processadas: ${processedCount}, Pendentes: ${queue.length - processedCount}`)
    return success && processedCount === queue.length
  },

  // Sincronizar dados com o servidor
  async syncToServer(data: EstadoAplicacao): Promise<boolean> {
    try {
      console.log("Sincronizando dados com o servidor...")

      // Adicionar timeout à requisição
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": this.getClientId(),
          "X-Request-ID": `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        },
        body: JSON.stringify({
          ...data,
          lastUpdated: new Date().toISOString(),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Erro ao sincronizar dados: ${response.status}`)
      }

      console.log("Dados sincronizados com sucesso com o servidor")
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
      console.log("Fila de sincronização limpa")
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
}
