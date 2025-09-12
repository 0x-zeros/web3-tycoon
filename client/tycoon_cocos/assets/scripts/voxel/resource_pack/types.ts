/**
 * Resource Pack 解析系统类型定义
 */

export type NamespacedId = {
    ns: string;
    path: string;
};

export type TextureInfo = {
    key: string;
    id: string;
    ns: string;
    domain: string;
    name: string;
    rel: string;
    missing?: boolean;
    source?: "resourcepack" | "vanilla" | "unknown";
};

export type ElementFace = {
    dir: "north" | "south" | "west" | "east" | "up" | "down";
    uv?: [number, number, number, number];
    rotation?: 0 | 90 | 180 | 270;
    textureKey?: string;
    cullface?: string;
    tintindex?: number;
};

export type ElementDef = {
    from: [number, number, number];
    to: [number, number, number];
    rotation?: {
        origin: [number, number, number];
        axis: "x" | "y" | "z";
        angle: number;
        rescale?: boolean;
    };
    shade?: boolean;
    faces: ElementFace[];
};

export type CombinedJson = {
    blockstate?: any;
    models: Array<{ rel: string; ns: string; json: any }>;
    texturesDict: Record<string, string>;
    resolvedTextures: Record<string, TextureInfo>;
};

export type ParsedBlockData = {
    id: NamespacedId;
    shortId: string;
    rotationY?: 0 | 90 | 180 | 270;
    modelTemplate?: "cube_all" | "cube_column" | "cross" | "elements" | "builtin" | "unsupported";
    elements: ElementDef[];
    textures: TextureInfo[];
    debug: {
        blockstatePath?: string;
        modelChainPaths: string[];
        combinedJson: CombinedJson;
    };
};

export type BlockStateData = {
    variants?: {
        [key: string]: BlockStateVariant | BlockStateVariant[];
    };
    multipart?: any;
};

export type BlockStateVariant = {
    model: string;
    x?: number;
    y?: number;
    z?: number;
    uvlock?: boolean;
    weight?: number;
};

export type ModelData = {
    parent?: string;
    ambientocclusion?: boolean;
    display?: { [key: string]: any };
    textures?: { [key: string]: string };
    elements?: ModelElement[];
};

export type ModelElement = {
    from: [number, number, number];
    to: [number, number, number];
    rotation?: {
        origin: [number, number, number];
        axis: "x" | "y" | "z";
        angle: number;
        rescale?: boolean;
    };
    shade?: boolean;
    faces?: {
        [face: string]: ModelFace;
    };
};

export type ModelFace = {
    uv?: [number, number, number, number];
    texture: string;
    cullface?: string;
    rotation?: number;
    tintindex?: number;
};

export type ParseOptions = {
    rootDir?: string;
    searchRoots?: string[];
    defaultNamespace?: string;
};

export type ModelRefInfo = {
    kind?: "var" | "path" | "builtin";
    builtin?: boolean;
    ns: string;
    domain?: string;
    name: string;
};

export type ResourceCache = {
    blockstates: Map<string, BlockStateData>;
    models: Map<string, ModelData>;
    textures: Map<string, string>;
};