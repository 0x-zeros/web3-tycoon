/**
 * 地块颜色测试脚本
 * 用于测试地块材质颜色设置是否正常工作
 */

import { _decorator, Component, Node, Vec3, Material, MeshRenderer, Color, Prefab, instantiate } from 'cc';
import { MapTile } from '../map/core/MapTile';

const { ccclass, property } = _decorator;

@ccclass('MapColorTest')
export class MapColorTest extends Component {
    
    @property(Prefab)
    tilePrefab: Prefab = null!;
    
    @property(Node)
    testContainer: Node = null!;
    
    private testTile: Node = null!;
    private colors: Color[] = [
        Color.RED,
        Color.GREEN,
        Color.BLUE,
        Color.YELLOW,
        Color.MAGENTA,
        Color.CYAN
    ];
    
    private currentColorIndex: number = 0;
    
    start() {
        this.createTestTile();
        this.scheduleColorChange();
    }
    
    private createTestTile(): void {
        if (!this.tilePrefab || !this.testContainer) {
            console.error('[MapColorTest] 缺少必要的预制件或容器节点');
            return;
        }
        
        // 实例化测试地块
        this.testTile = instantiate(this.tilePrefab);
        this.testTile.setParent(this.testContainer);
        this.testTile.setPosition(Vec3.ZERO);
        
        // 获取地块组件
        const mapTile = this.testTile.getComponent(MapTile);
        if (mapTile) {
            // 初始化地块数据
            mapTile.initializeTile({
                id: 'test-tile-001',
                type: 'start',
                position: { x: 0, y: 0, z: 0 },
                name: '颜色测试地块',
                description: '用于测试材质颜色设置的地块',
                color: '#FF0000',
                isOccupied: false,
                occupiedBy: null,
                properties: {},
                state: 'normal'
            }, this.testTile);
            
            console.log('[MapColorTest] 测试地块创建完成');
        } else {
            console.error('[MapColorTest] 测试地块预制件上没有找到MapTile组件');
        }
    }
    
    private scheduleColorChange(): void {
        // 每2秒切换一次颜色
        this.schedule(() => {
            this.changeColor();
        }, 2.0);
    }
    
    private changeColor(): void {
        if (!this.testTile) return;
        
        const mapTile = this.testTile.getComponent(MapTile);
        if (!mapTile) return;
        
        const newColor = this.colors[this.currentColorIndex];
        console.log(`[MapColorTest] 正在切换到颜色: ${newColor.toHEX()}`);
        
        // 设置新颜色
        mapTile.setTileColor(newColor);
        
        // 切换到下一个颜色
        this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
    }
    
    /**
     * 手动测试颜色设置（可通过按钮调用）
     */
    public testRandomColor(): void {
        if (!this.testTile) return;
        
        const mapTile = this.testTile.getComponent(MapTile);
        if (!mapTile) return;
        
        // 生成随机颜色
        const randomColor = new Color(
            Math.random() * 255,
            Math.random() * 255,
            Math.random() * 255,
            255
        );
        
        console.log(`[MapColorTest] 设置随机颜色: ${randomColor.toHEX()}`);
        mapTile.setTileColor(randomColor);
    }
}