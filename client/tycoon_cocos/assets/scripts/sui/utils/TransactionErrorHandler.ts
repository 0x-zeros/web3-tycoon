/**
 * Sui 交易错误处理器
 * 提供统一的错误处理和用户通知机制
 */

import { SuiErrorTranslator } from './SuiErrorTranslator';
import { UINotification } from '../../ui/utils/UINotification';
import { UIMessage } from '../../ui/utils/UIMessage';

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
    /** 信息提示 - 自动消失的 Notification */
    INFO = 'info',
    /** 警告 - 自动消失的 Notification */
    WARNING = 'warning',
    /** 错误 - 自动消失的 Notification（默认） */
    ERROR = 'error',
    /** 严重错误 - 需要用户确认的 MessageBox */
    CRITICAL = 'critical'
}

/**
 * 错误处理选项
 */
export interface ErrorHandlerOptions {
    /** 错误标题（可选） */
    title?: string;
    /** 错误严重程度（默认 ERROR） */
    severity?: ErrorSeverity;
    /** 是否在 console 打印详细错误（默认 true） */
    logToConsole?: boolean;
    /** 自定义消息前缀（在翻译后的消息前添加） */
    messagePrefix?: string;
    /** 自定义消息后缀 */
    messageSuffix?: string;
}

/**
 * Sui 交易错误处理器类
 */
export class TransactionErrorHandler {
    /**
     * 处理 Sui 交易错误
     *
     * @param error 原始错误对象
     * @param options 处理选项
     * @returns 翻译后的错误信息
     *
     * @example
     * ```typescript
     * try {
     *   await SuiManager.instance.rollAndStep(session, path);
     * } catch (error) {
     *   TransactionErrorHandler.handle(error, {
     *     title: '掷骰子失败',
     *     messagePrefix: '无法完成移动：'
     *   });
     * }
     * ```
     */
    public static handle(error: any, options: ErrorHandlerOptions = {}) {
        // 默认选项
        const {
            title = '',
            severity = ErrorSeverity.ERROR,
            logToConsole = true,
            messagePrefix = '',
            messageSuffix = ''
        } = options;

        // 翻译错误
        const errorInfo = SuiErrorTranslator.translate(error);

        // 构建完整消息
        let fullMessage = errorInfo.message;
        if (messagePrefix) {
            fullMessage = messagePrefix + fullMessage;
        }
        if (messageSuffix) {
            fullMessage = fullMessage + messageSuffix;
        }

        // Console 日志
        if (logToConsole) {
            const detailedError = SuiErrorTranslator.getDetailedError(error);
            console.error(`[TransactionErrorHandler] ${title || '交易错误'}:`, detailedError);
            console.error('  原始错误:', error);
        }

        // 显示用户通知
        this._showNotification(fullMessage, title, severity);

        return errorInfo;
    }

    /**
     * 显示通知（根据严重程度选择 Notification 或 MessageBox）
     */
    private static _showNotification(
        message: string,
        title: string,
        severity: ErrorSeverity
    ): void {
        switch (severity) {
            case ErrorSeverity.INFO:
                UINotification.info(message, title, 6000);
                break;

            case ErrorSeverity.WARNING:
                UINotification.warning(message, title, 6000);
                break;

            case ErrorSeverity.ERROR:
                UINotification.error(message, title, 6000);
                break;

            case ErrorSeverity.CRITICAL:
                // 严重错误使用 MessageBox，需要用户确认
                UIMessage.error(message, title || '严重错误').catch(err => {
                    console.error('[TransactionErrorHandler] MessageBox error:', err);
                });
                break;

            default:
                UINotification.error(message, title, 6000);
        }
    }

    /**
     * 判断是否是特定的 Move 错误码
     */
    public static isErrorCode(error: any, code: number): boolean {
        return SuiErrorTranslator.isErrorCode(error, code);
    }

    /**
     * 判断是否是 Move 错误
     */
    public static isMoveError(error: any): boolean {
        return SuiErrorTranslator.isMoveError(error);
    }
}

/**
 * 便捷函数：处理 Sui 交易错误
 *
 * @example
 * ```typescript
 * import { handleSuiTransactionError } from './TransactionErrorHandler';
 *
 * try {
 *   await someTransaction();
 * } catch (error) {
 *   handleSuiTransactionError(error, { title: '操作失败' });
 * }
 * ```
 */
export function handleSuiTransactionError(
    error: any,
    options?: ErrorHandlerOptions
) {
    return TransactionErrorHandler.handle(error, options);
}
