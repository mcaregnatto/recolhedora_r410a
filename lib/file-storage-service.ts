import type { EstadoAplicacao, EntradaGas } from "./types"

// URL do arquivo de texto que armazenará os dados
const FILE_URL = "/api/database.txt"

// Serviço para armazenamento baseado em arquivo de texto
export const fileStorageService = {
  // Carregar dados do arquivo
  async carregar(): Promise<EstadoAplicacao> {
    try {
      console.log("Carregando dados do arquivo...")
      const response = await fetch(FILE_URL, {
        cache: "no-store", // Não usar cache
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (!response.ok) {
        throw new Error(`Erro ao carregar dados: ${response.status}`)
      }

      const texto = await response.text()

      // Se o arquivo estiver vazio, retornar estado inicial
      if (!texto.trim()) {
        console.log("Arquivo vazio, retornando estado inicial")
        return {
          acumulado: 0,
          rodada: 1,
          historico: [],
        }
      }

      try {
        // Converter texto para objeto
        const dados = JSON.parse(texto)
        console.log("Dados carregados com sucesso:", dados)

        // Salvar no localStorage como backup
        this.salvarNoLocalStorage(dados)

        return dados
      } catch (parseError) {
        console.error("Erro ao analisar JSON:", parseError)
        // Se houver erro no parsing, tentar carregar do localStorage
        return this.carregarDoLocalStorage()
      }
    } catch (error) {
      console.error("Erro ao carregar dados do arquivo:", error)

      // Em caso de erro, tentar carregar do localStorage como fallback
      return this.carregarDoLocalStorage()
    }
  },

  // Salvar dados no arquivo
  async salvar(dados: EstadoAplicacao): Promise<void> {
    try {
      console.log("Salvando dados no arquivo...")

      // Converter objeto para texto
      const texto = JSON.stringify(dados, null, 2)

      // Enviar para o servidor
      const response = await fetch("/api/salvar-dados", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: texto,
      })

      if (!response.ok) {
        throw new Error(`Erro ao salvar dados: ${response.status}`)
      }

      console.log("Dados salvos com sucesso no arquivo")

      // Salvar também no localStorage como backup
      this.salvarNoLocalStorage(dados)
    } catch (error) {
      console.error("Erro ao salvar dados no arquivo:", error)

      // Em caso de erro, salvar apenas no localStorage
      this.salvarNoLocalStorage(dados)
      throw new Error(
        "Não foi possível salvar os dados no servidor. Os dados foram salvos localmente, mas não estarão disponíveis para outros usuários até que a conexão seja restabelecida.",
      )
    }
  },

  // Salvar dados no localStorage (backup)
  salvarNoLocalStorage(dados: EstadoAplicacao): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("gasRecolhimentoData", JSON.stringify(dados))
        console.log("Dados salvos no localStorage como backup")
      }
    } catch (error) {
      console.error("Erro ao salvar no localStorage:", error)
    }
  },

  // Carregar dados do localStorage (fallback)
  carregarDoLocalStorage(): EstadoAplicacao {
    try {
      if (typeof window !== "undefined") {
        const dados = localStorage.getItem("gasRecolhimentoData")
        if (dados) {
          console.log("Dados carregados do localStorage (fallback)")
          return JSON.parse(dados)
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

  // Adicionar entrada ao histórico
  async adicionarEntrada(entrada: EntradaGas): Promise<EstadoAplicacao> {
    try {
      // Carregar dados atuais
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

  // Exportar dados para CSV
  exportarCSV(historico: EntradaGas[]): string {
    // Cabeçalho do CSV
    const cabecalho = "Data,Operador,Quantidade (g),Acumulado (g),Rodada,Tipo\n"

    // Linhas de dados
    const linhas = historico
      .map((entrada) => {
        const data = new Date(entrada.data).toLocaleString("pt-BR")
        const tipo = entrada.trocaCilindro ? "Troca de Cilindro" : "Recolhimento"
        const quantidade = entrada.trocaCilindro ? "" : entrada.quantidade

        return `"${data}","${entrada.operador || "Não informado"}","${quantidade}","${entrada.acumulado}","${entrada.rodada}","${tipo}"`
      })
      .join("\n")

    return cabecalho + linhas
  },

  // Fazer download do arquivo CSV
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
