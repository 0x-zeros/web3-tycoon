const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function activate(context) {
    let disposable = vscode.commands.registerCommand('mdPasteImage.paste', async function () {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        if (editor.document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('This command only works in markdown files');
            return;
        }

        try {
            await pasteImage(editor);
        } catch (error) {
            vscode.window.showErrorMessage(`Error pasting image: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function pasteImage(editor) {
    // 检查剪贴板是否包含图片
    try {
        const result = execSync('pbpaste -Prefer public.png', { encoding: 'base64' });
        if (!result || result.trim() === '') {
            vscode.window.showInformationMessage('No image found in clipboard');
            return;
        }
    } catch (error) {
        vscode.window.showInformationMessage('No image found in clipboard');
        return;
    }

    // 获取配置的图片保存路径
    const config = vscode.workspace.getConfiguration('mdPasteImage');
    const imagePath = config.get('imagePath', 'assets/images_md');
    
    // 获取工作区根目录
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    // 创建完整的保存路径并进行安全检查
    //使用了 path.resolve 来替代 path.join。path.resolve 会将路径解析为一个绝对路径，能更好地处理 ../ 这样的相对路径。
    const fullImageDir = path.resolve(workspaceRoot, imagePath);

    // 安全校验：确保图片保存路径在工作区内
    if (!fullImageDir.startsWith(workspaceRoot)) {
        vscode.window.showErrorMessage(`Invalid image path: ${imagePath}. Path must be within the workspace.`);
        return;
    }
    
    // 确保目录存在
    if (!fs.existsSync(fullImageDir)) {
        fs.mkdirSync(fullImageDir, { recursive: true });
    }

    // 生成唯一的文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const imageName = `image-${timestamp}.png`;
    const fullImagePath = path.join(fullImageDir, imageName);

    try {
        // 保存图片
        const imageData = execSync('pbpaste -Prefer public.png', { encoding: null });
        fs.writeFileSync(fullImagePath, imageData);

        // 计算相对于当前markdown文件的路径
        const currentFileDir = path.dirname(editor.document.uri.fsPath);
        const relativePath = path.relative(currentFileDir, fullImagePath).replace(/\\/g, '/');

        // 在当前光标位置插入markdown图片语法
        const position = editor.selection.active;
        const imageMarkdown = `![](${relativePath})`;
        
        await editor.edit(editBuilder => {
            editBuilder.insert(position, imageMarkdown);
        });

        vscode.window.showInformationMessage(`Image saved to: ${relativePath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to save image: ${error.message}`);
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};