const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Create a simple PPTX with images for testing
async function createTestPPTX() {
  const pythonScript = `
import os
try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.enum.text import PP_ALIGN
    
    # Create presentation
    prs = Presentation()
    
    # Title Slide
    slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(slide_layout)
    title = slide.shapes.title
    subtitle = slide.placeholders[1]
    
    title.text = "Neural Networks Study Guide"
    subtitle.text = "Chapter 1: Introduction to Neural Networks"
    
    # Content Slide 1
    slide_layout = prs.slide_layouts[1]
    slide = prs.slides.add_slide(slide_layout)
    title = slide.shapes.title
    content = slide.placeholders[1]
    
    title.text = "What are Neural Networks?"
    content.text = '''• Artificial neural networks are computing systems inspired by biological neural networks
• They consist of connected nodes called artificial neurons
• Each connection can transmit signals between neurons
• The network learns by adjusting the connection weights'''
    
    # Content Slide 2 with bullet points
    slide_layout = prs.slide_layouts[1]
    slide = prs.slides.add_slide(slide_layout)
    title = slide.shapes.title
    content = slide.placeholders[1]
    
    title.text = "Key Components"
    content.text = '''1. Input Layer
   - Receives the initial data
   - Each node represents a feature
   
2. Hidden Layers
   - Process the information
   - Apply transformations and activations
   
3. Output Layer
   - Produces the final result
   - Classification or regression output'''
    
    # Table Slide
    slide_layout = prs.slide_layouts[5]  # Title Only
    slide = prs.slides.add_slide(slide_layout)
    title = slide.shapes.title
    title.text = "Common Activation Functions"
    
    # Add table
    rows = 4
    cols = 3
    left = Inches(1)
    top = Inches(2)
    width = Inches(8)
    height = Inches(3)
    
    table = slide.shapes.add_table(rows, cols, left, top, width, height).table
    
    # Set headers
    table.cell(0, 0).text = 'Function'
    table.cell(0, 1).text = 'Formula'
    table.cell(0, 2).text = 'Use Case'
    
    # Add data
    table.cell(1, 0).text = 'Sigmoid'
    table.cell(1, 1).text = '1/(1+e^-x)'
    table.cell(1, 2).text = 'Binary classification'
    
    table.cell(2, 0).text = 'ReLU'
    table.cell(2, 1).text = 'max(0, x)'
    table.cell(2, 2).text = 'Hidden layers'
    
    table.cell(3, 0).text = 'Tanh'
    table.cell(3, 1).text = '(e^x - e^-x)/(e^x + e^-x)'
    table.cell(3, 2).text = 'Centered data'
    
    # Save
    prs.save('test-neural-networks.pptx')
    print("Created test-neural-networks.pptx successfully!")
    
except ImportError:
    print("python-pptx not installed. Creating a simple text file instead.")
    with open('test-neural-networks.txt', 'w') as f:
        f.write("""Neural Networks Study Guide

Chapter 1: Introduction to Neural Networks

What are Neural Networks?
• Artificial neural networks are computing systems inspired by biological neural networks
• They consist of connected nodes called artificial neurons
• Each connection can transmit signals between neurons
• The network learns by adjusting the connection weights

Key Components:
1. Input Layer
   - Receives the initial data
   - Each node represents a feature
   
2. Hidden Layers
   - Process the information
   - Apply transformations and activations
   
3. Output Layer
   - Produces the final result
   - Classification or regression output

Common Activation Functions:
Function | Formula | Use Case
---------|---------|----------
Sigmoid  | 1/(1+e^-x) | Binary classification
ReLU     | max(0, x) | Hidden layers
Tanh     | (e^x - e^-x)/(e^x + e^-x) | Centered data
""")
    print("Created test-neural-networks.txt as fallback")
`;

  const testDir = path.join(__dirname, '..', 'test-files');
  await fs.mkdir(testDir, { recursive: true });
  
  const scriptPath = path.join(testDir, 'create_pptx.py');
  await fs.writeFile(scriptPath, pythonScript);
  
  console.log('Creating test PowerPoint presentation...');
  
  try {
    const { stdout, stderr } = await execAsync(`cd "${testDir}" && python3 create_pptx.py`);
    console.log(stdout);
    if (stderr) console.error('Warnings:', stderr);
    
    // Clean up the script
    await fs.unlink(scriptPath);
    
    return path.join(testDir, 'test-neural-networks.pptx');
  } catch (error) {
    console.error('Error creating PPTX:', error.message);
    // Clean up the script
    try {
      await fs.unlink(scriptPath);
    } catch {}
    
    // Create a sample document description instead
    const sampleContent = `# Test Document for MarkItDown

This document would normally be a PowerPoint presentation with:

## Slide 1: Title
- Neural Networks Study Guide
- Chapter 1: Introduction

## Slide 2: Content
- Definition of neural networks
- Key components
- Learning process

## Slide 3: Table
| Function | Formula | Use Case |
|----------|---------|----------|
| Sigmoid | 1/(1+e^-x) | Binary classification |
| ReLU | max(0, x) | Hidden layers |
| Tanh | (e^x - e^-x)/(e^x + e^-x) | Centered data |
`;
    
    const mdPath = path.join(testDir, 'test-presentation.md');
    await fs.writeFile(mdPath, sampleContent);
    console.log('Created test markdown file as fallback');
    return mdPath;
  }
}

// Run the creation
createTestPPTX().then(filePath => {
  console.log(`\nTest file created at: ${filePath}`);
}).catch(console.error);