import type { EstadoAplicacao } from "./types"

const DB_NAME = "RecolhedoraDB"
const DB_VERSION = 1
const STORE_NAME = "recolhimento"

// Inicializar o banco de dados
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = (event) => {
      console.error("Erro ao abrir o banco de dados:", event)
      reject("Não foi possível abrir o banco de dados")
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

// Salvar o estado no IndexedDB
export async function salvarEstado(estado: EstadoAplicacao): Promise<void> {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)

      // Usamos um ID fixo para sempre sobrescrever o mesmo registro
      const request = store.put({ id: "estado_atual", ...estado })

      request.onsuccess = () => {
        console.log("Estado salvo com sucesso no IndexedDB")
        resolve()
      }

      request.onerror = (event) => {
        console.error("Erro ao salvar estado:", event)
        reject("Falha ao salvar dados no banco de dados")
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    console.error("Erro ao salvar no IndexedDB:", error)
    throw new Error("Falha ao salvar dados no banco de dados")
  }
}

// Obter o estado do IndexedDB
export async function obterEstado(): Promise<EstadoAplicacao> {
  try {
    const db = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get("estado_atual")

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Remover o campo ID antes de retornar
          const { id, ...estado } = result
          resolve(estado as EstadoAplicacao)
        } else {
          // Se não houver dados, retornar estado inicial
          resolve({
            acumulado: 0,
            rodada: 1,
            historico: [],
          })
        }
      }

      request.onerror = (event) => {
        console.error("Erro ao obter estado:", event)
        reject("Falha ao obter dados do banco de dados")
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    console.error("Erro ao obter do IndexedDB:", error)
    // Retornar estado padrão em caso de erro
    return {
      acumulado: 0,
      rodada: 1,
      historico: [],
    }
  }
}

export interface EntradaGas {
  data: number
  operador: string | null
  quantidade: number
  acumulado: number
  rodada: number
  trocaCilindro: boolean
  valorFinalRodada?: number
}

// Exportar dados para CSV
export function exportarParaCSV(historico: EntradaGas[]): string {
  // Cabeçalhos do CSV
  const cabecalhos = [
    "Data",
    "Operador",
    "Quantidade (g)",
    "Acumulado (g)",
    "Rodada",
    "Troca de Cilindro",
    "Valor Final da Rodada (g)",
  ]

  // Converter dados para linhas CSV
  const linhas = historico.map((entrada) => {
    const data = new Date(entrada.data).toLocaleString("pt-BR")
    const quantidade = entrada.trocaCilindro ? "Troca de Cilindro" : `${entrada.quantidade}`
    const valorFinal = entrada.valorFinalRodada ? `${entrada.valorFinalRodada}` : ""
    const trocaCilindro = entrada.trocaCilindro ? "Sim" : "Não"

    return [
      data,
      entrada.operador || "Não informado",
      quantidade,
      `${entrada.acumulado}`,
      `${entrada.rodada}`,
      trocaCilindro,
      valorFinal,
    ].join(",")
  })

  // Juntar cabeçalhos e linhas
  return [cabecalhos.join(","), ...linhas].join("\n")
}

// Função para fazer download do arquivo CSV
export function downloadCSV(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  // Criar URL para o blob
  const url = URL.createObjectURL(blob)

  // Configurar o link
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"

  // Adicionar à página, clicar e remover
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
