-- 保存剪贴板图片到指定路径
on run argv
    if (count of argv) = 0 then
        return "error: no file path provided"
    end if
    
    set targetFile to (item 1 of argv)
    
    try
        set clipboardInfo to (clipboard info) as list
        set hasImage to false
        
        -- 检查剪贴板是否包含图片
        repeat with clipboardType in clipboardInfo
            set typeString to (clipboardType as string)
            if typeString contains "class PNGf" or typeString contains "TIFF" then
                set hasImage to true
                exit repeat
            end if
        end repeat
        
        if not hasImage then
            return "error: no image in clipboard"
        end if
        
        -- 尝试保存为PNG格式
        try
            set imageData to (the clipboard as «class PNGf»)
        on error
            -- 如果PNG失败，尝试TIFF
            try
                set imageData to (the clipboard as «class TIFF»)
            on error
                return "error: unable to get image data"
            end try
        end try
        
        -- 写入文件
        try
            set fileRef to open for access targetFile with write permission
            set eof fileRef to 0
            write imageData to fileRef
            close access fileRef
            return targetFile
        on error errorMsg
            try
                close access targetFile
            end try
            return "error: " & errorMsg
        end try
        
    on error errorMsg
        return "error: " & errorMsg
    end try
end run