/**
 * 事件游标管理
 * 用于跟踪事件查询的位置和分页
 */

/**
 * 事件游标
 */
export interface EventCursor {
    /** 事件序号 */
    eventSeq: number;
    /** 交易序号 */
    txSeq?: number;
    /** 是否有更多数据 */
    hasNextPage: boolean;
    /** 下一页游标 */
    nextCursor?: string;
}

/**
 * 游标管理器
 */
export class SuiEventCursor {
    private cursor: EventCursor;
    private readonly storageKey: string;

    constructor(storageKey: string = 'sui_event_cursor') {
        this.storageKey = storageKey;
        this.cursor = this.loadCursor();
    }

    /**
     * 获取当前游标
     */
    getCursor(): EventCursor {
        return { ...this.cursor };
    }

    /**
     * 更新游标
     */
    updateCursor(cursor: Partial<EventCursor>): void {
        this.cursor = {
            ...this.cursor,
            ...cursor
        };
        this.saveCursor();
    }

    /**
     * 更新事件序号
     */
    updateEventSeq(eventSeq: number): void {
        if (eventSeq > this.cursor.eventSeq) {
            this.cursor.eventSeq = eventSeq;
            this.saveCursor();
        }
    }

    /**
     * 重置游标
     */
    reset(): void {
        this.cursor = {
            eventSeq: 0,
            hasNextPage: true
        };
        this.saveCursor();
    }

    /**
     * 从存储加载游标
     */
    private loadCursor(): EventCursor {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (error) {
                console.error('Failed to load cursor from storage:', error);
            }
        }

        return {
            eventSeq: 0,
            hasNextPage: true
        };
    }

    /**
     * 保存游标到存储
     */
    private saveCursor(): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.cursor));
            } catch (error) {
                console.error('Failed to save cursor to storage:', error);
            }
        }
    }

    /**
     * 导出游标数据
     */
    export(): string {
        return JSON.stringify(this.cursor);
    }

    /**
     * 导入游标数据
     */
    import(data: string): void {
        try {
            this.cursor = JSON.parse(data);
            this.saveCursor();
        } catch (error) {
            console.error('Failed to import cursor:', error);
        }
    }
}

/**
 * 创建游标管理器
 */
export function createEventCursor(gameId?: string): SuiEventCursor {
    const key = gameId ? `sui_event_cursor_${gameId}` : 'sui_event_cursor';
    return new SuiEventCursor(key);
}