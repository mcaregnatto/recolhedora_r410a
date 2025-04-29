const fs = require("fs")
const path = require("path")

// Caminho para o diretório de dados
const DATA_DIR = path.join(process.cwd(), "data")
const DB_FILE = path.join(DATA_DIR, "storage.json")
const LOG_FILE = path.join(DATA_DIR, "storage.log")

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

// Verificar se há um arquivo de bloqueio antigo e removê-lo
const LOCK_FILE = path.join(DATA_DIR, "storage.lock")
if (fs.existsSync(LOCK_FILE)) {
  console.log("Removendo arquivo de bloqueio antigo...")
  fs.unlinkSync(LOCK_FILE)
}

// Inicializar arquivo de log se não existir
if (!fs.existsSync(LOG_FILE)) {
  console.log("Inicializando arquivo de log...")
  const timestamp = new Date().toISOString()
  fs.writeFileSync(LOG_FILE, `[${timestamp}] Sistema inicializado\n`, "utf8")
}

// Verificar permissões de escrita
try {
  const testFile = path.join(DATA_DIR, ".write-test")
  fs.writeFileSync(testFile, "test")
  fs.unlinkSync(testFile)
  console.log("Permissões de escrita verificadas com sucesso!")
} catch (error) {
  console.error("ERRO: O diretório de dados não tem permissões de escrita!")
  console.error("Por favor, verifique as permissões do diretório:", DATA_DIR)
  console.error(error)
  process.exit(1)
}

console.log("Configuração do banco de dados concluída!")
