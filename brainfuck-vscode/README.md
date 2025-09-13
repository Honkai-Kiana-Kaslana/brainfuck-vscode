# BrainFuck VS Code 插件

一个功能完整的 BrainFuck 语言支持插件，为 VS Code 提供语法高亮、代码执行、调试和丰富的开发体验。

## 功能特性

### 🎨 语法高亮
- 对 BrainFuck 的 8 个基本指令提供清晰的语法高亮
- 支持 `.bf`、`.b` 和 `.brainfuck` 文件扩展名
- 非指令字符自动识别为注释

### ▶️ 代码执行
- 一键运行 BrainFuck 程序
- 支持标准输入（当程序包含 `,` 指令时）
- 实时输出执行结果到专用输出面板
- 可配置内存带大小和执行步数限制

### 🔍 调试支持
- 完整的调试器功能：设置断点、单步执行、继续执行
- 实时查看内存带状态和指针位置
- 支持变量查看和内存转储
- 循环栈跟踪功能

### 📝 代码格式化
- 自动格式化 BrainFuck 代码，提高可读性
- 可配置缩进大小（默认 2 空格）
- 智能处理循环结构的缩进

### 💡 智能辅助
- 悬停提示：显示每个指令的功能说明
- 代码补全：快速插入 BrainFuck 指令
- 签名帮助：提供循环结构的说明
- 代码模板：快速插入 Hello World 示例

## 安装方法

### 从 VSIX 安装
1. 下载插件包 (`brainfuck-vscode-1.0.0.vsix`)
2. 在 VS Code 中打开命令面板 (Ctrl+Shift+P)
3. 运行 "Extensions: Install from VSIX..."
4. 选择下载的 VSIX 文件进行安装

### 从源代码安装
```bash
# 克隆仓库
git clone https://github.com/Honkai-Kiana-Kaslana/brainfuck-vscode.git

# 进入目录
cd brainfuck-vscode

# 安装依赖
npm install

# 编译 TypeScript 代码
npm run compile

# 打包插件
npm run package

# 安装生成的 VSIX 文件
code --install-extension brainfuck-vscode-1.0.0.vsix
```

## 使用方法

### 运行 BrainFuck 程序
1. 打开或创建一个 `.bf` 文件
2. 使用以下任一方法运行程序：
   - 点击编辑器右上方的运行按钮 (▶️)
   - 使用命令面板 (Ctrl+Shift+P) 并选择 "BrainFuck: Run"
   - 右键单击编辑器并选择 "Run BrainFuck Program"

### 调试 BrainFuck 程序
1. 设置断点：在行号左侧单击
2. 启动调试会话：
   - 点击编辑器右上方的调试按钮 (🐞)
   - 使用命令面板并选择 "BrainFuck: Debug"
3. 使用调试控制台进行单步执行、继续等操作

### 格式化代码
1. 使用命令面板 (Ctrl+Shift+P) 并选择 "BrainFuck: Format"
2. 或右键单击编辑器并选择 "Format Document"

### 插入代码模板
1. 使用命令面板 (Ctrl+Shift+P) 并选择 "BrainFuck: Insert Hello World Template"
2. 将在光标处插入一个经典的 Hello World 程序

## 配置选项

插件提供以下可配置选项：

| 设置项                                 | 描述                   | 默认值  |
| -------------------------------------- | ---------------------- | ------- |
| `brainfuck.tapeSize`                   | 内存带大小（单元数）   | 30000   |
| `brainfuck.enableComments`             | 启用非指令字符作为注释 | true    |
| `brainfuck.maxExecutionSteps`          | 最大执行步数限制       | 1000000 |
| `brainfuck.formatting.spacesPerIndent` | 格式化时的缩进空格数   | 2       |

在 VS Code 设置中搜索 "brainfuck" 来修改这些配置。

## 示例程序

### Hello World
```
++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.
```

### 简单循环
```
+++[>++<-]>.  # 3×2=6 输出
```

## 故障排除

### 常见问题

1. **程序执行时间过长**
   - 增加 `brainfuck.maxExecutionSteps` 设置
   - 检查程序是否存在无限循环

2. **内存带越界**
   - 确保指针操作不会超出内存带边界
   - 检查 `<` 和 `>` 指令的使用

3. **循环不匹配**
   - 插件会自动检测并报告不匹配的 `[` 和 `]`

### 获取帮助

如果您遇到问题或有功能建议，请：
1. 检查 [GitHub Issues](https://github.com/Honkai-Kiana-Kaslana/brainfuck-vscode/issues) 中是否已有相关讨论
2. 提交新的 Issue，包含详细的问题描述和重现步骤

## 开发贡献

欢迎贡献代码！以下是参与开发的方法：

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/Honkai-Kiana-Kaslana/brainfuck-vscode.git

# 安装依赖
npm install

# 编译并监视更改
npm run watch

# 在扩展开发主机中测试
按下 F5 启动调试
```

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- 感谢 BrainFuck 语言的设计者 Urban Müller
- 感谢所有贡献者和用户的支持
- 灵感来源于社区中的各种 BrainFuck 工具和实现

---


享受编写 BrainFuck 代码的乐趣！如有任何问题或建议，请随时联系我们。
