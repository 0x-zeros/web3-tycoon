# Prompt: Minecraft Resource Pack Parser





## 目标
- 解析 **Minecraft Java 版资源包**中的方块（block）模型与贴图。


### 关于命名空间的策略：
	1.	规范化 ID：把外部传入的 blockId 统一转成 {namespace, path} 形式；如果没写命名空间，默认 minecraft。
	2.	相对引用默认规则：JSON 里出现未带命名空间的 parent/texture 引用，先按**“当前文件的命名空间”**尝试；找不到再回退到 minecraft。
	•	这样既兼容绝大多数包（很多写法省略了 minecraft:），也能让第三方包用自己的命名空间工作正常。
	3.	解析结果保留命名空间（比如 minecraft:block/stone），同时你可以额外提供一个 shortId（去掉命名空间，仅供 UI 搜索/展示）。

“minecraft” 在代码里使用 namespace_default 定义了使用
现在工程里有两个namespace： “minecraft”， “web3”


## 完整说明：

解析目标

输入：
	•	blockId: string（例如 "stone" 或 "minecraft:stone"）
	•	rootDir: string（资源包根目录；下面给出的相对路径都可以用 path.join(rootDir, rel) 打开）; 默认的rootDir 为 “voxel/resource_pack” （在client/tycoon_cocos/assets/resources/里）

输出：
	•	data: ParsedBlockData（见下方 TypeScript 类型），其中：
	•	textures[] 给出相对路径到 .png
	•	debug 里包含：
	•	blockstatePath（相对路径）
	•	modelChainPaths[]（继承链上所有 model 的相对路径，含父级）
	•	combinedJson（把涉及到的 blockstate + models 的 JSON 组合成一份便于调试查看的数据）

    （在缺失时标记 missing: true）


