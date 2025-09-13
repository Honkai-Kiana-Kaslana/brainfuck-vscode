import * as vscode from 'vscode';

export class BrainFuckHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);
        
        let contents: vscode.MarkdownString[] = [];
        
        switch (word) {
            case '>':
                contents.push(new vscode.MarkdownString('**Pointer increment**  \nMove the pointer to the right (next cell)'));
                break;
            case '<':
                contents.push(new vscode.MarkdownString('**Pointer decrement**  \nMove the pointer to the left (previous cell)'));
                break;
            case '+':
                contents.push(new vscode.MarkdownString('**Increment**  \nIncrement the byte at the pointer'));
                break;
            case '-':
                contents.push(new vscode.MarkdownString('**Decrement**  \nDecrement the byte at the pointer'));
                break;
            case '.':
                contents.push(new vscode.MarkdownString('**Output**  \nOutput the byte at the pointer as an ASCII character'));
                break;
            case ',':
                contents.push(new vscode.MarkdownString('**Input**  \nInput a byte and store it at the pointer'));
                break;
            case '[':
                contents.push(new vscode.MarkdownString('**Loop start**  \nIf the byte at the pointer is zero, jump forward to the matching `]`'));
                break;
            case ']':
                contents.push(new vscode.MarkdownString('**Loop end**  \nIf the byte at the pointer is nonzero, jump back to the matching `[`'));
                break;
        }
        
        if (contents.length > 0) {
            return new vscode.Hover(contents);
        }
        
        return null;
    }
}