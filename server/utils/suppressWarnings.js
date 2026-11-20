/**
 * Suppress specific warnings that don't affect functionality
 */

// Store original console.warn
const originalWarn = console.warn;

// List of warnings to suppress
const warningsToSuppress = [
  'Class GNotificationCenterDelegate is implemented in both',
  'objc[',
  'This may cause spurious casting failures'
];

// Override console.warn
console.warn = function(...args) {
  const message = args.join(' ');
  
  // Check if this is a warning we want to suppress
  const shouldSuppress = warningsToSuppress.some(warning => 
    message.includes(warning)
  );
  
  if (!shouldSuppress) {
    // Call original console.warn
    originalWarn.apply(console, args);
  }
};

// Also suppress via process warnings
process.on('warning', (warning) => {
  const shouldSuppress = warningsToSuppress.some(w => 
    warning.message?.includes(w) || warning.stack?.includes(w)
  );
  
  if (!shouldSuppress) {
    console.log('Warning:', warning.message);
  }
});

module.exports = {
  restoreWarnings: () => {
    console.warn = originalWarn;
  }
};