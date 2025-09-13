import * as vscode from 'vscode';

export class BrainFuckSignatureHelpProvider implements vscode.SignatureHelpProvider {
    provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.SignatureHelpContext): vscode.ProviderResult<vscode.SignatureHelp> {
        // 在BrainFuck中，循环是唯一需要签名帮助的结构
        const range = document.getWordRangeAtPosition(position);
        const word = range ? document.getText(range) : '';
        
        if (word === '[') {
            const signatureHelp = new vscode.SignatureHelp();
            const signature = new vscode.SignatureInformation('Loop', 'A loop that continues while the current cell is nonzero');
            signatureHelp.signatures = [signature];
            signatureHelp.activeSignature = 0;
            signatureHelp.activeParameter = 0;
            return signatureHelp;
        }
        
        return null;
    }
}