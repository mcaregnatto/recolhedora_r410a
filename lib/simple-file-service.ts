import type { EstadoAplicacao, EntradaGas } from "./types"

// Configuration
const FILE_URL = "/api/simple-database"

// Simple file storage service
export const simpleFileService = {
  // Load data from file
  async carregar(): Promise<EstadoAplicacao> {
    try {
      console.log("Loading data from file...")
      const response = await fetch(`${FILE_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
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
        console.log("Data loaded successfully")

        // Save to localStorage as backup
        this.saveToLocalStorage(data)

        return data
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError)

        // If parsing fails, try to load from localStorage
        return this.loadFromLocalStorage()
      }
    } catch (error) {
      console.error("Error loading data:", error)

      // If error, try to load from localStorage
      return this.loadFromLocalStorage()
    }
  },

  // Save data to file
  async salvar(data: EstadoAplicacao): Promise<void> {
    try {
      console.log("Saving data to file...")

      // Convert to JSON string
      const jsonData = JSON.stringify(data, null, 2)

      // Send to server
      const response = await fetch(FILE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonData,
      })

      if (!response.ok) {
        throw new Error(`Error saving data: ${response.status}`)
      }

      console.log("Data saved successfully to file")

      // Save to localStorage as backup
      this.saveToLocalStorage(data)
    } catch (error) {
      console.error("Error saving data:", error)

      // Save to localStorage and throw error
      this.saveToLocalStorage(data)
      throw new Error(
        "Failed to save data to the file. Data has been saved locally, but won't be available to other users until connection is restored.",
      )
    }
  },

  // Add entry to history
  async adicionarEntrada(entrada: EntradaGas): Promise<EstadoAplicacao> {
    try {
      // Load current data to get the latest state
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
