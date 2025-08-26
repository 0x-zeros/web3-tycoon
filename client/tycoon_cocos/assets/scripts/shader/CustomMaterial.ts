import { _decorator, Material, EffectAsset, Texture2D, Color, gfx, renderer } from 'cc';
const { ccclass } = _decorator;

/**
 * 自定义材质类 - 适配Cocos Creator v3.8
 * 提供创建和管理自定义材质的功能
 */

interface CustomMaterialParams {
    name: string;
    type: string;
    value?: any;
}

interface CustomMaterialDefines {
    [key: string]: any;
}

@ccclass('CustomMaterial')
export default class CustomMaterial extends Material {
    private _shaderName: string = '';
    private _customColor: Color = new Color(255, 255, 255, 255);
    private _customTexture: Texture2D | null = null;
    private _customParams: { [key: string]: any } = {};

    /**
     * 构造函数
     * @param shaderName 着色器名称
     * @param params 自定义参数数组
     * @param defines 宏定义对象
     */
    constructor(shaderName?: string, params?: CustomMaterialParams[], defines?: CustomMaterialDefines) {
        super();

        if (shaderName) {
            this.initialize(shaderName, params, defines);
        }
    }

    /**
     * 初始化自定义材质
     * @param shaderName 着色器名称
     * @param params 自定义参数数组
     * @param defines 宏定义对象
     */
    public initialize(shaderName: string, params?: CustomMaterialParams[], defines?: CustomMaterialDefines): void {
        this._shaderName = shaderName;

        try {
            // 创建Effect资产
            const effectAsset = new EffectAsset();
            
            // 设置基本技术配置
            effectAsset.techniques = [{
                passes: [{
                    program: shaderName,
                    blendState: {
                        targets: [{
                            blend: true,
                            blendSrc: gfx.BlendFactor.SRC_ALPHA,
                            blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                            blendSrcAlpha: gfx.BlendFactor.SRC_ALPHA,
                            blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA
                        }]
                    },
                    depthStencilState: {
                        depthTest: false,
                        depthWrite: false
                    },
                    rasterizerState: {
                        cullMode: gfx.CullMode.NONE
                    },
                    properties: this.buildProperties(params)
                }]
            }];

            // 设置宏定义
            if (defines) {
                effectAsset.techniques[0].passes[0].defines = defines;
            }

            // 初始化材质
            this.initialize({
                effectAsset: effectAsset,
                technique: 0
            });

            // 设置默认属性
            this.setProperty('mainTexture', this._customTexture);
            this.setProperty('mainColor', this._customColor);

            console.log(`CustomMaterial initialized with shader: ${shaderName}`);
        } catch (error) {
            console.error('Failed to initialize CustomMaterial:', error);
        }
    }

    /**
     * 构建材质属性配置
     * @param params 参数数组
     * @returns 属性配置对象
     */
    private buildProperties(params?: CustomMaterialParams[]): { [key: string]: any } {
        const properties: { [key: string]: any } = {
            mainTexture: { type: 'sampler2D' },
            mainColor: { type: 'color' }
        };

        if (params) {
            for (const param of params) {
                properties[param.name] = {
                    type: this.convertParamType(param.type),
                    value: param.value
                };
            }
        }

        return properties;
    }

    /**
     * 转换参数类型
     * @param type 原始类型字符串
     * @returns 转换后的类型
     */
    private convertParamType(type: string): string {
        const typeMap: { [key: string]: string } = {
            'PARAM_TEXTURE_2D': 'sampler2D',
            'PARAM_COLOR4': 'color',
            'PARAM_FLOAT': 'float',
            'PARAM_FLOAT2': 'vec2',
            'PARAM_FLOAT3': 'vec3',
            'PARAM_FLOAT4': 'vec4',
            'PARAM_INT': 'int'
        };

        return typeMap[type] || 'float';
    }

    /**
     * 获取材质的纹理
     */
    public get texture(): Texture2D | null {
        return this._customTexture;
    }

    /**
     * 设置材质的纹理
     * @param val 纹理对象
     */
    public set texture(val: Texture2D | null) {
        if (this._customTexture !== val) {
            this._customTexture = val;
            this.setProperty('mainTexture', val);
        }
    }

    /**
     * 获取材质的颜色
     */
    public get color(): Color {
        return this._customColor;
    }

    /**
     * 设置材质的颜色
     * @param val 颜色对象
     */
    public set color(val: Color) {
        this._customColor.set(val);
        // 将颜色值转换为0-1范围
        const normalizedColor = new Color(
            val.r / 255,
            val.g / 255,
            val.b / 255,
            val.a / 255
        );
        this.setProperty('mainColor', normalizedColor);
    }

    /**
     * 克隆材质
     * @returns 克隆的材质实例
     */
    public clone(): CustomMaterial {
        const copy = new CustomMaterial();
        copy._shaderName = this._shaderName;
        copy.texture = this.texture;
        copy.color = this.color;
        copy._customParams = { ...this._customParams };
        
        // 复制材质基本属性
        if (this.effectAsset) {
            copy.initialize({
                effectAsset: this.effectAsset,
                technique: 0
            });
        }

        return copy;
    }

    /**
     * 设置自定义参数的值
     * @param name 参数名称
     * @param value 参数值
     */
    public setParamValue(name: string, value: any): void {
        this._customParams[name] = value;
        this.setProperty(name, value);
    }

    /**
     * 获取自定义参数的值
     * @param name 参数名称
     * @returns 参数值
     */
    public getParamValue(name: string): any {
        return this._customParams[name];
    }

    /**
     * 设置宏定义值
     * @param name 宏定义名称
     * @param value 宏定义值
     */
    public setDefine(name: string, value: any): void {
        // 在v3.8中通过重新编译着色器来应用宏定义
        const defines = { ...this.passes[0].defines };
        defines[name] = value;
        
        // 重新设置Pass配置
        this.passes[0].tryCompile();
    }

    /**
     * 获取着色器名称
     * @returns 着色器名称
     */
    public getShaderName(): string {
        return this._shaderName;
    }

    /**
     * 销毁材质资源
     */
    public destroy(): void {
        this._customTexture = null;
        this._customParams = {};
        super.destroy();
    }
}