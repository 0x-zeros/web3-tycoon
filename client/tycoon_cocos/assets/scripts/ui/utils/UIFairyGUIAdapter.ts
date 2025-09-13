// assets/scripts/ui/FairyGUIAdapter.ts
import { _decorator, Component, view, sys, director, game, Game } from 'cc';
const { ccclass, property } = _decorator;

import * as fgui from "fairygui-cc";
import GameSettings from '../../config/GameSettings';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';


/**
 * 管理 FairyGUI 的屏幕适配。
 * 监听窗口size变更
 */
@ccclass('UIFairyGUIAdapter')
export class UIFairyGUIAdapter extends Component {

  private designWidth = GameSettings.designWidth;
  private designHeight = GameSettings.designHeight;


  
  onLoad() {
    //在add 该脚本的地方create GRoot

    // 监听窗口/分辨率变化
    // Cocos 3.x 常用这两个事件足以覆盖窗口尺寸与设计分辨率动态变化
    view.on('frame-size-changed', this.applyScale, this);
    view.on('design-resolution-changed', this.applyScale, this);

    // 当应用从后台回到前台时也尝试刷新一次
    game.on(Game.EVENT_SHOW, this.applyScale, this);
  }

  onDestroy() {
    view.off('frame-size-changed', this.applyScale, this);
    view.off('design-resolution-changed', this.applyScale, this);

    game.off(Game.EVENT_SHOW, this.applyScale, this);
  }

  /**
   * 根据当前窗口尺寸和配置，设置 FairyGUI 的缩放策略。
   */
  private applyScale = () => {

    // console.log('[UIFairyGUIAdapter] applyScale');

    if (!fgui?.GRoot?.inst) return;

    //设置组件全屏，即大小和逻辑屏幕大小一致。
    //组件的内部应该做好关联处理， 以应对大小改变。
    //该事件由要适配全屏的组件监听，比如UIInGame
    //emit event 
    const width = fgui?.GRoot?.inst.width || this.designWidth;
    const height = fgui?.GRoot?.inst.height || this.designHeight;
    console.log(`[UIFairyGUIAdapter] fgui?.GRoot?.inst: width=${width}, height=${height}`);
    EventBus.emit(EventTypes.UI.ScreenSizeChanged, { width: width, height: height });
  
    //ai给的方案是错的。。。setContentScaleFactor只有unity里有，cocos里没有
  };

}