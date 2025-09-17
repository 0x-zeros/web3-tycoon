import { EventId } from '@mysten/sui/client';
import { sys } from 'cc';

/**
 * Sui 事件游标管理器
 * 负责保存和恢复事件索引的游标位置
 */
export class SuiEventCursor {
    /** 存储键名前缀 */
    private readonly STORAGE_KEY_PREFIX = 'sui_event_cursor';

    /** 当前环境标识（用于区分不同网络） */
    private _environment: string = 'default';

    /**
     * 设置环境标识
     * @param env 环境标识（如 mainnet, testnet, devnet）
     */
    public setEnvironment(env: string): void {
        this._environment = env;
    }

    /**
     * 保存游标到本地存储
     * @param cursor 事件ID游标
     */
    public saveCursor(cursor: EventId | null): void {
        try {
            const key = this._getStorageKey();
            const value = cursor ? JSON.stringify(cursor) : '';

            if (this._isCocos()) {
                // Cocos Creator 环境使用 sys.localStorage
                sys.localStorage.setItem(key, value);
            } else if (typeof localStorage !== 'undefined') {
                // 浏览器环境
                localStorage.setItem(key, value);
            } else {
                // Node.js 或其他环境，使用内存存储
                this._memoryStorage.set(key, value);
            }

            if (this._debug) {
                console.log(`[SuiEventCursor] 保存游标: ${value}`);
            }
        } catch (error) {
            console.error('[SuiEventCursor] 保存游标失败:', error);
        }
    }

    /**
     * 从本地存储加载游标
     * @returns 事件ID游标，如果没有则返回 null
     */
    public loadCursor(): EventId | null {
        try {
            const key = this._getStorageKey();
            let value: string | null = null;

            if (this._isCocos()) {
                // Cocos Creator 环境
                value = sys.localStorage.getItem(key);
            } else if (typeof localStorage !== 'undefined') {
                // 浏览器环境
                value = localStorage.getItem(key);
            } else {
                // Node.js 或其他环境
                value = this._memoryStorage.get(key) || null;
            }

            if (value && value !== '') {
                const cursor = JSON.parse(value) as EventId;

                if (this._debug) {
                    console.log(`[SuiEventCursor] 加载游标: ${value}`);
                }

                return cursor;
            }

            return null;
        } catch (error) {
            console.error('[SuiEventCursor] 加载游标失败:', error);
            return null;
        }
    }

    /**
     * 清除存储的游标
     */
    public clearCursor(): void {
        try {
            const key = this._getStorageKey();

            if (this._isCocos()) {
                // Cocos Creator 环境
                sys.localStorage.removeItem(key);
            } else if (typeof localStorage !== 'undefined') {
                // 浏览器环境
                localStorage.removeItem(key);
            } else {
                // Node.js 或其他环境
                this._memoryStorage.delete(key);
            }

            if (this._debug) {
                console.log('[SuiEventCursor] 清除游标');
            }
        } catch (error) {
            console.error('[SuiEventCursor] 清除游标失败:', error);
        }
    }

    /**
     * 检查是否存在已保存的游标
     */
    public hasCursor(): boolean {
        const cursor = this.loadCursor();
        return cursor !== null;
    }

    /**
     * 获取游标信息（用于调试）
     */
    public getCursorInfo(): {
        hasCursor: boolean;
        cursor: EventId | null;
        environment: string;
        storageKey: string;
    } {
        const cursor = this.loadCursor();
        return {
            hasCursor: cursor !== null,
            cursor: cursor,
            environment: this._environment,
            storageKey: this._getStorageKey()
        };
    }

    /**
     * 导出游标（用于备份）
     */
    public exportCursor(): string | null {
        const cursor = this.loadCursor();
        return cursor ? JSON.stringify(cursor) : null;
    }

    /**
     * 导入游标（用于恢复）
     */
    public importCursor(cursorString: string): boolean {
        try {
            const cursor = JSON.parse(cursorString) as EventId;
            this.saveCursor(cursor);
            return true;
        } catch (error) {
            console.error('[SuiEventCursor] 导入游标失败:', error);
            return false;
        }
    }

    /**
     * 获取所有环境的游标（调试用）
     */
    public getAllCursors(): Record<string, EventId | null> {
        const cursors: Record<string, EventId | null> = {};
        const environments = ['mainnet', 'testnet', 'devnet', 'default'];

        for (const env of environments) {
            const oldEnv = this._environment;
            this._environment = env;
            cursors[env] = this.loadCursor();
            this._environment = oldEnv;
        }

        return cursors;
    }

    /**
     * 清除所有环境的游标（重置用）
     */
    public clearAllCursors(): void {
        const environments = ['mainnet', 'testnet', 'devnet', 'default'];

        for (const env of environments) {
            const oldEnv = this._environment;
            this._environment = env;
            this.clearCursor();
            this._environment = oldEnv;
        }

        console.log('[SuiEventCursor] 清除所有游标');
    }

    // ==================== 私有方法 ====================

    /** 调试模式 */
    private _debug: boolean = false;

    /** 内存存储（用于不支持 localStorage 的环境） */
    private _memoryStorage: Map<string, string> = new Map();

    /**
     * 获取存储键名
     */
    private _getStorageKey(): string {
        return `${this.STORAGE_KEY_PREFIX}_${this._environment}`;
    }

    /**
     * 检查是否在 Cocos Creator 环境中
     */
    private _isCocos(): boolean {
        return typeof sys !== 'undefined' && sys.localStorage;
    }

    /**
     * 设置调试模式
     */
    public setDebug(debug: boolean): void {
        this._debug = debug;
    }
}