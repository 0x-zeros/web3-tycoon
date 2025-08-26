/**
 * CdxrShader - 纹理与颜色叠加着色器
 * 适配Cocos Creator v3.8的着色器定义
 */

interface ShaderDefinition {
    name: string;
    defines: any[];
    vert: string;
    frag: string;
}

// Cocos Creator v3.8 兼容的着色器定义
const cdxrShader: ShaderDefinition = {
    name: "cdxrShader",
    
    defines: [],

    // 顶点着色器 - 适配v3.8的uniform和attribute命名
    vert: `
        precision highp float;
        
        // v3.8标准uniform
        uniform mat4 cc_matViewProj;
        uniform mat4 cc_matWorld;
        
        // 顶点属性
        in vec3 a_position;
        in vec2 a_texCoord;
        
        // 输出到片段着色器
        out vec2 v_uv0;
        
        void main () {
            vec4 pos = cc_matViewProj * cc_matWorld * vec4(a_position, 1.0);
            gl_Position = pos;
            v_uv0 = a_texCoord;
        }
    `,

    // 片段着色器 - 适配v3.8的纹理采样和输出
    frag: `
        precision highp float;
        
        // 输入纹理
        uniform sampler2D cc_spriteTexture;
        
        // 从顶点着色器传入
        in vec2 v_uv0;
        
        // 输出颜色
        layout(location = 0) out vec4 fragColor;
        
        void main() {
            // 采样纹理
            vec4 texColor = texture(cc_spriteTexture, v_uv0);
            
            // Alpha测试 - 如果红色通道小于0.5则丢弃像素
            if(texColor.r < 0.5) {
                discard;
            }
            
            // 可选的颜色反转效果（已注释）
            // texColor.r = 1.0 - texColor.r;
            // texColor.g = 1.0 - texColor.g;
            // texColor.b = 1.0 - texColor.b;
            
            // 输出最终颜色
            fragColor = texColor;
        }
    `
};

// 兼容v2.x版本的着色器定义（用于渐进式迁移）
const cdxrShaderLegacy: ShaderDefinition = {
    name: "cdxrShaderLegacy",
    
    defines: [],

    // v2.x兼容的顶点着色器
    vert: `
        uniform mat4 viewProj;
        attribute vec3 a_position;
        attribute vec2 a_uv0;
        varying vec2 uv0;
        
        void main () {
            vec4 pos = viewProj * vec4(a_position, 1.0);
            gl_Position = pos;
            uv0 = a_uv0;
        }
    `,

    // v2.x兼容的片段着色器
    frag: `
        uniform sampler2D texture;
        varying vec2 uv0;
        
        void main() { 
            vec4 texColor = texture2D(texture, uv0);
             
            if(texColor.r < 0.5) {
                discard;
            }
            
            gl_FragColor = texColor;
        }
    `
};

// 导出着色器定义
export { cdxrShader as default, cdxrShaderLegacy };

// 类型导出
export type { ShaderDefinition };