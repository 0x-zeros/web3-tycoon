# Grass Block Overlay

本设计文档整理了在 **Cocos Creator 3.x** 中实现 Minecraft 风格的 `grass_block` 渲染方案。

grass_block 只是block举例，不止草方块。菌岩（nylium）、**菌丝（mycelium）**等也有 *_side_overlay 的做法。思路相同：底层侧面是主体纹理，上面再叠一层带 tint 或特殊颜色的 overlay。 请根据模型有 2 个 elements 这个标准来通用化。

思路是：同一方块画两次——一次不透明基础层（top/bottom/side），一次半透明 overlay 层（仅四个侧面，乘以生物群系颜色）。

---

## Grass Block Overlay 实现

### 基本结构

#### 两个材质（Material）

	•	matBase（不透明）：深度写入开、混合关、接受 AO
	•	matOverlay（透明）：深度测试开、深度写入关、Alpha 混合开、（可选）shade=false 的效果，即尽量不受 AO/阴影脏化；片元颜色乘以 u_BiomeColor


* **子网格 0：方块本体**（不透明）

  
  * 六个面（top / bottom / four sides）
  * 贴图：`grass_block_top`、`dirt`、`grass_block_side`
  * Material： matBase
  
* **子网格 1：草的绿色 overlay**（透明 + tint）

  * 仅四个侧面（不含 top/bottom）
  * 贴图：`grass_block_side_overlay`
  * 属性：`tintindex = 0` → 生物群系颜色
  * 渲染：深度测试开、深度写入关、透明混合开
  * Material： matOverlay

### 渲染要点

1. **渲染顺序**：先绘制本体，再绘制 overlay。
2. **避免 Z-Fighting**：

   * overlay 层深度写入关，或
   * 在顶点 shader 做 `u_Inflate=0.001` 的微膨胀。
3. **Tint（生物群系染色）**：

  * `u_BiomeColor` \* overlay 纹理采样色。
  *	matOverlay 提供 u_BiomeColor（vec3/vec4）
	*	片元：outColor.rgb *= u_BiomeColor.rgb;
	*	u_BiomeColor 的值由你在区块生成或渲染剔除阶段按“位置→biome”查表后塞进材质（或实例化材质/UBO）


4. **AO/阴影**：overlay 常用 `shade=false` 效果，避免草色“发脏”。
  overlay 想“更干净”就别乘 AO。你可以：
	*	基础层：AO 写进顶点色（或单独 attribute），shader 里乘。
	*	overlay：顶点色写 1 或在 shader 忽略 AO 通道。

### Cocos 实现方式

* 使用 **Mesh 两个子网格**：

  * `subMesh 0` → 基础层材质（不透明）
  * `subMesh 1` → overlay 材质（透明 + tint）
* Overlay 材质关键设置：

  * `depthTest = true`
  * `depthWrite = false`
  * `blend = alpha blend`
  * `u_BiomeColor`、`u_Inflate`



### 方块状态（有雪的变体）

grass_block 在 snowy=true 时通常换模型，不再叠绿色 overlay。
在你的方块状态机里：
	•	snowy=false → 使用“两层方案”（base + overlay）
	•	snowy=true → 用“雪边缘”的侧面贴图（单层即可），跳过 overlay pass

---

