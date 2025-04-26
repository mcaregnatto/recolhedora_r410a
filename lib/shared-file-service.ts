import type { EstadoAplicacao, EntradaGas } from "./types"

// Configuration
const FILE_URL = "/api/shared-database" // API endpoint to access the shared file
const LOCK_TIMEOUT = 30000 // 30 seconds lock timeout
const MAX_RETRIES = 5 // Maximum number of retries for operations

// Shared file storage service
export const sharedFileService = {
  // Get file lock before writing
  async acquireLock(): Promise<string> {
    try {
      const response = await fetch(`${FILE_URL}/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: this.getClientId(),
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to acquire lock: ${response.status}`)
      }

      const data = await response.json()
      return data.lockId
    } catch (error) {
      console.error("Error acquiring lock:", error)
      throw error
    }
  },

  // Release file lock after writing
  async releaseLock(lockId: string): Promise<void> {
    try {
      const response = await fetch(`${FILE_URL}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lockId,
          clientId: this.getClientId(),
        }),
      })

      if (!response.ok) {
        console.warn(`Warning: Failed to release lock: ${response.status}`)
      }
    } catch (error) {
      console.warn("Warning: Error releasing lock:", error)
    }
  },

  // Generate or retrieve client ID
  getClientId(): string {
    if (typeof window === "undefined") return "server"

    let clientId = localStorage.getItem("clientId")
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem("clientId", clientId)
    }
    return clientId
  },

  // Load data with retry mechanism
  async carregar(retryCount = 0): Promise<EstadoAplicacao> {
    try {
      console.log("Loading data from shared file...")
      const response = await fetch(`${FILE_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (!response.ok) {
        throw new Error(`Error loading data: ${response.status}`)
      }

      const text = await response.text()

      // If file is empty, return initial state
      if (!text.trim()) {
        console.log("Empty file, returning initial state")
        return {
          acumulado: 0,
          rodada: 1,
          historico: [],
        }
      }

      try {
        // Parse JSON
        const data = JSON.parse(text)
        console.log("Data loaded successfully:", data)

        // Save to localStorage as backup
        this.saveToLocalStorage(data)

        return data
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError)

        // If parsing fails, try to load from localStorage
        return this.loadFromLocalStorage()
      }
    } catch (error) {
      console.error(`Error loading data (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error)

      // Implement retry with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff
        console.log(`Retrying in ${delay}ms...`)

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(this.carregar(retryCount + 1))
          }, delay)
        })
      }

      // If all retries fail, try to load from localStorage
      return this.loadFromLocalStorage()
    }
  },

  // Save data with retry and locking mechanism
  async salvar(data: EstadoAplicacao, retryCount = 0): Promise<void> {
    let lockId = null

    try {
      console.log("Saving data to shared file...")

      // First, get the latest data to ensure we're not overwriting newer changes
      const currentData = await this.carregar()

      // Acquire lock
      lockId = await this.acquireLock()
      console.log("Lock acquired:", lockId)

      // Convert to JSON string
      const jsonData = JSON.stringify(data, null, 2)

      // Send to server
      const response = await fetch(FILE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lock-Id": lockId,
        },
        body: jsonData,
      })

      if (!response.ok) {
        throw new Error(`Error saving data: ${response.status}`)
      }

      console.log("Data saved successfully to shared file")

      // Save to localStorage as backup
      this.saveToLocalStorage(data)
    } catch (error) {
      console.error(`Error saving data (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error)

      // Implement retry with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff
        console.log(`Retrying in ${delay}ms...`)

        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.salvar(data, retryCount + 1)
              .then(resolve)
              .catch(reject)
          }, delay)
        })
      }

      // If all retries fail, save to localStorage and throw error
      this.saveToLocalStorage(data)
      throw new Error(
        "Failed to save data to the shared file. Data has been saved locally, but won't be available to other users until connection is restored.",
      )
    } finally {
      // Always release lock if we acquired one
      if (lockId) {
        await this.releaseLock(lockId)
        console.log("Lock released:", lockId)
      }
    }
  },

  // Add entry to history
  async adicionarEntrada(entrada: EntradaGas): Promise<EstadoAplicacao> {
    try {
      // Load current data
      const dados = await this.carregar()

      // Add new entry to the beginning of history
      const novoHistorico = [entrada, ...dados.historico]

      // Update state
      const novoEstado = {
        acumulado: entrada.acumulado,
        rodada: entrada.rodada,
        historico: novoHistorico,
      }

      // Save updated data
      await this.salvar(novoEstado)

      return novoEstado
    } catch (error) {
      console.error("Error adding entry:", error)
      throw error
    }
  },

  // Save data to localStorage (backup)
  saveToLocalStorage(data: EstadoAplicacao): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("gasRecolhimentoData", JSON.stringify(data))
        localStorage.setItem("gasRecolhimentoLastSync", new Date().toISOString())
        console.log("Data saved to localStorage as backup")
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error)
    }
  },

  // Load data from localStorage (fallback)
  loadFromLocalStorage(): EstadoAplicacao {
    try {
      if (typeof window !== "undefined") {
        const data = localStorage.getItem("gasRecolhimentoData")
        if (data) {
          console.log("Data loaded from localStorage (fallback)")
          return JSON.parse(data)
        }
      }

      // If no data in localStorage, return initial state
      console.log("No data found in localStorage, returning initial state")
      return {
        acumulado: 0,
        rodada: 1,
        historico: [],
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error)
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
    return localStorage.getItem("gasRecolhimentoLastSync")
  },

  // Export data to CSV
  exportarCSV(historico: EntradaGas[]): string {
    // CSV header
    const header = "Data,Operador,Quantidade (g),Acumulado (g),Rodada,Tipo\n"

    // Data rows
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
