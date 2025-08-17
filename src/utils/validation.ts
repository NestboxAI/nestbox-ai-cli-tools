/**
 * Validates if a string is a valid JavaScript/TypeScript function name
 */
export function isValidFunctionName(name: string): boolean {
  // Check if it's a valid JavaScript identifier
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  
  // Check if it's not a reserved keyword
  const reservedKeywords = [
    'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'double', 'else', 'enum', 'eval', 'export', 'extends', 'false', 'final',
    'finally', 'float', 'for', 'function', 'goto', 'if', 'implements', 'import',
    'in', 'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new',
    'null', 'package', 'private', 'protected', 'public', 'return', 'short',
    'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
    'transient', 'true', 'try', 'typeof', 'var', 'void', 'volatile', 'while',
    'with', 'yield'
  ];
  
  return validIdentifierRegex.test(name) && !reservedKeywords.includes(name.toLowerCase());
}
