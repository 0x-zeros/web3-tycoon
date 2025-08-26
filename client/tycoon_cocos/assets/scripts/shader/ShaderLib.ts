import { _decorator, gfx, Material, EffectAsset, renderer } from 'cc';
const { ccclass } = _decorator;

/**
 * Shader库 - 适配Cocos Creator v3.8
 */

interface ShaderData {
    name: string;
    vert: string;
    frag: string;
    defines?: any[];
}

class ShaderLibClass {
    private _shaders: { [key: string]: ShaderData } = {};

    /**
     * 增加一个新的Shader
     * @param shader Shader数据对象
     */
    public addShader(shader: ShaderData): void {
        if (this._shaders[shader.name]) {
            console.error("addShader - shader already exist: ", shader.name);
            return;
        }

        // 在v3.8中使用renderer模块管理Shader程序
        try {
            // 创建Effect资产来定义shader
            const effectAsset = new EffectAsset();
            effectAsset.techniques = [{
                passes: [{
                    program: shader.name,
                    properties: {}
                }]
            }];
            
            // 注册shader程序
            renderer.ProgramLib.define(shader.name, shader.vert, shader.frag, shader.defines || []);
            
            this._shaders[shader.name] = shader;
        } catch (error) {
            console.error("Failed to add shader:", shader.name, error);
        }
    }

    /**
     * 取Shader的定义
     * @param name Shader名称
     * @returns Shader数据对象
     */
    public getShader(name: string): ShaderData | undefined {
        return this._shaders[name];
    }

    /**
     * 检查Shader是否已存在
     * @param name Shader名称
     * @returns 是否存在
     */
    public hasShader(name: string): boolean {
        return !!this._shaders[name];
    }

    /**
     * 移除Shader
     * @param name Shader名称
     */
    public removeShader(name: string): void {
        if (this._shaders[name]) {
            delete this._shaders[name];
        }
    }

    /**
     * 获取所有已注册的Shader名称列表
     * @returns Shader名称数组
     */
    public getAllShaderNames(): string[] {
        return Object.keys(this._shaders);
    }
}

// 创建单例实例
const ShaderLib = new ShaderLibClass();

export default ShaderLib;