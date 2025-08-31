import { _decorator, Component, Node, MeshRenderer, Material, utils, Vec3, Camera, Enum } from 'cc';
import { VoxelChunk } from '../core/VoxelTypes';
import { VoxelMeshGenerator } from './VoxelMesh';
import { VoxelChunkManager } from '../world/VoxelChunk';
import { VoxelBlockType } from '../core/VoxelBlock';
import { VoxelWorldManager } from '../world/VoxelWorld';
import { VoxelConfig, VoxelRenderMode } from '../core/VoxelConfig';
import { VoxelWorldConfig, VoxelWorldMode } from '../core/VoxelWorldConfig';
import { VoxelInteractionManager, VoxelInteractionEvents } from '../interaction/VoxelInteractionManager';
import { VoxelCameraController, CameraMode } from '../interaction/VoxelCameraController';
import { VoxelCollisionSystem } from '../interaction/VoxelCollisionSystem';

const { ccclass, property } = _decorator;

@ccclass('VoxelRenderer')
export class VoxelRenderer extends Component {
    
    @property(Material)
    public blockMaterial: Material | null = null;
    
    @property(Material)
    public skyMaterial: Material | null = null;
    
    @property(Camera)
    public camera: Camera | null = null;
    
    @property(Node)
    public worldRoot: Node | null = null;
    
    @property({ type: Enum(VoxelRenderMode), displayName: "渲染模式" })
    public renderMode: VoxelRenderMode = VoxelRenderMode.MERGED_CHUNK;
    
    @property(VoxelInteractionManager)
    public interactionManager: VoxelInteractionManager | null = null;
    
    private worldManager: VoxelWorldManager | null = null;
    private chunkNodes: Map<string, Node> = new Map();
    private blockNodes: Map<string, Node> = new Map(); // 独立模式下存储block节点
    private timer: number = 0;
    private daylight: number = 1.0;
    private fogDistance: number = VoxelConfig.FOG_DISTANCE_DEFAULT;
    
    protected onLoad(): void {
        if (!this.worldRoot) {
            this.worldRoot = new Node('VoxelWorld');
            this.node.addChild(this.worldRoot);
        }
        
        this.worldManager = new VoxelWorldManager();
        
        this.initializeInteractionSystem();
    }
    
    private initializeInteractionSystem(): void {
        if (!this.interactionManager) {
            this.interactionManager = this.getComponent(VoxelInteractionManager);
        }
        
        if (!this.interactionManager) {
            console.warn('[VoxelRenderer] 未找到VoxelInteractionManager组件，交互功能将不可用');
            return;
        }
        
        const interactionEvents: VoxelInteractionEvents = {
            onBlockClick: (hitResult) => {
                console.log('[VoxelRenderer] 方块点击:', hitResult);
            },
            onBlockHover: (hitResult) => {
                if (hitResult) {
                    console.log('[VoxelRenderer] 方块悬停:', hitResult.position);
                }
            },
            onBlockPlace: (position, blockType) => {
                console.log('[VoxelRenderer] 方块放置:', position, blockType);
                this.markChunkForUpdate(position);
            },
            onBlockBreak: (position) => {
                console.log('[VoxelRenderer] 方块破坏:', position);
                this.markChunkForUpdate(position);
            },
            onModeChange: (mode) => {
                console.log('[VoxelRenderer] 摄像机模式切换:', mode);
            }
        };
        
        this.interactionManager.initialize(this.worldManager, interactionEvents);
    }
    
    private markChunkForUpdate(blockPosition: Vec3): void {
        if (!this.worldManager) return;
        
        const { p, q } = VoxelChunkManager.getChunkCoords(blockPosition.x, blockPosition.z);
        const chunk = this.worldManager.getChunk(p, q);
        
        if (chunk) {
            VoxelChunkManager.markChunkDirty(chunk);
            
            const neighbors = VoxelChunkManager.getNeighborChunkCoords(p, q);
            neighbors.forEach(({ p: np, q: nq }) => {
                const neighborChunk = this.worldManager.getChunk(np, nq);
                if (neighborChunk) {
                    VoxelChunkManager.markChunkDirty(neighborChunk);
                }
            });
        }
    }

