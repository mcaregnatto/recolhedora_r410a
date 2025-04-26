# Recolhedora R410-A

System for controlling R410-A gas collection.

## Features

- Simple file-based storage to ensure all users see the same data
- Accumulated and round control
- Collection history
- Data export to CSV
- Visual progress indicator
- Support for offline mode (viewing only)
- Synchronization mechanism

## Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`
   npm install
   \`\`\`
3. Run the project:
   \`\`\`
   npm run dev
   \`\`\`

## Usage

1. Enter your name in the "Operator Name" field
2. Enter the amount of gas withdrawn in grams
3. Click "Register"
4. When the accumulated reaches 10,000g, click "Change Cylinder"
5. To view history, click "History"
6. To export data, open the history and click "Export CSV"
7. Click "Sync" to manually synchronize data with the server

## Data Structure

Data is stored in a single shared JSON file (`public/database.json`). This ensures that all users see the same data, solving synchronization problems between devices.

### Conflict Prevention

The system uses a simple approach to prevent conflicts:
- Before writing, the system always reads the latest data
- Each operation is atomic (read latest data, make changes, write back)
- Local storage is used as a backup in case of connection issues

## Troubleshooting

- **Data doesn't appear**: Click the "Sync" button to update data from the server
- **Error saving**: Check your internet connection and try again
- **Inconsistent data**: Restart the server and check the database file

## Deployment

When deploying to a production environment, ensure that:
1. The `public` directory is writable by the application
2. The server has sufficient permissions to create and modify files
3. For cloud environments, consider using a more robust database solution
