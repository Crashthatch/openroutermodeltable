#!/usr/bin/env node
/**
 * Fetch OpenRouter models data and generate a static HTML table.
 */

const https = require('https');
const fs = require('fs');

const API_URL = 'https://openrouter.ai/api/v1/models';

/**
 * Fetch models data from OpenRouter API
 */
function fetchModelsData() {
    return new Promise((resolve, reject) => {
        https.get(API_URL, {
            headers: {
                'User-Agent': 'OpenRouterModelTable/1.0'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Generate HTML page with sortable, filterable table
 */
function generateHTML(modelsData) {
    const models = modelsData.data || [];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenRouter Models Table</title>
    
    <!-- DataTables CSS -->
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" crossorigin="anonymous">
    
    <style>
        body {
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .container-fluid {
            max-width: 100%;
        }
        h1 {
            margin-bottom: 20px;
            color: #333;
        }
        .info-text {
            margin-bottom: 15px;
            color: #666;
        }
        table.dataTable {
            width: 100% !important;
        }
        .model-id {
            font-family: monospace;
            font-size: 0.9em;
        }
        .price-cell {
            text-align: right;
            font-family: monospace;
        }
        .context-length {
            text-align: right;
        }
        .created-date {
            white-space: nowrap;
        }
        .dataTables_wrapper {
            padding: 10px 0;
        }
        .architecture {
            font-size: 0.85em;
            color: #666;
        }
        .chip {
            display: inline-block;
            padding: 2px 8px;
            margin: 2px;
            border-radius: 12px;
            background-color: #e7f3ff;
            color: #0066cc;
            font-size: 0.8em;
        }
        .param-cell {
            text-align: center;
            font-size: 1.2em;
        }
        .param-yes {
            color: #28a745;
        }
        .param-no {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <h1>OpenRouter Models Table</h1>
        <p class="info-text">
            A comprehensive, sortable, and filterable table of all models available from OpenRouter.
            Click on column headers to sort. Use the search box to filter results.
        </p>
        <p class="info-text">
            <small>Last updated: ${timestamp}</small>
        </p>
        
        <table id="modelsTable" class="table table-striped table-bordered" style="width:100%">
            <thead>
                <tr>
                    <th>Model ID</th>
                    <th>Name</th>
                    <th>Context Length</th>
                    <th>Prompt Price (per 1M tokens)</th>
                    <th>Completion Price (per 1M tokens)</th>
                    <th>Architecture</th>
                    <th>Created</th>
                    <th>Top Provider</th>
                    <th>Tools</th>
                    <th>Reasoning</th>
                    <th>Include Reasoning</th>
                    <th>Response Format</th>
                    <th>Structured Outputs</th>
                </tr>
            </thead>
            <tbody>
`;
    
    // Add rows for each model
    models.forEach(model => {
        const modelId = model.id || '';
        const name = model.name || '';
        const contextLength = model.context_length || 0;
        
        // Get pricing information
        const pricing = model.pricing || {};
        const promptPrice = pricing.prompt || '0';
        const completionPrice = pricing.completion || '0';
        
        // Convert prices to per 1M tokens
        let promptPriceDisplay = 'N/A';
        let completionPriceDisplay = 'N/A';
        let promptPriceNumeric = 0;
        let completionPriceNumeric = 0;
        
        try {
            promptPriceNumeric = Math.round(parseFloat(promptPrice) * 1000000 * 10000) / 10000;
            promptPriceDisplay = `$${promptPriceNumeric.toFixed(4)}`;
        } catch (e) {}
        
        try {
            completionPriceNumeric = Math.round(parseFloat(completionPrice) * 1000000 * 10000) / 10000;
            completionPriceDisplay = `$${completionPriceNumeric.toFixed(4)}`;
        } catch (e) {}
        
        // Get other fields
        const architecture = model.architecture || {};
        const archModality = architecture.modality || '';
        const archTokenizer = architecture.tokenizer || '';
        const archInstructType = architecture.instruct_type || '';
        
        let archDisplay = archModality;
        if (archTokenizer) archDisplay += ` | ${archTokenizer}`;
        if (archInstructType) archDisplay += ` | ${archInstructType}`;
        
        const created = model.created || 0;
        const createdDate = created ? new Date(created * 1000).toISOString().split('T')[0] : 'N/A';
        
        const topProvider = model.top_provider || {};
        const topProviderName = topProvider.name || 'N/A';
        
        // Get supported parameters
        const supportedParams = model.supported_parameters || [];
        const supportsTools = supportedParams.includes('tools');
        const supportsReasoning = supportedParams.includes('reasoning');
        const supportsIncludeReasoning = supportedParams.includes('include_reasoning');
        const supportsResponseFormat = supportedParams.includes('response_format');
        const supportsStructuredOutputs = supportedParams.includes('structured_outputs');
        
        // Helper function to create parameter cell
        const paramCell = (supported) => {
            if (supported) {
                return `<td class="param-cell param-yes" data-order="1">✓</td>`;
            } else {
                return `<td class="param-cell param-no" data-order="0">✗</td>`;
            }
        };
        
        html += `                <tr>
                    <td class="model-id">${escapeHtml(modelId)}</td>
                    <td>${escapeHtml(name)}</td>
                    <td class="context-length" data-order="${contextLength}">${contextLength.toLocaleString()}</td>
                    <td class="price-cell" data-order="${promptPriceNumeric}">${escapeHtml(promptPriceDisplay)}</td>
                    <td class="price-cell" data-order="${completionPriceNumeric}">${escapeHtml(completionPriceDisplay)}</td>
                    <td class="architecture">${escapeHtml(archDisplay)}</td>
                    <td class="created-date">${escapeHtml(createdDate)}</td>
                    <td>${escapeHtml(topProviderName)}</td>
                    ${paramCell(supportsTools)}
                    ${paramCell(supportsReasoning)}
                    ${paramCell(supportsIncludeReasoning)}
                    ${paramCell(supportsResponseFormat)}
                    ${paramCell(supportsStructuredOutputs)}
                </tr>
`;
    });
    
    html += `            </tbody>
        </table>
    </div>
    
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" crossorigin="anonymous"></script>
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
    <!-- DataTables JS -->
    <script src="https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js" crossorigin="anonymous"></script>
    <script src="https://cdn.datatables.net/1.13.7/js/dataTables.bootstrap5.min.js" crossorigin="anonymous"></script>
    
    <script>
        $(document).ready(function() {
            const table = $('#modelsTable').DataTable({
                "pageLength": 25,
                "order": [[0, "asc"]],
                "lengthMenu": [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
                "columnDefs": [
                    { "type": "num", "targets": [2, 3, 4] }  // Numeric sorting for context and prices
                ],
                "initComplete": function () {
                    // Add filter dropdowns for parameter columns (columns 8-12)
                    this.api().columns([8, 9, 10, 11, 12]).every(function () {
                        const column = this;
                        const header = $(column.header());
                        
                        // Create select element
                        const select = $('<select class="form-select form-select-sm"><option value="">All</option></select>')
                            .appendTo(header)
                            .on('change', function () {
                                const val = $.fn.dataTable.util.escapeRegex($(this).val());
                                column.search(val ? '^' + val + '$' : '', true, false).draw();
                            })
                            .on('click', function(e) {
                                e.stopPropagation();
                            });
                        
                        // Add options
                        select.append('<option value="✓">✓ Yes</option>');
                        select.append('<option value="✗">✗ No</option>');
                    });
                }
            });
        });
    </script>
</body>
</html>
`;
    
    return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Main function
 */
async function main() {
    console.log('Fetching models data from OpenRouter API...');
    
    try {
        const modelsData = await fetchModelsData();
        console.log(`Successfully fetched ${modelsData.data ? modelsData.data.length : 0} models`);
        
        // Save the raw JSON data for reference
        fs.writeFileSync('models_data.json', JSON.stringify(modelsData, null, 2), 'utf-8');
        console.log('Saved raw data to models_data.json');
        
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
}

// Run main function if this is the main module
if (require.main === module) {
    main();
}

module.exports = { fetchModelsData, generateHTML };
