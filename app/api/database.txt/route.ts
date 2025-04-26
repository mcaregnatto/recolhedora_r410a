import { readFile } from "fs/promises"
import path from "path"
import fs from "fs"

// Caminho para o arquivo de banco de dados
const DB_FILE_PATH = path.join(process.cwd(), "public", "api", "database.txt")

export async function GET() {
  try {
    // Verificar se o diretório existe, se não, criar
    const dirPath = path.dirname(DB_FILE_PATH)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    // Verificar se o arquivo existe, se não, criar com estado inicial
    if (!fs.existsSync(DB_FILE_PATH)) {
      const estadoInicial = {
        acumulado: 0,
        rodada: 1,
        historico: [],
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(estadoInicial, null, 2), "utf8")
    }

    // Ler o arquivo
    const dados = await readFile(DB_FILE_PATH, "utf8")

    // Retornar o conteúdo como texto
    return new Response(dados, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Erro ao ler arquivo de banco de dados:", error)

    // Se ocorrer qualquer erro, retornar um objeto vazio
    return new Response(
      JSON.stringify(
        {
          acumulado: 0,
          rodada: 1,
          historico: [],
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  }
}
