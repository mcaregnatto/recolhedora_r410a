import type { EstadoAplicacao } from "./types"

// Configuração
const API_URL = "/api/realtime-db"
const SYNC_INTERVAL = 3000 // 3 segundos para polling
const DEBOUNCE_TIME = 300 // 300ms para debounce de atualizações

// Serviço de sincronização em tempo real
export const realtimeSyncService = {
  // Última vez que os dados foram enviados
  lastSyncTime: 0,

  // Timeout para debounce
  syncTimeout: null as NodeJS.Timeout | null,

  // Polling interval
  pollingInterval: null as NodeJS.Timeout | null,

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
    const response = await fetch(`${API_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })

    if (!response.ok) {
      throw new Error(`Erro ao buscar dados: ${response.status}`)
    }

    return await response.json()
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
  async _sendDataImmediate(data: EstadoAplicacao): Promise<void> {
    try {
      const now = Date.now()
      this.lastSyncTime = now

      // Adicionar timestamp para controle de versão
      const dataToSend = {
        ...data,
        lastUpdated: new Date().toISOString(),
        timestamp: now,
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": `client_${Math.random().toString(36).substring(2, 9)}`,
          "X-Request-Time": now.toString(),
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        throw new Error(`Erro ao enviar dados: ${response.status}`)
      }

      console.log("Dados enviados com sucesso:", now)

      // Salvar no localStorage como backup
      if (typeof window !== "undefined") {
        localStorage.setItem("gasRecolhimentoData", JSON.stringify(data))
        localStorage.setItem("gasRecolhimentoLastSync", new Date().toISOString())
      }
    } catch (error) {
      console.error("Erro ao enviar dados:", error)
      throw error
    }
  },
}