    protected update(deltaTime: number): void {
        this.timer += deltaTime;
        this.updateShaderUniforms();
        
        if (this.camera && this.worldManager) {
            const cameraPos = this.camera.node.worldPosition;
            this.worldManager.updateChunksAroundPlayer(cameraPos.x, cameraPos.z);
            this.renderVisibleChunks();
        }
    }

    private updateShaderUniforms(): void {
        if (this.blockMaterial) {
            this.blockMaterial.setProperty('timer', this.timer % (2 * Math.PI));
            this.blockMaterial.setProperty('daylight', this.daylight);
            this.blockMaterial.setProperty('fogDistance', this.fogDistance);
            this.blockMaterial.setProperty('ortho', 0);
        }
        
        if (this.skyMaterial) {
            this.skyMaterial.setProperty('timer', this.timer % (2 * Math.PI));
        }
    }

    private renderVisibleChunks(): void {
        if (!this.camera || !this.worldManager) return;
        
        const cameraPos = this.camera.node.worldPosition;
        const renderableChunks = this.worldManager.getRenderableChunks(cameraPos.x, cameraPos.z);
        const activeChunkKeys = new Set<string>();
        
        renderableChunks.forEach(chunk => {
            const chunkKey = this.getChunkKey(chunk.p, chunk.q);
            activeChunkKeys.add(chunkKey);
            
            if (VoxelChunkManager.isChunkDirty(chunk)) {
                this.updateChunkMesh(chunk);
                VoxelChunkManager.clearChunkDirtyFlag(chunk);
            }
            
            this.ensureChunkNode(chunk);
        });
        
        this.removeUnusedChunkNodes(activeChunkKeys);
    }

    private updateChunkMesh(chunk: VoxelChunk): void {
        const blocks: { x: number, y: number, z: number, type: VoxelBlockType }[] = [];
        
        VoxelChunkManager.forEachBlock(chunk, (x, y, z, w) => {
            if (w > 0) {
                blocks.push({ x, y, z, type: w as VoxelBlockType });
            }
        });
        
        if (blocks.length === 0) {
            this.removeChunkNode(chunk.p, chunk.q);
            this.removeChunkBlockNodes(chunk.p, chunk.q);
            return;
        }
        
        // 根据渲染模式选择不同的更新方法
        if (this.renderMode === VoxelRenderMode.MERGED_CHUNK) {
            this.updateChunkMeshMerged(chunk, blocks);
        } else {
            this.updateChunkMeshIndividual(chunk, blocks);
        }
    }

    private updateChunkMeshMerged(chunk: VoxelChunk, blocks: { x: number, y: number, z: number, type: VoxelBlockType }[]): void {
        const getBlockAt = (x: number, y: number, z: number): VoxelBlockType => {
            if (!this.worldManager) return VoxelBlockType.EMPTY;
            return this.worldManager.getBlock(x, y, z);
        };
        
        const baseX = chunk.p * VoxelConfig.CHUNK_SIZE;
        const baseZ = chunk.q * VoxelConfig.CHUNK_SIZE;
        const meshData = VoxelMeshGenerator.generateChunkMesh(blocks, getBlockAt, baseX, baseZ);
        
        if (meshData.vertices.length === 0) {
            this.removeChunkNode(chunk.p, chunk.q);
            return;
        }

        const geometry = VoxelMeshGenerator.createCocosMesh(meshData);
        const mesh = utils.MeshUtils.createMesh(geometry);
        
        const chunkNode = this.getOrCreateChunkNode(chunk);
        const meshRenderer = chunkNode.getComponent(MeshRenderer);
        if (meshRenderer) {
            meshRenderer.mesh = mesh;
        }
        
        chunk.faces = meshData.indices.length / 3;
        
        // 在合并模式下清理可能存在的独立block节点
        this.removeChunkBlockNodes(chunk.p, chunk.q);
    }

