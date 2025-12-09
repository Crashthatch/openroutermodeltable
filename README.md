# OpenRouter Models Table

A comprehensive, sortable, and filterable table of all models available from [OpenRouter](https://openrouter.ai/).

## Features

- ✨ **Sortable columns**: Click on any column header to sort the table
- 🔍 **Searchable/Filterable**: Use the search box to filter models in real-time
- 📊 **Complete information**: Includes pricing, context length, architecture, release date, and more
- 🚀 **Static HTML**: Can be hosted anywhere - no server required
- 🔄 **Easy updates**: Simple scripts to regenerate the table with latest data
- 🔒 **Secure**: HTML escaping prevents XSS attacks

## Usage

### Quick Start

1. Generate the table using either Python or Node.js:

**Using Python:**
```bash
python3 generate_table.py
```

**Using Node.js:**
```bash
node generate_table.js
```

**Note:** Fetching statistics for all models can take a significant amount of time. You can use the `--limit` option to generate the table with stats for only the first N models:

```bash
node generate_table.js --limit 50
```

2. Open `index.html` in your web browser to view the interactive table

### What Gets Generated

The scripts will create two files:
- `index.html` - The interactive table ready to be viewed or hosted
- `models_data.json` - Raw JSON data from the OpenRouter API

### Hosting

Since `index.html` is a static file with no server dependencies, you can:
- Open it directly in a browser
- Host it on GitHub Pages
- Deploy to Netlify, Vercel, or any static hosting service
- Serve it from any web server

## Column Information

The table includes the following columns:

- **Model ID**: Unique identifier for the model
- **Name**: Human-readable model name
- **Context Length**: Maximum context window size
- **Prompt Price**: Cost per 1M input tokens
- **Completion Price**: Cost per 1M output tokens
- **Architecture**: Model architecture details (modality, tokenizer, instruction type)
- **Created**: Release/creation date
- **Top Provider**: Best available provider for this model
- **Tools**: Supports tools/function calling (✓/✗)
- **Reasoning**: Supports reasoning parameter (✓/✗)
- **Include Reasoning**: Supports include_reasoning parameter (✓/✗)
- **Response Format**: Supports response_format parameter (✓/✗)
- **Structured Outputs**: Supports structured_outputs parameter (✓/✗)
- **Throughput Min/Max/Median**: Minimum, maximum, and median throughput (tokens/sec) over the last 7 days
- **Latency Min/Max/Median**: Minimum, maximum, and median time to first token (ms) over the last 7 days
- **E2E Latency Min/Max/Median**: Minimum, maximum, and median end-to-end latency (ms) over the last 7 days
- **Uptime (7d avg)**: Average uptime percentage over the last 7 days

## Requirements

### Python Version
- Python 3.6 or higher
- No additional packages required (uses only standard library)

### Node.js Version
- Node.js 12 or higher
- No additional packages required (uses only built-in modules)

## API Documentation

This project uses the [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models) to fetch model data.

## License

MIT
