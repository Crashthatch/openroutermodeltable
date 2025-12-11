#!/usr/bin/env node
/**
 * Fetch OpenRouter models data and generate a static HTML table.
 */

const https = require('https');
const fs = require('fs');

const API_URL = 'https://openrouter.ai/api/v1/models';
const ANALYTICS_API_URL = 'https://openrouter.ai/api/frontend/models/find?order=newest';

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
 * Fetch analytics data from OpenRouter API
 */
function fetchAnalyticsData() {
    return new Promise((resolve, reject) => {
        https.get(ANALYTICS_API_URL, {
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
 * Fetch stats data from OpenRouter API for a specific model
 */
function fetchStatsData(permaslug, statsType) {
    return new Promise((resolve, reject) => {
        const encodedSlug = encodeURIComponent(permaslug);
        const url = `https://openrouter.ai/api/frontend/stats/${statsType}?permaslug=${encodedSlug}`;

        https.get(url, {
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
                    // If stats are not available, return null instead of failing
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            // If stats are not available, return null instead of failing
            resolve(null);
        });
    });
}

/**
 * Calculate min, max, median from an array of numbers
 */
function calculateStats(values) {
    if (!values || values.length === 0) {
        return { min: null, max: null, median: null };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    let median;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        median = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        median = sorted[mid];
    }

    return { min, max, median };
}

/**
 * Extract values from stats API response
 */
function extractStatsValues(statsData) {
    if (!statsData || !statsData.data) {
        return [];
    }

    const values = [];
    for (const entry of statsData.data) {
        if (entry.y) {
            // Get the first provider's value
            const providerValues = Object.values(entry.y);
            if (providerValues.length > 0) {
                values.push(providerValues[0]);
            }
        }
    }

    return values;
}

/**
 * Calculate average uptime from recent uptime data
 */
function calculateAverageUptime(uptimeData) {
    if (!uptimeData || !uptimeData.data) {
        return null;
    }

    const providerData = Object.values(uptimeData.data)[0];
    if (!providerData || providerData.length === 0) {
        return null;
    }

    const uptimes = providerData.map(entry => entry.uptime).filter(uptime => uptime !== null);
    if (uptimes.length === 0) {
        return null;
    }
    const sum = uptimes.reduce((a, b) => a + b, 0);
    return sum / uptimes.length;
}

/**
 * Fetch endpoint stats for a model (top provider info)
 */
function fetchEndpointStats(permaslug, variant = 'standard') {
    return new Promise((resolve) => {
        const encodedSlug = encodeURIComponent(permaslug);
        const url = `https://openrouter.ai/api/frontend/stats/endpoint?permaslug=${encodedSlug}&variant=${variant}`;

        https.get(url, {
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
                    // If stats are not available, return null instead of failing
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            // If stats are not available, return null instead of failing
            resolve(null);
        });
    });
}

/**
 * Extract top provider stats from endpoint stats API response
 */
function extractTopProviderStats(endpointData) {
    if (!endpointData || !endpointData.data || endpointData.data.length === 0) {
        return null;
    }

    // Get the first endpoint (top provider)
    const topEndpoint = endpointData.data[0];
    const stats = topEndpoint.stats || {};

    return {
        p50_throughput: stats.p50_throughput || null,
        p50_latency: stats.p50_latency || null,
        request_count: stats.request_count || null
    };
}

/**
 * Fetch all stats for a model
 */
async function fetchModelStats(canonicalSlug) {
    if (!canonicalSlug) {
        return null;
    }

    try {
        const [throughputData, latencyData, e2eLatencyData, uptimeData, endpointData] = await Promise.all([
            fetchStatsData(canonicalSlug, 'throughput-comparison'),
            fetchStatsData(canonicalSlug, 'latency-comparison'),
            fetchStatsData(canonicalSlug, 'latency-e2e-comparison'),
            fetchStatsData(canonicalSlug, 'uptime-recent'),
            fetchEndpointStats(canonicalSlug)
        ]);

        const throughputValues = extractStatsValues(throughputData);
        const latencyValues = extractStatsValues(latencyData);
        const e2eLatencyValues = extractStatsValues(e2eLatencyData);
        const avgUptime = calculateAverageUptime(uptimeData);
        const topProviderStats = extractTopProviderStats(endpointData);

        return {
            throughput: calculateStats(throughputValues),
            latency: calculateStats(latencyValues),
            e2eLatency: calculateStats(e2eLatencyValues),
            uptime: avgUptime,
            topProvider: topProviderStats
        };
    } catch (err) {
        console.error(`Error fetching stats for ${canonicalSlug}: ${err.message}`);
        return null;
    }
}

/**
 * Generate HTML page with sortable, filterable table
 */
function generateHTML(modelsData, modelsStats, analyticsData = null) {
    const models = modelsData.data || [];
    const analytics = analyticsData || {};
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
            font-size: 0.9em;
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
        /* Tooltip styling for model names */
        #modelsTable tbody tr td:nth-child(2) {
            cursor: help;
        }
        #modelsTable tbody tr td:nth-child(2):hover {
            background-color: #f0f8ff;
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
        .stats-cell {
            text-align: right;
            font-family: monospace;
            font-size: 0.85em;
        }
        .stats-na {
            text-align: center;
            color: #999;
        }
        /* Filter input styling */
        .filter-input {
            width: 100%;
            padding: 6px 10px;
            margin-top: 5px;
            font-size: 0.85em;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .filter-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 8px;
            min-width: 80px;
        }
        .filter-container input {
            width: 100%;
            padding: 6px 10px;
            font-size: 0.85em;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
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
        <p class="info-text">
            <small>Top Provider columns show P50 throughput (tokens/sec), P50 latency (ms), and request count for the best provider. Stats columns show min/max/median values over the last 7 days.</small>
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
                    <th>Supports reasoning</th>
                    <th>Supports include_reasoning</th>
                    <th>Supports response_format</th>
                    <th>Supports structured_output</th>
                    <th>Supports caching</th>
                    <th>Top Provider Throughput (P50) (tps)</th>
                    <th>Top Provider Latency (P50) (ms)</th>
                    <th>Top Provider Request Count</th>
                    <th>Throughput Min (tps)</th>
                    <th>Throughput Max (tps)</th>
                    <th>Throughput Median (tps)</th>
                    <th>Latency Min (ms)</th>
                    <th>Latency Max (ms)</th>
                    <th>Latency Median (ms)</th>
                    <th>E2E Latency Min (ms)</th>
                    <th>E2E Latency Max (ms)</th>
                    <th>E2E Latency Median (ms)</th>
                    <th>Uptime (7d avg)</th>
                    <th>Total Prompt Tokens</th>
                    <th>Total Completion Tokens</th>
                </tr>
            </thead>
            <tbody>
`;
    
    // Add rows for each model
    models.forEach(model => {
        const modelId = model.id || '';
        const canonicalSlug = model.canonical_slug || '';
        const permaslug = model.permaslug || canonicalSlug;
        // Extract base model ID without variant suffix (e.g., "model:free" -> "model")
        const baseModelId = modelId.split(':')[0];
        const name = model.name || '';
        const description = model.description || '';
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
        
        // Check if model supports caching by checking for the presence of input_cache_read field in pricing
        // Models with caching support have this field to indicate the cached input read pricing
        const supportsCaching = 'input_cache_read' in pricing;
        
        // Get stats for this model
        const stats = modelsStats[canonicalSlug] || modelsStats[permaslug] || null;

        // Get analytics data for this model
        // The analytics data is keyed by various slugs, try them all
        const modelAnalytics = analytics[modelId] || analytics[baseModelId] || analytics[canonicalSlug] || analytics[permaslug] || null;
        const totalPromptTokens = modelAnalytics ? modelAnalytics.total_prompt_tokens : null;
        const totalCompletionTokens = modelAnalytics ? modelAnalytics.total_completion_tokens : null;

        // Helper function to create parameter cell
        const paramCell = (supported) => {
            if (supported) {
                return `<td class="param-cell param-yes" data-order="1">✓</td>`;
            } else {
                return `<td class="param-cell param-no" data-order="0">✗</td>`;
            }
        };
        
        // Helper function to format stats cell
        const statsCell = (value, decimals = 2) => {
            if (value === null || value === undefined) {
                return `<td class="stats-na" data-order="-1">N/A</td>`;
            }
            return `<td class="stats-cell" data-order="${value}">${value.toFixed(decimals)}</td>`;
        };

        // Helper function to format integer stats cell (for counts)
        const statsCountCell = (value) => {
            if (value === null || value === undefined) {
                return `<td class="stats-na" data-order="-1">N/A</td>`;
            }
            return `<td class="stats-cell" data-order="${value}">${value.toLocaleString()}</td>`;
        };

        // Extract top provider stats for easier access
        const topProviderStats = stats && stats.topProvider;

        html += `                <tr>
                    <td class="model-id">${escapeHtml(modelId)}</td>
                    <td title="${escapeHtml(description)}">${escapeHtml(name)}</td>
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
                    ${paramCell(supportsCaching)}
                    ${topProviderStats ? statsCell(topProviderStats.p50_throughput, 2) : statsCell(null)}
                    ${topProviderStats ? statsCell(topProviderStats.p50_latency, 0) : statsCell(null)}
                    ${topProviderStats ? statsCountCell(topProviderStats.request_count) : statsCountCell(null)}
                    ${stats ? statsCell(stats.throughput.min, 2) : statsCell(null)}
                    ${stats ? statsCell(stats.throughput.max, 2) : statsCell(null)}
                    ${stats ? statsCell(stats.throughput.median, 2) : statsCell(null)}
                    ${stats ? statsCell(stats.latency.min, 0) : statsCell(null)}
                    ${stats ? statsCell(stats.latency.max, 0) : statsCell(null)}
                    ${stats ? statsCell(stats.latency.median, 0) : statsCell(null)}
                    ${stats ? statsCell(stats.e2eLatency.min, 0) : statsCell(null)}
                    ${stats ? statsCell(stats.e2eLatency.max, 0) : statsCell(null)}
                    ${stats ? statsCell(stats.e2eLatency.median, 0) : statsCell(null)}
                    ${stats && stats.uptime !== null ? statsCell(stats.uptime, 2) : statsCell(null)}
                    ${statsCountCell(totalPromptTokens)}
                    ${statsCountCell(totalCompletionTokens)}
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
            // Helper function to parse numeric values from table cells
            function parseNumericValue(value) {
                if (!value || value === 'N/A') return null;
                // Remove $ signs, commas, and other non-numeric characters except decimal point and minus
                const cleaned = value.replace(/[$,]/g, '');
                const parsed = parseFloat(cleaned);
                return isNaN(parsed) ? null : parsed;
            }
            
            // Generic range filtering function for numeric columns
            function createNumericFilter(columnIndex, minFilterId, maxFilterId) {
                return function(settings, data, dataIndex) {
                    const minInput = $(\`#\${minFilterId}\`).val();
                    const maxInput = $(\`#\${maxFilterId}\`).val();
                    
                    if (!minInput && !maxInput) return true;
                    
                    const min = parseFloat(minInput);
                    const max = parseFloat(maxInput);
                    const value = parseNumericValue(data[columnIndex]);
                    
                    // If value is null (N/A), exclude from filtered results unless no filters are set
                    if (value === null) return false;
                    
                    if (!isNaN(min) && !isNaN(max)) {
                        return value >= min && value <= max;
                    } else if (!isNaN(min)) {
                        return value >= min;
                    } else if (!isNaN(max)) {
                        return value <= max;
                    }
                    return true;
                };
            }
            
            // Add filter for Context Length (column 2)
            $.fn.dataTable.ext.search.push(createNumericFilter(2, 'contextMinFilter', 'contextMaxFilter'));
            
            // Add filters for Prompt Price (column 3)
            $.fn.dataTable.ext.search.push(createNumericFilter(3, 'promptPriceMin', 'promptPriceMax'));
            
            // Add filters for Completion Price (column 4)
            $.fn.dataTable.ext.search.push(createNumericFilter(4, 'completionPriceMin', 'completionPriceMax'));
            
            // Add filters for P50 columns 
            $.fn.dataTable.ext.search.push(createNumericFilter(14, 'throughputP50Min', 'throughputP50Max'));
            $.fn.dataTable.ext.search.push(createNumericFilter(15, 'latencyP50Min', 'latencyP50Max'));
            $.fn.dataTable.ext.search.push(createNumericFilter(16, 'requestCountMin', 'requestCountMax'));
            
            // Add filters for Throughput columns 
            $.fn.dataTable.ext.search.push(createNumericFilter(17, 'throughputMinMin', 'throughputMinMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(18, 'throughputMaxMin', 'throughputMaxMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(19, 'throughputMedianMin', 'throughputMedianMax'));
            
            // Add filters for Latency columns 
            $.fn.dataTable.ext.search.push(createNumericFilter(20, 'latencyMinMin', 'latencyMinMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(21, 'latencyMaxMin', 'latencyMaxMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(22, 'latencyMedianMin', 'latencyMedianMax'));
            
            // Add filters for E2E Latency column
            $.fn.dataTable.ext.search.push(createNumericFilter(23, 'e2eLatencyMinMin', 'e2eLatencyMinMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(24, 'e2eLatencyMaxMin', 'e2eLatencyMaxMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(25, 'e2eLatencyMedianMin', 'e2eLatencyMedianMax'));
            
            // Add filter for Uptime (column 26)
            $.fn.dataTable.ext.search.push(createNumericFilter(26, 'uptimeMin', 'uptimeMax'));
            
            // Add filters for Total Tokens columns
            $.fn.dataTable.ext.search.push(createNumericFilter(27, 'totalPromptTokensMin', 'totalPromptTokensMax'));
            $.fn.dataTable.ext.search.push(createNumericFilter(28, 'totalCompletionTokensMin', 'totalCompletionTokensMax'));
            
            // Custom range filtering function for Created Date
            // Note: String comparison works correctly for ISO 8601 dates (YYYY-MM-DD format)
            $.fn.dataTable.ext.search.push(
                function(settings, data, dataIndex) {
                    const minDate = $('#createdMinFilter').val();
                    const maxDate = $('#createdMaxFilter').val();
                    const createdDate = data[6] || '';
                    
                    if ((!minDate && !maxDate) ||
                        (!minDate && createdDate <= maxDate) ||
                        (minDate <= createdDate && !maxDate) ||
                        (minDate <= createdDate && createdDate <= maxDate)) {
                        return true;
                    }
                    return false;
                }
            );
            
            // Helper function to add min/max filters to a column
            function addMinMaxFilter(api, columnIndex, minId, maxId, inputType = 'text') {
                const header = $(api.column(columnIndex).header());
                const filterDiv = $('<div class="filter-container"></div>');
                
                const minInput = \`<input type="\${inputType}" id="\${minId}" placeholder="Min" class="filter-input" />\`;
                const maxInput = \`<input type="\${inputType}" id="\${maxId}" placeholder="Max" class="filter-input" />\`;
                
                filterDiv.append(minInput);
                filterDiv.append(maxInput);
                header.append(filterDiv);
                
                \`#\${minId}, #\${maxId}\`.split(', ').forEach(selector => {
                    $(selector).on('keyup change', function() {
                        table.draw();
                    }).on('click', function(e) {
                        e.stopPropagation();
                    });
                });
            }
            
            const table = $('#modelsTable').DataTable({
                "pageLength": -1,
                "order": [[0, "asc"]],
                "lengthMenu": [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
                "columnDefs": [
                    // Numeric sorting
                    { "type": "num", "targets": [2, 3, 4, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28] }
                ],
                "initComplete": function () {
                    const api = this.api();
                    
                    // Add min/max filters for Context Length (column 2)
                    addMinMaxFilter(api, 2, 'contextMinFilter', 'contextMaxFilter');
                    
                    // Add min/max filters for Prompt Price (column 3)
                    addMinMaxFilter(api, 3, 'promptPriceMin', 'promptPriceMax');
                    
                    // Add min/max filters for Completion Price (column 4)
                    addMinMaxFilter(api, 4, 'completionPriceMin', 'completionPriceMax');
                    
                    // Add date range filters for Created (column 6)
                    addMinMaxFilter(api, 6, 'createdMinFilter', 'createdMaxFilter', 'date');
                    
                    // Add filter dropdowns for parameter columns (columns 8-13)
                    api.columns([8, 9, 10, 11, 12, 13]).every(function () {
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
                    
                    // Add min/max filters for P50 columns 
                    addMinMaxFilter(api, 14, 'throughputP50Min', 'throughputP50Max');
                    addMinMaxFilter(api, 15, 'latencyP50Min', 'latencyP50Max');
                    addMinMaxFilter(api, 16, 'requestCountMin', 'requestCountMax');
                    
                    // Add min/max filters for Throughput columns 
                    addMinMaxFilter(api, 17, 'throughputMinMin', 'throughputMinMax');
                    addMinMaxFilter(api, 18, 'throughputMaxMin', 'throughputMaxMax');
                    addMinMaxFilter(api, 19, 'throughputMedianMin', 'throughputMedianMax');
                    
                    // Add min/max filters for Latency columns
                    addMinMaxFilter(api, 20, 'latencyMinMin', 'latencyMinMax');
                    addMinMaxFilter(api, 21, 'latencyMaxMin', 'latencyMaxMax');
                    addMinMaxFilter(api, 22, 'latencyMedianMin', 'latencyMedianMax');
                    
                    // Add min/max filters for E2E Latency columns
                    addMinMaxFilter(api, 23, 'e2eLatencyMinMin', 'e2eLatencyMinMax');
                    addMinMaxFilter(api, 24, 'e2eLatencyMaxMin', 'e2eLatencyMaxMax');
                    addMinMaxFilter(api, 25, 'e2eLatencyMedianMin', 'e2eLatencyMedianMax');
                    
                    // Add min/max filter for Uptime
                    addMinMaxFilter(api, 26, 'uptimeMin', 'uptimeMax');
                    
                    // Add min/max filters for Total Tokens columns
                    addMinMaxFilter(api, 27, 'totalPromptTokensMin', 'totalPromptTokensMax');
                    addMinMaxFilter(api, 28, 'totalCompletionTokensMin', 'totalCompletionTokensMax');
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
        
        // Fetch stats for models
        console.log('Fetching statistics for models...');
        const modelsStats = {};
        const models = modelsData.data || [];

        // Check for command line argument to limit number of models
        const args = process.argv.slice(2);
        const limitIndex = args.indexOf('--limit');
        let limit = models.length;
        if (limitIndex !== -1 && args[limitIndex + 1]) {
            const parsedLimit = parseInt(args[limitIndex + 1]);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = parsedLimit;
                console.log(`Limiting stats fetch to first ${limit} models`);
            } else {
                console.warn(`Invalid limit value: ${args[limitIndex + 1]}, ignoring`);
            }
        }

        // Fetch stats concurrently in batches of 10 to speed up the process
        const batchSize = 30;
        const modelsToFetch = models.slice(0, limit);

        for (let i = 0; i < modelsToFetch.length; i += batchSize) {
            const batch = modelsToFetch.slice(i, Math.min(i + batchSize, modelsToFetch.length));
            console.log(`Fetching stats batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(modelsToFetch.length / batchSize)} (${batch.length} models)...`);

            const batchPromises = batch.map(async (model) => {
                if (model.canonical_slug) {
                    const stats = await fetchModelStats(model.canonical_slug);
                    return { slug: model.canonical_slug, stats };
                }
                return null;
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                if (result && result.stats) {
                    modelsStats[result.slug] = result.stats;
                }
            });

            // Add a small delay between batches to avoid overwhelming the API
            if (i + batchSize < modelsToFetch.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // save modelStats to a JSON file
        fs.writeFileSync('models_stats.json', JSON.stringify(modelsStats, null, 2), 'utf-8');
        console.log('Saved stats data to models_stats.json');

        console.log(`Fetched stats for ${Object.keys(modelsStats).length} models`);

        // Fetch analytics data
        console.log('Fetching analytics data from OpenRouter API...');
        const analyticsData = await fetchAnalyticsData();
        const analyticsModels = analyticsData.data && analyticsData.data.analytics ? analyticsData.data.analytics : {};
        console.log(`Successfully fetched analytics data for ${Object.keys(analyticsModels).length} models`);

        // Save analytics data to JSON file
        fs.writeFileSync('models_analytics.json', JSON.stringify(analyticsModels, null, 2), 'utf-8');
        console.log('Saved analytics data to models_analytics.json');

        // Generate HTML
        const htmlContent = generateHTML(modelsData, modelsStats, analyticsModels);
        
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
