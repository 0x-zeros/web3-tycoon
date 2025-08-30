import { _decorator, Component, Node, MeshRenderer, Material, utils, Vec3, Camera } from 'cc';
import { VoxelChunk } from '../core/VoxelTypes';
import { VoxelMeshGenerator } from './VoxelMesh';
import { VoxelChunkManager } from '../world/VoxelChunk';
import { VoxelBlockType } from '../core/VoxelBlock';
import { VoxelWorldManager } from '../world/VoxelWorld';
import { VoxelConfig } from '../core/VoxelConfig';
import { VoxelWorldConfig, VoxelWorldMode } from '../core/VoxelWorldConfig';

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
    
    private worldManager: VoxelWorldManager | null = null;
    private chunkNodes: Map<string, Node> = new Map();
    private timer: number = 0;
    private daylight: number = 1.0;
    private fogDistance: number = VoxelConfig.FOG_DISTANCE_DEFAULT;
    
    protected onLoad(): void {
        if (!this.worldRoot) {
            this.worldRoot = new Node('VoxelWorld');
            this.node.addChild(this.worldRoot);
        }
        
        this.worldManager = new VoxelWorldManager();
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
            return;
        }
        
        const getBlockAt = (x: number, y: number, z: number): VoxelBlockType => {
            if (!this.worldManager) return VoxelBlockType.EMPTY;
            return this.worldManager.getBlock(x, y, z);
        };
        
        // 以区块基准坐标为原点，网格使用区块本地坐标，避免重复位移
        const baseX = chunk.p * VoxelConfig.CHUNK_SIZE;
        const baseZ = chunk.q * VoxelConfig.CHUNK_SIZE;
        const meshData = VoxelMeshGenerator.generateChunkMesh(blocks, getBlockAt, baseX, baseZ);
        
        if (meshData.vertices.length === 0) {
            this.removeChunkNode(chunk.p, chunk.q);
            return;
        }
        
        if (meshData.vertices.length === 0 || meshData.indices.length === 0) {
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
        this.chunkNodes.forEach(node => {
            node.destroy();
        });
        this.chunkNodes.clear();
        
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
                createRadius: 0,
                renderRadius: 0,
                deleteRadius: 0
            };
        }
        
        const stats = this.worldManager.getStatistics();
        return {
            ...stats,
            renderedChunks: this.chunkNodes.size
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

    protected onDestroy(): void {
        this.clearWorld();
    }
}