const fs = require("fs")
const path = require("path")

// Caminho para o diretório do banco de dados
const DB_DIR = path.join(process.cwd(), "public", "api")
const DB_FILE = path.join(DB_DIR, "database.txt")

// Verificar se o diretório existe, se não, criar
if (!fs.existsSync(DB_DIR)) {
  console.log("Criando diretório para o banco de dados...")
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Verificar se o arquivo existe, se não, criar com estado inicial
if (!fs.existsSync(DB_FILE)) {
  console.log("Criando arquivo de banco de dados...")
  const estadoInicial = {
    acumulado: 0,
    rodada: 1,
    historico: [],
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(estadoInicial, null, 2), "utf8")
  console.log("Arquivo de banco de dados criado com sucesso!")
}

console.log("Configuração do banco de dados concluída!")
