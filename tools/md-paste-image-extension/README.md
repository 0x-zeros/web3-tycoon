# Markdown Paste Image Extension

简单的VS Code插件，用于将Mac截图直接粘贴到markdown文件中。

## 功能特性

- ✅ 支持Mac系统的`pbpaste`命令
- ✅ 自动检测剪贴板中的图片
- ✅ 可配置的图片保存路径
- ✅ 自动生成相对路径的markdown图片语法
- ✅ 快捷键支持：`Cmd+Shift+V`

## 安装方法

### 查目标插件文件夹
```bash
ls ~/.cursor/extensions/ 
```

### VS Code
```bash
# 如果目录不存在，先创建
mkdir -p ~/.vscode/extensions/
cp -r tools/md-paste-image-extension ~/.vscode/extensions/
```

### Cursor
```bash
# 如果目录不存在，先创建
mkdir -p ~/.cursor/extensions/
cp -r tools/md-paste-image-extension ~/.cursor/extensions/
```

重启编辑器即可使用。

## 使用方法

1. 在Mac上截图（`Cmd+Shift+4` 或其他截图方式）
2. 在VS Code中打开markdown文件
3. 将光标定位到想要插入图片的位置
4. 按 `Cmd+Shift+V` 或使用命令面板搜索 "Paste Image from Clipboard"

## 配置

在VS Code设置中可以配置图片保存路径：

```json
{
  "mdPasteImage.imagePath": "assets/images_md"
}
```

默认保存路径为 `assets/images_md`，图片将保存在工作区根目录下的此路径中。

## 工作原理

1. 使用AppleScript检测剪贴板内容类型
2. 如果检测到图片，使用AppleScript直接读取剪贴板图片数据
3. 生成时间戳命名的PNG文件保存到配置目录
4. 插入相对路径的markdown图片语法

## 技术改进

相比原版本，新版本采用AppleScript方案：
- **类型检测**：`scripts/check_clipboard_type.applescript` - 精确检测剪贴板内容类型
- **图片保存**：`scripts/save_clipboard_image.applescript` - 直接操作剪贴板图片数据
- **兼容性**：支持PNG和TIFF格式，更好的Mac系统集成
- **错误处理**：详细的错误信息和状态反馈

## 测试方法

1. 截图（`Cmd+Shift+4` 或其他截图方式）
2. 在markdown文件中按 `Cmd+Shift+V`
3. 图片将自动保存并插入markdown语法

## todo
移动.md文件时，修改文件里图片的相对位置的（自动执行或者手动执行的）插件，（考虑到代码review， 以后有空再让ai看看）
