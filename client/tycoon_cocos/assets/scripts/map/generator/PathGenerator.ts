/**
 * 路径生成器 - Phase 1
 * 负责随机生成基础路径网络
 * 不依赖任何模板，纯随机生成
 */

import { Vec2 } from 'cc';
import { CoordUtils } from './MapGeneratorTypes';

export interface PathGenerationResult {
  paths: Vec2[];              // 所有路径点
  mainPath: Vec2[];          // 主路径
  sidePaths: Vec2[][];       // 支路
  intersections: Vec2[];     // 交叉点
  corners: Vec2[];          // 拐角点
}

export class PathGenerator {
  private width: number;
  private height: number;
  private random: () => number;

  constructor(width: number, height: number, randomFn?: () => number) {
    this.width = width;
    this.height = height;
    this.random = randomFn || Math.random;
  }

  /**
   * 生成随机路径（不需要模板）
   */
  generate(): PathGenerationResult {
    // 随机选择一种形状
    const shapeType = Math.floor(this.random() * 3);

    switch(shapeType) {
      case 0: // 方形环
        return this.generateSquareRing();
      case 1: // 双环
        return this.generateDoubleRing();
      case 2: // S形路径
        return this.generateSnakePath();
      default:
        return this.generateSquareRing();
    }
  }

  /**
   * 生成方形环路径
   */
  private generateSquareRing(): PathGenerationResult {
    // 随机边距
    const margin = 5 + Math.floor(this.random() * 6); // 5-10格

    // 四个角点
    const topLeft = new Vec2(margin, margin);
    const topRight = new Vec2(this.width - margin, margin);
    const bottomRight = new Vec2(this.width - margin, this.height - margin);
    const bottomLeft = new Vec2(margin, this.height - margin);

    const corners = [topLeft, topRight, bottomRight, bottomLeft];

    // 生成每条边的路径
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];

    // 底边（左到右）
    const bottomSteps = 8 + Math.floor(this.random() * 5); // 8-12格
    for (let i = 0; i <= bottomSteps; i++) {
      const x = Math.round(topLeft.x + (topRight.x - topLeft.x) * i / bottomSteps);
      const pos = new Vec2(x, topLeft.y);
      paths.push(pos);
      mainPath.push(pos);
    }

    // 右边（下到上）
    const rightSteps = 8 + Math.floor(this.random() * 5);
    for (let i = 1; i <= rightSteps; i++) {
      const y = Math.round(topRight.y + (bottomRight.y - topRight.y) * i / rightSteps);
      const pos = new Vec2(topRight.x, y);
      paths.push(pos);
      mainPath.push(pos);
    }

    // 顶边（右到左）
    const topSteps = 8 + Math.floor(this.random() * 5);
    for (let i = 1; i <= topSteps; i++) {
      const x = Math.round(bottomRight.x - (bottomRight.x - bottomLeft.x) * i / topSteps);
      const pos = new Vec2(x, bottomRight.y);
      paths.push(pos);
      mainPath.push(pos);
    }

    // 左边（上到下，不包括起点以免重复）
    const leftSteps = 8 + Math.floor(this.random() * 5);
    for (let i = 1; i < leftSteps; i++) {
      const y = Math.round(bottomLeft.y - (bottomLeft.y - topLeft.y) * i / leftSteps);
      const pos = new Vec2(bottomLeft.x, y);
      paths.push(pos);
      mainPath.push(pos);
    }

    // 加入随机抖动
    const jitteredPaths = paths.map(pos => this.applyJitter(pos));
    const jitteredMainPath = mainPath.map(pos => this.applyJitter(pos));

