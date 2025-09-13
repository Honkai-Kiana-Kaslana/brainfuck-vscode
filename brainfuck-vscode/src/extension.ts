import * as vscode from 'vscode';
import { BrainFuckInterpreter, BrainFuckExecutionResult } from './bfInterpreter';
import { BrainFuckHoverProvider } from './providers/hoverProvider';
import { BrainFuckCompletionProvider } from './providers/completionProvider';
import { BrainFuckSignatureHelpProvider } from './providers/signatureHelpProvider';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('BrainFuck extension is now active!');
    
    // 创建输出通道
    outputChannel = vscode.window.createOutputChannel('BrainFuck');
    
    // 获取配置
    const config = vscode.workspace.getConfiguration('brainfuck');
    const tapeSize = config.get<number>('tapeSize', 30000);
    const maxSteps = config.get<number>('maxExecutionSteps', 1000000);
    
    const interpreter = new BrainFuckInterpreter(tapeSize, maxSteps);
    
    // 注册命令
    const runCommand = vscode.commands.registerCommand('brainfuck.run', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        
        const document = editor.document;
        const code = document.getText();
        
        // 请求输入（如果需要）
        let input = '';
        if (code.includes(',')) {
            input = await vscode.window.showInputBox({
                prompt: 'Enter input for the BrainFuck program',
                placeHolder: 'Input characters'
            }) || '';
        }
        
        // 执行代码
        outputChannel.show(true);
        outputChannel.clear();
        outputChannel.appendLine('Running BrainFuck program...');
        
        try {
            const result = interpreter.execute(code, input);
            
            if (result.error) {
                outputChannel.appendLine(`Error: ${result.error}`);
                vscode.window.showErrorMessage(`BrainFuck execution error: ${result.error}`);
            } else {
                outputChannel.appendLine('Output:');
                outputChannel.appendLine(result.output);
                outputChannel.appendLine(`\nExecution completed in ${result.steps} steps`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`Error: ${errorMessage}`);
            vscode.window.showErrorMessage(`BrainFuck execution error: ${errorMessage}`);
        }
    });
    
    const debugCommand = vscode.commands.registerCommand('brainfuck.debug', () => {
        vscode.window.showInformationMessage('Starting BrainFuck debug session...');
        vscode.debug.startDebugging(undefined, {
            type: 'brainfuck',
            name: 'Debug BrainFuck',
            request: 'launch',
            program: '${file}',
            stopOnEntry: true
        });
    });
    
    const formatCommand = vscode.commands.registerCommand('brainfuck.format', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        const document = editor.document;
        const code = document.getText();
        const spacesPerIndent = vscode.workspace.getConfiguration('brainfuck').get<number>('formatting.spacesPerIndent', 2);
        
        try {
            const formattedCode = interpreter.formatCode(code, spacesPerIndent);
            
            editor.edit(editBuilder => {
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(code.length)
                );
                editBuilder.replace(fullRange, formattedCode);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error formatting BrainFuck code: ${error}`);
        }
    });
    
    const insertTemplateCommand = vscode.commands.registerCommand('brainfuck.insertTemplate', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        const template = interpreter.getHelloWorldTemplate();
        editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, template);
        });
    });
    
    // 注册语言功能提供者
    const hoverProvider = vscode.languages.registerHoverProvider('brainfuck', new BrainFuckHoverProvider());
    const completionProvider = vscode.languages.registerCompletionItemProvider('brainfuck', new BrainFuckCompletionProvider());
    const signatureHelpProvider = vscode.languages.registerSignatureHelpProvider('brainfuck', new BrainFuckSignatureHelpProvider(), '[', ']');
    
    // 添加到订阅列表
    context.subscriptions.push(
        runCommand,
        debugCommand,
        formatCommand,
        insertTemplateCommand,
        hoverProvider,
        completionProvider,
        signatureHelpProvider,
        outputChannel
    );
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}