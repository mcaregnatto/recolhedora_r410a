import { NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import fs from "fs"

// Path to the shared database file
const DB_FILE_PATH = path.join(process.cwd(), "public", "shared-database.json")

// Ensure the directory exists
const ensureDirectoryExists = () => {
  const dir = path.dirname(DB_FILE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Ensure the file exists
const ensureFileExists = async () => {
  ensureDirectoryExists()

  if (!fs.existsSync(DB_FILE_PATH)) {
    const initialState = {
      acumulado: 0,
      rodada: 1,
      historico: [],
    }

    await writeFile(DB_FILE_PATH, JSON.stringify(initialState, null, 2), "utf8")
  }
}

// GET endpoint to read the file
export async function GET() {
  try {
    await ensureFileExists()

    // Read the file
    const data = await readFile(DB_FILE_PATH, "utf8")

    // Return the content as text
    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Error reading shared database file:", error)

    // If any error occurs, return an empty initial state
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
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  }
}

// POST endpoint to write to the file
export async function POST(request: Request) {
  try {
    await ensureFileExists()

    // Get data from request body
    const data = await request.json()

    // Convert to formatted string
    const jsonString = JSON.stringify(data, null, 2)

    // Write to the file
    await writeFile(DB_FILE_PATH, jsonString, "utf8")

    return NextResponse.json({ success: true, message: "Data saved successfully" })
  } catch (error) {
    console.error("Error writing to shared database file:", error)
    return NextResponse.json({ success: false, message: "Error saving data", error: String(error) }, { status: 500 })
  }
}
