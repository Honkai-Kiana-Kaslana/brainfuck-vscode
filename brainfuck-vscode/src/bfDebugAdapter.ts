import * as vscode from 'vscode';
import * as debugProtocol from '@vscode/debugprotocol';
import * as path from 'path';
import * as fs from 'fs';
import { BrainFuckInterpreter, BrainFuckExecutionState } from './bfInterpreter';

export function activateDebugAdapter(context: vscode.ExtensionContext) {
    const debugFactory = new BrainFuckDebugAdapterDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('brainfuck', debugFactory));
}

class BrainFuckDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterInlineImplementation(new BrainFuckDebugSession());
    }
}

interface BrainFuckLaunchRequestArguments extends debugProtocol.LaunchRequestArguments {
    program: string;
    input?: string;
    stopOnEntry?: boolean;
}

class BrainFuckDebugSession implements vscode.DebugAdapter {
    private sequence: number = 1;
    private requestHandlers = new Map<string, (request: debugProtocol.Request) => void>();
    private eventEmitter = new vscode.EventEmitter<debugProtocol.Event>();
    private messageEmitter = new vscode.EventEmitter<debugProtocol.Message>();
    private interpreter: BrainFuckInterpreter;
    private executionState: BrainFuckExecutionState | null = null;
    private code: string = '';
    private input: string = '';
    private isRunning: boolean = false;
    private breakpoints: Map<string, number[]> = new Map();
    
    onDidSendMessage: vscode.Event<debugProtocol.Message> = this.messageEmitter.event;
    onDidSendEvent: vscode.Event<debugProtocol.Event> = this.eventEmitter.event;
    
    constructor() {
        this.interpreter = new BrainFuckInterpreter();
        
        this.requestHandlers.set('initialize', this.initialize.bind(this));
        this.requestHandlers.set('launch', this.launch.bind(this));
        this.requestHandlers.set('disconnect', this.disconnect.bind(this));
        this.requestHandlers.set('setBreakpoints', this.setBreakpoints.bind(this));
        this.requestHandlers.set('threads', this.threads.bind(this));
        this.requestHandlers.set('stackTrace', this.stackTrace.bind(this));
        this.requestHandlers.set('scopes', this.scopes.bind(this));
        this.requestHandlers.set('variables', this.variables.bind(this));
        this.requestHandlers.set('continue', this.continue.bind(this));
        this.requestHandlers.set('next', this.next.bind(this));
        this.requestHandlers.set('stepIn', this.stepIn.bind(this));
        this.requestHandlers.set('stepOut', this.stepOut.bind(this));
        this.requestHandlers.set('pause', this.pause.bind(this));
        this.requestHandlers.set('evaluate', this.evaluate.bind(this));
    }
    
    handleMessage(message: debugProtocol.Message): void {
        const request = message as debugProtocol.Request;
        const handler = this.requestHandlers.get(request.command);
        if (handler) {
            handler(request);
        } else {
            this.sendErrorResponse(request, `Unknown command: ${request.command}`);
        }
    }
    
    dispose() {
        // 清理资源
    }
    
    private sendResponse(response: debugProtocol.Response): void {
        response.seq = this.sequence++;
        this.messageEmitter.fire(response);
    }
    
    private sendEvent(event: debugProtocol.Event): void {
        event.seq = this.sequence++;
        this.eventEmitter.fire(event);
    }
    
