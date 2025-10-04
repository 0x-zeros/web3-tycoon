/**
 * UINotification Toast通知系统使用示例
 *
 * 这个文件展示了如何使用UINotification组件
 * 注意：这只是示例文件，不会被编译到游戏中
 */

import { UINotification, NotifyIcon, NotifyType, NotificationOptions } from "./UINotification";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";

/**
 * 基础用法示例
 */
export class BasicUsageExamples {
    /**
     * 示例1: 简单信息提示
     */
    static showInfoExample() {
        UINotification.info("连接成功");
    }

    /**
     * 示例2: 成功提示（带标题）
     */
    static showSuccessExample() {
        UINotification.success("交易已提交到区块链", "操作成功");
    }

    /**
     * 示例3: 警告提示（自定义时长5秒）
     */
    static showWarningExample() {
        UINotification.warning("余额不足，请充值", "警告", 5000);
    }

    /**
     * 示例4: 错误提示
     */
    static showErrorExample() {
        UINotification.error("网络连接失败，请重试", "错误");
    }

    /**
     * 示例5: 多个通知同时显示
     */
    static showMultipleExample() {
        UINotification.info("第一条消息");
        setTimeout(() => UINotification.success("第二条消息"), 500);
        setTimeout(() => UINotification.warning("第三条消息"), 1000);
        setTimeout(() => UINotification.error("第四条消息"), 1500);
    }
}

/**
 * 高级用法示例
 */
export class AdvancedUsageExamples {
    /**
     * 示例6: 完全自定义通知
     */
    static customNotificationExample() {
        UINotification.show({
            title: "新消息",
            message: "您有一条新消息：<color=#00ff00>游戏开始</color>",
            icon: NotifyIcon.INFO,
            type: NotifyType.INFO,
            duration: 4000
        });
    }

    /**
     * 示例7: 不显示图标的通知
     */
    static noIconExample() {
        UINotification.show({
            title: "系统提示",
            message: "这是一条没有图标的通知",
            icon: NotifyIcon.NONE,
            type: NotifyType.DEFAULT,
            duration: 3000
        });
    }

    /**
     * 示例8: 自定义Icon URL
     */
    static customIconExample() {
        UINotification.show({
            title: "自定义图标",
            message: "使用自定义图标的通知",
            icon: "ui://Common/custom_icon", // 自定义图标URL
            type: NotifyType.INFO,
            duration: 3000
        });
    }

    /**
     * 示例9: 富文本消息
     */
    static richTextExample() {
        UINotification.show({
            title: "游戏提示",
            message: "恭喜你获得<color=#ffaa00>金币 x100</color>!\n" +
                     "连续登录<b>7天</b>可获得更多奖励",
            icon: NotifyIcon.SUCCESS,
            type: NotifyType.SUCCESS,
            duration: 5000
        });
    }

    /**
     * 示例10: 长时间显示的通知
     */
    static longDurationExample() {
        UINotification.show({
            title: "重要提示",
            message: "这条消息会显示10秒钟",
            icon: NotifyIcon.WARNING,
            type: NotifyType.WARNING,
            duration: 10000 // 10秒
        });
    }

    /**
     * 示例11: 清除所有通知
     */
    static clearAllExample() {
        // 先显示几条通知
        UINotification.info("消息1");
        UINotification.success("消息2");
        UINotification.warning("消息3");

        // 2秒后清除所有通知
        setTimeout(() => {
            UINotification.clearAll();
        }, 2000);
    }
}

/**
 * 实战场景示例
 */
export class RealWorldExamples {
    /**
     * 场景1: 游戏事件通知
     */
    static gameEventExample() {
        // 监听游戏开始事件
        EventBus.on(EventTypes.Game.GameStart, () => {
            UINotification.info("游戏开始！", "Web3 Tycoon");
        });

        // 监听游戏暂停事件
        EventBus.on(EventTypes.Game.GamePause, () => {
            UINotification.warning("游戏已暂停", "暂停");
        });
    }

    /**
     * 场景2: 玩家行动反馈
     */
    static playerActionExample() {
        // 购买属性成功
        function onPropertyPurchased(propertyName: string, price: number) {
            UINotification.success(
                `成功购买 ${propertyName}，花费 ${price} SUI`,
                "购买成功"
            );
        }

        // 购买失败
        function onPurchaseFailed(reason: string) {
            UINotification.error(reason, "购买失败");
        }
    }

