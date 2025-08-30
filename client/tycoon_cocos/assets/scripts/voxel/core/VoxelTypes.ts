import { Vec3 } from "cc";

export interface VoxelMapEntry {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface VoxelMap {
    dx: number;
    dy: number;
    dz: number;
    mask: number;
    size: number;
    data: Map<string, VoxelMapEntry>;
}

export interface VoxelChunk {
    map: VoxelMap;
    lights: VoxelMap;
    p: number;
    q: number;
    faces: number;
    dirty: boolean;
    miny: number;
    maxy: number;
    node?: any;
}

export interface VoxelBlock {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface VoxelState {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    t: number;
}

export interface VoxelPlayer {
    id: number;
    name: string;
    state: VoxelState;
    state1: VoxelState;
    state2: VoxelState;
}

export interface VoxelWorkItem {
    p: number;
    q: number;
    load: boolean;
    blockMaps: VoxelMap[][];
    lightMaps: VoxelMap[][];
    miny: number;
    maxy: number;
    faces: number;
    data?: Float32Array;
}

export interface VoxelVertexData {
    position: Vec3;
    normal: Vec3;
    uv: { x: number; y: number };
    ao: number;
    light: number;
}

export interface VoxelMeshData {
    vertices: VoxelVertexData[];
    indices: number[];
}

export interface VoxelCubeParams {
    left: number;
    right: number;
    top: number;
    bottom: number;
    front: number;
    back: number;
    x: number;
    y: number;
    z: number;
    size: number;
    blockType: number;
}

export interface VoxelLightData {
    ao: number[][];
    light: number[][];
}

export interface VoxelNoiseConfig {
    octaves: number;
    persistence: number;
    lacunarity: number;
}

export type VoxelWorldFunc = (x: number, y: number, z: number, w: number, arg?: any) => void;

export interface VoxelRenderBatch {
    blocks: VoxelBlock[];
    mesh?: VoxelMeshData;
    node?: any;
    dirty: boolean;
}