    private sendErrorResponse(request: debugProtocol.Request, message: string): void {
        const response: debugProtocol.ErrorResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: false,
            command: request.command,
            message: message
        };
        this.sendResponse(response);
    }
    
    private initialize(request: debugProtocol.InitializeRequest): void {
        const response: debugProtocol.InitializeResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                supportsConfigurationDoneRequest: true,
                supportsEvaluateForHovers: true,
                supportsStepBack: false,
                supportsSetVariable: false
            }
        };
        this.sendResponse(response);
        
        // 发送初始化完成事件
        this.sendEvent({ type: 'event', event: 'initialized' });
    }
    
    private launch(request: debugProtocol.LaunchRequest): void {
        const args = request.arguments as BrainFuckLaunchRequestArguments;
        
        try {
            // 读取程序文件
            const programPath = args.program;
            this.code = fs.readFileSync(programPath, 'utf8');
            this.input = args.input || '';
            
            // 初始化执行状态
            this.executionState = this.interpreter.createInitialState();
            this.executionState.inputBuffer = this.input;
            
            // 设置断点
            const breakpoints = this.breakpoints.get(programPath) || [];
            this.executionState.breakpoints = new Set(breakpoints);
            
            const response: debugProtocol.LaunchResponse = {
                type: 'response',
                seq: 0,
                request_seq: request.seq,
                success: true,
                command: request.command
            };
            this.sendResponse(response);
            
            // 如果设置了stopOnEntry，在第一个指令处暂停
            if (args.stopOnEntry) {
                this.sendEvent({
                    type: 'event',
                    event: 'stopped',
                    body: {
                        reason: 'entry',
                        threadId: 1,
                        allThreadsStopped: true
                    }
                });
            } else {
                this.continueExecution();
            }
        } catch (error) {
            this.sendErrorResponse(request, `Failed to launch debug session: ${error}`);
        }
    }
    
    private disconnect(request: debugProtocol.DisconnectRequest): void {
        this.isRunning = false;
        const response: debugProtocol.DisconnectResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command
        };
        this.sendResponse(response);
    }
    
    private setBreakpoints(request: debugProtocol.SetBreakpointsRequest): void {
        const args = request.arguments;
        const path = args.source.path as string;
        
        // 保存断点
        this.breakpoints.set(path, args.breakpoints.map(bp => bp.line));
        
        const response: debugProtocol.SetBreakpointsResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                breakpoints: args.breakpoints.map(bp => ({
                    verified: true,
                    line: bp.line
                }))
            }
        };
        this.sendResponse(response);
    }
    
    private threads(request: debugProtocol.ThreadsRequest): void {
        const response: debugProtocol.ThreadsResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                threads: [{
                    id: 1,
                    name: 'BrainFuck Thread'
                }]
            }
        };
        this.sendResponse(response);
    }
    
    private stackTrace(request: debugProtocol.StackTraceRequest): void {
        const response: debugProtocol.StackTraceResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                stackFrames: [{
                    id: 1,
                    name: 'BrainFuck Program',
                    line: this.executionState ? this.executionState.instructionPointer : 0,
                    column: 0
                }]
            }
        };
        this.sendResponse(response);
    }
    
    private scopes(request: debugProtocol.ScopesRequest): void {
        const response: debugProtocol.ScopesResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                scopes: [{
                    name: 'Memory Tape',
                    variablesReference: 1,
                    expensive: false
                }]
            }
        };
        this.sendResponse(response);
    }
    
    private variables(request: debugProtocol.VariablesRequest): void {
        if (!this.executionState) {
            this.sendErrorResponse(request, 'No execution state available');
            return;
        }
        
        const variables: debugProtocol.Variable[] = [];
        
        // 显示指针附近的内存单元
        const start = Math.max(0, this.executionState.pointer - 5);
        const end = Math.min(this.executionState.tape.length, this.executionState.pointer + 6);
        
        for (let i = start; i < end; i++) {
            variables.push({
                name: `[${i}]`,
                value: this.executionState.tape[i].toString(),
                variablesReference: 0
            });
        }
        
        const response: debugProtocol.VariablesResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                variables
            }
        };
        this.sendResponse(response);
    }
    
    private continue(request: debugProtocol.ContinueRequest): void {
        this.continueExecution();
        
        const response: debugProtocol.ContinueResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command
        };
        this.sendResponse(response);
    }
    
    private next(request: debugProtocol.NextRequest): void {
        if (!this.executionState) {
            this.sendErrorResponse(request, 'No execution state available');
            return;
        }
        
        // 单步执行
        this.interpreter.execute(this.code, this.input, this.executionState, (state) => {
            this.executionState = state;
            this.sendStoppedEvent('step');
            return true; // 暂停执行
        });
        
        const response: debugProtocol.NextResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command
        };
        this.sendResponse(response);
    }
    
    private stepIn(request: debugProtocol.StepInRequest): void {
        // 在BrainFuck中，stepIn与next相同
        this.next(request);
    }
    
    private stepOut(request: debugProtocol.StepOutRequest): void {
        if (!this.executionState) {
            this.sendErrorResponse(request, 'No execution state available');
            return;
        }
        
        // 步出当前循环（如果有）
        if (this.executionState.loopStack.length > 0) {
            const currentLoopStart = this.executionState.loopStack[this.executionState.loopStack.length - 1];
            
            this.interpreter.execute(this.code, this.input, this.executionState, (state) => {
                this.executionState = state;
                // 如果指针移出了当前循环或者循环结束，则暂停
                if (state.loopStack.length === 0 || state.loopStack[state.loopStack.length - 1] !== currentLoopStart) {
                    this.sendStoppedEvent('step');
                    return true;
                }
                return false; // 继续执行
            });
        } else {
            // 没有循环，执行一步
            this.next(request);
        }
        
        const response: debugProtocol.StepOutResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command
        };
        this.sendResponse(response);
    }
    
    private pause(request: debugProtocol.PauseRequest): void {
        this.isRunning = false;
        
        const response: debugProtocol.PauseResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command
        };
        this.sendResponse(response);
    }
    
    private evaluate(request: debugProtocol.EvaluateRequest): void {
        // 简单的表达式求值，可以扩展为更复杂的表达式
        const response: debugProtocol.EvaluateResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: true,
            command: request.command,
            body: {
                result: 'Expression evaluation not supported in BrainFuck debugger',
                variablesReference: 0
            }
        };
        this.sendResponse(response);
    }
    
    private continueExecution(): void {
        if (!this.executionState || !this.code) {
            return;
        }
        
        this.isRunning = true;
        
        // 在后台继续执行
        setTimeout(() => {
            this.interpreter.execute(this.code, this.input, this.executionState!, (state) => {
                this.executionState = state;
                
                // 检查是否遇到断点或程序结束
                if (state.breakpoints.has(state.instructionPointer) || 
                    state.instructionPointer >= this.interpreter.preprocessCode(this.code).cleanCode.length) {
                    this.sendStoppedEvent(state.instructionPointer >= this.interpreter.preprocessCode(this.code).cleanCode.length ? 'end' : 'breakpoint');
                    return true; // 暂停执行
                }
                
                return !this.isRunning; // 如果isRunning为false，则暂停
            });
        }, 0);
    }
    
    private sendStoppedEvent(reason: string): void {
        this.sendEvent({
            type: 'event',
            event: 'stopped',
            body: {
                reason: reason,
                threadId: 1,
                allThreadsStopped: true
            }
        });
    }
}