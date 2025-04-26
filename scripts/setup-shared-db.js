const fs = require("fs")
const path = require("path")

// Path to the shared database directory and file
const DB_DIR = path.join(process.cwd(), "public")
const DB_FILE = path.join(DB_DIR, "shared-database.json")

// Ensure the directory exists
if (!fs.existsSync(DB_DIR)) {
  console.log("Creating directory for the shared database...")
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Ensure the file exists with initial state
if (!fs.existsSync(DB_FILE)) {
  console.log("Creating shared database file...")
  const initialState = {
    acumulado: 0,
    rodada: 1,
    historico: [],
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf8")
  console.log("Shared database file created successfully!")
}

console.log("Shared database setup completed!")
