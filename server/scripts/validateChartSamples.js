import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chartGenerationService } from '../services/chartGenerationService.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI escape codes for colors (in case chalk is not installed)
const colors = {
  green: (text) => chalk?.green ? chalk.green(text) : `\x1b[32m${text}\x1b[0m`,
  red: (text) => chalk?.red ? chalk.red(text) : `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => chalk?.yellow ? chalk.yellow(text) : `\x1b[33m${text}\x1b[0m`,
  blue: (text) => chalk?.blue ? chalk.blue(text) : `\x1b[34m${text}\x1b[0m`,
  gray: (text) => chalk?.gray ? chalk.gray(text) : `\x1b[90m${text}\x1b[0m`,
  bold: (text) => chalk?.bold ? chalk.bold(text) : `\x1b[1m${text}\x1b[0m`
};

async function validateChartData(chartData) {
  try {
    // Try to generate chart images
    const result = await chartGenerationService.generateChart(chartData);
    
    if (result.success) {
      return {
        success: true,
        previewSize: result.preview?.buffer?.length || 0,
        fullSize: result.full?.buffer?.length || 0,
        dimensions: {
          preview: { width: result.preview?.width, height: result.preview?.height },
          full: { width: result.full?.width, height: result.full?.height }
        }
      };
    } else {
      return {
        success: false,
        error: result.error || 'Unknown error'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Validation error'
    };
  }
}

async function validateFieldStructure(chartData) {
  const issues = [];
  
  // Basic structure validation
  if (!chartData.type) {
    issues.push('Missing required field: type');
  }
  if (!chartData.data) {
    issues.push('Missing required field: data');
  }
  
  // Type-specific validation
  switch (chartData.type) {
    case 'bar':
    case 'line':
    case 'area':
      if (!chartData.data?.labels) issues.push('Missing data.labels array');
      if (!chartData.data?.datasets) issues.push('Missing data.datasets array');
      if (chartData.data?.datasets && !Array.isArray(chartData.data.datasets)) {
        issues.push('data.datasets must be an array');
      }
      break;
      
    case 'pie':
      if (!chartData.data?.labels) issues.push('Missing data.labels array');
      if (!chartData.data?.values) issues.push('Missing data.values array');
      break;
      
    case 'scatter':
    case 'bubble':
      if (!chartData.data?.datasets) issues.push('Missing data.datasets array');
      chartData.data?.datasets?.forEach((dataset, i) => {
        if (!dataset.data || !Array.isArray(dataset.data)) {
          issues.push(`Dataset ${i}: data must be an array`);
        }
        dataset.data?.forEach((point, j) => {
          if (typeof point.x === 'undefined') issues.push(`Dataset ${i}, point ${j}: missing x value`);
          if (typeof point.y === 'undefined') issues.push(`Dataset ${i}, point ${j}: missing y value`);
          if (chartData.type === 'bubble' && typeof point.r === 'undefined') {
            issues.push(`Dataset ${i}, point ${j}: missing r value for bubble chart`);
          }
        });
      });
      break;
      
    case 'flow':
      if (!chartData.data?.nodes) issues.push('Missing data.nodes array');
      if (!chartData.data?.edges) issues.push('Missing data.edges array');
      break;
      
    case 'mindmap':
      if (!chartData.data?.root) issues.push('Missing data.root object');
      break;
      
    case 'gantt':
      if (!chartData.data?.tasks) issues.push('Missing data.tasks array');
      chartData.data?.tasks?.forEach((task, i) => {
        if (!task.name) issues.push(`Task ${i}: missing name`);
        if (!task.start) issues.push(`Task ${i}: missing start date`);
        if (!task.end) issues.push(`Task ${i}: missing end date`);
      });
      break;
      
    case 'radar':
      if (!chartData.data?.labels) issues.push('Missing data.labels array');
      if (!chartData.data?.datasets) issues.push('Missing data.datasets array');
      break;
      
    case 'tree':
      if (!chartData.data?.root) issues.push('Missing data.root object');
      break;
      
    case 'network':
      if (!chartData.data?.nodes) issues.push('Missing data.nodes array');
      if (!chartData.data?.edges) issues.push('Missing data.edges array');
      break;
      
    case 'heatmap':
      if (!chartData.data?.xLabels) issues.push('Missing data.xLabels array');
      if (!chartData.data?.yLabels) issues.push('Missing data.yLabels array');
      if (!chartData.data?.values) issues.push('Missing data.values 2D array');
      break;
      
    case 'waterfall':
      if (!chartData.data?.categories) issues.push('Missing data.categories array');
      if (!chartData.data?.values) issues.push('Missing data.values array');
      break;
      
    case 'sankey':
      if (!chartData.data?.nodes) issues.push('Missing data.nodes array');
      if (!chartData.data?.links) issues.push('Missing data.links array');
      break;
  }
  
  return issues;
}

async function main() {
  console.log(colors.bold('\n📊 Chart Sample Validation Tool\n'));
  
  // Load the generated samples
  const samplesPath = path.join(__dirname, 'chartSamples.json');
  
  try {
    const samplesContent = await fs.readFile(samplesPath, 'utf-8');
    const samples = JSON.parse(samplesContent);
    
    console.log(`Found ${samples.length} chart samples to validate\n`);
    
    const results = {
      total: samples.length,
      aiGenerated: { success: 0, failed: 0 },
      structureValid: { success: 0, failed: 0 },
      renderValid: { success: 0, failed: 0 },
      details: []
    };
    
    // Process each sample
    for (const sample of samples) {
      console.log(colors.blue(`\n━━━ ${sample.type.toUpperCase()} Chart ━━━`));
      
      const detail = {
        type: sample.type,
        aiSuccess: sample.success,
        structureIssues: [],
        renderResult: null
      };
      
      // Check if AI generated successfully
      if (sample.success) {
        results.aiGenerated.success++;
        console.log(colors.green('✓ AI Generation: Success'));
        
        // Validate structure
        const structureIssues = await validateFieldStructure(sample.chartData);
        detail.structureIssues = structureIssues;
        
        if (structureIssues.length === 0) {
          results.structureValid.success++;
          console.log(colors.green('✓ Structure: Valid'));
          
          // Try to render
          console.log(colors.gray('  Rendering chart...'));
          const renderResult = await validateChartData(sample.chartData);
          detail.renderResult = renderResult;
          
          if (renderResult.success) {
            results.renderValid.success++;
            console.log(colors.green('✓ Rendering: Success'));
            console.log(colors.gray(`  Preview: ${(renderResult.previewSize / 1024).toFixed(1)}KB (${renderResult.dimensions.preview.width}x${renderResult.dimensions.preview.height})`));
            console.log(colors.gray(`  Full: ${(renderResult.fullSize / 1024).toFixed(1)}KB (${renderResult.dimensions.full.width}x${renderResult.dimensions.full.height})`));
          } else {
            results.renderValid.failed++;
            console.log(colors.red(`✗ Rendering: Failed - ${renderResult.error}`));
          }
        } else {
          results.structureValid.failed++;
          console.log(colors.red('✗ Structure: Invalid'));
          structureIssues.forEach(issue => {
            console.log(colors.red(`  - ${issue}`));
          });
        }
      } else {
        results.aiGenerated.failed++;
        console.log(colors.red(`✗ AI Generation: Failed - ${sample.error}`));
        if (sample.rawJson) {
          console.log(colors.gray('  Raw JSON:'));
          console.log(colors.gray(sample.rawJson.substring(0, 200) + '...'));
        }
      }
      
      results.details.push(detail);
    }
    
    // Summary
    console.log(colors.bold('\n\n═══ VALIDATION SUMMARY ═══\n'));
    
    console.log(colors.bold('AI Generation:'));
    console.log(`  ${colors.green(`✓ Success: ${results.aiGenerated.success}`)}`);
    console.log(`  ${colors.red(`✗ Failed: ${results.aiGenerated.failed}`)}`);
    
    console.log(colors.bold('\nStructure Validation:'));
    console.log(`  ${colors.green(`✓ Valid: ${results.structureValid.success}`)}`);
    console.log(`  ${colors.red(`✗ Invalid: ${results.structureValid.failed}`)}`);
    
    console.log(colors.bold('\nRendering:'));
    console.log(`  ${colors.green(`✓ Success: ${results.renderValid.success}`)}`);
    console.log(`  ${colors.red(`✗ Failed: ${results.renderValid.failed}`)}`);
    
    // Success rate
    const overallSuccess = results.renderValid.success;
    const successRate = (overallSuccess / results.total * 100).toFixed(1);
    
    console.log(colors.bold(`\nOverall Success Rate: ${successRate}%`));
    
    // Problem charts
    const problemCharts = results.details.filter(d => 
      !d.aiSuccess || 
      d.structureIssues.length > 0 || 
      (d.renderResult && !d.renderResult.success)
    );
    
    if (problemCharts.length > 0) {
      console.log(colors.bold('\n\n⚠️  CHARTS REQUIRING ATTENTION:\n'));
      
      problemCharts.forEach(chart => {
        console.log(colors.yellow(`${chart.type}:`));
        if (!chart.aiSuccess) {
          console.log(colors.red('  - AI generation failed'));
        }
        if (chart.structureIssues.length > 0) {
          console.log(colors.red(`  - Structure issues: ${chart.structureIssues.join(', ')}`));
        }
        if (chart.renderResult && !chart.renderResult.success) {
          console.log(colors.red(`  - Rendering failed: ${chart.renderResult.error}`));
        }
      });
    }
    
    // Save detailed results
    const resultsPath = path.join(__dirname, 'chartValidationResults.json');
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(colors.gray(`\nDetailed results saved to: ${resultsPath}`));
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(colors.red('\n❌ Error: chartSamples.json not found!'));
      console.error(colors.yellow('Please run generateChartSamples.js first to generate the samples.\n'));
    } else {
      console.error(colors.red('\n❌ Error:'), error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);