/**
 * 路径生成器 - Phase 1
 * 负责根据模板生成基础路径网络
 */

import { Vec2 } from 'cc';
import { MapTemplateSpec, PathNode } from './templates/TemplateTypes';
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
   * 根据模板生成路径
   */
  generateFromTemplate(template: MapTemplateSpec): PathGenerationResult {
    switch (template.layout) {
      case 'snake':
        return this.generateSnakePath(template);
      case 'double_loop':
        return this.generateDoubleLoopPath(template);
      case 'musical_note':
        return this.generateMusicalNotePath(template);
      case 'grid':
      case 'full_grid':
        return this.generateGridPath(template);
      case 'nested_loops':
        return this.generateNestedLoopsPath(template);
      case 'complex_grid':
        return this.generateComplexGridPath(template);
      case 'single_ring':
      default:
        return this.generateSingleRingPath(template);
    }
  }

  /**
   * 生成蛇形路径
   */
  private generateSnakePath(template: MapTemplateSpec): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const corners: Vec2[] = [];

    if (template.pathConfig.mainPath) {
      // 使用预定义的路径节点
      for (const node of template.pathConfig.mainPath) {
        const pos = this.applyJitter(node.pos);
        paths.push(pos);
        mainPath.push(pos);
        if (node.type === 'corner') {
          corners.push(pos);
        }
      }

      // 连接路径节点形成连续路径
      const connectedPath = this.connectPathNodes(mainPath);
      return {
        paths: connectedPath,
        mainPath: connectedPath,
        sidePaths: [],
        intersections: [],
        corners
      };
    }

    // 生成S形蛇形路径
    const segments = 4 + Math.floor(this.random() * 3); // 4-6段
    let currentPos = new Vec2(2, 2);
    let direction = 'right';

    for (let i = 0; i < segments; i++) {
      const segmentLength = 8 + Math.floor(this.random() * 8); // 8-15格
      const segment = this.createStraightSegment(currentPos, direction, segmentLength);

      paths.push(...segment);
      mainPath.push(...segment);

      // 记录拐角
      if (i > 0) {
        corners.push(currentPos);
      }

      // 转弯
      currentPos = segment[segment.length - 1];
      direction = this.getNextDirection(direction, i % 2 === 0);

      if (i < segments - 1) {
        corners.push(currentPos);
      }
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
   * 生成双环路径
   */
  private generateDoubleLoopPath(template: MapTemplateSpec): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const intersections: Vec2[] = [];
    const corners: Vec2[] = [];

    if (template.pathConfig.rings) {
      const { outer, inner, bridges = 2 } = template.pathConfig.rings;

      // 生成外环
      if (outer) {
        const outerPath = this.createRingFromVertices(outer);
        paths.push(...outerPath);
        mainPath.push(...outerPath);

        // 记录外环拐角
        for (const vertex of outer) {
          corners.push(this.applyJitter(vertex));
        }
      }

      // 生成内环
      if (inner) {
        const innerPath = this.createRingFromVertices(inner);
        paths.push(...innerPath);

        // 记录内环拐角
        for (const vertex of inner) {
          corners.push(this.applyJitter(vertex));
        }
      }

      // 生成桥接
      if (outer && inner && bridges > 0) {
        const bridgePaths = this.createBridges(outer, inner, bridges);
        for (const bridge of bridgePaths) {
          paths.push(...bridge);
          // 桥接点作为交叉点
          intersections.push(bridge[0], bridge[bridge.length - 1]);
        }
      }
    }

    return {
      paths: this.removeDuplicates(paths),
      mainPath: this.removeDuplicates(mainPath),
      sidePaths: [],
      intersections,
      corners
    };
  }

  /**
   * 生成音符形状路径
   */
  private generateMusicalNotePath(template: MapTemplateSpec): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const sidePaths: Vec2[][] = [];
    const corners: Vec2[] = [];

    // 生成主环
    if (template.pathConfig.mainPath) {
      for (const node of template.pathConfig.mainPath) {
        const pos = this.applyJitter(node.pos);
        paths.push(pos);
        mainPath.push(pos);
        if (node.type === 'corner') {
          corners.push(pos);
        }
      }
    }

    // 生成子路径（音符的小圆圈）
    if (template.pathConfig.subPaths) {
      for (const subPath of template.pathConfig.subPaths) {
        const sub: Vec2[] = [];
        for (const node of subPath) {
          const pos = this.applyJitter(node.pos);
          paths.push(pos);
          sub.push(pos);
          if (node.type === 'corner') {
            corners.push(pos);
          }
        }
        sidePaths.push(sub);
      }
    }

    return {
      paths: this.removeDuplicates(paths),
      mainPath: this.removeDuplicates(mainPath),
      sidePaths,
      intersections: [],
      corners
    };
  }

  /**
   * 生成网格路径
   */
  private generateGridPath(template: MapTemplateSpec): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const intersections: Vec2[] = [];
    const corners: Vec2[] = [];

    if (template.pathConfig.grid) {
      const { rows, cols, connectivity } = template.pathConfig.grid;
      const cellWidth = Math.floor((this.width - 4) / cols);
      const cellHeight = Math.floor((this.height - 4) / rows);

      // 生成横线
      for (let row = 0; row <= rows; row++) {
        const y = 2 + row * cellHeight;
        for (let x = 2; x <= this.width - 2; x++) {
          const pos = new Vec2(x, y);
          paths.push(pos);
          if (row === 0 || row === rows) {
            mainPath.push(pos);
          }
        }
      }

      // 生成竖线
      for (let col = 0; col <= cols; col++) {
        const x = 2 + col * cellWidth;
        for (let y = 2; y <= this.height - 2; y++) {
          const pos = new Vec2(x, y);
          if (!this.containsPos(paths, pos)) {
            paths.push(pos);
          }
          if (col === 0 || col === cols) {
            if (!this.containsPos(mainPath, pos)) {
              mainPath.push(pos);
            }
          }
        }
      }

      // 记录交叉点
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= cols; col++) {
          const pos = new Vec2(2 + col * cellWidth, 2 + row * cellHeight);
          intersections.push(pos);
          if ((row === 0 || row === rows) && (col === 0 || col === cols)) {
            corners.push(pos);
          }
        }
      }

      // 根据连接性移除部分路径
      if (connectivity === 'cross') {
        // 只保留十字形
        paths.length = 0;
        const centerX = Math.floor(cols / 2);
        const centerY = Math.floor(rows / 2);

        // 横线
        const y = 2 + centerY * cellHeight;
        for (let x = 2; x <= this.width - 2; x++) {
          paths.push(new Vec2(x, y));
        }

        // 竖线
        const x = 2 + centerX * cellWidth;
        for (let y = 2; y <= this.height - 2; y++) {
          const pos = new Vec2(x, y);
          if (!this.containsPos(paths, pos)) {
            paths.push(pos);
          }
        }
      }
    }

    // 添加外环（如果有）
    if (template.pathConfig.rings?.outer) {
      const outerPath = this.createRingFromVertices(template.pathConfig.rings.outer);
      for (const pos of outerPath) {
        if (!this.containsPos(paths, pos)) {
          paths.push(pos);
          mainPath.push(pos);
        }
      }
    }

    return {
      paths: this.removeDuplicates(paths),
      mainPath: this.removeDuplicates(mainPath),
      sidePaths: [],
      intersections,
      corners
    };
  }

  /**
   * 生成嵌套环路径
   */
  private generateNestedLoopsPath(template: MapTemplateSpec): PathGenerationResult {
    // 类似双环，但内外环共享边
    return this.generateDoubleLoopPath(template);
  }

  /**
   * 生成复杂网格路径
   */
  private generateComplexGridPath(template: MapTemplateSpec): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const intersections: Vec2[] = [];
    const corners: Vec2[] = [];

    // 使用预定义的不规则路径
    if (template.pathConfig.mainPath) {
      for (const node of template.pathConfig.mainPath) {
        const pos = this.applyJitter(node.pos);
        paths.push(pos);
        mainPath.push(pos);

        if (node.type === 'intersection') {
          intersections.push(pos);
        } else if (node.type === 'corner') {
          corners.push(pos);
        }
      }

      // 连接所有节点
      const connectedPath = this.connectComplexPath(template.pathConfig.mainPath);
      return {
        paths: connectedPath,
        mainPath: connectedPath,
        sidePaths: [],
        intersections,
        corners
      };
    }

    // 回退到网格生成
    return this.generateGridPath(template);
  }

  /**
   * 生成单环路径
   */
  private generateSingleRingPath(template: MapTemplateSpec): PathGenerationResult {
    const paths: Vec2[] = [];
    const mainPath: Vec2[] = [];
    const corners: Vec2[] = [];

    if (template.pathConfig.rings?.outer) {
      const ringPath = this.createRingFromVertices(template.pathConfig.rings.outer);
      paths.push(...ringPath);
      mainPath.push(...ringPath);

      // 记录拐角
      for (const vertex of template.pathConfig.rings.outer) {
        corners.push(this.applyJitter(vertex));
      }
    } else {
      // 默认方形环
      const vertices = [
        new Vec2(5, 5), new Vec2(this.width - 5, 5),
        new Vec2(this.width - 5, this.height - 5), new Vec2(5, this.height - 5)
      ];
      const ringPath = this.createRingFromVertices(vertices);
      paths.push(...ringPath);
      mainPath.push(...ringPath);

      for (const vertex of vertices) {
        corners.push(vertex);
      }
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
   * 从顶点创建环路径
   */
  private createRingFromVertices(vertices: Vec2[]): Vec2[] {
    const path: Vec2[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const start = this.applyJitter(vertices[i]);
      const end = this.applyJitter(vertices[(i + 1) % vertices.length]);
      const segment = this.bresenhamLine(start, end);
      path.push(...segment);
    }

    return this.removeDuplicates(path);
  }

  /**
   * 创建直线段
   */
  private createStraightSegment(start: Vec2, direction: string, length: number): Vec2[] {
    const segment: Vec2[] = [];
    let current = start.clone();

    for (let i = 0; i < length; i++) {
      segment.push(current.clone());

      switch (direction) {
        case 'right':
          current.x++;
          break;
        case 'left':
          current.x--;
          break;
        case 'up':
          current.y++;
          break;
        case 'down':
          current.y--;
          break;
      }

      // 边界检查
      current.x = Math.max(2, Math.min(this.width - 2, current.x));
      current.y = Math.max(2, Math.min(this.height - 2, current.y));
    }

    return segment;
  }

  /**
   * 创建桥接路径
   */
  private createBridges(outer: Vec2[], inner: Vec2[], count: number): Vec2[][] {
    const bridges: Vec2[][] = [];
    const step = Math.floor(outer.length / count);

    for (let i = 0; i < count; i++) {
      const outerIndex = (i * step) % outer.length;
      const innerIndex = this.findNearestPoint(outer[outerIndex], inner);

      const bridge = this.bresenhamLine(
        this.applyJitter(outer[outerIndex]),
        this.applyJitter(inner[innerIndex])
      );

      bridges.push(bridge);
    }

    return bridges;
  }

  /**
   * 连接路径节点
   */
  private connectPathNodes(nodes: Vec2[]): Vec2[] {
    const connected: Vec2[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const segment = this.bresenhamLine(nodes[i], nodes[i + 1]);
      connected.push(...segment);
    }

    // 如果需要闭合
    if (nodes.length > 2) {
      const closing = this.bresenhamLine(nodes[nodes.length - 1], nodes[0]);
      connected.push(...closing);
    }

    return this.removeDuplicates(connected);
  }

  /**
   * 连接复杂路径（根据connections）
   */
  private connectComplexPath(nodes: PathNode[]): Vec2[] {
    const connected: Vec2[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      for (const targetIndex of node.connections) {
        const key = `${Math.min(i, targetIndex)}-${Math.max(i, targetIndex)}`;
        if (!processed.has(key) && targetIndex < nodes.length) {
          processed.add(key);
          const segment = this.bresenhamLine(
            this.applyJitter(node.pos),
            this.applyJitter(nodes[targetIndex].pos)
          );
          connected.push(...segment);
        }
      }
    }

    return this.removeDuplicates(connected);
  }

  /**
   * Manhattan路径算法（只允许4方向移动）
   */
  private bresenhamLine(start: Vec2, end: Vec2): Vec2[] {
    const points: Vec2[] = [];
    let x0 = Math.round(start.x);
    let y0 = Math.round(start.y);
    const x1 = Math.round(end.x);
    const y1 = Math.round(end.y);

    // 使用Manhattan路径：先横向移动，再纵向移动
    // 这确保了路径上的每个tile都与前一个tile共享一条边

    // 横向移动
    const dx = x1 - x0;
    const stepX = dx > 0 ? 1 : -1;
    let currentX = x0;

    while (currentX !== x1) {
      points.push(new Vec2(currentX, y0));
      currentX += stepX;
    }

    // 纵向移动
    const dy = y1 - y0;
    const stepY = dy > 0 ? 1 : -1;
    let currentY = y0;

    while (currentY !== y1) {
      points.push(new Vec2(x1, currentY));
      currentY += stepY;
    }

    // 添加终点
    points.push(new Vec2(x1, y1));

    return points;
  }

  /**
   * 应用抖动（限制为4方向）
   */
  private applyJitter(pos: Vec2, amount: number = 1): Vec2 {
    // 暂时禁用抖动，避免产生对角线连接
    // 如果需要抖动，应该只在一个方向上进行
    return pos.clone();
  }

  /**
   * 获取下一个方向
   */
  private getNextDirection(current: string, turnRight: boolean): string {
    const directions = ['right', 'down', 'left', 'up'];
    const index = directions.indexOf(current);
    const offset = turnRight ? 1 : -1;
    return directions[(index + offset + 4) % 4];
  }

  /**
   * 查找最近的点
   */
  private findNearestPoint(target: Vec2, points: Vec2[]): number {
    let minDist = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < points.length; i++) {
      const dist = Vec2.distance(target, points[i]);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  /**
   * 检查是否包含位置
   */
  private containsPos(points: Vec2[], pos: Vec2): boolean {
    return points.some(p => p.x === pos.x && p.y === pos.y);
  }

  /**
   * 移除重复点
   */
  private removeDuplicates(points: Vec2[]): Vec2[] {
    const unique: Vec2[] = [];
    const keys = new Set<string>();

    for (const point of points) {
      const key = `${point.x},${point.y}`;
      if (!keys.has(key)) {
        keys.add(key);
        unique.push(point);
      }
    }

    return unique;
  }

  /**
   * 验证路径间距（确保最小2格间隔）
   */
  validateSpacing(paths: Vec2[], minSpacing: number = 2): boolean {
    // 将路径转换为集合以便快速查找
    const pathSet = new Set(paths.map(p => CoordUtils.posToKey(p)));

    // 检查每对平行路径
    for (const pos of paths) {
      // 检查水平方向
      for (let offset = 1; offset < minSpacing; offset++) {
        const above = new Vec2(pos.x, pos.y + offset);
        const below = new Vec2(pos.x, pos.y - offset);

        if (pathSet.has(CoordUtils.posToKey(above)) ||
            pathSet.has(CoordUtils.posToKey(below))) {
          // 检查是否是长段
          let length = 1;
          for (let dx = 1; dx <= 4; dx++) {
            const nextPos = new Vec2(pos.x + dx, pos.y);
            const nextAbove = new Vec2(pos.x + dx, pos.y + offset);
            const nextBelow = new Vec2(pos.x + dx, pos.y - offset);

            if (pathSet.has(CoordUtils.posToKey(nextPos)) &&
                (pathSet.has(CoordUtils.posToKey(nextAbove)) ||
                 pathSet.has(CoordUtils.posToKey(nextBelow)))) {
              length++;
            } else {
              break;
            }
          }

          if (length > 4) {
            return false; // 超过4格的平行路径间距不足
          }
        }
      }

      // 检查垂直方向
      for (let offset = 1; offset < minSpacing; offset++) {
        const left = new Vec2(pos.x - offset, pos.y);
        const right = new Vec2(pos.x + offset, pos.y);

        if (pathSet.has(CoordUtils.posToKey(left)) ||
            pathSet.has(CoordUtils.posToKey(right))) {
          // 检查是否是长段
          let length = 1;
          for (let dy = 1; dy <= 4; dy++) {
            const nextPos = new Vec2(pos.x, pos.y + dy);
            const nextLeft = new Vec2(pos.x - offset, pos.y + dy);
            const nextRight = new Vec2(pos.x + offset, pos.y + dy);

            if (pathSet.has(CoordUtils.posToKey(nextPos)) &&
                (pathSet.has(CoordUtils.posToKey(nextLeft)) ||
                 pathSet.has(CoordUtils.posToKey(nextRight)))) {
              length++;
            } else {
              break;
            }
          }

          if (length > 4) {
            return false; // 超过4格的平行路径间距不足
          }
        }
      }
    }

    return true;
  }
}