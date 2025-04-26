import { NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"
import fs from "fs"

// Caminho para o arquivo de banco de dados
const DB_FILE_PATH = path.join(process.cwd(), "public", "api", "database.txt")

export async function POST(request: Request) {
  try {
    // Obter dados do corpo da requisição
    const dados = await request.json()

    // Converter para string formatada
    const dadosString = JSON.stringify(dados, null, 2)

    // Verificar se o diretório existe, se não, criar
    const dirPath = path.dirname(DB_FILE_PATH)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    // Escrever no arquivo
    await writeFile(DB_FILE_PATH, dadosString, "utf8")

    return NextResponse.json({ success: true, message: "Dados salvos com sucesso" })
  } catch (error) {
    console.error("Erro ao salvar dados no arquivo:", error)
    return NextResponse.json({ success: false, message: "Erro ao salvar dados", error: String(error) }, { status: 500 })
  }
}
