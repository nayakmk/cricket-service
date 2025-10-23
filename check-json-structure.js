const fs = require('fs');
const data = JSON.parse(fs.readFileSync('reports/cricket_matches_from_pdfs_final.json', 'utf8'));
console.log('Sample match innings structure:');
console.log(JSON.stringify(data[0].innings, null, 2));