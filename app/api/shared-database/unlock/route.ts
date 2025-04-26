import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { readFile, unlink } from "fs/promises"

// Path to the lock file
const LOCK_FILE_PATH = path.join(process.cwd(), "public", "shared-database.lock")

// POST endpoint to release a lock
export async function POST(request: Request) {
  try {
    const requestData = await request.json()
    const { lockId, clientId } = requestData

    // Check if lock file exists
    if (!fs.existsSync(LOCK_FILE_PATH)) {
      return NextResponse.json({ success: true, message: "Lock already released" })
    }

    // Read current lock
    const lockContent = await readFile(LOCK_FILE_PATH, "utf8")
    let currentLock

    try {
      currentLock = JSON.parse(lockContent)
    } catch (error) {
      // If error parsing lock file, assume it's corrupted and can be deleted
      await unlink(LOCK_FILE_PATH)
      return NextResponse.json({ success: true, message: "Corrupted lock file removed" })
    }

    // Check if this client owns the lock
    if (currentLock.lockId === lockId || currentLock.clientId === clientId) {
      // Delete the lock file
      await unlink(LOCK_FILE_PATH)
      return NextResponse.json({ success: true, message: "Lock released successfully" })
    } else {
      return NextResponse.json(
        { success: false, message: "Cannot release lock owned by another client" },
        { status: 403 },
      )
    }
  } catch (error) {
    console.error("Error releasing lock:", error)
    return NextResponse.json({ success: false, message: "Error releasing lock", error: String(error) }, { status: 500 })
  }
}
