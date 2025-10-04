/**
 * UIMessage MessageBox 使用示例
 *
 * 这个文件展示了如何使用UIMessage通用MessageBox组件
 * 注意：这只是示例文件，不会被编译到游戏中
 */

import { UIMessage, MessageBoxIcon, MessageBoxResult } from "./UIMessage";
import { UIManager } from "../core/UIManager";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";

/**
 * 初始化示例
 * 在GameInitializer中调用
 */
export async function initMessageBoxExample() {
    // 1. 注册MessageBox UI（在UI系统初始化后）
    UIManager.instance.registerMessageBoxUI();

    console.log("MessageBox UI registered");
}

/**
 * 基础用法示例
 */
export class BasicUsageExamples {
    /**
     * 示例1: 简单信息提示
     */
    static async showInfoExample() {
        await UIMessage.info("连接成功");
        console.log("用户已关闭信息提示");
    }

    /**
     * 示例2: 成功提示
     */
    static async showSuccessExample() {
        await UIMessage.success("交易已完成", "成功");
        console.log("用户已关闭成功提示");
    }

    /**
     * 示例3: 警告提示
     */
    static async showWarningExample() {
        await UIMessage.warning("余额不足，请充值", "警告");
        console.log("用户已关闭警告提示");
    }

    /**
     * 示例4: 错误提示
     */
    static async showErrorExample() {
        await UIMessage.error("网络连接失败，请重试", "错误");
        console.log("用户已关闭错误提示");
    }

    /**
     * 示例5: 确认对话框
     */
    static async showConfirmExample() {
        const confirmed = await UIMessage.confirm({
            message: "确定要购买这个NFT吗？",
            title: "确认购买",
            confirmText: "购买",
            cancelText: "取消"
        });

        if (confirmed) {
            console.log("用户确认购买");
            // 执行购买逻辑
        } else {
            console.log("用户取消购买");
        }
    }
}

/**
 * 高级用法示例
 */
export class AdvancedUsageExamples {
    /**
     * 示例6: 自定义按钮和回调
     */
    static async customButtonsExample() {
        const result = await UIMessage.show({
            title: "Web3 Tycoon",
            message: "欢迎来到区块链大富翁！",
            icon: MessageBoxIcon.INFO,
            buttons: {
                primary: {
                    text: "开始游戏",
                    callback: () => {
                        console.log("开始游戏按钮被点击");
                        EventBus.emit(EventTypes.Game.GameStart);
                    }
                },
                secondary: {
                    text: "查看教程",
                    visible: true,
                    callback: () => {
                        console.log("查看教程按钮被点击");
                    }
                },
                close: {
                    visible: false // 隐藏关闭按钮
                }
            }
        });

        console.log("MessageBox结果:", result);
    }

