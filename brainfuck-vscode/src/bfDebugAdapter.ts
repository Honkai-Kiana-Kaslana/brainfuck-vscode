import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
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

interface BrainFuckLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
    input?: string;
    stopOnEntry?: boolean;
}

class BrainFuckDebugSession implements vscode.DebugAdapter {
    private sequence: number = 1;
    private requestHandlers = new Map<string, (request: DebugProtocol.Request) => void>();
    private eventEmitter = new vscode.EventEmitter<DebugProtocol.Event>();
    private messageEmitter = new vscode.EventEmitter<DebugProtocol.Message>();
    private interpreter: BrainFuckInterpreter;
    private executionState: BrainFuckExecutionState | null = null;
    private code: string = '';
    private input: string = '';
    private isRunning: boolean = false;
    private breakpoints: Map<string, number[]> = new Map();
    
    onDidSendMessage: vscode.Event<DebugProtocol.Message> = this.messageEmitter.event;
    onDidSendEvent: vscode.Event<DebugProtocol.Event> = this.eventEmitter.event;
    
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
    
    handleMessage(message: DebugProtocol.Message): void {
        // 检查是否是请求消息 - 使用更安全的方式
        const msg = message as any;
        if (msg.type === 'request' && msg.command && msg.seq) {
            const request = msg as DebugProtocol.Request;
            const handler = this.requestHandlers.get(request.command);
            if (handler) {
                handler(request);
            } else {
                this.sendErrorResponse(request, `Unknown command: ${request.command}`);
            }
        }
    }
    
    dispose() {
        // 清理资源
    }
    
    private sendResponse(response: DebugProtocol.Response): void {
        response.seq = this.sequence++;
        this.messageEmitter.fire(response as any);
    }
    
    private sendEvent(event: DebugProtocol.Event): void {
        event.seq = this.sequence++;
        this.eventEmitter.fire(event);
    }
    
    private sendErrorResponse(request: DebugProtocol.Request, message: string): void {
        const response: DebugProtocol.ErrorResponse = {
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            success: false,
            command: request.command,
            message: message,
            body: {}
        };
        this.sendResponse(response);
    }
    
    private initialize(request: DebugProtocol.Request): void {
        const initRequest = request as DebugProtocol.InitializeRequest;
        const response: DebugProtocol.InitializeResponse = {
            type: 'response',
            seq: 0,
            request_seq: initRequest.seq,
            success: true,
            command: initRequest.command,
            body: {
                supportsConfigurationDoneRequest: true,
                supportsEvaluateForHovers: true,
                supportsStepBack: false,
                supportsSetVariable: false
            }
        };
        this.sendResponse(response);
        
        // 发送初始化完成事件
        this.sendEvent({
            type: 'event',
            seq: this.sequence++,
            event: 'initialized'
        } as DebugProtocol.Event);
    }
    