    private updateChunkMeshIndividual(chunk: VoxelChunk, blocks: { x: number, y: number, z: number, type: VoxelBlockType }[]): void {
        const getBlockAt = (x: number, y: number, z: number): VoxelBlockType => {
            if (!this.worldManager) return VoxelBlockType.EMPTY;
            return this.worldManager.getBlock(x, y, z);
        };
        
        // 清理现有该chunk的所有block节点
        this.removeChunkBlockNodes(chunk.p, chunk.q);
        
        // 为每个block创建独立节点
        blocks.forEach(block => {
            // 为单个block生成mesh
            const neighbors = {
                left: getBlockAt(block.x - 1, block.y, block.z),
                right: getBlockAt(block.x + 1, block.y, block.z),
                top: getBlockAt(block.x, block.y + 1, block.z),
                bottom: getBlockAt(block.x, block.y - 1, block.z),
                front: getBlockAt(block.x, block.y, block.z + 1),
                back: getBlockAt(block.x, block.y, block.z - 1)
            };
            
            const cubeParams = {
                left: neighbors.left,
                right: neighbors.right,
                top: neighbors.top,
                bottom: neighbors.bottom,
                front: neighbors.front,
                back: neighbors.back,
                x: 0, y: 0, z: 0, // 使用本地坐标原点
                size: 1.0,
                blockType: block.type
            };
            
            const lightData = {
                ao: Array(6).fill([1, 1, 1, 1]),
                light: Array(6).fill([0, 0, 0, 0])
            };
            
            const cubeMesh = VoxelMeshGenerator.makeCube(cubeParams, lightData);
            
            if (cubeMesh.vertices.length > 0) {
                const geometry = VoxelMeshGenerator.createCocosMesh(cubeMesh);
                const mesh = utils.MeshUtils.createMesh(geometry);
                
                const blockNode = this.getOrCreateBlockNode(block.x, block.y, block.z, block.type);
                const meshRenderer = blockNode.getComponent(MeshRenderer);
                if (meshRenderer) {
                    meshRenderer.mesh = mesh;
                }
            }
        });
        
        let totalFaces = 0;
        blocks.forEach(block => {
            const blockKey = this.getBlockKey(block.x, block.y, block.z);
            const blockNode = this.blockNodes.get(blockKey);
            if (blockNode) {
                const meshRenderer = blockNode.getComponent(MeshRenderer);
                if (meshRenderer?.mesh) {
                    try {
                        const indices = meshRenderer.mesh.readIndices(0);
                        totalFaces += indices ? indices.length / 3 : 0;
                    } catch (e) {
                        // 读取索引失败，忽略
                    }
                }
            }
        });
        
        chunk.faces = totalFaces;
    }

    private ensureChunkNode(chunk: VoxelChunk): void {
        if (!chunk.node) {
            chunk.node = this.getOrCreateChunkNode(chunk);
        }
    }

    private getOrCreateChunkNode(chunk: VoxelChunk): Node {
        const chunkKey = this.getChunkKey(chunk.p, chunk.q);
        let chunkNode = this.chunkNodes.get(chunkKey);
        
        if (!chunkNode) {
            chunkNode = new Node(`Chunk_${chunk.p}_${chunk.q}`);
            
            if (this.worldRoot) {
                this.worldRoot.addChild(chunkNode);
            }
            
            const worldPos = VoxelChunkManager.getChunkWorldPosition(chunk);
            chunkNode.setPosition(worldPos.x, 0, worldPos.z);
            
            const meshRenderer = chunkNode.addComponent(MeshRenderer);
            if (this.blockMaterial) {
                meshRenderer.material = this.blockMaterial;
            }
            
            this.chunkNodes.set(chunkKey, chunkNode);
            chunk.node = chunkNode;
        }
        
        return chunkNode;
    }

    private removeChunkNode(p: number, q: number): void {
        const chunkKey = this.getChunkKey(p, q);
        const chunkNode = this.chunkNodes.get(chunkKey);
        
        if (chunkNode) {
            chunkNode.destroy();
            this.chunkNodes.delete(chunkKey);
        }
    }

