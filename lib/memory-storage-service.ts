import type { EstadoAplicacao, EntradaGas } from "./types"

// Configuration
const API_URL = "/api/memory-db"
const LOCAL_STORAGE_KEY = "gasRecolhimentoData"
const LAST_SYNC_KEY = "gasRecolhimentoLastSync"

// Enhanced memory storage service with better persistence
export const memoryStorageService = {
  // Load data with priority on localStorage for reliability
  async carregar(): Promise<EstadoAplicacao> {
    // Primeiro, tente carregar do localStorage para garantir que temos dados
    const localData = this.loadFromLocalStorage()

    try {
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
      this.saveToLocalStorage(apiData)
      return apiData
    } catch (error) {
      console.error("Erro ao carregar dados da API:", error)
      console.log("Usando dados do armazenamento local...")

      // Se falhar, use os dados locais
      return localData
    }
  },

  // Sincronizar dados locais com o servidor
  async syncToServer(data: EstadoAplicacao): Promise<void> {
    try {
      console.log("Sincronizando dados locais com o servidor...")
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Erro ao sincronizar dados: ${response.status}`)
      }

      console.log("Dados sincronizados com sucesso com o servidor")
      this.updateLastSyncTime()
    } catch (error) {
      console.error("Erro ao sincronizar dados com o servidor:", error)
      // Não lançar erro, apenas registrar
    }
  },

  // Save data with priority on localStorage
  async salvar(data: EstadoAplicacao): Promise<void> {
    // Sempre salve primeiro no localStorage para garantir persistência
    this.saveToLocalStorage(data)

    try {
      console.log("Salvando dados na API...")
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Erro ao salvar dados: ${response.status}`)
      }

      console.log("Dados salvos com sucesso na API")
      this.updateLastSyncTime()
    } catch (error) {
      console.error("Erro ao salvar dados na API:", error)
      throw new Error(
        "Falha ao salvar dados na API. Os dados foram salvos localmente, mas não estarão disponíveis para outros usuários até que a conexão seja restabelecida.",
      )
    }
  },

  // Add entry to history
  async adicionarEntrada(entrada: EntradaGas): Promise<EstadoAplicacao> {
    try {
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

  // Save data to localStorage
  saveToLocalStorage(data: EstadoAplicacao): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
        this.updateLastSyncTime()
        console.log("Dados salvos no localStorage")
      }
    } catch (error) {
      console.error("Erro ao salvar no localStorage:", error)
    }
  },

  // Update last sync time
  updateLastSyncTime(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    }
  },

  // Load data from localStorage
  loadFromLocalStorage(): EstadoAplicacao {
    try {
      if (typeof window !== "undefined") {
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

  // Get last sync time
  getLastSyncTime(): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem(LAST_SYNC_KEY)
  },

  // Export data to CSV
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

  // Download CSV file
  downloadCSV(historico: EntradaGas[]): void {
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