路径约定（相对 rootDir）
	•	blockstates：assets/<ns>/blockstates/<name>.json
	•	models：assets/<ns>/models/<domain>/<name>.json（常见 <domain> 为 block / item）
	•	textures：assets/<ns>/textures/<domain>/<name>.png（常见 <domain> 为 block / item / entity）
	•	builtin：builtin/* → 没有磁盘文件，设置 missing: true


解析流程（Step-by-Step）

0) 工具函数
	•	parseNamespacedId(s, defaultNs='minecraft') -> { ns, path }
	•	允许输入形如 "minecraft:stone" 或 "stone"，输出 {ns:'minecraft', path:'stone'}
	•	parseModelOrTexRef(s, currentNs, type) -> { kind, builtin?, ns, domain, name }
	•	支持：
	•	"minecraft:block/stone" → {ns:'minecraft', domain:'block', name:'stone'}
	•	"block/stone"（无 ns）→ 先用 currentNs，找不到再 fallback 到 minecraft
	•	"#side" → {kind:'var', name:'side'}（后续用 textures 映射解析）
	•	"builtin/cross" → {builtin:true, name:'cross'}（举例）
	•	readJson(relPath) / exists(relPath)：相对路径读取/判断

1) 找到 blockstate
	1.	id = parseNamespacedId(blockId)（默认 ns=minecraft）
	2.	组装 blockstateRel = assets/${id.ns}/blockstates/${id.path}.json
	3.	bs = readJson(blockstateRel)（读不到则 data.debug 记上路径，进入降级流程）

2) 选取一个 variant
	•	仅处理默认/简单键：
	•	优先键 ""；否则取 variants 的第一个
	•	得到 modelRef（字符串，如 "minecraft:block/stone"）与可选 y（0/90/180/270）

如果是像按钮这类：
"parent": "minecraft:block/button", "textures": {"texture":"minecraft:block/stone"}，你的解析需要走模型父链才能拿到最终元素与贴图。 ￼

3) 解析模型继承链（从子到父，直到根）
	•	初始化：
	•	currentNs = id.ns
	•	pending = [modelRef]
	•	modelChain = []（存解析后的每一层模型 {relPath,json,ns}）
	•	texturesDict = {}（收集/合并每层 textures 映射，后加入不覆盖先前已有键的可改为“子级覆盖父级”的策略，按原版习惯子级优先）
	•	循环：
	1.	ref = pending.pop()
	2.	refInfo = parseModelOrTexRef(ref, currentNs, 'model')
	3.	若 refInfo.builtin → 走内置规则：
	•	builtin/generated / builtin/entity 等：标记 unsupported 或做最小占位
	•	builtin/missing：占位
	•	builtin/cross：等价于 parent: minecraft:block/cross（可自定义）
	•	将一个“虚拟模型节点”推入 modelChain，并 break（交由模板生成几何）
	4.	否则组装 modelRel = assets/${refInfo.ns}/models/${refInfo.domain}/${refInfo.name}.json；读取
	5.	modelChain.push({ rel: modelRel, ns: refInfo.ns, json })
	6.	合并 texturesDict = merge(texturesDict, json.textures)（子级覆盖父级）
	7.	若 json.parent 存在 → pending.push(json.parent)，将 currentNs = refInfo.ns（后续无 ns 的引用先在当前 ns 下解）
	•	循环结束后得到：
	•	modelChainPaths = modelChain.map(m=>m.rel)
	•	topModel = modelChain[0]（最子层）
	•	rootModel = modelChain[modelChain.length-1]（最顶层）

4) 解析 textures 映射（解 #var）
	•	resolveTextureRef(v, currentNs)：
	•	若是 "#name" → 到 texturesDict[name] 找原始字符串；再递归解析直到命名空间/域/文件名明确
	•	若是 "namespace:domain/name" 或 "domain/name" → 用 parseModelOrTexRef 得到 {ns,domain,name}
	•	得到 resolvedTextures: Record<string, {id:string, ns:string, domain:string, name:string, rel:string, missing:boolean, source:'resourcepack'|'vanilla'|'unknown'}>
	•	其中 rel = assets/${ns}/textures/${domain}/${name}.png（按约定补 .png）

贴图旁可能有 .png.mcmeta，你可在需要时读取其元数据，但 MVP 可以先忽略。

5) 得到可渲染几何定义
	•	若 topModel.json.elements 存在 → 直接用它（单位 0~16）
	•	否则根据模板 parent生成（例如）：
	•	minecraft:block/cube_all → 6 个面、UV=[0,0,16,16]，纹理 #all
	•	minecraft:block/cube_column → 上下 #end，侧面 #side
	•	minecraft:block/cross → 两张交叉的四边形，纹理 #cross
	•	在生成前，将每个面的 texture 用上一步 resolvedTextures 替换为具体贴图键（或直接替换为 rel 相对路径）

6) 汇总输出


伪代码：

TypeScript：结果数据结构
```ts
type NamespacedId = { ns: string; path: string; }; // e.g. {ns:"minecraft", path:"stone"}

type TextureInfo = {
  key: string;            // e.g. "all" | "side" | "end" | "cross" 等 textures 字典里的键
  id: string;             // "minecraft:block/stone"
  ns: string;             // "minecraft"
  domain: string;         // "block"
  name: string;           // "stone"
  rel: string;            // "assets/minecraft/textures/block/stone.png"  ←相对 rootDir
  missing?: boolean;      // 文件在 rootDir 下不存在
  source?: "resourcepack" | "vanilla" | "unknown"; // 可选，来源标记
};

type ElementFace = {
  dir: "north"|"south"|"west"|"east"|"up"|"down";
  uv?: [number,number,number,number];   // 像素 0~16
  rotation?: 0|90|180|270;
  textureKey?: string;  // "all" / "side" / ...
  textureRel?: string;  // 直接替换成相对路径，便于渲染
};

type ElementDef = {
  from: [number,number,number]; // 0~16
  to:   [number,number,number]; // 0~16
  faces: ElementFace[];
};

type CombinedJson = {
  blockstate?: any;                 // 选中的变体（或完整原 JSON）
  models: Array<{ rel: string; ns: string; json: any }>;
  texturesDict: Record<string, string>;      // 合并后的 textures 映射（未解 #var）
  resolvedTextures: Record<string, TextureInfo>; // 解完 #var 的结果
};

type ParsedBlockData = {
  id: NamespacedId;                 // 规范化后的方块 ID
  shortId: string;                  // 例如 "stone"（便于 UI），命名空间冲突时仅作展示
  rotationY?: 0|90|180|270;         // 来自 blockstates 变体
  modelTemplate?: "cube_all"|"cube_column"|"cross"|"elements"|"builtin"|"unsupported";
  elements: ElementDef[];           // 最终用于建网格的结构（单位 0~16）
  textures: TextureInfo[];          // 本方块实际会用到的纹理列表（相对路径 rel）
  debug: {
    blockstatePath?: string;        // 相对路径
    modelChainPaths: string[];      // 继承链相对路径（含父）
    combinedJson: CombinedJson;     // 汇总方便调试查看的一份数据
  };
};
```


伪代码（核心算法）
```ts
function parseBlock(blockId: string, rootDir: string, searchRoots: string[] = [rootDir]): ParsedBlockData {
  const id = parseNamespacedId(blockId, 'minecraft');
  const shortId = id.path;

  // 1) blockstate
  const bsRel = `assets/${id.ns}/blockstates/${id.path}.json`;
  const bs = readJsonFromRoots(bsRel, searchRoots); // {json, rel, foundRootIndex}
  const variant = pickVariant(bs.json.variants); // prefer "", else first
  const rotationY = variant?.y as 0|90|180|270 | undefined;
  let modelRef = variant?.model as string;

  // 2) model chain
  let modelChain = [];
  let texturesDict = {};
  let currentNs = id.ns;

  while (modelRef) {
    const info = parseModelOrTexRef(modelRef, currentNs, 'model');
    if (info.builtin) {
      modelChain.push({ rel: `builtin:${info.name}`, ns: 'builtin', json: { parent:`builtin/${info.name}` }});
      break;
    }
    const modelRel = `assets/${info.ns}/models/${info.domain}/${info.name}.json`;
    const m = readJsonFromRoots(modelRel, searchRoots);
    modelChain.push({ rel: modelRel, ns: info.ns, json: m.json });
    texturesDict = mergeTextures(texturesDict, m.json.textures); // child overrides parent
    modelRef = m.json.parent;
    currentNs = info.ns;
  }

  // 3) resolve textures
  const resolvedTextures = {};
  for (const [k, v] of Object.entries(texturesDict)) {
    const t = resolveTextureRef(v as string, currentNs, searchRoots); // -> {ns,domain,name,rel,missing,source}
    resolvedTextures[k] = { key: k, id: `${t.ns}:${t.domain}/${t.name}`, ...t };
  }

  // 4) build elements / template
  let elements: ElementDef[] = [];
  let template = 'unsupported';
  const top = modelChain[0];
  if (top?.json?.elements) {
    template = 'elements';
    elements = normalizeElements(top.json.elements, resolvedTextures);
  } else {
    const tpl = detectTemplate(modelChain); // cube_all / cube_column / cross / builtin
    template = tpl;
    elements = synthesizeElementsByTemplate(tpl, resolvedTextures);
  }

  // 5) textures array
  const textures = Object.values(resolvedTextures);

  // 6) combinedJson for debug
  const combinedJson: CombinedJson = {
    blockstate: bs?.json,
    models: modelChain,
    texturesDict,
    resolvedTextures
  };

  return {
    id, shortId, rotationY,
    modelTemplate: template as any,
    elements,
    textures,
    debug: {
      blockstatePath: bs?.rel,
      modelChainPaths: modelChain.map(m => m.rel),
      combinedJson
    }
  };
}
```


说明与边界
	•	Parent 合并顺序：一般遵循“子级覆盖父级”，即子模型里的 textures 与 elements 优先级更高。
	•	#var 解引用：可能多层嵌套；要有循环检测避免死循环。
	•	builtin/*：无磁盘文件；	builtin/generated / builtin/entity → 标记 unsupported 或用占位;  builtin/missing → 占位