overlay 的 Effect（最小可用）简化版：
```yaml
CCEffect %{
  techniques:
  - name: overlay
    passes:
    - vert: vert
      frag: frag
      rasterizerState:
        cullMode: back            # 只背面剔除
      depthStencilState:
        depthTest: true
        depthWrite: false         # 关键：overlay 不写深度
      blendState:
        targets:
        - blend: true             # 开混合
          blendEq: add
          blendSrc: src_alpha     # 预乘或非预乘都可；若你用预乘贴图，改为 one, one_minus_src_alpha
          blendDst: one_minus_src_alpha
          blendAlphaEq: add
          blendSrcAlpha: one
          blendDstAlpha: one_minus_src_alpha
}%

CCProgram vert %{
  precision highp float;
  #include <cc-global>
  #include <cc-local>
  in vec3 a_position;
  in vec3 a_normal;
  in vec2 a_texCoord;
  in vec4 a_color;

  uniform Constants {
    vec4 u_BiomeColor;      // xyz=rgb, w 可留作强度或 1
    float u_Inflate;        // 顶点微膨胀用，单位：像素/世界单位（按你世界尺度调）
  };

  out vec2 v_uv;
  out vec4 v_color;

  void main () {
    // 顶点微膨胀（可选，用于杜绝 overlay 与底层同平面 Z-fight）
    vec3 pos = a_position + a_normal * u_Inflate;

    gl_Position = cc_matProj * cc_matView * cc_matWorld * vec4(pos, 1.0);
    v_uv = a_texCoord;

    // 顶点颜色可预放 AO 等，这里保持为 1
    v_color = a_color;
  }
}%

CCProgram frag %{
  precision highp float;
  #include <cc-global>
  #include <cc-local>

  in vec2 v_uv;
  in vec4 v_color;

  uniform sampler2D u_OverlayTex;
  uniform Constants {
    vec4 u_BiomeColor;
    float u_Inflate;
  };

  void main() {
    vec4 c = texture(u_OverlayTex, v_uv);

    // 生物群系 tint（只乘 rgb）
    c.rgb *= u_BiomeColor.rgb;

    // 如果你想“shade:false”的感觉更强，可弱化 AO/阴影，这里简单用顶点色乘 1
    // c.rgb *= v_color.rgb; // 需要的话再开

    // 透明度使用纹理自身
    if (c.a <= 0.01) discard;

    gl_FragColor = c;
  }
}%
```


生成 Mesh（两个子网格）

思路：构建一个立方体（或你现有“网格合批器”输出的面集合），索引分两份：
	•	indicesBase：包含 six faces（含 up/down）
	•	indicesOverlay：仅四个侧面（north/east/south/west）

下面是极简伪代码（按现有体素系统改）：
```ts
import { Mesh, utils, Vec3, Material, geometry } from 'cc';

function buildGrassBlockMesh(): Mesh {
  // 你也可以用自己的体素面生成器，这里仅示意：
  const positions: number[] = [];
  const normals: number[]   = [];
  const uvs: number[]       = [];
  const colors: number[]    = []; // 顶点色可用于 AO，overlay 可保持 1

  const indicesBase: number[] = [];
  const indicesOverlay: number[] = [];

  // 假设我们有一个函数 addFace(...) 能往上追加一个面（两个三角形）
  // 面类型：'up','down','north','south','west','east'
  function addFace(type: string, toOverlay: boolean) {
    // 计算该面的 4 顶点 pos/normal/uv，push 到数组
    const baseIndex = positions.length / 3;
    // ... push 4 顶点、法线、uv、color(1,1,1,1)
    // ... 生成两个三角形索引：[0,1,2, 2,3,0] + baseIndex 偏移
    const faceIdx = [0,1,2, 2,3,0].map(i => i + baseIndex);
    if (toOverlay) indicesOverlay.push(...faceIdx);
    else indicesBase.push(...faceIdx);
  }

  // 六个面：基础层
  addFace('up',   false);
  addFace('down', false);
  addFace('north',false);
  addFace('south',false);
  addFace('west', false);
  addFace('east', false);

  // overlay：仅四侧
  addFace('north', true);
  addFace('south', true);
  addFace('west',  true);
  addFace('east',  true);

  // 组装 Mesh（两个子网格）
  const primitiveBase: geometry.IGeometry = {
    positions, normals, uvs, colors,
    indices: indicesBase,
  };
  const primitiveOverlay: geometry.IGeometry = {
    positions, normals, uvs, colors,
    indices: indicesOverlay,
  };

  return Mesh.create([
    primitiveBase,
    primitiveOverlay
  ]);
}
```



重点：positions/uvs 等顶点数组要共用，两个子网格只分索引即可。这样显存更省、cache 友好。