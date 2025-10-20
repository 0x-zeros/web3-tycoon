/**
 * CompositeVoxelActor - 组合式体素 Actor
 *
 * 通过组合多个 block + overlay + transform 来表现复杂对象
 * 独立系统，不依赖 VoxelSystem/ResourcePack
 *
 * 用途：
 * - 建筑渲染（替代预制 prefab）
 * - 装饰物
 * - 特效
 * - 任何需要组合式体素表现的对象
 *
 * @author Web3 Tycoon Team
 */

import { _decorator, Component, Node, Vec3 } from 'cc';
import { CompositeConfig, BlockComponent, RenderResult } from './CompositeTypes';
import { CompositeBlockRenderer } from './CompositeBlockRenderer';
import { BlockOverlayManager } from '../overlay/BlockOverlayManager';

const { ccclass, property } = _decorator;

@ccclass('CompositeVoxelActor')
export class CompositeVoxelActor extends Component {
    // ===== 配置 =====
    private _config: CompositeConfig | null = null;

    // ===== 渲染节点 =====
    private _rootNode: Node | null = null;           // 根节点（用于整体 transform）
    private _blockNodes: Node[] = [];                 // block 节点列表
    private _overlayNodes: Node[] = [];               // overlay 节点列表（用于清理）

    // ===== 状态 =====
    private _isRendered: boolean = false;

    // ===== 生命周期 =====

    protected onLoad(): void {
        console.log('[CompositeVoxelActor] Component loaded');
    }

    protected onDestroy(): void {
        this.clear();
    }

    // ===== 核心方法 =====

    /**
     * 设置组合配置并渲染
     *
     * @param config 组合配置
     * @returns 渲染结果
     */
    public async setConfig(config: CompositeConfig): Promise<RenderResult> {
        this._config = config;
        return await this.rebuild();
    }

    /**
     * 获取当前配置
     */
    public getConfig(): CompositeConfig | null {
        return this._config;
    }

    /**
     * 重建所有 block
     */
    public async rebuild(): Promise<RenderResult> {
        if (!this._config) {
            return {
                success: false,
                blockCount: 0,
                error: 'No config set'
            };
        }

        console.log('[CompositeVoxelActor] Rebuilding with config:', this._config);

        try {
            // 1. 清理旧节点
            this.clear();

            // 2. 创建根节点
            this._rootNode = new Node('CompositeRoot');
            this._rootNode.parent = this.node;

            // 3. 应用整体 transform
            if (this._config.basePosition) {
                this._rootNode.setPosition(this._config.basePosition);
            }

            if (this._config.baseScale) {
                this._rootNode.setScale(this._config.baseScale);
            }

            if (this._config.baseRotation) {
                this._rootNode.setRotationFromEuler(this._config.baseRotation);
            }

            // 4. 渲染每个 block 组件
            let successCount = 0;
            for (let i = 0; i < this._config.components.length; i++) {
                const comp = this._config.components[i];

                // 跳过不可见的组件
                if (comp.visible === false) {
                    continue;
                }

                const blockNode = await this.createBlockNode(comp, i);
                if (blockNode) {
                    this._blockNodes.push(blockNode);
                    successCount++;
                }
            }

            this._isRendered = true;

            console.log(`[CompositeVoxelActor] Rebuilt: ${successCount}/${this._config.components.length} blocks`);

            return {
                success: true,
                blockCount: successCount
            };
        } catch (error) {
            console.error('[CompositeVoxelActor] Rebuild failed:', error);
            return {
                success: false,
                blockCount: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 创建单个 block 节点
     *
     * @param comp Block 组件配置
     * @param index 组件索引
     * @returns 创建的节点
     */
    private async createBlockNode(comp: BlockComponent, index: number): Promise<Node | null> {
        try {
            // 1. 创建节点
            const node = new Node(`Block_${index}_${comp.blockId.replace(':', '_')}`);
            node.parent = this._rootNode;

            // 2. 设置 transform
            if (comp.position) {
                node.setPosition(comp.position);
            }

            if (comp.scale) {
                node.setScale(comp.scale);
            }

            if (comp.rotation) {
                node.setRotationFromEuler(comp.rotation);
            }

            // 3. 渲染 block mesh 和材质
            const renderSuccess = await CompositeBlockRenderer.renderBlock(node, comp.blockId);
            if (!renderSuccess) {
                console.warn(`[CompositeVoxelActor] Failed to render block ${comp.blockId}`);
                node.destroy();
                return null;
            }

            // 4. 添加 overlays（如果有）
            if (comp.overlays && comp.overlays.length > 0) {
                for (const overlayConfig of comp.overlays) {
                    const overlayNode = await BlockOverlayManager.createOverlay(node, overlayConfig);
                    if (overlayNode) {
                        this._overlayNodes.push(overlayNode);
                    }
                }
            }

            return node;
        } catch (error) {
            console.error(`[CompositeVoxelActor] Failed to create block node:`, error);
            return null;
        }
    }

    /**
     * 清理所有节点
     */
    public clear(): void {
        // 清理 overlay 节点（虽然会随 block 节点销毁，但明确清理更安全）
        this._overlayNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._overlayNodes = [];

        // 清理 block 节点
        this._blockNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._blockNodes = [];

        // 清理根节点
        if (this._rootNode && this._rootNode.isValid) {
            this._rootNode.destroy();
            this._rootNode = null;
        }

        this._isRendered = false;
    }

    // ===== 辅助方法 =====

    /**
     * 是否已渲染
     */
    public isRendered(): boolean {
        return this._isRendered;
    }

    /**
     * 获取根节点
     */
    public getRootNode(): Node | null {
        return this._rootNode;
    }

    /**
     * 获取所有 block 节点
     */
    public getBlockNodes(): Node[] {
        return [...this._blockNodes];
    }

    /**
     * 更新整体 transform（不重建）
     */
    public setBaseTransform(position?: Vec3, scale?: Vec3, rotation?: Vec3): void {
        if (!this._rootNode) {
            console.warn('[CompositeVoxelActor] Root node not created');
            return;
        }

        if (position) {
            this._rootNode.setPosition(position);
        }

        if (scale) {
            this._rootNode.setScale(scale);
        }

        if (rotation) {
            this._rootNode.setRotationFromEuler(rotation);
        }
    }

    /**
     * 显示/隐藏
     */
    public setVisible(visible: boolean): void {
        if (this._rootNode) {
            this._rootNode.active = visible;
        }
    }
}
