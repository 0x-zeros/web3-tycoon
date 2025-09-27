import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator, SpriteFrame, Rect, Size } from 'cc';
import { GButton, GObject } from "fairygui-cc";
import { VoxelSystem } from "../../voxel/VoxelSystem";

const { ccclass } = _decorator;

/**
 * 地图元素界面 - 玩家选择地图元素
 */
@ccclass('UIMapElement')
export class UIMapElement extends UIBase {

    private m_tiles:fgui.GList;      // 地块列表
    private m_objects:fgui.GList;    // 物体列表
    private m_properties:fgui.GList; // 地产列表

    private m_categoryController: fgui.Controller;  // category控制器

    /** 地块ID列表 */
    private m_tileIds:string[];
    /** 物体ID列表 */
    private m_objectIds:string[];
    /** 地产ID列表 */
    private m_propertyIds:string[];

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupDefaultValues();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // 获取controller (FairyGUI中已通过radio按钮特性自动关联)
        if (!this.panel) {
            console.error("[UIMapElement] Panel not initialized!");
            return;
        }

        this.m_categoryController = this.panel.getController("category");
        if (!this.m_categoryController) {
            console.error("[UIMapElement] category controller not found!");
            return;
        }

        // 获取Web3方块并分类
        const allBlocks = VoxelSystem.getInstance().getAllWeb3Blocks();
        const tileBlocks = allBlocks.filter(b => b.category === 'tile');
        const objectBlocks = allBlocks.filter(b => b.category === 'object');
        const propertyBlocks = allBlocks.filter(b => b.category === 'property');

        // 设置地块列表
        this.m_tileIds = tileBlocks.map(b => b.id);
        this.m_tiles = this.getList("tiles");
        if (this.m_tiles) {
            this.m_tiles.itemRenderer = this.renderTileItem.bind(this);
            this.m_tiles.numItems = this.m_tileIds.length;
            console.log("MapElement tiles count: ", this.m_tileIds.length);
        }

        // 设置物体列表
        this.m_objectIds = objectBlocks.map(b => b.id);
        this.m_objects = this.getList("objects");
        if (this.m_objects) {
            this.m_objects.itemRenderer = this.renderObjectItem.bind(this);
            this.m_objects.numItems = this.m_objectIds.length;
            console.log("MapElement objects count: ", this.m_objectIds.length);
        }

