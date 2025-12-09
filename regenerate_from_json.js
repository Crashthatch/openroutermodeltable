#!/usr/bin/env node
/**
 * Generate HTML table from existing models_data.json
 */

const fs = require('fs');
const { generateHTML } = require('./generate_table.js');

try {
    // Read existing models_data.json
    const modelsData = JSON.parse(fs.readFileSync('models_data.json', 'utf-8'));
    console.log(`Loaded ${modelsData.data ? modelsData.data.length : 0} models from models_data.json`);
    
    // Generate HTML
    const htmlContent = generateHTML(modelsData);
    
    // Save HTML file
    fs.writeFileSync('index.html', htmlContent, 'utf-8');
    console.log('Generated index.html');
    console.log('\nDone! Open index.html in your browser to view the table.');
} catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
}
