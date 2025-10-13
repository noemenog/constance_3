import * as monaco from 'monaco-editor';

// Define types
interface ValidationEntry {
    code: string;
    language: string;
}

interface ValidationError {
    message: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    severity: 'error' | 'warning' | 'info';
    source?: string;
    code?: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

type ValidationResults = Map<string, ValidationResult>;


class HeadlessMonacoValidator {
    private isInitialized: boolean = false;
    private modelCounter: number = 0;
    
    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        // Initialize Monaco Editor without DOM
        await this.setupMonacoEnvironment();
        this.setupLanguageValidators();
        this.isInitialized = true;
    }
    
    private async setupMonacoEnvironment(): Promise<void> {
        // Configure Monaco for headless operation
        if (typeof window === 'undefined') {
            // Node.js environment setup
            global.self = global as any;
            global.document = {
                createElement: () => ({}),
                createTextNode: () => ({}),
                getElementById: () => null,
                addEventListener: () => {},
                removeEventListener: () => {}
            } as any;
            global.navigator = { userAgent: 'node' } as any;
            global.location = { href: '' } as any;
        }
        
        // Set up Monaco worker environment
        (self as any).MonacoEnvironment = {
            getWorkerUrl: function (moduleId: string, label: string) {
                if (label === 'json') {
                    return './json.worker.bundle.js';
                }
                if (label === 'css' || label === 'scss' || label === 'less') {
                    return './css.worker.bundle.js';
                }
                if (label === 'html' || label === 'handlebars' || label === 'razor') {
                    return './html.worker.bundle.js';
                }
                if (label === 'typescript' || label === 'javascript') {
                    return './ts.worker.bundle.js';
                }
                return './editor.worker.bundle.js';
            }
        };
    }
    
