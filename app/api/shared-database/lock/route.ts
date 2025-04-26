import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { readFile, writeFile } from "fs/promises"

// Path to the lock file
const LOCK_FILE_PATH = path.join(process.cwd(), "public", "shared-database.lock")
// Lock timeout in milliseconds (30 seconds)
const LOCK_TIMEOUT = 30000

// Ensure the directory exists
const ensureDirectoryExists = () => {
  const dir = path.dirname(LOCK_FILE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Check if lock is expired
const isLockExpired = (lockData: any): boolean => {
  if (!lockData || !lockData.timestamp) return true

  const lockTime = new Date(lockData.timestamp).getTime()
  const currentTime = new Date().getTime()

  return currentTime - lockTime > LOCK_TIMEOUT
}

// POST endpoint to acquire a lock
export async function POST(request: Request) {
  try {
    ensureDirectoryExists()

    const requestData = await request.json()
    const clientId = requestData.clientId || "unknown"

    // Generate a unique lock ID
    const lockId = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Check if lock file exists and is valid
    let canAcquireLock = true
    let currentLock = null

    if (fs.existsSync(LOCK_FILE_PATH)) {
      try {
        const lockContent = await readFile(LOCK_FILE_PATH, "utf8")
        currentLock = JSON.parse(lockContent)

        // If lock is not expired and held by another client, cannot acquire
        if (!isLockExpired(currentLock) && currentLock.clientId !== clientId) {
          canAcquireLock = false
        }
      } catch (error) {
        // If error reading lock file, assume it's corrupted and can be overwritten
        console.warn("Error reading lock file, assuming it's corrupted:", error)
      }
    }

    if (!canAcquireLock) {
      return NextResponse.json(
        { success: false, message: "Lock is currently held by another client" },
        { status: 423 }, // Locked status code
      )
    }

    // Create new lock
    const newLock = {
      lockId,
      clientId,
      timestamp: new Date().toISOString(),
    }

    // Write lock to file
    await writeFile(LOCK_FILE_PATH, JSON.stringify(newLock, null, 2), "utf8")

    return NextResponse.json({ success: true, lockId, message: "Lock acquired successfully" })
  } catch (error) {
    console.error("Error acquiring lock:", error)
    return NextResponse.json({ success: false, message: "Error acquiring lock", error: String(error) }, { status: 500 })
  }
}
