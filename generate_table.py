#!/usr/bin/env python3
"""
Fetch OpenRouter models data and generate a static HTML table.
"""

import html
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, List, Any

API_URL = "https://openrouter.ai/api/v1/models"


def fetch_models_data() -> Dict[str, Any]:
    """Fetch models data from OpenRouter API."""
    try:
        req = urllib.request.Request(
            API_URL,
            headers={
                'User-Agent': 'OpenRouterModelTable/1.0'
            }
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data
    except urllib.error.URLError as e:
        print(f"Error fetching data from API: {e}")
        raise


def generate_html(models_data: Dict[str, Any]) -> str:
    """Generate HTML page with sortable, filterable table."""
    
    # Get the models list
    models = models_data.get('data', [])
    
    html_template = '''<!DOCTYPE html>
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
            <small>Last updated: ''' + datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') + '''</small>
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
                </tr>
            </thead>
            <tbody>
'''
    
    # Add rows for each model
    for model in models:
        model_id = model.get('id', '')
        name = model.get('name', '')
        context_length = model.get('context_length', 0)
        
        # Get pricing information
        pricing = model.get('pricing', {})
        prompt_price = pricing.get('prompt', '0')
        completion_price = pricing.get('completion', '0')
        
        # Convert prices to per 1M tokens (they're provided as per-token prices)
        try:
            prompt_price_numeric = round(float(prompt_price) * 1_000_000, 4)
            prompt_price_display = f"${prompt_price_numeric:.4f}"
        except (ValueError, TypeError):
            prompt_price_numeric = 0
            prompt_price_display = "N/A"
            
        try:
            completion_price_numeric = round(float(completion_price) * 1_000_000, 4)
            completion_price_display = f"${completion_price_numeric:.4f}"
        except (ValueError, TypeError):
            completion_price_numeric = 0
            completion_price_display = "N/A"
        
        # Get other fields
        architecture = model.get('architecture', {})
        arch_modality = architecture.get('modality', '')
        arch_tokenizer = architecture.get('tokenizer', '')
        arch_instruct_type = architecture.get('instruct_type', '')
        
        arch_display = f"{arch_modality}"
        if arch_tokenizer:
            arch_display += f" | {arch_tokenizer}"
        if arch_instruct_type:
            arch_display += f" | {arch_instruct_type}"
        
        created = model.get('created', 0)
        created_date = datetime.fromtimestamp(created, tz=timezone.utc).strftime('%Y-%m-%d') if created else 'N/A'
        
        top_provider = model.get('top_provider', {})
        top_provider_name = top_provider.get('name', 'N/A') if top_provider else 'N/A'
        
        html_template += f'''                <tr>
                    <td class="model-id">{html.escape(model_id)}</td>
                    <td>{html.escape(name)}</td>
                    <td class="context-length" data-order="{context_length}">{context_length:,}</td>
                    <td class="price-cell" data-order="{prompt_price_numeric}">{html.escape(prompt_price_display)}</td>
                    <td class="price-cell" data-order="{completion_price_numeric}">{html.escape(completion_price_display)}</td>
                    <td class="architecture">{html.escape(arch_display)}</td>
                    <td class="created-date">{html.escape(created_date)}</td>
                    <td>{html.escape(top_provider_name)}</td>
                </tr>
'''
    
    html_template += '''            </tbody>
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
            $('#modelsTable').DataTable({
                "pageLength": 25,
                "order": [[0, "asc"]],
                "lengthMenu": [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
                "columnDefs": [
                    { "type": "num", "targets": [2, 3, 4] }  // Numeric sorting for context and prices
                ]
            });
        });
    </script>
</body>
</html>
'''
    
    return html_template


def main():
    """Main function to fetch data and generate HTML."""
    print("Fetching models data from OpenRouter API...")
    
    try:
        models_data = fetch_models_data()
        print(f"Successfully fetched {len(models_data.get('data', []))} models")
        
        # Save the raw JSON data for reference
        with open('models_data.json', 'w', encoding='utf-8') as f:
            json.dump(models_data, f, indent=2, ensure_ascii=False)
        print("Saved raw data to models_data.json")
        
        # Generate HTML
        html_content = generate_html(models_data)
        
        # Save HTML file
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(html_content)
        print("Generated index.html")
        
        print("\nDone! Open index.html in your browser to view the table.")
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
