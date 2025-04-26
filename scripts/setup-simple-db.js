const fs = require("fs")
const path = require("path")

// Path to the database directory and file
const DB_DIR = path.join(process.cwd(), "public")
const DB_FILE = path.join(DB_DIR, "database.json")

// Ensure the directory exists
if (!fs.existsSync(DB_DIR)) {
  console.log("Creating directory for the database...")
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Ensure the file exists with initial state
if (!fs.existsSync(DB_FILE)) {
  console.log("Creating database file...")
  const initialState = {
    acumulado: 0,
    rodada: 1,
    historico: [],
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf8")
  console.log("Database file created successfully!")
}

console.log("Database setup completed!")
