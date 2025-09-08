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


    private m_tiles:fgui.GList;

    /** 方块ID列表 */
    private m_blockIds:string[];

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

        //准备数据
        this.m_blockIds = VoxelSystem.getInstance().getAllBlockIds();    
        console.log("MapElement blockIds: ", this.m_blockIds);

        this.m_tiles = this.getList("tiles");
        this.m_tiles.itemRenderer = this.renderListItem.bind(this);
        this.m_tiles.numItems = this.m_blockIds.length;



        //CocosCreator, onClickItem的第一个参数就是当前被点击的对象，可选的第二个对象是fgui.Event。
        // this.m_tiles.on(fgui.Event.CLICK_ITEM, this.onTileClick, this);
    
        console.log("MapElement tiles: ", this.m_tiles.numChildren);
    }

    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {

    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件

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

    //items 处理
    private renderListItem(index: number, obj: GObject): void {
    
        const tile = obj.asCom as GButton;

        //minecraft:stone 
        const blockId = this.m_blockIds[index];
        const blockName = VoxelSystem.getInstance().getBlockDefinition(blockId)?.displayName;
        tile.title = index + " " + blockName;


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
            const textureManager = VoxelSystem.getInstance().getTextureManager();
            textureManager.loadTexture(blockId).then(textureInfo => {
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

        tile.onClick(this.onTileClick, this);
    }

    private onTileClick(evt: fgui.Event): void {
        const tile = evt.sender as GButton;
        console.log("[UIMapElement] tile clicked: ", tile.title);
    }
    

    //
    public hide(): void {
        this.node.active = false;
        console.log("[UIMapElement] hide");
    }

    public show(): void {
        this.node.active = true;
        console.log("[UIMapElement] show");
    }
}