    private launch(request: DebugProtocol.Request): void {
        const launchRequest = request as DebugProtocol.LaunchRequest;
        const args = launchRequest.arguments as BrainFuckLaunchRequestArguments;
        
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
            
            const response: DebugProtocol.LaunchResponse = {
                type: 'response',
                seq: 0,
                request_seq: launchRequest.seq,
                success: true,
                command: launchRequest.command,
                body: {}
            };
            this.sendResponse(response);
            
            // 如果设置了stopOnEntry，在第一个指令处暂停
            if (args.stopOnEntry) {
                this.sendEvent({
                    type: 'event',
                    seq: this.sequence++,
                    event: 'stopped',
                    body: {
                        reason: 'entry',
                        threadId: 1,
                        allThreadsStopped: true
                    }
                } as DebugProtocol.Event);
            } else {
                this.continueExecution();
            }
        } catch (error) {
            this.sendErrorResponse(request, `Failed to launch debug session: ${error}`);
        }
    }
    
    private disconnect(request: DebugProtocol.Request): void {
        const disconnectRequest = request as DebugProtocol.DisconnectRequest;
        this.isRunning = false;
        const response: DebugProtocol.DisconnectResponse = {
            type: 'response',
            seq: 0,
            request_seq: disconnectRequest.seq,
            success: true,
            command: disconnectRequest.command,
            body: {}
        };
        this.sendResponse(response);
    }
    
    private setBreakpoints(request: DebugProtocol.Request): void {
        const setBpRequest = request as DebugProtocol.SetBreakpointsRequest;
        const args = setBpRequest.arguments;
        const path = args.source.path as string;
        
        // 保存断点
        const breakpoints = args.breakpoints || [];
        this.breakpoints.set(path, breakpoints.map((bp: any) => bp.line));
        
        const response: DebugProtocol.SetBreakpointsResponse = {
            type: 'response',
            seq: 0,
            request_seq: setBpRequest.seq,
            success: true,
            command: setBpRequest.command,
            body: {
                breakpoints: breakpoints.map((bp: any) => ({
                    verified: true,
                    line: bp.line
                }))
            }
        };
        this.sendResponse(response);
    }
    
    private threads(request: DebugProtocol.Request): void {
        const threadsRequest = request as DebugProtocol.ThreadsRequest;
        const response: DebugProtocol.ThreadsResponse = {
            type: 'response',
            seq: 0,
            request_seq: threadsRequest.seq,
            success: true,
            command: threadsRequest.command,
            body: {
                threads: [{
                    id: 1,
                    name: 'BrainFuck Thread'
                }]
            }
        };
        this.sendResponse(response);
    }
    
    private stackTrace(request: DebugProtocol.Request): void {
        const stackTraceRequest = request as DebugProtocol.StackTraceRequest;
        const response: DebugProtocol.StackTraceResponse = {
            type: 'response',
            seq: 0,
            request_seq: stackTraceRequest.seq,
            success: true,
            command: stackTraceRequest.command,
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
    
    private scopes(request: DebugProtocol.Request): void {
        const scopesRequest = request as DebugProtocol.ScopesRequest;
        const response: DebugProtocol.ScopesResponse = {
            type: 'response',
            seq: 0,
            request_seq: scopesRequest.seq,
            success: true,
            command: scopesRequest.command,
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
    
    private variables(request: DebugProtocol.Request): void {
        const variablesRequest = request as DebugProtocol.VariablesRequest;
        if (!this.executionState) {
            this.sendErrorResponse(request, 'No execution state available');
            return;
        }
        
        const variables: DebugProtocol.Variable[] = [];
        
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
        
        const response: DebugProtocol.VariablesResponse = {
            type: 'response',
            seq: 0,
            request_seq: variablesRequest.seq,
            success: true,
            command: variablesRequest.command,
            body: {
                variables
            }
        };
        this.sendResponse(response);
    }
    
    private continue(request: DebugProtocol.Request): void {
        const continueRequest = request as DebugProtocol.ContinueRequest;
        this.continueExecution();
        
        const response: DebugProtocol.ContinueResponse = {
            type: 'response',
            seq: 0,
            request_seq: continueRequest.seq,
            success: true,
            command: continueRequest.command,
            body: {}
        };
        this.sendResponse(response);
    }
    
    private next(request: DebugProtocol.Request): void {
        const nextRequest = request as DebugProtocol.NextRequest;
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
        
        const response: DebugProtocol.NextResponse = {
            type: 'response',
            seq: 0,
            request_seq: nextRequest.seq,
            success: true,
            command: nextRequest.command,
            body: {}
        };
        this.sendResponse(response);
    }
    
    private stepIn(request: DebugProtocol.Request): void {
        // 在BrainFuck中，stepIn与next相同
        this.next(request);
    }
    
    private stepOut(request: DebugProtocol.Request): void {
        const stepOutRequest = request as DebugProtocol.StepOutRequest;
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
        
        const response: DebugProtocol.StepOutResponse = {
            type: 'response',
            seq: 0,
            request_seq: stepOutRequest.seq,
            success: true,
            command: stepOutRequest.command,
            body: {}
        };
        this.sendResponse(response);
    }
    
    private pause(request: DebugProtocol.Request): void {
        const pauseRequest = request as DebugProtocol.PauseRequest;
        this.isRunning = false;
        
        const response: DebugProtocol.PauseResponse = {
            type: 'response',
            seq: 0,
            request_seq: pauseRequest.seq,
            success: true,
            command: pauseRequest.command,
            body: {}
        };
        this.sendResponse(response);
    }
    
    private evaluate(request: DebugProtocol.Request): void {
        const evaluateRequest = request as DebugProtocol.EvaluateRequest;
        // 简单的表达式求值，可以扩展为更复杂的表达式
        const response: DebugProtocol.EvaluateResponse = {
            type: 'response',
            seq: 0,
            request_seq: evaluateRequest.seq,
            success: true,
            command: evaluateRequest.command,
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
            seq: this.sequence++,
            event: 'stopped',
            body: {
                reason: reason,
                threadId: 1,
                allThreadsStopped: true
            }
        } as DebugProtocol.Event);
    }
}