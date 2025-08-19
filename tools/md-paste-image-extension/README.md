# Markdown Paste Image Extension

简单的VS Code插件，用于将Mac截图直接粘贴到markdown文件中。

## 功能特性

- ✅ 支持Mac系统的`pbpaste`命令
- ✅ 自动检测剪贴板中的图片
- ✅ 可配置的图片保存路径
- ✅ 自动生成相对路径的markdown图片语法
- ✅ 快捷键支持：`Cmd+Shift+V`

## 安装方法

1. 将整个插件文件夹复制到VS Code扩展目录：
   ```bash
   cp -r tools/md-paste-image-extension ~/.vscode/extensions/
   ```

2. 重启VS Code

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

1. 使用`pbpaste -Prefer public.png`检测剪贴板中的图片
2. 生成时间戳命名的PNG文件
3. 保存到配置的目录
4. 插入相对路径的markdown图片语法


## todo
移动.md文件是，修改文件里图片的相对位置的（自动执行或者手动执行的）插件，（考虑到代码review， 以后有空再让ai看看）