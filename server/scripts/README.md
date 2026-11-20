# Chart Testing Scripts

This directory contains scripts for testing the chart generation system.

## Available Scripts

### 1. `testAllCharts.js`
Runs a comprehensive test of all chart types:
```bash
node testAllCharts.js
```

This will:
- Generate samples for all 15 chart types using AI
- Validate the structure of generated JSON
- Test rendering each chart to images
- Save results to JSON files

### 2. `generateChartSamples.js`
Generates chart data samples using AI:
```bash
node generateChartSamples.js
```

Output: `chartSamples.json`

### 3. `validateChartSamples.js`
Validates previously generated samples:
```bash
node validateChartSamples.js
```

Input: `chartSamples.json`
Output: `chartValidationResults.json`

### 4. `testSingleChart.js`
Tests a single chart type with optional custom prompt:
```bash
# Using default prompt
node testSingleChart.js bar

# Using custom prompt
node testSingleChart.js line "Create a line chart showing Bitcoin price over last week"
```

Available chart types:
- flow
- bar
- line
- pie
- mindmap
- gantt
- scatter
- area
- radar
- tree
- network
- heatmap
- bubble
- waterfall
- sankey

## Troubleshooting

### Common Issues

1. **"No JSON code block found"**
   - AI didn't wrap response in ```json blocks
   - Check AI prompts in `/server/prompts/chartPrompts.js`

2. **"Cannot read properties of undefined"**
   - Chart data structure doesn't match expected format
   - Check type definitions in `/shared/types/charts.ts`

3. **Rendering fails**
   - Missing required fields for chart type
   - Check chart generation service in `/server/services/chartGenerationService.js`

### Quick Fixes

To test if a specific chart type is working:
```bash
# Test with default prompt
node testSingleChart.js scatter

# Test with custom data
node testSingleChart.js bar "Show sales: Q1 $100k, Q2 $120k, Q3 $110k, Q4 $150k"
```

To regenerate all samples:
```bash
rm chartSamples.json chartValidationResults.json
node testAllCharts.js
```