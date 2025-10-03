/**
 * UIEditor 地图上传功能集成示例
 *
 * 这是一个示例文件，展示如何在 UIEditor 中集成地图上传功能
 * 实际集成时需要根据项目结构调整
 */

import { MapAdminInteraction } from '../../sui/interactions/mapAdmin';
import { exportGameMapToMapTemplate } from '../../map/utils/MapTemplateExporter';
import type { GameMap } from '../../map/core/GameMap';

// ===== UIEditor 中需要添加的属性 =====

// private _gameMap: GameMap;  // 地图实例（已有）
// private _suiClient: SuiClient;  // Sui 客户端
// private _packageId: string;  // 合约包ID
// private _gameDataId: string;  // GameData 对象ID
// private _adminCapId: string;  // AdminCap 对象ID
// private _keypair: Ed25519Keypair;  // 签名密钥

// ===== btn_toMoveMap 按钮点击处理 =====

/**
 * "上传到 Move" 按钮点击
 * 将当前编辑的地图上传到链上
 */
async function onBtnToMoveMapClick(this: any) {
    console.log('[UIEditor] btn_toMoveMap clicked');

    try {
        // 1. 检查必要条件
        if (!this._gameMap) {
            console.error('[UIEditor] GameMap not initialized');
            this.showErrorToast('地图未加载');
            return;
        }

        if (!this._suiClient || !this._packageId || !this._gameDataId || !this._adminCapId || !this._keypair) {
            console.error('[UIEditor] Sui configuration incomplete');
            this.showErrorToast('请先配置 Sui 连接');
            return;
        }

        // 2. 弹出输入框：模板ID
        const templateId = await this.promptTemplateId();
        if (templateId === null) {
            console.log('[UIEditor] User cancelled');
            return;
        }

        // 3. 导出地图数据
        console.log('[UIEditor] Exporting map data...');
        const mapTemplate = exportGameMapToMapTemplate(this._gameMap, templateId);

        // 4. 显示确认对话框
        const confirmMessage =
            `确认上传地图模板 #${templateId}？\n\n` +
            `地块数量: ${mapTemplate.tiles_static.size}\n` +
            `建筑数量: ${mapTemplate.buildings_static.size}\n` +
            `医院数量: ${mapTemplate.hospital_ids.length}\n\n` +
            `上传后无法修改，请确认数据无误。`;

        const confirmed = await this.showConfirmDialog(confirmMessage);
        if (!confirmed) {
            console.log('[UIEditor] User cancelled confirmation');
            return;
        }

        // 5. 显示加载中
        this.showLoadingDialog('正在上传地图到 Sui 链上...\n请稍候，这可能需要几秒钟。');

        // 6. 创建交互器并上传
        const mapAdmin = new MapAdminInteraction(
            this._suiClient,
            this._packageId,
            this._gameDataId
        );

        const result = await mapAdmin.uploadMapTemplate(
            mapTemplate,
            this._adminCapId,
            this._keypair
        );

        // 7. 成功提示
        this.hideLoadingDialog();

        const successMessage =
            `地图上传成功！\n\n` +
            `模板 ID: ${result.templateId}\n` +
            `交易哈希: ${result.txHash.slice(0, 16)}...\n\n` +
            `玩家现在可以使用此地图创建游戏。`;

        this.showSuccessDialog(successMessage);

        console.log('[UIEditor] Map uploaded successfully');
        console.log('Template ID:', result.templateId);
        console.log('Transaction:', result.txHash);

    } catch (error) {
        // 8. 错误处理
        this.hideLoadingDialog();

        console.error('[UIEditor] Failed to upload map:', error);

        let errorMessage = '上传失败：';
        if (error instanceof Error) {
            errorMessage += error.message;
        } else {
            errorMessage += String(error);
        }

        this.showErrorDialog(errorMessage);
    }
}

// ===== UI 辅助函数（需要在 UIEditor 中实现） =====

/**
 * 弹出输入框让用户输入模板ID
 * @returns 模板ID，null 表示取消
 */
async function promptTemplateId(this: any): Promise<number | null> {
    // 实现方式1：使用 FairyGUI 的输入对话框
    // 实现方式2：使用自定义 UI 面板
    // 实现方式3：使用浏览器 prompt（临时）

    // 临时实现（需要替换为实际UI）
    const input = prompt('请输入模板ID（正整数）：', '1');
    if (input === null) return null;

    const id = parseInt(input);
    if (isNaN(id) || id < 0 || id > 65535) {
        this.showErrorToast('无效的模板ID，必须是 0-65535 的整数');
        return null;
    }

    return id;
}

/**
 * 显示确认对话框
 * @param message 消息内容
 * @returns true=确认, false=取消
 */
async function showConfirmDialog(this: any, message: string): Promise<boolean> {
    // 实现方式：使用 FairyGUI 对话框或浏览器 confirm

    // 临时实现
    return confirm(message);
}

/**
 * 显示加载对话框
 */
function showLoadingDialog(this: any, message: string): void {
    // 实现：显示模态加载框
    console.log('[Loading]', message);
}

/**
 * 隐藏加载对话框
 */
function hideLoadingDialog(this: any): void {
    // 实现：隐藏加载框
}

/**
 * 显示成功对话框
 */
function showSuccessDialog(this: any, message: string): void {
    // 实现：显示成功提示
    alert(message);
}

/**
 * 显示错误对话框
 */
function showErrorDialog(this: any, message: string): void {
    // 实现：显示错误提示
    alert(message);
}

/**
 * 显示错误Toast
 */
function showErrorToast(this: any, message: string): void {
    console.error(message);
}

// ===== 集成说明 =====

/**
 * 如何在 UIEditor.ts 中集成：
 *
 * 1. 导入相关模块：
 *    import { MapAdminInteraction } from '../../sui/interactions/mapAdmin';
 *    import { exportGameMapToMapTemplate } from '../../map/utils/MapTemplateExporter';
 *
 * 2. 添加 Sui 相关属性（或通过 SuiManager 统一管理）：
 *    private _suiClient: SuiClient;
 *    private _packageId: string;
 *    private _gameDataId: string;
 *    private _adminCapId: string;
 *    private _keypair: Ed25519Keypair;
 *
 * 3. 在 onLoad() 中初始化 Sui 配置
 *
 * 4. 找到 btn_toMoveMap 按钮的事件绑定，调用 onBtnToMoveMapClick()
 *
 * 5. 实现上述的 UI 辅助函数（prompt, confirm, loading 等）
 */

export {
    onBtnToMoveMapClick,
    promptTemplateId,
    showConfirmDialog,
    showLoadingDialog,
    hideLoadingDialog,
    showSuccessDialog,
    showErrorDialog,
    showErrorToast
};