        // 设置地产列表
        this.m_propertyIds = propertyBlocks.map(b => b.id);
        this.m_properties = this.getList("properties");
        if (this.m_properties) {
            this.m_properties.itemRenderer = this.renderPropertyItem.bind(this);
            this.m_properties.numItems = this.m_propertyIds.length;
            console.log("MapElement properties count: ", this.m_propertyIds.length);
        }
    }

    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 默认选中第一个地图元素
        this._selectFirstElement();
    }
    
    /**
     * 选中当前类别的第一个元素
     */
    private _selectFirstElement(): void {
        const currentCategory = this.getCurrentCategory();
        let defaultId: string | null = null;
        let type: 'tile' | 'object' | 'property' = 'tile';

        if (currentCategory === 'tiles') {
            type = 'tile';
            // 地块默认选中 empty_land
            defaultId = this.m_tileIds.includes('web3:empty_land') ? 'web3:empty_land' : this.m_tileIds[0];
        } else if (currentCategory === 'objects') {
            type = 'object';
            defaultId = this.m_objectIds[0];
        } else if (currentCategory === 'properties') {
            type = 'property';
            defaultId = this.m_propertyIds[0];
        }

        if (defaultId) {
            // 延迟一帧执行，确保列表已经渲染完成
            this.scheduleOnce(() => {
                this._selectElementById(defaultId!, type);
            }, 0);
        }
    }
    
    /**
     * 根据blockId选中地图元素
     * @param blockId 方块ID
     * @param type 类型：'tile' 或 'object'
     */
    private _selectElementById(blockId: string, type: 'tile' | 'object' | 'property' = 'tile'): void {
        const ids = type === 'tile' ? this.m_tileIds :
                   type === 'object' ? this.m_objectIds :
                   this.m_propertyIds;
        const index = ids.indexOf(blockId);
        if (index === -1) {
            console.warn(`[UIMapElement] Block ID not found: ${blockId}, falling back to first element`);
            // 如果找不到指定的blockId，回退到选中第一个元素
            this._selectElementByIndex(0, type);
            return;
        }
        
        this._selectElementByIndex(index, type);
    }
    
    /**
     * 根据索引选中地图元素
     * @param index 元素索引
     * @param type 类型：'tile'、'object' 或 'property'
     */
    private _selectElementByIndex(index: number, type: 'tile' | 'object' | 'property' = 'tile'): void {
        const ids = type === 'tile' ? this.m_tileIds :
                   type === 'object' ? this.m_objectIds :
                   this.m_propertyIds;
        const list = type === 'tile' ? this.m_tiles :
                   type === 'object' ? this.m_objects :
                   this.m_properties;

        if (!list) {
            console.error(`[UIMapElement] List not found for type: ${type}`);
            return;
        }

        if (index < 0 || index >= ids.length) {
            console.warn(`[UIMapElement] Invalid index: ${index}`);
            return;
        }
        
        const blockId = ids[index];
        
        // 获取Web3方块信息
        const web3Blocks = VoxelSystem.getInstance().getAllWeb3Blocks();
        const web3Block = web3Blocks.find(b => b.id === blockId);
        
        // 获取方块名称
        const blockName = web3Block ? web3Block.name : 
                         VoxelSystem.getInstance().getBlockDefinition(blockId)?.displayName || blockId;
        
        if (!web3Block && !VoxelSystem.getInstance().getBlockDefinition(blockId)) {
            console.warn(`[UIMapElement] Block not found: ${blockId}`);
            return;
        }
        
        // 获取对应的tile对象
        const tile = list.getChildAt(index) as GButton;
        if (!tile) {
            console.warn(`[UIMapElement] Tile not found at index: ${index}`);
            return;
        }
        
        // 获取tileIcon的spriteFrame
        const tileIcon = tile.getChild("tileIcon") as fgui.GLoader;
        const spriteFrame = tileIcon ? tileIcon.texture : null;
        
        // 获取size信息（仅对property有效）
        const size = web3Block?.size || 1;

        // 发送选中事件，携带完整数据
        EventBus.emit(EventTypes.UI.MapElementSelected, {
            blockId: blockId,
            blockName: blockName,
            spriteFrame: spriteFrame,
            index: index,
            type: type,
            size: size,
            category: web3Block?.category || type
        });
        
        console.log(`[UIMapElement] Default selected: ${blockName} (${blockId}) type: ${type}`);
    }

    /**
     * 切换显示类别
     * @param category 要显示的类别 (使用FairyGUI的页面名称)
     */
    public switchCategory(category: 'tiles' | 'objects' | 'properties'): void {
        console.log(`[UIMapElement] Switching to category: ${category}`);

        if (!this.m_categoryController) {
            console.error("[UIMapElement] Cannot switch category: controller not initialized!");
            return;
        }

        // 通过设置controller的selectedPage来切换显示
        // FairyGUI会自动处理对应页面的显示/隐藏
        this.m_categoryController.selectedPage = category;

        // 选中第一个元素
        this._selectFirstElement();
    }

    /**
     * 获取当前类别
     */
    public getCurrentCategory(): string {
        // 从controller获取当前选中的类别
        if (!this.m_categoryController) {
            console.error("[UIMapElement] Controller not initialized!");
            return 'tiles';
        }
        return this.m_categoryController.selectedPage || 'tiles';
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // Radio按钮已在FairyGUI编辑器中通过controller自动关联
        // 无需手动绑定点击事件

        //todo close button?
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {

        //todo close button?

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {

        //ui onEnable 里调用的

        // 测试：自动切换到property类别以查看是否有property
        if (this.m_propertyIds && this.m_propertyIds.length > 0) {
            console.log(`[UIMapElement] Found ${this.m_propertyIds.length} properties, auto-switching to property category for testing`);
            // 延迟一帧执行，确保UI完全初始化
            this.scheduleOnce(() => {
                this.switchCategory('properties');
            }, 0.1);
        }
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        

    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {

    }

    // 渲染地块项
    private renderTileItem(index: number, obj: GObject): void {
        this.renderListItem(index, obj, this.m_tileIds, 'tile');
    }

    // 渲染物体项
    private renderObjectItem(index: number, obj: GObject): void {
        this.renderListItem(index, obj, this.m_objectIds, 'object');
    }

    // 渲染地产项
    private renderPropertyItem(index: number, obj: GObject): void {
        this.renderListItem(index, obj, this.m_propertyIds, 'property');
    }

    // 通用渲染方法
    private renderListItem(index: number, obj: GObject, ids: string[], type: 'tile' | 'object' | 'property'): void {
    
        const tile = obj.asCom as GButton;

        //web3:empty_land 等
        const blockId = ids[index];
        
        // 获取Web3方块信息
        const web3Blocks = VoxelSystem.getInstance().getAllWeb3Blocks();
        const web3Block = web3Blocks.find(b => b.id === blockId);
        
        // 显示方块名称
        const blockName = web3Block ? web3Block.name : 
                         VoxelSystem.getInstance().getBlockDefinition(blockId)?.displayName || blockId;
        tile.title = `${index} ${blockName}`;


        const tileIcon = tile.getChild("tileIcon") as fgui.GLoader;
        
        // 设置 GLoader 的缩放模式，确保图片能正确填充到设置的尺寸
        tileIcon.fill = fgui.LoaderFillType.ScaleFree; // 自由缩放，保持宽高比
        // 或者使用以下选项：
        // tileIcon.fill = fgui.LoaderFillType.Scale; // 拉伸填充
        // tileIcon.fill = fgui.LoaderFillType.ScaleNoBorder; // 缩放无边框
        
        // // 假设你的方块纹理在 resources/texture/blocks/ 目录下
        // const texturePath = `texture/blocks/${blockId.replace('minecraft:', '')}`;
        // tileIcon.url = texturePath;
    
        try {
            // 使用 TextureManager 加载纹理
            // 需要将 blockId 转换为纹理路径格式
            const textureManager = VoxelSystem.getInstance().getTextureManager();
            
            // 获取方块数据以获取正确的纹理路径
            VoxelSystem.getInstance().getBlockData(blockId).then(blockData => {
                if (!blockData || blockData.textures.length === 0) {
                    console.warn(`[UIMapElement] 无法获取方块纹理: ${blockId}`);
                    return;
                }
                
                // 使用第一个纹理（通常是主纹理）
                const mainTexture = blockData.textures[0];
                const texturePath = mainTexture.rel; // 使用纹理的相对路径
                
                return textureManager.loadTexture(texturePath);
            }).then(textureInfo => {
                if (textureInfo && textureInfo.texture) {
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = textureInfo.texture;
                    
                    // 设置 SpriteFrame 的原始尺寸，这样 GLoader 会正确缩放
                    const texture = textureInfo.texture;
                    spriteFrame.originalSize = new Size(texture.width, texture.height);
                    
                    // 设置完整的纹理区域
                    spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                    
                    tileIcon.texture = spriteFrame;
                } else {
                    // 使用默认图标
                    tileIcon.url = "texture/icons/default_block";
                }
            });
            

        } catch (error) {
            console.warn(`[UIMapElement] 加载方块纹理失败: ${blockId}`, error);
            tileIcon.url = "texture/icons/default_block";
        }

        // 根据类型绑定不同的点击事件
        if (type === 'tile') {
            tile.onClick((evt: fgui.Event) => this.onTileClick(evt, 'tile'), this);
        } else if (type === 'object') {
            tile.onClick((evt: fgui.Event) => this.onTileClick(evt, 'object'), this);
        } else if (type === 'property') {
            tile.onClick((evt: fgui.Event) => this.onTileClick(evt, 'property'), this);
        }
    }

    private onTileClick(evt: fgui.Event, type: 'tile' | 'object' | 'property'): void {
        const tile = evt.sender as GButton;
        const list = type === 'tile' ? this.m_tiles :
                     type === 'object' ? this.m_objects :
                     this.m_properties;
        const ids = type === 'tile' ? this.m_tileIds :
                   type === 'object' ? this.m_objectIds :
                   this.m_propertyIds;

        if (!list) {
            console.error(`[UIMapElement] List not found for type: ${type}`);
            return;
        }

        const index = list.getChildIndex(tile);
        const blockId = ids[index];
        
        // 获取Web3方块信息
        const web3Blocks = VoxelSystem.getInstance().getAllWeb3Blocks();
        const web3Block = web3Blocks.find(b => b.id === blockId);
        
        // 获取方块名称
        const blockName = web3Block ? web3Block.name : 
                         VoxelSystem.getInstance().getBlockDefinition(blockId)?.displayName || "";
        
        console.log("[UIMapElement] tile clicked: ", tile.title);
        
        // 获取tileIcon的spriteFrame
        const tileIcon = tile.getChild("tileIcon") as fgui.GLoader;
        const spriteFrame = tileIcon ? tileIcon.texture : null;
        
        // 获取size信息（仅对property有效）
        const size = web3Block?.size || 1;

        // 发送选中事件，携带完整数据
        EventBus.emit(EventTypes.UI.MapElementSelected, {
            blockId: blockId,
            blockName: blockName,
            spriteFrame: spriteFrame,  // 传递spriteFrame以便共享
            index: index,
            type: type,
            size: size,  // 添加size信息
            category: web3Block?.category || type  // 添加category信息
        });
    }
}