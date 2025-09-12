// assets/scripts/ui/FairyGUIAdapter.ts
import { _decorator, Component, view, sys, director, game, Game } from 'cc';
const { ccclass, property } = _decorator;

import * as fgui from "fairygui-cc";

enum MatchMode {
  MatchWidthOrHeight = 'MatchWidthOrHeight',
  MatchWidth = 'MatchWidth',
  MatchHeight = 'MatchHeight',
}

/**
 * 在 Cocos Creator 中管理 FairyGUI 的屏幕适配。
 * - 调用 GRoot.create()（只调用一次）
 * - setContentScaleFactor(designW, designH, mode, match)
 * - 监听窗口变更并重新计算
 */
@ccclass('UIFairyGUIAdapter')
export class UIFairyGUIAdapter extends Component {
  @property({ tooltip: 'UI 设计分辨率宽（如 1920）' })
  designWidth = 1920;

  @property({ tooltip: 'UI 设计分辨率高（如 1080）' })
  designHeight = 1080;

  @property({
    tooltip:
      '缩放模式：\n- MatchWidthOrHeight：同时考虑宽高，依赖 match（0=更贴近宽，1=更贴近高）\n- MatchWidth：按宽等比\n- MatchHeight：按高等比',
  })
  matchMode: MatchMode = MatchMode.MatchWidthOrHeight;

  @property({
    tooltip:
      '仅在 MatchWidthOrHeight 模式下生效。\n0 表示更偏向“按宽”，1 表示更偏向“按高”。常用 0.5。',
    range: [0, 1, 0.01],
  })
  match = 0.5;

  private _inited = false;

  
  onLoad() {
    //在add 该脚本的地方create GRoot
    // // 1) 确保创建 GRoot（只需要一次；多次调用内部也会做保护）
    // if (!this._inited) {
    //   fgui.GRoot.create();
    //   this._inited = true;
    // }

    // 2) 首次适配
    this.applyScale();

    // 3) 监听窗口/分辨率变化
    // Cocos 3.x 常用这两个事件足以覆盖窗口尺寸与设计分辨率动态变化
    view.on('frame-size-changed', this.applyScale, this);
    view.on('design-resolution-changed', this.applyScale, this);

    // （可选）当应用从后台回到前台时也尝试刷新一次
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

    console.log('[UIFairyGUIAdapter] applyScale');
    console.log(`fgui?.GRoot?.inst.width=${fgui?.GRoot?.inst.width}, fgui?.GRoot?.inst.height=${fgui?.GRoot?.inst.height}`);

    if (!fgui?.GRoot?.inst) return;

    // 读取当前 Frame Size
    const frameSize = view.getFrameSize();//screen.windowSize
    const w = frameSize.width;
    const h = frameSize.height;

    // 你可以在这里做日志：console.log(`[FGUI] frameSize = ${w}x${h}`);
    console.log(`[UIFairyGUIAdapter] frameSize = ${w}x${h}`);


    //ai给的方案是错的。。。下面的函数只有unity里有，cocos里没有

    // // 统一用 FairyGUI 的 UIContentScaler 模式（与 Unity CanvasScaler 类似）
    // // setContentScaleFactor(designWidth, designHeight, screenMatchMode?, matchValue?)
    // // - MatchWidthOrHeight: 第四个参数 match（0~1）决定更贴近宽或高
    // // - MatchWidth / MatchHeight: 只用前三个参数
    // const UIScaler = fgui.UIContentScaler?.ScreenMatchMode;

    // switch (this.matchMode) {
    //   case MatchMode.MatchWidthOrHeight:
    //     fgui.GRoot.inst.setContentScaleFactor(
    //       this.designWidth,
    //       this.designHeight,
    //       UIScaler.MatchWidthOrHeight,
    //       this.clamp01(this.match)
    //     );
    //     console.log(`[UIFairyGUIAdapter] setContentScaleFactor = ${this.designWidth}x${this.designHeight},matchMode = ${UIScaler.MatchWidthOrHeight},match = ${this.clamp01(this.match)}`);
    //     break;

    //   case MatchMode.MatchWidth:
    //     fgui.GRoot.inst.setContentScaleFactor(
    //       this.designWidth,
    //       this.designHeight,
    //       UIScaler.MatchWidth
    //     );
    //     console.log(`[UIFairyGUIAdapter] setContentScaleFactor = ${this.designWidth}x${this.designHeight},matchMode = ${UIScaler.MatchWidth}`);
    //     break;

    //   case MatchMode.MatchHeight:
    //     fgui.GRoot.inst.setContentScaleFactor(
    //       this.designWidth,
    //       this.designHeight,
    //       UIScaler.MatchHeight
    //     );
    //     console.log(`[UIFairyGUIAdapter] setContentScaleFactor = ${this.designWidth}x${this.designHeight},matchMode = ${UIScaler.MatchHeight}`);
    //     break;
    // }

    // 如果你需要把 GRoot 适配到屏幕像素尺寸，也可以设置：
    // fgui.GRoot.inst.setSize(w, h); // 通常不需要，FGUI 内部会根据缩放策略处理
  };

  private clamp01(v: number) {
    return Math.max(0, Math.min(1, v));
  }
}