#!/usr/bin/env node

// Hook script to block Claude from accessing .env files
// This script receives the tool call information via stdin

process.stdin.setEncoding('utf8');

let stdinData = '';

process.stdin.on('data', (chunk) => {
  stdinData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the tool call data
    const toolCall = JSON.parse(stdinData);
    
    // Check if this is a Read or Grep tool call
    if (toolCall.tool === 'Read' || toolCall.tool === 'Grep') {
      // Check the file path parameter
      const filePath = toolCall.parameters?.file_path || toolCall.parameters?.path || '';
      
      // Check if the path contains .env (case insensitive)
      if (filePath.toLowerCase().includes('.env')) {
        // Block the operation and return error
        console.error('You cannot read the .env file');
        process.exit(1);
      }
      
      // For Grep tool, also check if searching within .env files
      if (toolCall.tool === 'Grep' && toolCall.parameters?.glob) {
        const glob = toolCall.parameters.glob.toLowerCase();
        if (glob.includes('.env')) {
          console.error('You cannot read the .env file');
          process.exit(1);
        }
      }
    }
    
    // Allow the operation to proceed
    process.exit(0);
    
  } catch (error) {
    // If we can't parse the input, allow the operation to proceed
    // to avoid blocking legitimate operations due to parsing errors
    process.exit(0);
  }
});

// Remove the duplicate readable handler that was causing JSON parsing issues