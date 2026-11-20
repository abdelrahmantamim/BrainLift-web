/**
 * Prompt sanitization utility to prevent AI prompt injection attacks.
 * Strips known injection patterns and limits input length.
 */

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?prior\s+instructions?/gi,
  /disregard\s+(all\s+)?previous/gi,
  /disregard\s+(all\s+)?prior/gi,
  /forget\s+(all\s+)?your\s+instructions?/gi,
  /forget\s+(all\s+)?(everything|what)\s+(you\s+were|I)\s+(told|said)/gi,
  /you\s+are\s+now\s+a/gi,
  /act\s+as\s+(a\s+|an\s+)?(?!if)/gi,  // "act as" but not "act as if" (common in instructions)
  /new\s+instructions?:/gi,
  /system\s*prompt/gi,
  /\bOVERRIDE\b/gi,
  /\bSYSTEM\b:\s/gi,
  /\]\s*\n?\s*\[?\s*system/gi,
  /do\s+not\s+follow\s+(the\s+)?(above|previous|prior)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /roleplay\s+as/gi,
  /switch\s+to\s+.{0,20}\s+mode/gi,
  /enter\s+.{0,20}\s+mode/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
];

// Max length for custom instructions
const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 500;

/**
 * Sanitize user-supplied custom instructions to prevent prompt injection.
 * @param {string} input - Raw user input
 * @returns {string} Sanitized input safe for inclusion in AI prompts
 */
export function sanitizeCustomInstructions(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Cap length
  if (sanitized.length > MAX_CUSTOM_INSTRUCTIONS_LENGTH) {
    sanitized = sanitized.substring(0, MAX_CUSTOM_INSTRUCTIONS_LENGTH);
  }

  // Strip markdown code blocks (could hide injection)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '');
  sanitized = sanitized.replace(/`[^`]*`/g, '');

  // Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[removed]');
  }

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s{3,}/g, '  ').trim();

  return sanitized;
}

/**
 * Validate that a UUID string is properly formatted.
 * @param {string} id - The string to validate
 * @returns {boolean} Whether the string is a valid UUID v4
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
