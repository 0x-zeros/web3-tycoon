/**
 * ID 格式化工具类
 * 提供统一的 ID 和地址显示格式化方法
 */
export class IdFormatter {
    /**
     * 缩短地址显示（0x1234...5678 格式）
     *
     * 用于：
     * - 钱包地址
     * - player.owner
     * - 其他需要缩短的地址类型
     *
     * @param address 完整地址
     * @param prefixLen 前缀长度（默认 6，包含 0x）
     * @param suffixLen 后缀长度（默认 4）
     * @returns 缩短后的地址，如 "0x1234...5678"
     *
     * @example
     * IdFormatter.shortenAddress("0x123456789abcdef")
     * // 返回: "0x1234...cdef"
     */
    static shortenAddress(address: string, prefixLen: number = 6, suffixLen: number = 4): string {
        if (!address || address.length < prefixLen + suffixLen) {
            return address;
        }
        return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
    }

    /**
     * 缩短对象 ID 显示
     *
     * 注意：大多数情况下建议完整显示对象 ID（game.id, template_map_id 等）
     * 仅在确实需要缩短时才使用此方法
     *
     * @param id 完整对象 ID
     * @param prefixLen 前缀长度
     * @param suffixLen 后缀长度
     * @returns 缩短后的 ID
     */
    static shortenId(id: string, prefixLen: number = 8, suffixLen: number = 6): string {
        if (!id || id.length < prefixLen + suffixLen) {
            return id;
        }
        return `${id.slice(0, prefixLen)}...${id.slice(-suffixLen)}`;
    }
}
