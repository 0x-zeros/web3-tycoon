/**
 * 模板导入器
 * 
 * 作用：在编辑模式或运行时，将 TemplateLibrary 中的模板一键生成到当前 GameMap。
 * - 自动将模板中的银行、商店、传送等映射到现有tile类型（机会/卡片/奖励）。
 * - 适合在编辑场景中作为“模板初始盘面”，后续再手动微调。
 */

import { _decorator, Component } from 'cc';
import { MapGenerator } from './MapGenerator';
import { MapGenerationMode } from './MapGeneratorTypes';
import { GameMap } from '../core/GameMap';
import { getTemplateById, getTemplateList } from './templates/TemplateLibrary';

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('TemplateImporter')
@executeInEditMode(true)
export class TemplateImporter extends Component {
  @property({ displayName: '模板ID', tooltip: '可在控制台打印可用模板列表' })
  templateId: string = 'music_city';

  @property({ displayName: '地图宽度' })
  mapWidth: number = 40;

  @property({ displayName: '地图高度' })
  mapHeight: number = 40;

  @property({ displayName: '随机种子(可选)' })
  seed: number = 0;

  @property({ displayName: '加载时自动生成' })
  generateOnLoad: boolean = false;


  private gameMap: GameMap | null = null;

  onLoad() {
    // 尝试获取同节点上的 GameMap
    this.gameMap = this.getComponent(GameMap) || this.node.getComponent(GameMap);
    if (!this.gameMap) {
      // 也允许父节点上挂 GameMap
      this.gameMap = this.node.getComponentInChildren(GameMap);
    }
  }

  start() {
    if (this.generateOnLoad) {
      this.generateNow().catch(err => console.error('[TemplateImporter] generate failed:', err));
    }
  }

  /**
   * 打印可用模板列表（方便在控制台中查看ID）
   */
  public printTemplates(): void {
    const list = getTemplateList();
    console.log('[TemplateImporter] 可用模板:');
    list.forEach(t => console.log(`- ${t.id}: ${t.name} (${t.tileCount})`));
  }

  /**
   * 生成并应用模板
   */
  public async generateNow(): Promise<void> {
    if (!this.gameMap) {
      console.error('[TemplateImporter] 未找到 GameMap 组件');
      return;
    }

    const tpl = getTemplateById(this.templateId);
    if (!tpl) {
      console.error(`[TemplateImporter] 未找到模板: ${this.templateId}`);
      this.printTemplates();
      return;
    }

    console.log(`[TemplateImporter] 使用模板: ${tpl.name} (${tpl.id})`);

    // 创建生成器
    const generator = new MapGenerator({
      mode: MapGenerationMode.CLASSIC,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      seed: this.seed || Date.now(),
      templateId: this.templateId
    });

    const result = await generator.generateFromTemplate(this.templateId);
    await this.gameMap.applyGeneratedMap(result);

  }
}
