const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'db.json');

try {
    const data = fs.readFileSync(dbPath, 'utf8');
    JSON.parse(data);
    console.log('Database JSON is valid.');
} catch (e) {
    console.log('Database JSON is corrupted:', e.message);
    console.log('Resetting database to safe state...');
    
    // Create a backup of the corrupted file just in case
    const backupPath = dbPath + '.bak-' + Date.now();
    try {
        fs.copyFileSync(dbPath, backupPath);
        console.log('Backup created at:', backupPath);
    } catch (copyErr) {
        console.error('Failed to create backup:', copyErr.message);
    }

    // Write a minimal valid database structure
    // This will trigger the server to re-seed on next start
    fs.writeFileSync(dbPath, '{"users":[],"topics":[],"proposals":[],"notifications":[],"schedules":[],"documents":[],"presentations":[],"emails":[]}', 'utf8');
    console.log('Database has been reset to an empty structure. The server will re-seed on next load.');
}
