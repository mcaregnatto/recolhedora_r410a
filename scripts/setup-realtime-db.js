const fs = require("fs")
const path = require("path")

// Caminho para o arquivo de banco de dados
const DB_DIR = path.join(process.cwd(), "public")
const DB_FILE = path.join(DB_DIR, "realtime-db.json")

console.log("Configurando banco de dados em tempo real...")

// Verificar se o diretório existe, se não, criar
if (!fs.existsSync(DB_DIR)) {
  console.log("Criando diretório para o banco de dados...")
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Verificar se o arquivo existe, se não, criar com estado inicial
if (!fs.existsSync(DB_FILE)) {
  console.log("Criando arquivo de banco de dados...")
  const initialState = {
    acumulado: 0,
    rodada: 1,
    historico: [],
    lastUpdated: new Date().toISOString(),
    timestamp: Date.now(),
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf8")
  console.log("Arquivo de banco de dados criado com sucesso!")
}

// Verificar permissões de escrita
try {
  const testFile = path.join(DB_DIR, ".write-test")
  fs.writeFileSync(testFile, "test")
  fs.unlinkSync(testFile)
  console.log("Permissões de escrita verificadas com sucesso!")
} catch (error) {
  console.error("AVISO: O diretório pode não ter permissões de escrita!")
  console.error("Por favor, verifique as permissões do diretório:", DB_DIR)
}

console.log("Configuração do banco de dados em tempo real concluída!")
