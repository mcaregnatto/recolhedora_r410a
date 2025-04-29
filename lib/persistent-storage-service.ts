import type { EstadoAplicacao, EntradaGas } from "./types"

// Configuração
const API_URL = "/api/storage"
const LOCAL_STORAGE_KEY = "gasRecolhimentoData"
const LAST_SYNC_KEY = "gasRecolhimentoLastSync"
const SYNC_QUEUE_KEY = "gasRecolhimentoSyncQueue"
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000 // ms

// Verificar se estamos no navegador
const isBrowser = typeof window !== "undefined"

// Interface para operações na fila de sincronização
interface SyncOperation {
  id: string
  timestamp: number
  operation: "save" | "delete"
  data: EstadoAplicacao
  attempts: number
}

// Serviço de armazenamento persistente com mecanismos robustos
export const persistentStorageService = {
  // Carregar dados com prioridade no localStorage para confiabilidade
  async carregar(): Promise<EstadoAplicacao> {
    try {
      // Primeiro, tente carregar do localStorage para garantir que temos dados
      const localData = this.loadFromLocalStorage()

      // Tente processar a fila de sincronização pendente
      this.processQueue()

      console.log("Tentando carregar dados da API...")
      const response = await fetch(`${API_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })

      if (!response.ok) {
        throw new Error(`Erro ao carregar dados: ${response.status}`)
      }

      const apiData = await response.json()
      console.log("Dados carregados com sucesso da API")

      // Verificar se os dados da API são mais recentes que os dados locais
      // Se não houver histórico na API mas houver localmente, use os dados locais
      if (apiData.historico.length === 0 && localData.historico.length > 0) {
        console.log("API retornou dados vazios, usando dados locais mais completos")

        // Sincronize os dados locais com a API para restaurar os dados
        this.syncToServer(localData)
        return localData
      }

      // Se os dados da API tiverem histórico, use-os e atualize o localStorage
      if (isBrowser) {
        this.saveToLocalStorage(apiData)
      }
      return apiData
    } catch (error) {
      console.error("Erro ao carregar dados da API:", error)
      console.log("Usando dados do armazenamento local...")

      // Se falhar, use os dados locais
      return this.loadFromLocalStorage()
    }
  },

  // Sincronizar dados locais com o servidor com retry
  async syncToServer(data: EstadoAplicacao, retryCount = 0): Promise<boolean> {
    try {
      console.log("Sincronizando dados com o servidor...")
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": this.getClientId(),
          "X-Request-ID": `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Erro ao sincronizar dados: ${response.status}`)
      }

      console.log("Dados sincronizados com sucesso com o servidor")
      if (isBrowser) {
        this.updateLastSyncTime()
      }
      return true
    } catch (error) {
      console.error(`Erro ao sincronizar dados com o servidor (tentativa ${retryCount + 1}/${RETRY_ATTEMPTS}):`, error)

      // Implementar retry com backoff exponencial
      if (retryCount < RETRY_ATTEMPTS - 1) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount)
        console.log(`Tentando novamente em ${delay}ms...`)

        return new Promise((resolve) => {
          setTimeout(() => {
            this.syncToServer(data, retryCount + 1)
              .then(resolve)
              .catch(() => resolve(false))
          }, delay)
        })
      }

      // Se todas as tentativas falharem, adicione à fila para sincronização posterior
      this.addToSyncQueue(data)
      return false
    }
  },

  // Salvar dados com prioridade no localStorage
  async salvar(data: EstadoAplicacao): Promise<boolean> {
    // Validar dados antes de salvar
    if (!this.validateData(data)) {
      console.error("Dados inválidos, não foi possível salvar")
      return false
    }

    // Sempre salve primeiro no localStorage para garantir persistência
    if (isBrowser) {
      this.saveToLocalStorage(data)
    }

    try {
      // Tentar sincronizar com o servidor
      const success = await this.syncToServer(data)
      return success
    } catch (error) {
      console.error("Erro ao salvar dados na API:", error)

      // Adicionar à fila de sincronização para tentar mais tarde
      this.addToSyncQueue(data)

      return false
    }
  },

  // Adicionar à fila de sincronização
  addToSyncQueue(data: EstadoAplicacao): void {
    if (!isBrowser) return

    try {
      const queue = this.getSyncQueue()
      const operationId = Date.now().toString()

      // Adicionar nova operação à fila
      queue.push({
        id: operationId,
        timestamp: Date.now(),
        operation: "save",
        data: data,
        attempts: 0,
      })

      // Salvar fila atualizada
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
      console.log("Operação adicionada à fila de sincronização")
    } catch (error) {
      console.error("Erro ao adicionar à fila de sincronização:", error)
    }
  },

  // Obter fila de sincronização
  getSyncQueue(): SyncOperation[] {
    if (!isBrowser) return []

    try {
      const queueData = localStorage.getItem(SYNC_QUEUE_KEY)
      return queueData ? JSON.parse(queueData) : []
    } catch (error) {
      console.error("Erro ao ler fila de sincronização:", error)
      return []
    }
  },

  // Processar fila de sincronização
  async processQueue(): Promise<void> {
    if (!isBrowser || !navigator.onLine) return

    const queue = this.getSyncQueue()
    if (queue.length === 0) return

    console.log(`Processando fila de sincronização (${queue.length} operações pendentes)`)

    // Ordenar por timestamp para processar na ordem correta
    queue.sort((a, b) => a.timestamp - b.timestamp)

    // Processar cada operação na fila
    for (let i = 0; i < queue.length; i++) {
      const operation = queue[i]

      // Pular operações que já tentaram muitas vezes
      if (operation.attempts >= RETRY_ATTEMPTS) {
        console.warn(`Operação ${operation.id} excedeu o número máximo de tentativas`)
        continue
      }

      try {
        let success = false

        if (operation.operation === "save") {
          success = await this.syncToServer(operation.data)
        }

        if (success) {
          // Remover operação da fila se for bem-sucedida
          queue.splice(i, 1)
          i-- // Ajustar índice após remoção
        } else {
          // Incrementar contador de tentativas
          operation.attempts++
        }
      } catch (error) {
        console.error(`Erro ao processar operação ${operation.id}:`, error)
        operation.attempts++
      }
    }

    // Atualizar fila no localStorage
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))

    // Se ainda houver operações na fila, agendar nova tentativa
    if (queue.length > 0) {
      setTimeout(() => this.processQueue(), RETRY_DELAY * 5)
    }
  },

  // Adicionar entrada ao histórico
  async adicionarEntrada(entrada: EntradaGas): Promise<EstadoAplicacao> {
    try {
      // Validar entrada
      if (!this.validateEntrada(entrada)) {
        throw new Error("Entrada inválida")
      }

      // Carregar dados atuais para obter o estado mais recente
      const dados = await this.carregar()

      // Adicionar nova entrada ao início do histórico
      const novoHistorico = [entrada, ...dados.historico]

      // Atualizar estado
      const novoEstado = {
        acumulado: entrada.acumulado,
        rodada: entrada.rodada,
        historico: novoHistorico,
      }

      // Salvar dados atualizados
      await this.salvar(novoEstado)

      return novoEstado
    } catch (error) {
      console.error("Erro ao adicionar entrada:", error)
      throw error
    }
  },

  // Validar dados antes de salvar
  validateData(data: EstadoAplicacao): boolean {
    // Verificar se os dados têm a estrutura correta
    if (data === null || typeof data !== "object") return false
    if (typeof data.acumulado !== "number") return false
    if (typeof data.rodada !== "number") return false
    if (!Array.isArray(data.historico)) return false

    // Verificar se o histórico contém entradas válidas
    for (const entrada of data.historico) {
      if (!this.validateEntrada(entrada)) return false
    }

    return true
  },

  // Validar entrada individual
  validateEntrada(entrada: EntradaGas): boolean {
    if (entrada === null || typeof entrada !== "object") return false
    if (!entrada.id) return false
    if (typeof entrada.acumulado !== "number") return false
    if (typeof entrada.rodada !== "number") return false
    if (!entrada.data) return false

    // Se não for troca de cilindro, quantidade deve ser um número positivo
    if (!entrada.trocaCilindro && (typeof entrada.quantidade !== "number" || entrada.quantidade <= 0)) {
      return false
    }

    return true
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

  // Salvar dados no localStorage
  saveToLocalStorage(data: EstadoAplicacao): void {
    try {
      if (isBrowser) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
        this.updateLastSyncTime()
        console.log("Dados salvos no localStorage")
      }
    } catch (error) {
      console.error("Erro ao salvar no localStorage:", error)
    }
  },

  // Atualizar hora da última sincronização
  updateLastSyncTime(): void {
    if (isBrowser) {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    }
  },

  // Carregar dados do localStorage
  loadFromLocalStorage(): EstadoAplicacao {
    try {
      if (isBrowser) {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (data) {
          console.log("Dados carregados do localStorage")
          return JSON.parse(data)
        }
      }

      // Se não houver dados no localStorage, retornar estado inicial
      console.log("Nenhum dado encontrado no localStorage, retornando estado inicial")
      return {
        acumulado: 0,
        rodada: 1,
        historico: [],
      }
    } catch (error) {
      console.error("Erro ao carregar do localStorage:", error)
      return {
        acumulado: 0,
        rodada: 1,
        historico: [],
      }
    }
  },

  // Obter hora da última sincronização
  getLastSyncTime(): string | null {
    if (!isBrowser) return null
    return localStorage.getItem(LAST_SYNC_KEY)
  },

  // Exportar dados para CSV
  exportarCSV(historico: EntradaGas[]): string {
    // Cabeçalho do CSV
    const header = "Data,Operador,Quantidade (g),Acumulado (g),Rodada,Tipo\n"

    // Linhas de dados
    const rows = historico
      .map((entrada) => {
        const data = new Date(entrada.data).toLocaleString("pt-BR")
        const tipo = entrada.trocaCilindro ? "Troca de Cilindro" : "Recolhimento"
        const quantidade = entrada.trocaCilindro ? "" : entrada.quantidade

        return `"${data}","${entrada.operador || "Não informado"}","${quantidade}","${entrada.acumulado}","${entrada.rodada}","${tipo}"`
      })
      .join("\n")

    return header + rows
  },

  // Download do arquivo CSV
  downloadCSV(historico: EntradaGas[]): void {
    if (!isBrowser) return

    const csv = this.exportarCSV(historico)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `recolhimento-r410a-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
}
