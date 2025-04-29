const fs = require("fs")
const path = require("path")

// Caminho para o diretório de dados
const DATA_DIR = path.join(process.cwd(), "data")
const DB_FILE = path.join(DATA_DIR, "storage.json")

// Verificar se o diretório existe, se não, criar
if (!fs.existsSync(DATA_DIR)) {
  console.log("Criando diretório para o banco de dados...")
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Verificar se o arquivo existe, se não, criar com estado inicial
if (!fs.existsSync(DB_FILE)) {
  console.log("Criando arquivo de banco de dados...")
  const estadoInicial = {
    acumulado: 0,
    rodada: 1,
    historico: [],
    lastUpdated: new Date().toISOString(),
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(estadoInicial, null, 2), "utf8")
  console.log("Arquivo de banco de dados criado com sucesso!")
}

console.log("Configuração do banco de dados concluída!")
