import * as vscode from 'vscode';

export interface BrainFuckExecutionResult {
    output: string;
    steps: number;
    memoryDump: Uint8Array;
    error?: string;
}

export interface BrainFuckExecutionState {
    tape: Uint8Array;
    pointer: number;
    output: string;
    inputBuffer: string;
    inputIndex: number;
    stepCount: number;
    instructionPointer: number;
    loopStack: number[];
    breakpoints: Set<number>;
}

export class BrainFuckInterpreter {
    private tapeSize: number;
    private maxSteps: number;
    
    constructor(tapeSize: number = 30000, maxSteps: number = 1000000) {
        this.tapeSize = tapeSize;
        this.maxSteps = maxSteps;
    }
    
    createInitialState(): BrainFuckExecutionState {
        return {
            tape: new Uint8Array(this.tapeSize),
            pointer: 0,
            output: "",
            inputBuffer: "",
            inputIndex: 0,
            stepCount: 0,
            instructionPointer: 0,
            loopStack: [],
            breakpoints: new Set<number>()
        };
    }
    
    preprocessCode(code: string): { cleanCode: string; loopMap: Map<number, number> } {
        // 过滤非指令字符并构建循环映射
        const cleanCode: string[] = [];
        const originalToCleanMap: number[] = [];
        const cleanToOriginalMap: number[] = [];
        const loopStack: number[] = [];
        const loopMap = new Map<number, number>();
        
        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            if ("><+-.,[]".includes(char)) {
                const cleanIndex = cleanCode.length;
                cleanCode.push(char);
                originalToCleanMap[i] = cleanIndex;
                cleanToOriginalMap[cleanIndex] = i;
                
                if (char === '[') {
                    loopStack.push(cleanIndex);
                } else if (char === ']') {
                    if (loopStack.length === 0) {
                        throw new Error(`Unmatched ']' at position ${i}`);
                    }
                    const start = loopStack.pop()!;
                    loopMap.set(start, cleanIndex);
                    loopMap.set(cleanIndex, start);
                }
            }
        }
        
        if (loopStack.length > 0) {
            throw new Error(`Unmatched '[' at position ${cleanToOriginalMap[loopStack[0]]}`);
        }
        
        return {
            cleanCode: cleanCode.join(''),
            loopMap
        };
    }
    
    execute(
        code: string, 
        input: string = "", 
        state?: BrainFuckExecutionState,
        onStep?: (state: BrainFuckExecutionState) => boolean
    ): BrainFuckExecutionResult {
        const { cleanCode, loopMap } = this.preprocessCode(code);
        let currentState = state || this.createInitialState();
        currentState.inputBuffer = input;
        currentState.inputIndex = 0;
        
        try {
            for (
                currentState.instructionPointer = state ? currentState.instructionPointer : 0;
                currentState.instructionPointer < cleanCode.length;
                currentState.instructionPointer++
            ) {
                // 检查步数限制
                if (currentState.stepCount >= this.maxSteps) {
                    throw new Error(`Execution exceeded maximum step limit of ${this.maxSteps}`);
                }
                
                // 检查断点
                if (currentState.breakpoints.has(currentState.instructionPointer)) {
                    if (onStep && onStep(currentState)) {
                        break; // 调试器请求暂停
                    }
                }
                
                const instruction = cleanCode[currentState.instructionPointer];
                
                switch (instruction) {
                    case '>':
                        currentState.pointer++;
                        if (currentState.pointer >= this.tapeSize) {
                            throw new Error("Pointer moved beyond tape end");
                        }
                        break;
                    case '<':
                        currentState.pointer--;
                        if (currentState.pointer < 0) {
                            throw new Error("Pointer moved before tape start");
                        }
                        break;
                    case '+':
                        currentState.tape[currentState.pointer]++;
                        break;
                    case '-':
                        currentState.tape[currentState.pointer]--;
                        break;
                    case '.':
                        currentState.output += String.fromCharCode(currentState.tape[currentState.pointer]);
                        break;
                    case ',':
                        if (currentState.inputIndex < currentState.inputBuffer.length) {
                            currentState.tape[currentState.pointer] = currentState.inputBuffer.charCodeAt(currentState.inputIndex++);
                        } else {
                            currentState.tape[currentState.pointer] = 0;
                        }
                        break;
                    case '[':
                        if (currentState.tape[currentState.pointer] === 0) {
                            currentState.instructionPointer = loopMap.get(currentState.instructionPointer)!;
                        } else {
                            currentState.loopStack.push(currentState.instructionPointer);
                        }
                        break;
                    case ']':
                        if (currentState.tape[currentState.pointer] !== 0) {
                            currentState.instructionPointer = loopMap.get(currentState.instructionPointer)!;
                        } else {
                            currentState.loopStack.pop();
                        }
                        break;
                }
                
                currentState.stepCount++;
                
                // 每一步都调用回调（用于调试器）
                if (onStep && onStep(currentState)) {
                    break;
                }
            }
            
            return {
                output: currentState.output,
                steps: currentState.stepCount,
                memoryDump: currentState.tape.slice(),
                error: undefined
            };
        } catch (error) {
            return {
                output: currentState.output,
                steps: currentState.stepCount,
                memoryDump: currentState.tape.slice(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    // 格式化BrainFuck代码
    formatCode(code: string, spacesPerIndent: number = 2): string {
        const { cleanCode } = this.preprocessCode(code);
        let formatted = "";
        let indentLevel = 0;
        
        for (let i = 0; i < cleanCode.length; i++) {
            const char = cleanCode[i];
            
            if (char === ']') {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            if (char === ']' && formatted.trimEnd().endsWith('[')) {
                // 处理空循环
                formatted = formatted.trimEnd();
                formatted += "[]";
            } else {
                if (i > 0 && char === '[' && cleanCode[i - 1] !== '[') {
                    formatted += "\n" + " ".repeat(indentLevel * spacesPerIndent);
                }
                formatted += char;
            }
            
            if (char === '[') {
                indentLevel++;
            }
            
            // 在循环后添加换行
            if (char === ']' && i < cleanCode.length - 1 && cleanCode[i + 1] !== ']') {
                formatted += "\n" + " ".repeat(indentLevel * spacesPerIndent);
            }
        }
        
        return formatted;
    }
    
    // 获取Hello World模板
    getHelloWorldTemplate(): string {
        return `++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.`;
    }
}