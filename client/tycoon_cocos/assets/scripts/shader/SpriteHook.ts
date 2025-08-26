import { _decorator, Sprite, Material, SpriteFrame, Color, Node, RenderData, renderer, gfx } from 'cc';

/**
 * SpriteHook - Sprite自定义材质扩展，适配Cocos Creator v3.8
 * 为Sprite组件添加自定义材质支持
 */

// 扩展Sprite接口
declare module 'cc' {
    interface Sprite {
        _customMaterials?: { [key: string]: Material };
        _currCustomMaterial?: Material;
        _customMaterialName?: string;
        getMaterial?(name: string): Material | undefined;
        setMaterial?(name: string, mat: Material): void;
        activateMaterial?(name: string): void;
        getCurrMaterial?(): Material | undefined;
    }
}

class SpriteHookClass {
    private initialized = false;
    private readonly STATE_CUSTOM = 101;

    /**
     * 初始化SpriteHook，为Sprite组件添加自定义材质支持
     */
    public init(): void {
        if (this.initialized) {
            return;
        }

        this.extendSpritePrototype();
        this.initialized = true;
        console.log('SpriteHook initialized for Cocos Creator v3.8');
    }

    /**
     * 扩展Sprite原型方法
     */
    private extendSpritePrototype(): void {
        // 取自定义材质
        Sprite.prototype.getMaterial = function(this: Sprite, name: string): Material | undefined {
            if (this._customMaterials) {
                return this._customMaterials[name];
            }
            return undefined;
        };

        // 设置自定义材质
        Sprite.prototype.setMaterial = function(this: Sprite, name: string, mat: Material): void {
            if (!this._customMaterials) {
                this._customMaterials = {};
            }
            this._customMaterials[name] = mat;
        };

        // 激活某个材质
        Sprite.prototype.activateMaterial = function(this: Sprite, name: string): void {
            const mat = this.getMaterial!(name);
            if (mat && mat !== this._currCustomMaterial) {
                if (this.node) {
                    // 在v3.8中设置材质颜色
                    mat.setProperty('mainColor', this.color);
                }
                
                if (this.spriteFrame) {
                    // 在v3.8中设置纹理
                    const texture = this.spriteFrame.texture;
                    if (texture) {
                        mat.setProperty('mainTexture', texture);
                    }
                }

                // 应用材质到Sprite
                this.customMaterial = mat;
                this._currCustomMaterial = mat;
                this._customMaterialName = name;
                
                // 标记需要重新渲染
                this.markForUpdateRenderData();
            } else if (!mat) {
                console.error("activateMaterial - unknown material: ", name);
            }
        };

        // 取当前的材质
        Sprite.prototype.getCurrMaterial = function(this: Sprite): Material | undefined {
            return this._currCustomMaterial;
        };
    }

    /**
     * 检查是否已初始化
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * 重置Hook状态
     */
    public reset(): void {
        this.initialized = false;
    }

    /**
     * 为指定Sprite创建自定义材质实例
     * @param sprite 目标Sprite组件
     * @param materialName 材质名称
     * @param baseMaterial 基础材质（可选）
     * @returns 创建的材质实例
     */
    public createCustomMaterial(sprite: Sprite, materialName: string, baseMaterial?: Material): Material | null {
        try {
            let material: Material;
            
            if (baseMaterial) {
                // 克隆基础材质
                material = Material.copy(baseMaterial);
            } else {
                // 创建默认材质
                material = new Material();
            }

            // 设置材质到Sprite
            sprite.setMaterial!(materialName, material);
            
            return material;
        } catch (error) {
            console.error('Failed to create custom material:', error);
            return null;
        }
    }

    /**
     * 移除Sprite的自定义材质
     * @param sprite 目标Sprite组件
     * @param materialName 材质名称
     */
    public removeCustomMaterial(sprite: Sprite, materialName: string): void {
        if (sprite._customMaterials && sprite._customMaterials[materialName]) {
            delete sprite._customMaterials[materialName];
            
            // 如果移除的是当前激活的材质，重置为默认材质
            if (sprite._customMaterialName === materialName) {
                sprite.customMaterial = null;
                sprite._currCustomMaterial = undefined;
                sprite._customMaterialName = undefined;
            }
        }
    }

    /**
     * 获取Sprite所有自定义材质名称
     * @param sprite 目标Sprite组件
     * @returns 材质名称数组
     */
    public getCustomMaterialNames(sprite: Sprite): string[] {
        if (sprite._customMaterials) {
            return Object.keys(sprite._customMaterials);
        }
        return [];
    }
}

// 创建单例实例
const SpriteHook = new SpriteHookClass();

export default SpriteHook;