    private setupLanguageValidators(): void {
        // Configure JSON validation
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            allowComments: false,
            schemas: [],
            enableSchemaRequest: false,
            schemaValidation: 'error',
            schemaRequest: 'error'
        });
        
        // Configure TypeScript/JavaScript validation
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: true
        });
        
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: true
        });
        
        // Register custom languages
        this.registerCustomLanguages();
    }
    
    private registerCustomLanguages(): void {
        // Register YAML if not already registered
        if (!monaco.languages.getLanguages().find((lang: any) => lang.id === 'yaml')) {
            monaco.languages.register({ id: 'yaml' });
            this.setupYAMLLanguage();
        }
        
        // Register Batch
        if (!monaco.languages.getLanguages().find((lang: any) => lang.id === 'batch')) {
            monaco.languages.register({ id: 'batch' });
            this.setupBatchLanguage();
        }
        
        // Register VBScript
        if (!monaco.languages.getLanguages().find((lang: any)=> lang.id === 'vbscript')) {
            monaco.languages.register({ id: 'vbscript' });
            this.setupVBScriptLanguage();
        }
    }
    
    private setupYAMLLanguage(): void {
        monaco.languages.setMonarchTokensProvider('yaml', {
            tokenizer: {
                root: [
                    [/^(\s*)([\w\-\s]+)(:)(\s*)/, ['white', 'key', 'delimiter', 'white']],
                    [/^(\s*)(-\s+)/, ['white', 'delimiter']],
                    [/".*?"/, 'string'],
                    [/'.*?'/, 'string'],
                    [/\d+/, 'number'],
                    [/true|false/, 'keyword'],
                    [/null/, 'keyword'],
                    [/#.*$/, 'comment']
                ]
            }
        });
    }
    
    private setupBatchLanguage(): void {
        monaco.languages.setMonarchTokensProvider('batch', {
            ignoreCase: true,
            tokenizer: {
                root: [
                    [/^@?echo\s+(on|off)/, 'keyword'],
                    [/^::\s*.*$/, 'comment'],
                    [/^rem\s+.*$/, 'comment'],
                    [/\b(if|else|for|goto|call|set|exit|pause|cls|dir|cd|md|rd|del|copy|move)\b/, 'keyword'],
                    [/\b(exist|not|errorlevel|defined)\b/, 'keyword'],
                    [/\b(equ|neq|lss|leq|gtr|geq)\b/, 'operator'],
                    [/%[^%]+%/, 'variable'],
                    [/![^!]+!/, 'variable'],
                    [/".*?"/, 'string'],
                    [/^:[a-zA-Z_][a-zA-Z0-9_]*/, 'type'],
                    [/[(){}[\]]/, 'bracket'],
                    [/[<>=!]/, 'operator']
                ]
            }
        });
    }
    
    private setupVBScriptLanguage(): void {
        monaco.languages.setMonarchTokensProvider('vbscript', {
            ignoreCase: true,
            tokenizer: {
                root: [
                    [/\b(dim|if|then|else|elseif|end|sub|function|for|next|while|wend|do|loop|select|case|exit|return)\b/, 'keyword'],
                    [/\b(and|or|not|xor|eqv|imp|mod|is)\b/, 'operator'],
                    [/\b(true|false|null|nothing|empty)\b/, 'constant'],
                    [/\b(msgbox|inputbox|createobject|getobject|wscript|response|request)\b/, 'support.function'],
                    [/'.*$/, 'comment'],
                    [/".*?"/, 'string'],
                    [/\b\d+(\.\d+)?\b/, 'number'],
                    [/[(){}[\]]/, 'bracket'],
                    [/[<>=!&]/, 'operator']
                ]
            }
        });
    }
    
    /**
     * Validate multiple code snippets
     */
    async validateCodeMap(codeMap: Map<string, ValidationEntry>): Promise<ValidationResults> {
        await this.initialize();
        
        const results: ValidationResults = new Map();
        const validationPromises: Promise<void>[] = [];
        
        for (const [key, entry] of codeMap.entries()) {
            const promise = this.validateSingleEntry(key, entry, results);
            validationPromises.push(promise);
        }
        
        await Promise.all(validationPromises);
        return results;
    }
    
    private async validateSingleEntry(key: string, entry: ValidationEntry, results: ValidationResults): Promise<void> {
        try {
            const result = await this.validateCode(entry.code, entry.language);
            results.set(key, result);
        } catch (error) {
            results.set(key, {
                isValid: false,
                errors: [{
                    message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 1,
                    severity: 'error',
                    source: 'validator'
                }],
                warnings: []
            });
        }
    }
    
    /**
     * Validate a single code snippet
     */
    async validateCode(code: string, language: string): Promise<ValidationResult> {
        await this.initialize();
        
        // Create a unique URI for this validation
        const uri = monaco.Uri.parse(`inmemory://model${++this.modelCounter}.${this.getFileExtension(language)}`);
        
        try {
            // Create model
            const model = monaco.editor.createModel(code, language, uri);
            
            // Wait for validation to complete
            await this.waitForValidation(model);
            
            // Get markers (errors/warnings)
            const markers = monaco.editor.getModelMarkers({ resource: uri });
            
            const errors: ValidationError[] = [];
            const warnings: ValidationError[] = [];
            
            for (const marker of markers) {
                const error: ValidationError = {
                    message: marker.message,
                    line: marker.startLineNumber,
                    column: marker.startColumn,
                    endLine: marker.endLineNumber,
                    endColumn: marker.endColumn,
                    severity: this.mapSeverity(marker.severity),
                    source: marker.source,
                    code: typeof marker.code === 'string' ? marker.code : marker.code?.value
                };
                
                if (marker.severity === monaco.MarkerSeverity.Error) {
                    errors.push(error);
                } else if (marker.severity === monaco.MarkerSeverity.Warning) {
                    warnings.push(error);
                }
            }
            
            // Add custom validation for languages not fully supported by Monaco
            const customValidation = await this.performCustomValidation(code, language);
            errors.push(...customValidation.errors);
            warnings.push(...customValidation.warnings);
            
            // Clean up
            model.dispose();
            
            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
                    line: 1,
                    column: 1,
                    endLine: 1,
                    endColumn: 1,
                    severity: 'error',
                    source: 'validator'
                }],
                warnings: []
            };
        }
    }
    
    private async waitForValidation(model: monaco.editor.ITextModel): Promise<void> {
        return new Promise((resolve) => {
            // Wait a bit for Monaco's async validation to complete
            setTimeout(() => {
                // Check if there are any pending validations
                const checkValidation = () => {
                    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                    // Monaco typically completes validation within 100-500ms
                    resolve();
                };
                
                // Give Monaco time to validate
                setTimeout(checkValidation, 300);
            }, 100);
        });
    }
    
    private async performCustomValidation(code: string, language: string): Promise<{ errors: ValidationError[]; warnings: ValidationError[]; }> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        
        switch (language.toLowerCase()) {
            case 'yaml':
                return this.validateYAML(code);
            case 'batch':
                return this.validateBatch(code);
            case 'vbscript':
                return this.validateVBScript(code);
            case 'shell':
            case 'bash':
                return this.validateShell(code);
            default:
                return { errors, warnings };
        }
    }
    
    private validateYAML(code: string): { errors: ValidationError[]; warnings: ValidationError[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            
            // Check for tabs (YAML doesn't allow tabs)
            if (line.includes('\t')) {
                errors.push({
                    message: 'YAML does not allow tabs for indentation',
                    line: lineNum,
                    column: line.indexOf('\t') + 1,
                    endLine: lineNum,
                    endColumn: line.indexOf('\t') + 2,
                    severity: 'error',
                    source: 'yaml-validator'
                });
            }
            
            // Check for unmatched quotes
            const singleQuotes = (line.match(/'/g) || []).length;
            const doubleQuotes = (line.match(/"/g) || []).length;
            
            if (singleQuotes % 2 !== 0) {
                errors.push({
                    message: 'Unmatched single quote',
                    line: lineNum,
                    column: line.lastIndexOf("'") + 1,
                    endLine: lineNum,
                    endColumn: line.lastIndexOf("'") + 2,
                    severity: 'error',
                    source: 'yaml-validator'
                });
            }
            
            if (doubleQuotes % 2 !== 0) {
                errors.push({
                    message: 'Unmatched double quote',
                    line: lineNum,
                    column: line.lastIndexOf('"') + 1,
                    endLine: lineNum,
                    endColumn: line.lastIndexOf('"') + 2,
                    severity: 'error',
                    source: 'yaml-validator'
                });
            }
            
            // Check for invalid key syntax
            if (line.includes(':') && !line.trim().startsWith('#')) {
                const colonIndex = line.indexOf(':');
                const beforeColon = line.substring(0, colonIndex).trim();
                
                if (beforeColon.includes(' ') && !beforeColon.startsWith('"') && !beforeColon.startsWith("'")) {
                    warnings.push({
                        message: 'Keys with spaces should be quoted',
                        line: lineNum,
                        column: 1,
                        endLine: lineNum,
                        endColumn: colonIndex + 1,
                        severity: 'warning',
                        source: 'yaml-validator'
                    });
                }
            }
        }
        
        return { errors, warnings };
    }
    
    private validateBatch(code: string): { errors: ValidationError[]; warnings: ValidationError[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const lines = code.split('\n');
        const labels = new Set<string>();
        const gotoTargets: Array<{ target: string; line: number }> = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmed = line.trim();
            
            if (!trimmed || trimmed.startsWith('::') || trimmed.toLowerCase().startsWith('rem ')) continue;
            
            // Check for labels
            if (trimmed.startsWith(':')) {
                const labelName = trimmed.substring(1).toLowerCase();
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName)) {
                    errors.push({
                        message: `Invalid label name '${labelName}'`,
                        line: lineNum,
                        column: 1,
                        endLine: lineNum,
                        endColumn: trimmed.length + 1,
                        severity: 'error',
                        source: 'batch-validator'
                    });
                } else {
                    labels.add(labelName);
                }
                continue;
            }
            
            // Check GOTO statements
            const gotoMatch = trimmed.match(/^goto\s+(\S+)/i);
            if (gotoMatch) {
                gotoTargets.push({
                    target: gotoMatch[1].toLowerCase(),
                    line: lineNum
                });
            }
            
            // Check quotes
            const doubleQuotes = (line.match(/"/g) || []).length;
            if (doubleQuotes % 2 !== 0) {
                errors.push({
                    message: 'Unmatched quote',
                    line: lineNum,
                    column: line.lastIndexOf('"') + 1,
                    endLine: lineNum,
                    endColumn: line.lastIndexOf('"') + 2,
                    severity: 'error',
                    source: 'batch-validator'
                });
            }
            
            // Check IF statements
            if (trimmed.toLowerCase().startsWith('if ')) {
                if (!trimmed.includes(' (') && !trimmed.includes(' echo') && !trimmed.includes(' set') && !trimmed.includes(' goto')) {
                    warnings.push({
                        message: 'IF statement may be missing command or parentheses',
                        line: lineNum,
                        column: 1,
                        endLine: lineNum,
                        endColumn: trimmed.length + 1,
                        severity: 'warning',
                        source: 'batch-validator'
                    });
                }
            }
        }
        
        // Check for undefined GOTO targets
        for (const { target, line } of gotoTargets) {
            if (!labels.has(target)) {
                errors.push({
                    message: `Undefined label '${target}'`,
                    line,
                    column: 1,
                    endLine: line,
                    endColumn: 10,
                    severity: 'error',
                    source: 'batch-validator'
                });
            }
        }
        
        return { errors, warnings };
    }
    
    private validateVBScript(code: string): { errors: ValidationError[]; warnings: ValidationError[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const lines = code.split('\n');
        
        let ifCount = 0;
        let endIfCount = 0;
        let subCount = 0;
        let endSubCount = 0;
        let functionCount = 0;
        let endFunctionCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmed = line.trim().toLowerCase();
            
            if (!trimmed || trimmed.startsWith("'")) continue;
            
            // Count control structures
            if (trimmed.startsWith('if ')) {
                ifCount++;
                if (!trimmed.includes(' then')) {
                    errors.push({
                        message: "IF statement missing 'Then'",
                        line: lineNum,
                        column: line.toLowerCase().indexOf('if') + 1,
                        endLine: lineNum,
                        endColumn: line.length + 1,
                        severity: 'error',
                        source: 'vbscript-validator'
                    });
                }
            }
            
            if (trimmed === 'end if') endIfCount++;
            if (trimmed.startsWith('sub ')) subCount++;
            if (trimmed === 'end sub') endSubCount++;
            if (trimmed.startsWith('function ')) functionCount++;
            if (trimmed === 'end function') endFunctionCount++;
            
            // Check for unmatched quotes
            const doubleQuotes = (line.match(/"/g) || []).length;
            if (doubleQuotes % 2 !== 0) {
                errors.push({
                    message: 'Unmatched quote',
                    line: lineNum,
                    column: line.lastIndexOf('"') + 1,
                    endLine: lineNum,
                    endColumn: line.lastIndexOf('"') + 2,
                    severity: 'error',
                    source: 'vbscript-validator'
                });
            }
        }
        
        // Check for unmatched control structures
        if (ifCount !== endIfCount) {
            errors.push({
                message: `Unmatched If/End If statements (${ifCount} If, ${endIfCount} End If)`,
                line: lines.length,
                column: 1,
                endLine: lines.length,
                endColumn: 1,
                severity: 'error',
                source: 'vbscript-validator'
            });
        }
        
        return { errors, warnings };
    }
    
    private validateShell(code: string): { errors: ValidationError[]; warnings: ValidationError[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmed = line.trim();
            
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Check for common shell syntax issues
            if (trimmed.includes('if [') && !trimmed.includes(']')) {
                errors.push({
                    message: 'Missing closing bracket in if statement',
                    line: lineNum,
                    column: line.indexOf('if [') + 1,
                    endLine: lineNum,
                    endColumn: line.length + 1,
                    severity: 'error',
                    source: 'shell-validator'
                });
            }
            
            if (trimmed.startsWith('if ') && !trimmed.includes(' then') && !trimmed.endsWith(';')) {
                errors.push({
                    message: "Missing 'then' in if statement",
                    line: lineNum,
                    column: line.indexOf('if') + 1,
                    endLine: lineNum,
                    endColumn: line.length + 1,
                    severity: 'error',
                    source: 'shell-validator'
                });
            }
            
            // Check quotes
            const singleQuotes = (line.match(/'/g) || []).length;
            const doubleQuotes = (line.match(/"/g) || []).length;
            
            if (singleQuotes % 2 !== 0) {
                errors.push({
                    message: 'Unmatched single quote',
                    line: lineNum,
                    column: line.lastIndexOf("'") + 1,
                    endLine: lineNum,
                    endColumn: line.lastIndexOf("'") + 2,
                    severity: 'error',
                    source: 'shell-validator'
                });
            }
            
            if (doubleQuotes % 2 !== 0) {
                errors.push({
                    message: 'Unmatched double quote',
                    line: lineNum,
                    column: line.lastIndexOf('"') + 1,
                    endLine: lineNum,
                    endColumn: line.lastIndexOf('"') + 2,
                    severity: 'error',
                    source: 'shell-validator'
                });
            }
        }
        
        return { errors, warnings };
    }
    
    private mapSeverity(severity: monaco.MarkerSeverity): 'error' | 'warning' | 'info' {
        switch (severity) {
            case monaco.MarkerSeverity.Error: return 'error';
            case monaco.MarkerSeverity.Warning: return 'warning';
            case monaco.MarkerSeverity.Info: return 'info';
            default: return 'error';
        }
    }
    
    private getFileExtension(language: string): string {
        const extensions: Record<string, string> = {
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yml',
            'javascript': 'js',
            'typescript': 'ts',
            'python': 'py',
            'powershell': 'ps1',
            'shell': 'sh',
            'bash': 'sh',
            'batch': 'bat',
            'vbscript': 'vbs',
            'html': 'html',
            'css': 'css',
            'sql': 'sql'
        };
        return extensions[language.toLowerCase()] || 'txt';
    }
    
    /**
     * Clean up resources
     */
    dispose(): void {
        // Monaco models are disposed individually, but we can clear any global state here
        monaco.editor.getModels().forEach((model: any) => model.dispose());
    }
}

export { HeadlessMonacoValidator, ValidationEntry, ValidationError, ValidationResult, ValidationResults };