    private removeUnusedChunkNodes(activeChunkKeys: Set<string>): void {
        const keysToRemove: string[] = [];
        
        this.chunkNodes.forEach((node, key) => {
            if (!activeChunkKeys.has(key)) {
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => {
            const node = this.chunkNodes.get(key);
            if (node) {
                node.destroy();
                this.chunkNodes.delete(key);
            }
        });
    }

    private getChunkKey(p: number, q: number): string {
        return `${p}_${q}`;
    }

    private getBlockKey(x: number, y: number, z: number): string {
        return `${x}_${y}_${z}`;
    }

    private getOrCreateBlockNode(x: number, y: number, z: number, blockType: VoxelBlockType): Node {
        const blockKey = this.getBlockKey(x, y, z);
        let blockNode = this.blockNodes.get(blockKey);
        
        if (!blockNode) {
            blockNode = new Node(`Block_${x}_${y}_${z}_${blockType}`);
            
            // 计算所属的chunk坐标
            const chunkP = Math.floor(x / VoxelConfig.CHUNK_SIZE);
            const chunkQ = Math.floor(z / VoxelConfig.CHUNK_SIZE);
            
            // 获取或创建chunk容器节点（用于独立模式的层级管理）
            const chunkContainerNode = this.getOrCreateChunkContainerNode(chunkP, chunkQ);
            chunkContainerNode.addChild(blockNode);
            
            // 计算相对于chunk的本地坐标
            const localX = x - chunkP * VoxelConfig.CHUNK_SIZE;
            const localZ = z - chunkQ * VoxelConfig.CHUNK_SIZE;
            blockNode.setPosition(localX, y, localZ);
            
            const meshRenderer = blockNode.addComponent(MeshRenderer);
            if (this.blockMaterial) {
                meshRenderer.material = this.blockMaterial;
            }
            
            this.blockNodes.set(blockKey, blockNode);
        }
        
        return blockNode;
    }

    private getOrCreateChunkContainerNode(p: number, q: number): Node {
        const chunkKey = this.getChunkKey(p, q);
        let chunkContainer = this.chunkNodes.get(chunkKey);
        
        if (!chunkContainer) {
            chunkContainer = new Node(`ChunkContainer_${p}_${q}`);
            
            if (this.worldRoot) {
                this.worldRoot.addChild(chunkContainer);
            }
            
            // 设置chunk的世界坐标位置
            const chunkWorldX = p * VoxelConfig.CHUNK_SIZE;
            const chunkWorldZ = q * VoxelConfig.CHUNK_SIZE;
            chunkContainer.setPosition(chunkWorldX, 0, chunkWorldZ);
            
            this.chunkNodes.set(chunkKey, chunkContainer);
        }
        
        return chunkContainer;
    }

    private removeBlockNode(x: number, y: number, z: number): void {
        const blockKey = this.getBlockKey(x, y, z);
        const blockNode = this.blockNodes.get(blockKey);
        
        if (blockNode) {
            blockNode.destroy();
            this.blockNodes.delete(blockKey);
        }
    }

    private removeChunkBlockNodes(p: number, q: number): void {
        const chunkMinX = p * VoxelConfig.CHUNK_SIZE;
        const chunkMaxX = (p + 1) * VoxelConfig.CHUNK_SIZE;
        const chunkMinZ = q * VoxelConfig.CHUNK_SIZE;
        const chunkMaxZ = (q + 1) * VoxelConfig.CHUNK_SIZE;
        
        const keysToRemove: string[] = [];
        
        this.blockNodes.forEach((node, key) => {
            const [x, , z] = key.split('_').map(Number);
            
            if (x >= chunkMinX && x < chunkMaxX && z >= chunkMinZ && z < chunkMaxZ) {
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => {
            const node = this.blockNodes.get(key);
            if (node) {
                node.destroy();
                this.blockNodes.delete(key);
            }
        });
        
        // 如果chunk容器节点没有子节点了，也删除它
        const chunkKey = this.getChunkKey(p, q);
        const chunkContainer = this.chunkNodes.get(chunkKey);
        if (chunkContainer && chunkContainer.children.length === 0) {
            chunkContainer.destroy();
            this.chunkNodes.delete(chunkKey);
        }
    }

    public setBlock(x: number, y: number, z: number, blockType: VoxelBlockType): boolean {
        if (!this.worldManager) return false;
        return this.worldManager.setBlock(x, y, z, blockType);
    }

    public getBlock(x: number, y: number, z: number): VoxelBlockType {
        if (!this.worldManager) return VoxelBlockType.EMPTY;
        return this.worldManager.getBlock(x, y, z);
    }

    public getHeightAt(x: number, z: number): number {
        if (!this.worldManager) return 0;
        return this.worldManager.getHeightAt(x, z);
    }

    public raycast(
        startPos: Vec3, 
        direction: Vec3, 
        maxDistance: number = 100
    ): { hit: boolean, x?: number, y?: number, z?: number, blockType?: VoxelBlockType } {
        if (!this.worldManager) {
            return { hit: false };
        }
        
        return this.worldManager.raycast(
            startPos.x, startPos.y, startPos.z,
            direction.x, direction.y, direction.z,
            maxDistance
        );
    }

    public setDaylight(value: number): void {
        this.daylight = Math.max(0, Math.min(1, value));
    }

    public setFogDistance(distance: number): void {
        this.fogDistance = Math.max(10, distance);
    }

    public setCreateRadius(radius: number): void {
        if (this.worldManager) {
            this.worldManager.setCreateRadius(radius);
        }
    }

    public setRenderRadius(radius: number): void {
        if (this.worldManager) {
            this.worldManager.setRenderRadius(radius);
        }
    }

    public setDeleteRadius(radius: number): void {
        if (this.worldManager) {
            this.worldManager.setDeleteRadius(radius);
        }
    }

    public clearWorld(): void {
        // 清理chunk节点
        this.chunkNodes.forEach(node => {
            node.destroy();
        });
        this.chunkNodes.clear();
        
        // 清理独立block节点
        this.blockNodes.forEach(node => {
            node.destroy();
        });
        this.blockNodes.clear();
        
        if (this.worldManager) {
            this.worldManager.clear();
        }
    }

    public getWorldStatistics() {
        if (!this.worldManager) {
            return {
                totalChunks: 0,
                loadedChunks: 0,
                renderedChunks: 0,
                renderedBlocks: 0,
                createRadius: 0,
                renderRadius: 0,
                deleteRadius: 0,
                renderMode: this.renderMode
            };
        }
        
        const stats = this.worldManager.getStatistics();
        return {
            ...stats,
            renderedChunks: this.chunkNodes.size,
            renderedBlocks: this.blockNodes.size,
            renderMode: this.renderMode
        };
    }

    public generateAroundPosition(x: number, z: number, radius: number = 5): void {
        if (!this.worldManager) return;
        
        const { p: centerP, q: centerQ } = VoxelChunkManager.getChunkCoords(x, z);
        
        for (let dp = -radius; dp <= radius; dp++) {
            for (let dq = -radius; dq <= radius; dq++) {
                const p = centerP + dp;
                const q = centerQ + dq;
                
                if (!this.worldManager.isChunkLoaded(p, q)) {
                    this.worldManager.generateChunk(p, q);
                }
            }
        }
    }

    public findSpawnLocation(): Vec3 {
        if (!this.worldManager) {
            return new Vec3(0, 10, 0);
        }
        
        const spawn = this.worldManager.findSpawnLocation();
        return new Vec3(spawn.x, spawn.y, spawn.z);
    }

    public switchWorldMode(mode: VoxelWorldMode): void {
        console.log(`[VoxelRenderer] 切换世界模式: ${mode}`);
        
        VoxelWorldConfig.setMode(mode);
        
        this.clearWorld();
        
        // 先重建 worldManager，再应用模式下的半径等设置，避免被覆盖
        this.worldManager = new VoxelWorldManager();
        this.applyWorldModeSettings(mode);
    }

    private applyWorldModeSettings(mode: VoxelWorldMode): void {
        const config = VoxelWorldConfig.getConfig();
        
        switch (mode) {
            case VoxelWorldMode.NORMAL:
                this.setFogDistance(150);
                if (this.worldManager) {
                    this.worldManager.setCreateRadius(config.CREATE_CHUNK_RADIUS);
                    this.worldManager.setRenderRadius(config.RENDER_CHUNK_RADIUS);
                    this.worldManager.setDeleteRadius(config.DELETE_CHUNK_RADIUS);
                }
                console.log(`[VoxelRenderer] 标准世界设置: ${config.CHUNK_SIZE}x${config.CHUNK_SIZE}x${config.MAX_HEIGHT}`);
                break;
                
            case VoxelWorldMode.SMALL_FLAT:
                this.setFogDistance(80);
                if (this.worldManager) {
                    this.worldManager.setCreateRadius(config.CREATE_CHUNK_RADIUS);
                    this.worldManager.setRenderRadius(config.RENDER_CHUNK_RADIUS);
                    this.worldManager.setDeleteRadius(config.DELETE_CHUNK_RADIUS);
                }
                console.log(`[VoxelRenderer] 小平坦世界设置: ${config.CHUNK_SIZE}x${config.CHUNK_SIZE}x${config.MAX_HEIGHT}`);
                break;
                
            case VoxelWorldMode.TINY_DEBUG:
                this.setFogDistance(40);
                if (this.worldManager) {
                    this.worldManager.setCreateRadius(config.CREATE_CHUNK_RADIUS);
                    this.worldManager.setRenderRadius(config.RENDER_CHUNK_RADIUS);
                    this.worldManager.setDeleteRadius(config.DELETE_CHUNK_RADIUS);
                }
                console.log(`[VoxelRenderer] 微调试世界设置: ${config.CHUNK_SIZE}x${config.CHUNK_SIZE}x${config.MAX_HEIGHT}`);
                break;
        }
        
        console.log(`[VoxelRenderer] 世界信息: ${VoxelWorldConfig.getWorldInfo()}`);
    }

    public getCurrentWorldMode(): VoxelWorldMode {
        return VoxelWorldConfig.getMode();
    }

    public getWorldModeInfo(): string {
        return VoxelWorldConfig.getWorldInfo();
    }

    public regenerateWorld(): void {
        console.log('[VoxelRenderer] 重新生成世界');
        this.clearWorld();
        
        if (this.camera && this.worldManager) {
            const cameraPos = this.camera.node.worldPosition;
            this.generateAroundPosition(cameraPos.x, cameraPos.z, 3);
        }
    }

    public setRenderMode(mode: VoxelRenderMode): void {
        if (this.renderMode === mode) return;
        
        const oldMode = this.renderMode;
        this.renderMode = mode;
        
        console.log(`[VoxelRenderer] 切换渲染模式: ${oldMode} → ${mode}`);
        
        // 重新渲染所有已加载的chunk
        if (this.worldManager) {
            const loadedChunks = this.worldManager.getLoadedChunks();
            loadedChunks.forEach(chunk => {
                VoxelChunkManager.markChunkDirty(chunk);
            });
        }
    }

    public getCurrentRenderMode(): VoxelRenderMode {
        return this.renderMode;
    }

    public getRenderModeInfo(): string {
        const chunkCount = this.chunkNodes.size;
        const blockCount = this.blockNodes.size;
        
        return `渲染模式: ${this.renderMode}\n` +
               `Chunk节点数: ${chunkCount}\n` +
               `Block节点数: ${blockCount}\n` +
               `总节点数: ${chunkCount + blockCount}`;
    }

    public debugPrintNodeHierarchy(): void {
        console.log('[VoxelRenderer] 节点层级结构:');
        console.log(`渲染模式: ${this.renderMode}`);
        
        if (this.renderMode === VoxelRenderMode.MERGED_CHUNK) {
            console.log('合并模式结构: WorldRoot → ChunkNode (with MeshRenderer)');
            this.chunkNodes.forEach((chunkNode, key) => {
                const meshRenderer = chunkNode.getComponent(MeshRenderer);
                const hasMesh = meshRenderer && meshRenderer.mesh ? '✓' : '✗';
                console.log(`  └─ Chunk_${key} [Mesh: ${hasMesh}]`);
            });
        } else {
            console.log('独立模式结构: WorldRoot → ChunkContainer → BlockNode (with MeshRenderer)');
            this.chunkNodes.forEach((chunkNode, key) => {
                console.log(`  └─ ChunkContainer_${key} (${chunkNode.children.length} blocks)`);
                chunkNode.children.forEach(blockNode => {
                    const meshRenderer = blockNode.getComponent(MeshRenderer);
                    const hasMesh = meshRenderer && meshRenderer.mesh ? '✓' : '✗';
                    console.log(`    └─ ${blockNode.name} [Mesh: ${hasMesh}]`);
                });
            });
        }
        
        console.log(`总计: ${this.chunkNodes.size} chunk节点, ${this.blockNodes.size} block节点`);
    }

    public debugToggleCullMode(): void {
        console.log('[VoxelRenderer] 面剔除调试信息:');
        console.log('- 顶点索引已调整为顺时针（CW）顺序');
        console.log('- effect文件中设置了cullMode: back');
        console.log('- 如果面朝向仍有问题，请在Inspector中调整Material设置');
        console.log('可选值: front, back, none');
    }

    public debugPrintMeshInfo(): void {
        console.log('[VoxelRenderer] 网格调试信息:');
        console.log(`已渲染区块数量: ${this.chunkNodes.size}`);
        
        this.chunkNodes.forEach((node, key) => {
            const meshRenderer = node.getComponent(MeshRenderer);
            if (meshRenderer && meshRenderer.mesh) {
                const mesh = meshRenderer.mesh;
                try {
                    const indices = mesh.readIndices(0);
                    const indexCount = indices ? indices.length : 0;
                    console.log(`区块 ${key}: 三角形=${indexCount/3}`);
                } catch (e) {
                    console.log(`区块 ${key}: 无法读取mesh数据`);
                }
            }
        });
    }

    public getInteractionManager(): VoxelInteractionManager | null {
        return this.interactionManager;
    }

    public setSelectedBlockType(blockType: VoxelBlockType): void {
        if (this.interactionManager) {
            this.interactionManager.setSelectedBlockType(blockType);
        }
    }

    public getSelectedBlockType(): VoxelBlockType | null {
        return this.interactionManager ? this.interactionManager.getSelectedBlockType() : null;
    }

    public toggleCameraMode(): void {
        if (this.interactionManager) {
            this.interactionManager.toggleCameraMode();
        }
    }

    public setCameraMode(mode: CameraMode): void {
        if (this.interactionManager) {
            this.interactionManager.setCameraMode(mode);
        }
    }

    public getCurrentCameraMode(): CameraMode | null {
        return this.interactionManager ? this.interactionManager.getCurrentCameraMode() : null;
    }

    public performRaycast(): any {
        return this.interactionManager ? this.interactionManager.performRaycast() : { hit: false };
    }

    public placeBlock(position: Vec3, blockType?: VoxelBlockType): boolean {
        if (!this.interactionManager) return false;
        return this.interactionManager.placeBlock(position, blockType);
    }

    public breakBlock(position: Vec3): boolean {
        if (!this.interactionManager) return false;
        return this.interactionManager.breakBlock(position);
    }

    public setInteractionEventCallbacks(events: VoxelInteractionEvents): void {
        if (this.interactionManager) {
            this.interactionManager.setEventCallbacks(events);
        }
    }

    public debugPrintInteractionInfo(): void {
        console.log('[VoxelRenderer] 交互系统调试信息:');
        
        if (!this.interactionManager) {
            console.log('交互管理器: 未初始化');
            return;
        }
        
        const cameraMode = this.getCurrentCameraMode();
        const selectedBlock = this.getSelectedBlockType();
        const lastHover = this.interactionManager.getLastHoverResult();
        
        console.log(`摄像机模式: ${cameraMode}`);
        console.log(`选中方块类型: ${selectedBlock}`);
        console.log(`悬停结果:`, lastHover);
        
        if (this.camera) {
            const cameraPos = this.camera.node.getWorldPosition();
            console.log(`摄像机位置: (${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)})`);
        }
        
        const raycastResult = this.performRaycast();
        console.log('射线投射结果:', raycastResult);
    }

    protected onDestroy(): void {
        this.clearWorld();
    }
}