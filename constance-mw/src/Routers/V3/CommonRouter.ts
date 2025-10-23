import express, { Request, Response } from "express";
import { BaseUserInfo, BasicProperty, PropertyItem, ResponseData, User } from "../../Models/HelperModels";
import { AppConfigConstants, ErrorSeverityValue } from "../../Models/Constants";
import { codeMirrorValidator } from '../../BizLogic/CodeMirrorValidator';
import { sort } from "fast-sort";
import { Filter, ObjectId } from "mongodb";
import { ConstanceRepo } from "../../Repository/ConstanceRepo";
import { ConfigItem } from "../../Models/ServiceModels";





export const commonRouter = express.Router();


commonRouter.get("/init/get-configs", async (req: Request, res: Response) => {
    try {     
        let constanceRepo = new ConstanceRepo();
        let processedGenConfigs: ConfigItem[] = await constanceRepo.getConfigs(AppConfigConstants.BUCKETID__MAIN_GENERAL_CONFIG) ?? [];

        res.status(200).send({ payload: processedGenConfigs ?? [] } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});




//==========================================================================================================================
//#region =========================================== FOR CORRECTIONS ======================================================
commonRouter.get("/corrections/execute", async (req: Request, res: Response) => {
    try {
        const exekey = req.headers.exekey?.toString()?.trim() || null;
        const host = req.headers.host?.toString()?.trim() || null;
        if(!exekey || exekey !== "6dba499d-d4ea-4e85-8978-fb26f7eb3083__5e24194a-105e-4133-bf5c-85b6cca8574c" || host !== "localhost:7000") {
            throw new Error(`Sorry buddy! Execution is unauthorized!`);
        }
        
        //do stuff here....

        res.status(200).send({ payload: "Process completed successfully!" } as ResponseData);
    }
    catch (e: any) {
        let resp = {
            payload: undefined,
            error: { id: crypto.randomUUID(), code: "500", severity: ErrorSeverityValue.ERROR, message: e.message }
        }
        console.error(resp);
        res.status(500).json(resp);
    }
});
//#endregion ================================================================================================================




//======================== CodeMirror Validator Test Endpoint ===========================================
//=======================================================================================================

// Test endpoint: GET http://localhost:7000/api/v3/test/codemirror-validator
commonRouter.get("/codemirror-validator", async (req: Request, res: Response) => {
    try {
        console.log('🧪 Starting CodeMirror Validator API Test...');
        
        // Test cases with good and bad code for multiple languages
        const testCases = {
            // PYTHON TESTS
            'python-good.py': `def calculate_fibonacci(n):
    """Calculate fibonacci number recursively."""
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

# Test the function
result = calculate_fibonacci(10)
print(f"Fibonacci(10) = {result}")`,
            
            'python-bad.py': `def broken_function(
    # Missing closing parenthesis and colon
    if x = 5:  # Should be == not =
        return x * 2
    else
        return x + 1  # Missing colon after else
        
# Invalid indentation
print("This is wrong indentation")`,
            
            // JAVASCRIPT TESTS
            'javascript-good.js': `class Calculator {
    constructor() {
        this.history = [];
    }
    
    add(a, b) {
        const result = a + b;
        this.history.push(\`\${a} + \${b} = \${result}\`);
        return result;
    }
}

const calc = new Calculator();
console.log(calc.add(5, 3));`,
            
            'javascript-bad.js': `class BrokenCalculator {
    constructor( {
        this.history = [];  // Missing closing parenthesis
    }
    
    add(a, b) {
        const result = a +;  // Missing operand
        return result
    }  // Missing semicolon
}`,
            
            // JSON TESTS
            'json-good.json': `{
    "name": "Test Config",
    "version": "1.0.0",
    "settings": {
        "enabled": true,
        "maxRetries": 3,
        "timeout": 5000
    }
}`,
            
            'json-bad.json': `{
    "name": "Test Config",
    "version": "1.0.0",
    "settings": {
        "enabled": true,
        "maxRetries": 3,
        "timeout": 5000,
    }
}`,
            
            // SQL TESTS
            'sql-good.sql': `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, email) 
VALUES ('johndoe', 'john@example.com');

SELECT * FROM users WHERE created_at > '2024-01-01';`,
            
            'sql-bad.sql': `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

INSERT INTO users (username, email) 
    ('johndoe', 'john@example.com');`,

            // DOCKER TESTS
            'dockerfile-good.dockerfile': `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
EXPOSE 3000
USER node
CMD ["npm", "start"]`,

            'dockerfile-bad.dockerfile': `# Missing FROM instruction
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y curl
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`,

            // POWERSHELL TESTS
            'powershell-good.ps1': `function Get-SystemInfo {
    param(
        [string]$ComputerName = $env:COMPUTERNAME
    )
    
    $info = @{
        Computer = $ComputerName
        OS = (Get-WmiObject Win32_OperatingSystem).Caption
        Memory = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    }
    
    return $info
}

Get-SystemInfo`,

            'powershell-bad.ps1': `function Get-SystemInfo {
    param(
        [string]$ComputerName = $env:COMPUTERNAME
    )
    
    $info = @{
        Computer = $ComputerName
        OS = (Get-WmiObject Win32_OperatingSystem).Caption
        Memory = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2
    }
    
    return $info
}`,

            // YAML TESTS
            'yaml-good.yaml': `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  database_url: "postgresql://user:pass@db:5432/app"
  redis_url: "redis://redis:6379"
  log_level: "info"`,

            'yaml-bad.yaml': `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  database_url: "postgresql://user:pass@db:5432/app"
  redis_url: "redis://redis:6379"
  log_level: "info"
    extra_indent: "this is incorrectly indented"`
        };
        
        console.log('🔍 Running validation tests...');
        
        // Process test cases and extract language from filename
        const results: { [filename: string]: any } = {};
        
        for (const [filename, code] of Object.entries(testCases)) {
            // Extract language from filename (e.g., "python-good.py" -> "python")
            let language = '';
            if (filename.includes('.')) {
                const extension = filename.split('.').pop()?.toLowerCase();
                switch (extension) {
                    case 'py': language = 'python'; break;
                    case 'js': language = 'javascript'; break;
                    case 'json': language = 'json'; break;
                    case 'sql': language = 'sql'; break;
                    case 'dockerfile': language = 'dockerfile'; break;
                    case 'ps1': language = 'powershell'; break;
                    case 'yaml': case 'yml': language = 'yaml'; break;
                    case 'xml': language = 'xml'; break;
                    default: language = extension || 'unknown'; break;
                }
            }
            
            // Run individual validation for each test case
            try {
                const result = codeMirrorValidator.validateSingle(code, language);
                results[filename] = result;
            } catch (error) {
                results[filename] = {
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
        
        // Process results
        let passCount = 0;
        let failCount = 0;
        const testResults = [];
        
        for (const [filename, result] of Object.entries(results)) {
            const isGoodCode = filename.includes('-good.');
            const isBadCode = filename.includes('-bad.');
            const language = filename.split('.').pop();
            
            let testPassed = false;
            let status = '';
            
            if (isGoodCode && result.isValid) {
                status = 'PASS - Good code correctly validated';
                testPassed = true;
                passCount++;
            } else if (isBadCode && !result.isValid) {
                status = 'PASS - Bad code correctly detected';
                testPassed = true;
                passCount++;
            } else if (isGoodCode && !result.isValid) {
                status = 'FAIL - Good code incorrectly flagged as invalid';
                failCount++;
            } else if (isBadCode && result.isValid) {
                status = 'FAIL - Bad code incorrectly validated as good';
                failCount++;
            }
            
            testResults.push({
                filename,
                language: language?.toUpperCase(),
                isValid: result.isValid,
                errorCount: result.errors.length,
                status,
                passed: testPassed,
                errors: result.errors.slice(0, 3).map((error: any) => ({
                    line: error.line,
                    column: error.column,
                    message: error.message,
                    severity: error.severity
                }))
            });
        }
        
        const summary = {
            totalTests: passCount + failCount,
            passed: passCount,
            failed: failCount,
            successRate: ((passCount / (passCount + failCount)) * 100).toFixed(1) + '%',
            supportedLanguages: codeMirrorValidator.getSupportedLanguages()
        };
        
        console.log(`✅ CodeMirror Validator Test completed: ${summary.successRate} success rate`);
        
        res.status(200).json({
            payload: {
                summary,
                testResults,
                message: passCount === (passCount + failCount) 
                    ? "🎉 ALL TESTS PASSED! CodeMirror validator is working perfectly!" 
                    : "⚠️ Some tests failed. CodeMirror validator may need refinement."
            }
        } as ResponseData);
        
    } catch (e: any) {
        console.error('❌ CodeMirror validator test failed:', e);
        let resp = {
            payload: undefined,
            error: { 
                id: crypto.randomUUID(), 
                code: "500", 
                severity: ErrorSeverityValue.ERROR, 
                message: `CodeMirror validator test failed: ${e.message}` 
            }
        };
        res.status(500).json(resp);
    }
});





// Single validation endpoint: POST http://localhost:7000/api/v3/validate-code
// Body: { "code": "def hello():\n    print('Hello')", "language": "python" }
commonRouter.post("/validate-code", async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, language } = req.body;
        
        if (!code || !language) {
            res.status(400).json({
                payload: undefined,
                error: {
                    id: crypto.randomUUID(),
                    code: "400",
                    severity: ErrorSeverityValue.ERROR,
                    message: "Both 'code' and 'language' fields are required"
                }
            });
            return;
        }

        console.log(`🔍 Validating ${language} code...`);
        
        const result = codeMirrorValidator.validateSingle(code, language);
        
        res.status(200).json({
            payload: {
                validation: result,
                supportedLanguages: codeMirrorValidator.getSupportedLanguages()
            }
        } as ResponseData);
        
    } catch (e: any) {
        console.error('❌ Code validation failed:', e);
        let resp = {
            payload: undefined,
            error: { 
                id: crypto.randomUUID(), 
                code: "500", 
                severity: ErrorSeverityValue.ERROR, 
                message: `Code validation failed: ${e.message}` 
            }
        };
        res.status(500).json(resp);
    }
});

//========================================================================================================
//========================================================================================================

