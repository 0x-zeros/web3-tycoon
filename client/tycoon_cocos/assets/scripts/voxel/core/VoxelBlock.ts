export enum VoxelBlockType {
    EMPTY = 0,
    GRASS = 1,
    SAND = 2,
    STONE = 3,
    BRICK = 4,
    WOOD = 5,
    CEMENT = 6,
    DIRT = 7,
    PLANK = 8,
    SNOW = 9,
    GLASS = 10,
    COBBLE = 11,
    LIGHT_STONE = 12,
    DARK_STONE = 13,
    CHEST = 14,
    LEAVES = 15,
    CLOUD = 16,
    TALL_GRASS = 17,
    YELLOW_FLOWER = 18,
    RED_FLOWER = 19,
    PURPLE_FLOWER = 20,
    SUN_FLOWER = 21,
    WHITE_FLOWER = 22,
    BLUE_FLOWER = 23,
    COLOR_00 = 32,
    COLOR_01 = 33,
    COLOR_02 = 34,
    COLOR_03 = 35,
    COLOR_04 = 36,
    COLOR_05 = 37,
    COLOR_06 = 38,
    COLOR_07 = 39,
    COLOR_08 = 40,
    COLOR_09 = 41,
    COLOR_10 = 42,
    COLOR_11 = 43,
    COLOR_12 = 44,
    COLOR_13 = 45,
    COLOR_14 = 46,
    COLOR_15 = 47,
    COLOR_16 = 48,
    COLOR_17 = 49,
    COLOR_18 = 50,
    COLOR_19 = 51,
    COLOR_20 = 52,
    COLOR_21 = 53,
    COLOR_22 = 54,
    COLOR_23 = 55,
    COLOR_24 = 56,
    COLOR_25 = 57,
    COLOR_26 = 58,
    COLOR_27 = 59,
    COLOR_28 = 60,
    COLOR_29 = 61,
    COLOR_30 = 62,
    COLOR_31 = 63
}

export interface VoxelBlockProperties {
    isPlant: boolean;
    isObstacle: boolean;
    isTransparent: boolean;
    isDestructable: boolean;
    textureTop: number;
    textureBottom: number;
    textureSide: number;
    lightLevel: number;
}

export class VoxelBlockRegistry {
    private static blockProperties: Map<VoxelBlockType, VoxelBlockProperties> = new Map();
    
    private static readonly items: VoxelBlockType[] = [
        VoxelBlockType.GRASS,
        VoxelBlockType.SAND,
        VoxelBlockType.STONE,
        VoxelBlockType.BRICK,
        VoxelBlockType.WOOD,
        VoxelBlockType.CEMENT,
        VoxelBlockType.DIRT,
        VoxelBlockType.PLANK,
        VoxelBlockType.SNOW,
        VoxelBlockType.GLASS,
        VoxelBlockType.COBBLE,
        VoxelBlockType.LIGHT_STONE,
        VoxelBlockType.DARK_STONE,
        VoxelBlockType.CHEST,
        VoxelBlockType.LEAVES
    ];

    private static readonly plants: Set<VoxelBlockType> = new Set([
        VoxelBlockType.TALL_GRASS,
        VoxelBlockType.YELLOW_FLOWER,
        VoxelBlockType.RED_FLOWER,
        VoxelBlockType.PURPLE_FLOWER,
        VoxelBlockType.SUN_FLOWER,
        VoxelBlockType.WHITE_FLOWER,
        VoxelBlockType.BLUE_FLOWER
    ]);

    static {
        this.initializeBlocks();
    }

    private static initializeBlocks(): void {
        this.blockProperties.set(VoxelBlockType.EMPTY, {
            isPlant: false,
            isObstacle: false,
            isTransparent: true,
            isDestructable: false,
            textureTop: 0,
            textureBottom: 0,
            textureSide: 0,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.GRASS, {
            isPlant: false,
            isObstacle: true,
            isTransparent: false,
            isDestructable: true,
            textureTop: 0,
            textureBottom: 2,
            textureSide: 1,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.SAND, {
            isPlant: false,
            isObstacle: true,
            isTransparent: false,
            isDestructable: true,
            textureTop: 18,
            textureBottom: 18,
            textureSide: 18,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.STONE, {
            isPlant: false,
            isObstacle: true,
            isTransparent: false,
            isDestructable: true,
            textureTop: 32,
            textureBottom: 32,
            textureSide: 32,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.WOOD, {
            isPlant: false,
            isObstacle: true,
            isTransparent: false,
            isDestructable: true,
            textureTop: 21,
            textureBottom: 21,
            textureSide: 20,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.LEAVES, {
            isPlant: false,
            isObstacle: true,
            isTransparent: true,
            isDestructable: true,
            textureTop: 22,
            textureBottom: 22,
            textureSide: 22,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.GLASS, {
            isPlant: false,
            isObstacle: true,
            isTransparent: true,
            isDestructable: true,
            textureTop: 49,
            textureBottom: 49,
            textureSide: 49,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.CLOUD, {
            isPlant: false,
            isObstacle: false,
            isTransparent: true,
            isDestructable: false,
            textureTop: 14,
            textureBottom: 14,
            textureSide: 14,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.LIGHT_STONE, {
            isPlant: false,
            isObstacle: true,
            isTransparent: false,
            isDestructable: true,
            textureTop: 35,
            textureBottom: 35,
            textureSide: 35,
            lightLevel: 10
        });

        this.plants.forEach(plantType => {
            this.blockProperties.set(plantType, {
                isPlant: true,
                isObstacle: false,
                isTransparent: true,
                isDestructable: true,
                textureTop: plantType,
                textureBottom: plantType,
                textureSide: plantType,
                lightLevel: 0
            });
        });
    }

    static isPlant(blockType: VoxelBlockType): boolean {
        const props = this.blockProperties.get(blockType);
        return props ? props.isPlant : false;
    }

    static isObstacle(blockType: VoxelBlockType): boolean {
        const props = this.blockProperties.get(blockType);
        return props ? props.isObstacle : false;
    }

    static isTransparent(blockType: VoxelBlockType): boolean {
        const props = this.blockProperties.get(blockType);
        return props ? props.isTransparent : true;
    }

    static isDestructable(blockType: VoxelBlockType): boolean {
        const props = this.blockProperties.get(blockType);
        return props ? props.isDestructable : false;
    }

    static getTextureIndex(blockType: VoxelBlockType, faceIndex: number): number {
        const props = this.blockProperties.get(blockType);
        if (!props) return 0;

        switch (faceIndex) {
            case 0: return props.textureTop;    // top
            case 1: return props.textureBottom; // bottom
            default: return props.textureSide;  // sides
        }
    }

    static getLightLevel(blockType: VoxelBlockType): number {
        const props = this.blockProperties.get(blockType);
        return props ? props.lightLevel : 0;
    }

    static getItems(): VoxelBlockType[] {
        return [...this.items];
    }

    static getItemCount(): number {
        return this.items.length;
    }

    static isValidBlockType(blockType: number): blockType is VoxelBlockType {
        return this.blockProperties.has(blockType as VoxelBlockType);
    }

    static getBlockProperties(blockType: VoxelBlockType): VoxelBlockProperties | undefined {
        return this.blockProperties.get(blockType);
    }

    static registerCustomBlock(blockType: VoxelBlockType, properties: VoxelBlockProperties): void {
        this.blockProperties.set(blockType, properties);
    }
}