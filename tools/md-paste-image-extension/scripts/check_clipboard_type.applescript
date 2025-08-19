-- 检测剪贴板内容类型
on run
    try
        set clipboardInfo to (clipboard info) as list
        
        -- 检查是否包含图片数据
        repeat with clipboardType in clipboardInfo
            if (clipboardType as string) contains "class PNGf" then
                return "image"
            end if
            if (clipboardType as string) contains "TIFF" then
                return "image"
            end if
        end repeat
        
        -- 检查是否包含文本
        try
            set clipboardText to (the clipboard as text)
            if length of clipboardText > 0 then
                return "text"
            end if
        end try
        
        return "unknown"
        
    on error
        return "error"
    end try
end run