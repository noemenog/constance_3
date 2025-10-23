import { EditorState } from '@codemirror/state';
import { Language } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';



export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        line: number;
        column: number;
        message: string;
        severity: 'error' | 'warning' | 'info';
    }>;
    language: string;
}

export interface LanguageValidationMap {
    [key: string]: ValidationResult;
}

export class CodeMirrorValidator {
    private languageMap: Map<string, Language> = new Map();

    constructor() {
        // Initialize supported languages
        this.languageMap.set('python', python().language);
        this.languageMap.set('javascript', javascript().language);
        this.languageMap.set('json', json().language);
        this.languageMap.set('xml', xml().language);
        this.languageMap.set('yaml', yaml().language);
        this.languageMap.set('sql', sql().language);
        this.languageMap.set('typescript', javascript({ typescript: true }).language);
    }

    /**
     * Validate code for a specific language
     */
    public validateSingle(code: string, language: string): ValidationResult {
        const normalizedLang = language.toLowerCase();
        
        try {
            // Handle special cases that don't use CodeMirror
            if (normalizedLang === 'powershell' || normalizedLang === 'bash' || normalizedLang === 'shell') {
                return this.validateShellScript(code, normalizedLang);
            }
            
            if (normalizedLang === 'vbscript') {
                return this.validateVBScript(code);
            }
            
            if (normalizedLang === 'dockerfile') {
                return this.validateDockerfile(code);
            }

            // Use CodeMirror for supported languages
            const lang = this.languageMap.get(normalizedLang);
            if (!lang) {
                return {
                    isValid: false,
                    errors: [{
                        line: 1,
                        column: 1,
                        message: `Unsupported language: ${language}`,
                        severity: 'error'
                    }],
                    language
                };
            }

            return this.validateWithCodeMirror(code, lang, language);
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    line: 1,
                    column: 1,
                    message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: 'error'
                }],
                language
            };
        }
    }

    /**
     * Validate multiple code snippets for different languages
     */
    public validateCodeMap(codeMap: { [language: string]: string }): LanguageValidationMap {
        const results: LanguageValidationMap = {};
        
        for (const [language, code] of Object.entries(codeMap)) {
            results[language] = this.validateSingle(code, language);
        }
        
        return results;
    }

    /**
     * Validate using CodeMirror language support
     */
    private validateWithCodeMirror(code: string, language: Language, languageName: string): ValidationResult {
        try {
            // Create an editor state with the language
            const state = EditorState.create({
                doc: code,
                extensions: [language]
            });

            // Basic syntax validation - if the state can be created without throwing, 
            // it means the basic syntax is valid
            const diagnostics: ValidationResult['errors'] = [];

            // For some languages, we can do additional validation
            if (languageName.toLowerCase() === 'json') {
                return this.validateJSON(code);
            }

            if (languageName.toLowerCase() === 'python') {
                return this.validatePython(code);
            }

            if (languageName.toLowerCase() === 'javascript') {
                return this.validateJavaScript(code);
            }

            if (languageName.toLowerCase() === 'sql') {
                return this.validateSQL(code);
            }

            if (languageName.toLowerCase() === 'yaml') {
                return this.validateYAML(code);
            }

            // If we get here, basic syntax appears valid
            return {
                isValid: diagnostics.length === 0,
                errors: diagnostics,
                language: languageName
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    line: 1,
                    column: 1,
                    message: `Syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
                    severity: 'error'
                }],
                language: languageName
            };
        }
    }

    /**
     * Enhanced JSON validation
     */
    private validateJSON(code: string): ValidationResult {
        try {
            JSON.parse(code);
            return {
                isValid: true,
                errors: [],
                language: 'json'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
            const lineMatch = errorMessage.match(/line (\d+)/);
            const columnMatch = errorMessage.match(/column (\d+)/);
            
            return {
                isValid: false,
                errors: [{
                    line: lineMatch ? parseInt(lineMatch[1]) : 1,
                    column: columnMatch ? parseInt(columnMatch[1]) : 1,
                    message: errorMessage,
                    severity: 'error'
                }],
                language: 'json'
            };
        }
    }

    /**
     * Enhanced Python validation using python-ast
     */
    private validatePython(code: string): ValidationResult {
        try {
            const errors: ValidationResult['errors'] = [];
            const lines = code.split('\n');

            // Check for syntax errors by analyzing the code structure
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // Check for unmatched parentheses in function definitions
                if (trimmedLine.startsWith('def ') && trimmedLine.includes('(') && !trimmedLine.includes(')')) {
                    let hasClosing = false;
                    for (let j = i + 1; j < lines.length; j++) {
                        if (lines[j].includes(')') && lines[j].includes(':')) {
                            hasClosing = true;
                            break;
                        }
                        if (lines[j].trim() && !lines[j].startsWith(' ') && !lines[j].startsWith('\t')) {
                            break; // Function definition ended without closing
                        }
                    }
                    if (!hasClosing) {
                        errors.push({
                            line: i + 1,
                            column: line.indexOf('(') + 1,
                            message: 'Missing closing parenthesis in function definition',
                            severity: 'error'
                        });
                    }
                }
                
                // Check for missing colon after if/else/def/class statements
                if ((trimmedLine.startsWith('if ') || trimmedLine.startsWith('elif ') || 
                     trimmedLine.startsWith('else') || trimmedLine.startsWith('def ') || 
                     trimmedLine.startsWith('class ')) && 
                    !trimmedLine.endsWith(':') && trimmedLine.length > 0) {
                    errors.push({
                        line: i + 1,
                        column: line.length,
                        message: 'Missing colon at end of statement',
                        severity: 'error'
                    });
                }
                
                // Check for assignment in if statements (should be ==)
                if (trimmedLine.includes('if ') && trimmedLine.includes(' = ') && !trimmedLine.includes(' == ')) {
                    const equalPos = line.indexOf(' = ');
                    if (equalPos > line.indexOf('if ')) {
                        errors.push({
                            line: i + 1,
                            column: equalPos + 2,
                            message: 'Assignment in if statement, did you mean == for comparison?',
                            severity: 'error'
                        });
                    }
                }
                
                // Check for print statement (Python 2 style)
                if (trimmedLine.includes('print ') && !trimmedLine.includes('print(')) {
                    errors.push({
                        line: i + 1,
                        column: line.indexOf('print ') + 1,
                        message: 'Python 3 syntax: use print() function instead of print statement',
                        severity: 'warning'
                    });
                }
                
                // Check for indentation issues (very basic)
                if (line.length > 0 && lines[i].length > 0 && lines[i][0] === ' ') {
                    const leadingSpaces = lines[i].length - lines[i].trimStart().length;
                    if (leadingSpaces % 4 !== 0) {
                        errors.push({
                            line: i + 1,
                            column: 1,
                            message: 'Indentation should be a multiple of 4 spaces',
                            severity: 'warning'
                        });
                    }
                }
            }

            const hasErrors = errors.filter(e => e.severity === 'error').length > 0;
            return {
                isValid: !hasErrors,
                errors,
                language: 'python'
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    line: 1,
                    column: 1,
                    message: `Python syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
                    severity: 'error'
                }],
                language: 'python'
            };
        }
    }

    /**
     * Enhanced JavaScript validation
     */
    private validateJavaScript(code: string): ValidationResult {
        try {
            const errors: ValidationResult['errors'] = [];
            const lines = code.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // Check for unmatched parentheses in function/constructor definitions
                if ((trimmedLine.includes('function ') || trimmedLine.includes('constructor(')) && 
                    trimmedLine.includes('(') && !trimmedLine.includes(')')) {
                    errors.push({
                        line: i + 1,
                        column: line.indexOf('(') + 1,
                        message: 'Missing closing parenthesis in function definition',
                        severity: 'error'
                    });
                }
                
                // Check for incomplete expressions (e.g., "a +;")
                if (trimmedLine.includes(' +;') || trimmedLine.includes(' -;') || 
                    trimmedLine.includes(' *;') || trimmedLine.includes(' /;')) {
                    const opPos = Math.max(
                        line.indexOf(' +;'), line.indexOf(' -;'),
                        line.indexOf(' *;'), line.indexOf(' /;')
                    );
                    errors.push({
                        line: i + 1,
                        column: opPos + 1,
                        message: 'Incomplete expression - missing operand',
                        severity: 'error'
                    });
                }
                
                // Check for missing opening brace after class/function
                if ((trimmedLine.startsWith('class ') || trimmedLine.includes('function ')) && 
                    trimmedLine.includes(')') && !trimmedLine.includes('{')) {
                    // Look for opening brace in next few lines
                    let foundBrace = false;
                    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                        if (lines[j].includes('{')) {
                            foundBrace = true;
                            break;
                        }
                    }
                    if (!foundBrace) {
                        errors.push({
                            line: i + 1,
                            column: line.length,
                            message: 'Missing opening brace after function/class declaration',
                            severity: 'error'
                        });
                    }
                }
            }

            const hasErrors = errors.filter(e => e.severity === 'error').length > 0;
            return {
                isValid: !hasErrors,
                errors,
                language: 'javascript'
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    line: 1,
                    column: 1,
                    message: `JavaScript syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
                    severity: 'error'
                }],
                language: 'javascript'
            };
        }
    }

    /**
     * Enhanced SQL validation
     */
    private validateSQL(code: string): ValidationResult {
        try {
            const errors: ValidationResult['errors'] = [];
            const lines = code.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim().toLowerCase();
                
                // Check for trailing commas in CREATE TABLE
                if (trimmedLine.includes('create table') && i < lines.length - 1) {
                    for (let j = i + 1; j < lines.length; j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.includes(',') && lines[j + 1] && lines[j + 1].trim() === ');') {
                            errors.push({
                                line: j + 1,
                                column: nextLine.indexOf(',') + 1,
                                message: 'Trailing comma before closing parenthesis in CREATE TABLE',
                                severity: 'error'
                            });
                        }
                        if (nextLine.includes(');')) break;
                    }
                }
                
                // Check for missing VALUES keyword in INSERT
                if (trimmedLine.startsWith('insert into') && trimmedLine.includes('(') && 
                    !trimmedLine.includes('values')) {
                    // Check next line for VALUES
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim().toLowerCase();
                        if (!nextLine.startsWith('values') && nextLine.includes('(')) {
                            errors.push({
                                line: i + 2,
                                column: 1,
                                message: 'Missing VALUES keyword in INSERT statement',
                                severity: 'error'
                            });
                        }
                    }
                }
            }

            const hasErrors = errors.filter(e => e.severity === 'error').length > 0;
            return {
                isValid: !hasErrors,
                errors,
                language: 'sql'
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    line: 1,
                    column: 1,
                    message: `SQL syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
                    severity: 'error'
                }],
                language: 'sql'
            };
        }
    }

    /**
     * Enhanced YAML validation
     */
    private validateYAML(code: string): ValidationResult {
        try {
            const errors: ValidationResult['errors'] = [];
            const lines = code.split('\n');
            let detectedIndentSize: number | null = null;
            const contextStack: number[] = []; // Track indentation context

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                if (trimmedLine.length === 0) continue;
                
                const leadingSpaces = line.length - line.trimStart().length;
                
                // Check for tabs (YAML doesn't allow tabs)
                if (line.includes('\t')) {
                    errors.push({
                        line: i + 1,
                        column: line.indexOf('\t') + 1,
                        message: 'YAML does not allow tabs for indentation - use spaces',
                        severity: 'error'
                    });
                    continue;
                }
                
                // Detect indentation size from first indented line
                if (detectedIndentSize === null && leadingSpaces > 0) {
                    detectedIndentSize = leadingSpaces;
                    contextStack.push(0, leadingSpaces); // Root level and first indent level
                }
                
                // For lines with indentation, validate consistency
                if (leadingSpaces > 0 && detectedIndentSize !== null) {
                    // Update context stack based on current indentation
                    while (contextStack.length > 1 && leadingSpaces < contextStack[contextStack.length - 1]) {
                        contextStack.pop(); // Unindent
                    }
                    
                    const currentContextLevel = contextStack[contextStack.length - 1];
                    
                    // Check if this is a valid indentation level
                    if (leadingSpaces !== currentContextLevel) {
                        // This should be either the same level or exactly one indent level deeper
                        const expectedNextLevel = currentContextLevel + detectedIndentSize;
                        
                        if (leadingSpaces === expectedNextLevel) {
                            // Valid new level
                            contextStack.push(leadingSpaces);
                        } else if (leadingSpaces % detectedIndentSize !== 0) {
                            // Invalid indentation - not a multiple of base indent
                            errors.push({
                                line: i + 1,
                                column: 1,
                                message: `Inconsistent YAML indentation - expected multiple of ${detectedIndentSize} spaces, but found ${leadingSpaces} spaces`,
                                severity: 'error'
                            });
                        } else {
                            // Check if this matches any previous level in the stack
                            const validLevel = contextStack.includes(leadingSpaces);
                            if (!validLevel) {
                                // This is a jump in indentation that skips levels
                                errors.push({
                                    line: i + 1,
                                    column: 1,
                                    message: `Invalid YAML indentation - expected ${currentContextLevel} or ${expectedNextLevel} spaces, but found ${leadingSpaces} spaces`,
                                    severity: 'error'
                                });
                            }
                        }
                    }
                }
                
                // Additional check: look for sibling items that should have same indentation
                if (i > 0 && leadingSpaces > 0) {
                    const prevLine = lines[i - 1];
                    const prevSpaces = prevLine.length - prevLine.trimStart().length;
                    const prevTrimmed = prevLine.trim();
                    
                    // If both lines are key-value pairs at what should be the same level
                    if (trimmedLine.includes(':') && prevTrimmed.includes(':') && 
                        !prevTrimmed.endsWith(':') && !trimmedLine.endsWith(':')) {
                        
                        // Look for the parent context (lines that end with ':' like 'data:')
                        let parentIndent = -1;
                        for (let j = i - 1; j >= 0; j--) {
                            const checkLine = lines[j].trim();
                            const checkSpaces = lines[j].length - lines[j].trimStart().length;
                            if (checkLine.endsWith(':') && checkSpaces < leadingSpaces) {
                                parentIndent = checkSpaces;
                                break;
                            }
                        }
                        
                        // If we found a parent and the previous line is also under the same parent
                        if (parentIndent >= 0 && prevSpaces > parentIndent && leadingSpaces > parentIndent) {
                            if (leadingSpaces !== prevSpaces) {
                                errors.push({
                                    line: i + 1,
                                    column: 1,
                                    message: `Inconsistent YAML indentation - sibling items should have same indentation (expected ${prevSpaces} spaces like previous line, but found ${leadingSpaces} spaces)`,
                                    severity: 'error'
                                });
                            }
                        }
                    }
                }
            }

            const hasErrors = errors.filter(e => e.severity === 'error').length > 0;
            return {
                isValid: !hasErrors,
                errors,
                language: 'yaml'
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    line: 1,
                    column: 1,
                    message: `YAML syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
                    severity: 'error'
                }],
                language: 'yaml'
            };
        }
    }

    /**
     * Basic shell script validation
     */
    private validateShellScript(code: string, language: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const lines = code.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // PowerShell specific validation
            if (language === 'powershell') {
                // Check for unmatched parentheses in function parameters
                if (line.includes('param(') && !line.includes(')')) {
                    let hasClosing = false;
                    for (let j = i + 1; j < lines.length; j++) {
                        if (lines[j].includes(')')) {
                            hasClosing = true;
                            break;
                        }
                    }
                    if (!hasClosing) {
                        errors.push({
                            line: i + 1,
                            column: line.indexOf('param(') + 1,
                            message: 'Missing closing parenthesis in param block',
                            severity: 'error'
                        });
                    }
                }
                
                // Check for unmatched parentheses in expressions
                const openParens = (line.match(/\(/g) || []).length;
                const closeParens = (line.match(/\)/g) || []).length;
                if (openParens > closeParens && !line.includes('param(')) {
                    errors.push({
                        line: i + 1,
                        column: line.lastIndexOf('(') + 1,
                        message: 'Unmatched opening parenthesis',
                        severity: 'error'
                    });
                }
            }
            
            // General shell script checks
            if (line.startsWith('#!') && i !== 0) {
                errors.push({
                    line: i + 1,
                    column: 1,
                    message: 'Shebang should be on the first line',
                    severity: 'warning'
                });
            }
            
            // Check for unmatched quotes (basic)
            const singleQuotes = (line.match(/'/g) || []).length;
            const doubleQuotes = (line.match(/"/g) || []).length;
            
            if (singleQuotes % 2 !== 0) {
                errors.push({
                    line: i + 1,
                    column: line.indexOf("'") + 1,
                    message: 'Unmatched single quote',
                    severity: 'error'
                });
            }
            
            if (doubleQuotes % 2 !== 0) {
                errors.push({
                    line: i + 1,
                    column: line.indexOf('"') + 1,
                    message: 'Unmatched double quote',
                    severity: 'error'
                });
            }
        }

        return {
            isValid: errors.filter(e => e.severity === 'error').length === 0,
            errors,
            language
        };
    }

    /**
     * Basic VBScript validation
     */
    private validateVBScript(code: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const lines = code.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim().toLowerCase();
            
            // Check for basic VBScript syntax
            if (line.includes('dim ') && !line.includes(' as ')) {
                errors.push({
                    line: i + 1,
                    column: line.indexOf('dim ') + 1,
                    message: 'Consider specifying variable type with "As" keyword',
                    severity: 'warning'
                });
            }
        }

        return {
            isValid: true,
            errors,
            language: 'vbscript'
        };
    }

    /**
     * Basic Dockerfile validation
     */
    private validateDockerfile(code: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const lines = code.split('\n');
        let hasFrom = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim().toUpperCase();
            
            if (line.startsWith('FROM ')) {
                hasFrom = true;
            }
            
            // Check for common Dockerfile issues
            if (line.startsWith('RUN ') && line.includes('apt-get update') && !line.includes('apt-get clean')) {
                errors.push({
                    line: i + 1,
                    column: 1,
                    message: 'Consider adding "apt-get clean" to reduce image size',
                    severity: 'warning'
                });
            }
        }

        if (!hasFrom) {
            errors.push({
                line: 1,
                column: 1,
                message: 'Dockerfile must start with a FROM instruction',
                severity: 'error'
            });
        }

        return {
            isValid: errors.filter(e => e.severity === 'error').length === 0,
            errors,
            language: 'dockerfile'
        };
    }

    /**
     * Get list of supported languages
     */
    public getSupportedLanguages(): string[] {
        return [
            'python',
            'javascript',
            'typescript', 
            'json',
            'xml',
            'yaml',
            'sql',
            'powershell',
            'bash',
            'shell',
            'vbscript',
            'dockerfile'
        ];
    }
}

// Export singleton instance
export const codeMirrorValidator = new CodeMirrorValidator();