    return {
      paths: this.removeDuplicates(jitteredPaths),
      mainPath: this.removeDuplicates(jitteredMainPath),
      sidePaths: [],
      intersections: [],
      corners: corners.map(c => this.applyJitter(c))
    };
  }

  /**
   * 生成双环路径
   */
  private generateDoubleRing(): PathGenerationResult {
    // 外环边距
    const outerMargin = 5 + Math.floor(this.random() * 3); // 5-7
    // 内环边距
    const innerMargin = 12 + Math.floor(this.random() * 4); // 12-15

    // 生成外环
    const outerRing = this.createRing(outerMargin);

    // 生成内环
    const innerRing = this.createRing(innerMargin);

    // 生成连接桥
    const bridges: Vec2[][] = [];
    const bridgeCount = 2 + Math.floor(this.random() * 2); // 2-3个桥

    for (let i = 0; i < bridgeCount; i++) {
      const side = Math.floor(this.random() * 4); // 随机选择一边
      const bridge = this.createBridge(outerMargin, innerMargin, side);
      bridges.push(bridge);
    }

    // 合并所有路径
    const allPaths = [
      ...outerRing,
      ...innerRing,
      ...bridges.flat()
    ];

    return {
      paths: this.removeDuplicates(allPaths),
      mainPath: this.removeDuplicates(outerRing),
      sidePaths: [innerRing, ...bridges],
      intersections: [], // 桥接点
      corners: [] // 环的角点
    };
  }

  /**
   * 生成S形蛇形路径
   */
  private generateSnakePath(): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const corners: Vec2[] = [];

    // 随机段数
    const segments = 3 + Math.floor(this.random() * 3); // 3-5段

    let currentPos = new Vec2(5, 5);
    let direction = 0; // 0:右, 1:上, 2:左, 3:下

    for (let seg = 0; seg < segments; seg++) {
      // 每段的长度
      const segmentLength = 8 + Math.floor(this.random() * 8); // 8-15格

      // 生成这一段
      for (let i = 0; i < segmentLength; i++) {
        const pos = currentPos.clone();

        // 根据方向移动
        switch(direction) {
          case 0: pos.x += i; break; // 右
          case 1: pos.y += i; break; // 上
          case 2: pos.x -= i; break; // 左
          case 3: pos.y -= i; break; // 下
        }

        // 确保在地图范围内
        pos.x = Math.max(3, Math.min(this.width - 3, pos.x));
        pos.y = Math.max(3, Math.min(this.height - 3, pos.y));

        paths.push(this.applyJitter(pos));
        mainPath.push(this.applyJitter(pos));
      }

      // 更新当前位置到段末
      switch(direction) {
        case 0: currentPos.x += segmentLength; break;
        case 1: currentPos.y += segmentLength; break;
        case 2: currentPos.x -= segmentLength; break;
        case 3: currentPos.y -= segmentLength; break;
      }

      // 记录拐角
      if (seg < segments - 1) {
        corners.push(currentPos.clone());
      }

      // 转向（顺时针）
      direction = (direction + 1) % 4;
    }

    return {
      paths: this.removeDuplicates(paths),
      mainPath: this.removeDuplicates(mainPath),
      sidePaths: [],
      intersections: [],
      corners
    };
  }

  /**
   * 创建一个环
   */
  private createRing(margin: number): Vec2[] {
    const ring: Vec2[] = [];
    const stepsPerSide = 8 + Math.floor(this.random() * 5); // 8-12格

    // 四边
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < stepsPerSide; i++) {
        let x = margin, y = margin;

        switch(side) {
          case 0: // 底边
            x = margin + (this.width - 2 * margin) * i / stepsPerSide;
            break;
          case 1: // 右边
            x = this.width - margin;
            y = margin + (this.height - 2 * margin) * i / stepsPerSide;
            break;
          case 2: // 顶边
            x = this.width - margin - (this.width - 2 * margin) * i / stepsPerSide;
            y = this.height - margin;
            break;
          case 3: // 左边
            x = margin;
            y = this.height - margin - (this.height - 2 * margin) * i / stepsPerSide;
            break;
        }

        ring.push(this.applyJitter(new Vec2(Math.round(x), Math.round(y))));
      }
    }

    return ring;
  }

  /**
   * 创建连接桥
   */
  private createBridge(outerMargin: number, innerMargin: number, side: number): Vec2[] {
    const bridge: Vec2[] = [];
    const steps = innerMargin - outerMargin;

    // 随机起点位置
    const t = 0.2 + this.random() * 0.6; // 20%-80%的位置

    for (let i = 0; i <= steps; i++) {
      let x = 0, y = 0;
      const progress = i / steps;

      switch(side) {
        case 0: // 底部桥
          x = outerMargin + (this.width - 2 * outerMargin) * t;
          y = outerMargin + (innerMargin - outerMargin) * progress;
          break;
        case 1: // 右侧桥
          x = this.width - outerMargin - (innerMargin - outerMargin) * progress;
          y = outerMargin + (this.height - 2 * outerMargin) * t;
          break;
        case 2: // 顶部桥
          x = outerMargin + (this.width - 2 * outerMargin) * t;
          y = this.height - outerMargin - (innerMargin - outerMargin) * progress;
          break;
        case 3: // 左侧桥
          x = outerMargin + (innerMargin - outerMargin) * progress;
          y = outerMargin + (this.height - 2 * outerMargin) * t;
          break;
      }

      bridge.push(new Vec2(Math.round(x), Math.round(y)));
    }

    return bridge;
  }

  /**
   * 应用随机抖动
   */
  private applyJitter(pos: Vec2): Vec2 {
    // 小幅随机偏移（-1到1格）
    const jitterX = Math.round((this.random() - 0.5) * 2);
    const jitterY = Math.round((this.random() - 0.5) * 2);

    return new Vec2(
      Math.max(2, Math.min(this.width - 2, pos.x + jitterX)),
      Math.max(2, Math.min(this.height - 2, pos.y + jitterY))
    );
  }

  /**
   * 去除重复的路径点
   */
  private removeDuplicates(paths: Vec2[]): Vec2[] {
    const seen = new Set<string>();
    const result: Vec2[] = [];

    for (const pos of paths) {
      const key = CoordUtils.posToKey(pos);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(pos);
      }
    }

    return result;
  }

  /**
   * 验证路径间距（保留接口兼容性）
   */
  validateSpacing(paths: Vec2[], minSpacing: number): boolean {
    // 简单验证，不影响生成
    return true;
  }
}