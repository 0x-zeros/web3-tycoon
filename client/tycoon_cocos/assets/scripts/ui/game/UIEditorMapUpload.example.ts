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
 *
 * ⚠️ 完整流程：
 * 1. 强制执行编号和验证
 * 2. 输入模板ID
 * 3. 导出MapTemplate（前置检查）
 * 4. 用户确认
 * 5. BCS序列化并上传
 */
async function onBtnToMoveMapClick(this: any) {
    console.log('[UIEditor] btn_toMoveMap clicked');

    try {
        // ===== Step 0: 检查必要条件 =====
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

        // ===== Step 1: 完整计算和验证 =====
        console.log('[UIEditor] Step 1: Running full calculation & validation...');
        const entrancesValid = this._gameMap.calculateBuildingEntrances();
        // 内部会调用 assignIds()，包含：
        //   - DFS分配tile编号
        //   - 分配building编号
        //   - 计算tile邻居（w/n/e/s）
        //   - 计算building连街
        // 然后验证建筑入口

        if (!entrancesValid) {
            this.showErrorDialog(
                '❌ 建筑入口验证失败！\n\n' +
                '请检查控制台中的警告信息。\n\n' +
                '常见问题：\n' +
                '• 建筑周围缺少空地tile\n' +
                '• 入口tile的类型不是EMPTY_LAND\n' +
                '• 1x1建筑应有1个入口，2x2建筑应有2个入口\n' +
                '• 建筑朝向与入口位置不匹配\n\n' +
                '修复后地图会自动保存，然后重新点击此按钮。'
            );
            return;  // 中止上传
        }
        console.log('[UIEditor] ✓ All calculations and validations passed');

        // ===== Step 2: 输入模板ID =====
        const templateId = await this.promptTemplateId();
        if (templateId === null) {
            console.log('[UIEditor] User cancelled');
            return;
        }

        // ===== Step 3: 导出地图数据 =====
        console.log('[UIEditor] Step 3: Exporting map template...');
        let mapTemplate;
        try {
            mapTemplate = exportGameMapToMapTemplate(this._gameMap, templateId);
        } catch (error) {
            console.error('[UIEditor] Export failed:', error);
            this.showErrorDialog(
                `导出失败：\n${error.message}\n\n` +
                '这可能是程序错误，请联系开发者。'
            );
            return;
        }
        console.log('[UIEditor] ✓ Map template exported');

        // ===== Step 4: 用户确认 =====
        const confirmMessage =
            `确认上传地图模板 #${templateId} 到 Sui 链上？\n\n` +
            `✓ 地块数量: ${mapTemplate.tiles_static.size}\n` +
            `✓ 建筑数量: ${mapTemplate.buildings_static.size}\n` +
            `✓ 医院数量: ${mapTemplate.hospital_ids.length}\n\n` +
            `注意：\n` +
            `• 上传后无法修改\n` +
            `• 需要消耗 Gas 费用\n` +
            `• 数据已通过完整验证\n\n` +
            `确认继续？`;

        const confirmed = await this.showConfirmDialog(confirmMessage);
        if (!confirmed) {
            console.log('[UIEditor] User cancelled confirmation');
            return;
        }

        // ===== Step 5: BCS序列化并上传 =====
        this.showLoadingDialog(
            '正在上传地图到 Sui 链上...\n\n' +
            '步骤：\n' +
            '1. BCS序列化数据...\n' +
            '2. 构建交易...\n' +
            '3. 提交到链上...\n\n' +
            '请稍候，这可能需要几秒钟。'
        );

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

        // ===== Step 6: 成功提示 =====
        this.hideLoadingDialog();

        const successMessage =
            `🎉 地图上传成功！\n\n` +
            `模板 ID: ${result.templateId}\n` +
            `交易哈希: ${result.txHash.slice(0, 20)}...\n\n` +
            `✓ 数据已写入区块链\n` +
            `✓ 玩家现在可以使用此地图创建游戏\n\n` +
            `您可以在区块浏览器中查看详情。`;

        this.showSuccessDialog(successMessage);

        console.log('[UIEditor] ===== Upload Complete =====');
        console.log('Template ID:', result.templateId);
        console.log('Transaction Hash:', result.txHash);
        console.log('Tiles:', mapTemplate.tiles_static.size);
        console.log('Buildings:', mapTemplate.buildings_static.size);

    } catch (error) {
        // ===== 错误处理 =====
        this.hideLoadingDialog();

        console.error('[UIEditor] ===== Upload Failed =====');
        console.error('Error:', error);

        let errorMessage = '❌ 上传失败\n\n';
        if (error instanceof Error) {
            errorMessage += error.message;
        } else {
            errorMessage += String(error);
        }

        errorMessage += '\n\n详细错误信息已输出到控制台。';

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