    /**
     * 示例7: Modeless模式（不阻挡背景点击）
     */
    static async modelessExample() {
        await UIMessage.show({
            title: "提示",
            message: "这是一个非阻挡式消息框，你可以点击背景继续操作",
            modal: false, // 设置为非模态
            icon: MessageBoxIcon.INFO,
            buttons: {
                primary: { text: "知道了" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 示例8: 富文本消息
     */
    static async richTextExample() {
        await UIMessage.show({
            title: "游戏更新",
            message: "欢迎来到<color=#00ff00>Web3 Tycoon</color>!\n\n" +
                     "新功能:\n" +
                     "• 支持<b>NFT</b>属性\n" +
                     "• 添加<color=#ffaa00>DeFi</color>集成\n" +
                     "• 优化游戏体验",
            icon: MessageBoxIcon.SUCCESS,
            buttons: {
                primary: { text: "太棒了！" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 示例9: 自定义皮肤
     */
    static async customSkinExample() {
        await UIMessage.show({
            title: "VIP消息",
            message: "恭喜您成为VIP玩家！",
            icon: MessageBoxIcon.SUCCESS,
            skin: {
                bgColor: "#ffcc00", // 金色背景
                titleColor: "#ffffff",
                messageColor: "#ffffff"
            },
            buttons: {
                primary: { text: "领取奖励" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 示例10: 设置全局默认皮肤
     */
    static setGlobalSkinExample() {
        UIMessage.setDefaultSkin({
            bgColor: "#ff336699", // 默认背景色
            titleColor: "#ffffff",
            messageColor: "#eeeeee"
        });

        console.log("全局默认皮肤已设置");
    }

    /**
     * 示例11: 获取用户选择结果
     */
    static async getUserChoiceExample() {
        const result = await UIMessage.show({
            title: "选择操作",
            message: "请选择要执行的操作",
            icon: MessageBoxIcon.INFO,
            buttons: {
                primary: { text: "保存" },
                secondary: { text: "取消", visible: true },
                close: { text: "关闭", visible: true }
            }
        });

        switch (result) {
            case MessageBoxResult.PRIMARY:
                console.log("用户选择了保存");
                break;
            case MessageBoxResult.SECONDARY:
                console.log("用户选择了取消");
                break;
            case MessageBoxResult.CLOSE:
                console.log("用户关闭了对话框");
                break;
        }
    }
}

/**
 * 队列管理示例
 */
export class QueueManagementExamples {
    /**
     * 示例12: 连续显示多个MessageBox（自动排队）
     */
    static async queueExample() {
        console.log("当前队列长度:", UIMessage.getQueueLength());

        // 这些调用会自动排队，一个接一个显示
        UIMessage.info("第一条消息");
        UIMessage.success("第二条消息");
        UIMessage.warning("第三条消息");

        console.log("3个消息已加入队列，队列长度:", UIMessage.getQueueLength());
    }

    /**
     * 示例13: 清空队列
     */
    static clearQueueExample() {
        // 清空所有等待中的MessageBox
        UIMessage.clearQueue();
        console.log("队列已清空");
    }
}

/**
 * 实战场景示例
 */
export class RealWorldExamples {
    /**
     * 场景1: 游戏暂停确认
     */
    static async pauseGameExample() {
        const confirmed = await UIMessage.confirm({
            message: "确定要暂停游戏吗？",
            title: "暂停游戏",
            confirmText: "确定",
            cancelText: "取消",
            icon: MessageBoxIcon.WARNING
        });

        if (confirmed) {
            EventBus.emit(EventTypes.Game.GamePause);
        }
    }

    /**
     * 场景2: 购买确认
     */
    static async purchaseConfirmExample(propertyName: string, price: number) {
        const confirmed = await UIMessage.confirm({
            message: `确定要花费 ${price} SUI 购买 ${propertyName} 吗？`,
            title: "购买确认",
            confirmText: "购买",
            cancelText: "取消",
            icon: MessageBoxIcon.INFO
        });

        if (confirmed) {
            // 执行购买逻辑
            console.log(`购买 ${propertyName}`);
        }
    }

    /**
     * 场景3: 错误处理
     */
    static async errorHandlingExample(errorMessage: string) {
        await UIMessage.error(errorMessage, "操作失败");
        // 错误处理逻辑
    }

    /**
     * 场景4: 异步操作反馈
     */
    static async asyncOperationExample() {
        // 显示loading提示（可以用Modeless模式）
        UIMessage.show({
            title: "处理中",
            message: "正在连接区块链...",
            modal: true,
            icon: MessageBoxIcon.INFO,
            buttons: {
                primary: { visible: false },
                secondary: { visible: false },
                close: { visible: false }
            }
        });

        try {
            // 执行异步操作
            await this.connectToBlockchain();

            // 关闭loading，显示成功
            UIMessage.clearQueue(); // 清空loading提示
            await UIMessage.success("连接成功！");
        } catch (error) {
            UIMessage.clearQueue();
            await UIMessage.error("连接失败，请重试");
        }
    }

    private static async connectToBlockchain(): Promise<void> {
        // 模拟异步操作
        return new Promise((resolve) => setTimeout(resolve, 2000));
    }
}

/**
 * 完整的使用流程示例
 */
export class CompleteWorkflowExample {
    /**
     * 游戏开始时的完整流程
     */
    static async gameStartWorkflow() {
        // 1. 欢迎消息
        await UIMessage.show({
            title: "欢迎",
            message: "欢迎来到<color=#00ff00>Web3 Tycoon</color>!\n准备好开始游戏了吗？",
            icon: MessageBoxIcon.SUCCESS,
            buttons: {
                primary: { text: "开始游戏" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });

        // 2. 规则确认
        const understood = await UIMessage.confirm({
            message: "游戏过程中会消耗SUI代币，请确保您的钱包有足够余额。是否继续？",
            title: "注意事项",
            confirmText: "我知道了",
            cancelText: "返回",
            icon: MessageBoxIcon.WARNING
        });

        if (!understood) {
            console.log("用户选择返回");
            return;
        }

        // 3. 开始游戏
        EventBus.emit(EventTypes.Game.GameStart);

        // 4. 显示首次提示（Modeless模式，不阻挡操作）
        UIMessage.show({
            title: "提示",
            message: "点击地图上的属性可以查看详情",
            modal: false,
            icon: MessageBoxIcon.INFO,
            buttons: {
                primary: { text: "知道了" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }
}
