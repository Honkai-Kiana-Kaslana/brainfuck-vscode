import * as vscode from 'vscode';

export class BrainFuckCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const completions: vscode.CompletionItem[] = [];
        
        // BrainFuck指令补全
        const commands = [
            { label: '>', detail: 'Pointer increment' },
            { label: '<', detail: 'Pointer decrement' },
            { label: '+', detail: 'Increment byte' },
            { label: '-', detail: 'Decrement byte' },
            { label: '.', detail: 'Output byte' },
            { label: ',', detail: 'Input byte' },
            { label: '[', detail: 'Loop start' },
            { label: ']', detail: 'Loop end' }
        ];
        
        commands.forEach(cmd => {
            const item = new vscode.CompletionItem(cmd.label, vscode.CompletionItemKind.Operator);
            item.detail = cmd.detail;
            completions.push(item);
        });
        
        return completions;
    }
}