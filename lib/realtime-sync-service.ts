import type { EstadoAplicacao } from "./types"

// Configuração
const API_URL = "/api/realtime-db"
const SYNC_INTERVAL = 3000 // 3 segundos para polling
const DEBOUNCE_TIME = 300 // 300ms para debounce de atualizações
const MAX_RETRIES = 3 // Número máximo de tentativas

// Serviço de sincronização em tempo real
export const realtimeSyncService = {
  // Última vez que os dados foram enviados
  lastSyncTime: 0,

  // Timeout para debounce
  syncTimeout: null as NodeJS.Timeout | null,

  // Polling interval
  pollingInterval: null as NodeJS.Timeout | null,

  // Contador de tentativas
  retryCount: 0,

  // Iniciar polling para atualizações
  startPolling(onDataUpdate: (data: EstadoAplicacao) => void): void {
    if (typeof window === "undefined") return

    // Limpar intervalo existente se houver
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }

    // Configurar novo intervalo de polling
    this.pollingInterval = setInterval(async () => {
      try {
        const data = await this.fetchLatestData()
        onDataUpdate(data)
        this.retryCount = 0 // Resetar contador de tentativas após sucesso
      } catch (error) {
        console.error("Erro ao buscar atualizações:", error)
      }
    }, SYNC_INTERVAL)

    console.log("Polling de sincronização iniciado")
  },

  // Parar polling
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
      console.log("Polling de sincronização parado")
    }
  },

  // Buscar dados mais recentes
  async fetchLatestData(): Promise<EstadoAplicacao> {
    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })

      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status}`)
      }

      const data = await response.json()

      // Validar dados recebidos
      if (!data || typeof data !== "object" || typeof data.acumulado !== "number" || !Array.isArray(data.historico)) {
        throw new Error("Dados inválidos recebidos do servidor")
      }

      return data
    } catch (error) {
      console.error("Erro ao buscar dados:", error)

      // Se falhar, tentar carregar do localStorage
      if (typeof window !== "undefined") {
        const localData = localStorage.getItem("gasRecolhimentoData")
        if (localData) {
          try {
            return JSON.parse(localData)
          } catch (e) {
            console.error("Erro ao analisar dados locais:", e)
          }
        }
      }

      // Se tudo falhar, retornar estado inicial
      return {
        acumulado: 0,
        rodada: 1,
        historico: [],
      }
    }
  },

  // Enviar dados com debounce para evitar múltiplas requisições
  sendData(data: EstadoAplicacao): Promise<void> {
    return new Promise((resolve, reject) => {
      // Limpar timeout anterior se existir
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout)
      }

      // Configurar novo timeout com debounce
      this.syncTimeout = setTimeout(async () => {
        try {
          await this._sendDataImmediate(data)
          resolve()
        } catch (error) {
          reject(error)
        }
      }, DEBOUNCE_TIME)
    })
  },

  // Enviar dados imediatamente sem debounce
  async sendDataImmediate(data: EstadoAplicacao): Promise<void> {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = null
    }

    return this._sendDataImmediate(data)
  },

  // Implementação interna do envio de dados
  async _sendDataImmediate(data: EstadoAplicacao, retryAttempt = 0): Promise<void> {
    try {
      const now = Date.now()
      this.lastSyncTime = now

      // Preparar dados para envio
      const dataToSend = {
        ...data,
        lastUpdated: new Date().toISOString(),
        timestamp: now,
      }

      // Gerar ID de cliente único
      const clientId = this._getClientId()

      console.log("Enviando dados para o servidor...", {
        timestamp: now,
        historico: dataToSend.historico.length,
      })

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": clientId,
          "X-Request-Time": now.toString(),
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Erro desconhecido")
        throw new Error(`Erro ao enviar dados: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log("Dados enviados com sucesso:", result)

      // Salvar no localStorage como backup
      if (typeof window !== "undefined") {
        localStorage.setItem("gasRecolhimentoData", JSON.stringify(data))
        localStorage.setItem("gasRecolhimentoLastSync", new Date().toISOString())
      }

      // Resetar contador de tentativas após sucesso
      this.retryCount = 0
    } catch (error) {
      console.error(`Erro ao enviar dados (tentativa ${retryAttempt + 1}/${MAX_RETRIES}):`, error)

      // Salvar no localStorage como backup mesmo em caso de erro
      if (typeof window !== "undefined") {
        localStorage.setItem("gasRecolhimentoData", JSON.stringify(data))
      }

      // Tentar novamente se não excedeu o número máximo de tentativas
      if (retryAttempt < MAX_RETRIES - 1) {
        console.log(`Tentando novamente em ${1000 * (retryAttempt + 1)}ms...`)
        return new Promise((resolve, reject) => {
          setTimeout(
            async () => {
              try {
                await this._sendDataImmediate(data, retryAttempt + 1)
                resolve()
              } catch (retryError) {
                reject(retryError)
              }
            },
            1000 * (retryAttempt + 1),
          ) // Backoff exponencial
        })
      }

      throw error
    }
  },

  // Gerar ID de cliente único
  _getClientId(): string {
    if (typeof window === "undefined") return "server"

    let clientId = localStorage.getItem("clientId")
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem("clientId", clientId)
    }
    return clientId
  },
}