    /**
     * 场景3: 区块链交易状态
     */
    static blockchainTransactionExample() {
        // 交易提交中
        function onTransactionSubmitted() {
            UINotification.info("交易已提交到区块链", "处理中", 2000);
        }

        // 交易确认
        function onTransactionConfirmed(txHash: string) {
            UINotification.success(
                `交易已确认\n哈希: ${txHash.substring(0, 10)}...`,
                "交易成功",
                5000
            );
        }

        // 交易失败
        function onTransactionFailed(error: string) {
            UINotification.error(
                `交易失败: ${error}`,
                "错误",
                6000
            );
        }
    }

    /**
     * 场景4: 连续通知（游戏进度）
     */
    static gameProgressExample() {
        // 模拟游戏进度更新
        setTimeout(() => UINotification.info("到达起点"), 1000);
        setTimeout(() => UINotification.info("掷骰子: 6"), 3000);
        setTimeout(() => UINotification.success("前进6格"), 4000);
        setTimeout(() => UINotification.warning("触发事件卡片"), 6000);
    }

    /**
     * 场景5: 系统提示
     */
    static systemNotificationExample() {
        // 定期提示
        setInterval(() => {
            UINotification.info("自动保存完成", "系统", 2000);
        }, 60000); // 每分钟提示一次

        // 网络状态变化
        function onNetworkStatusChanged(online: boolean) {
            if (online) {
                UINotification.success("网络连接已恢复", "网络状态");
            } else {
                UINotification.error("网络连接已断开", "网络状态", 10000);
            }
        }
    }

    /**
     * 场景6: 成就解锁
     */
    static achievementExample() {
        function onAchievementUnlocked(name: string, description: string) {
            UINotification.show({
                title: `🏆 成就解锁：${name}`,
                message: description,
                icon: NotifyIcon.SUCCESS,
                type: NotifyType.SUCCESS,
                duration: 6000
            });
        }
    }

    /**
     * 场景7: 玩家互动通知
     */
    static playerInteractionExample() {
        // 玩家发送交易请求
        function onTradeRequest(playerName: string) {
            UINotification.show({
                title: "交易请求",
                message: `${playerName} 想与你交易`,
                icon: NotifyIcon.INFO,
                type: NotifyType.INFO,
                duration: 5000
            });
        }

        // 收到聊天消息
        function onChatMessage(playerName: string, message: string) {
            UINotification.show({
                title: playerName,
                message: message,
                icon: NotifyIcon.INFO,
                type: NotifyType.DEFAULT,
                duration: 4000
            });
        }
    }
}

/**
 * 动画和时序控制示例
 */
export class AnimationExamples {
    /**
     * 示例: 顺序显示多条消息（间隔显示）
     */
    static sequentialNotificationsExample() {
        const messages = [
            { type: 'info', msg: '准备开始游戏...' },
            { type: 'info', msg: '加载地图资源...' },
            { type: 'success', msg: '地图加载完成！' },
            { type: 'info', msg: '初始化玩家...' },
            { type: 'success', msg: '游戏准备完成！' }
        ];

        messages.forEach((item, index) => {
            setTimeout(() => {
                if (item.type === 'info') {
                    UINotification.info(item.msg);
                } else {
                    UINotification.success(item.msg);
                }
            }, index * 1000); // 每条消息间隔1秒
        });
    }

    /**
     * 示例: 爆发式通知（同时显示多条）
     */
    static burstNotificationsExample() {
        // 同时显示5条通知（会自动管理，最多显示5条）
        for (let i = 1; i <= 7; i++) {
            UINotification.info(`通知 ${i}`, `批量通知`, 3000);
        }
        // 注意：由于最大数量限制，只会显示最新的5条
    }
}

/**
 * 完整的游戏流程示例
 */
export class CompleteWorkflowExample {
    /**
     * 游戏回合完整流程通知
     */
    static async gameTurnWorkflow() {
        // 1. 回合开始
        UINotification.info("轮到你了！", "回合开始");

        await this.delay(2000);

        // 2. 掷骰子
        const diceResult = Math.floor(Math.random() * 6) + 1;
        UINotification.info(`掷出了 ${diceResult} 点`, "掷骰子");

        await this.delay(2000);

        // 3. 移动
        UINotification.success(`前进 ${diceResult} 格`, "移动中");

        await this.delay(2000);

        // 4. 触发事件
        const events = ["购买属性", "支付租金", "抽取卡片", "获得奖励"];
        const event = events[Math.floor(Math.random() * events.length)];
        UINotification.warning(`触发: ${event}`, "事件");

        await this.delay(2000);

        // 5. 回合结束
        UINotification.info("回合结束", "等待其他玩家");
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
