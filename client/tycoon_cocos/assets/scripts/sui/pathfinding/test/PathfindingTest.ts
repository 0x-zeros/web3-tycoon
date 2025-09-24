/**
 * 寻路系统测试用例
 * 验证BFS算法和路径选择生成的正确性
 */

import { MapTemplate, createMapTemplateFromJSON } from '../../types/MapTemplate';
import { MapGraph } from '../MapGraph';
import { BFSPathfinder } from '../BFSPathfinder';
import { PathChoiceGenerator } from '../PathChoiceGenerator';

/**
 * 创建测试地图模板
 * 一个简单的20格环形地图，带有一些邻接连接
 */
function createTestMapTemplate(): MapTemplate {
    const data = {
        id: "1",
        name: "Test Map",
        description: "Test map for pathfinding",
        starting_tile: "0",
        player_count_range: { min: 2, max: 4 },
        tiles: []
    };

    // 创建20个环形连接的地块
    for (let i = 0; i < 20; i++) {
        data.tiles.push({
            id: i.toString(),
            kind: i === 0 ? 10 : 1, // 0是起点，其他是属性
            cw_next: ((i + 1) % 20).toString(),
            ccw_next: ((i - 1 + 20) % 20).toString(),
            adj: []
        });
    }

    // 添加一些邻接连接（捷径）
    // 0 <-> 10
    data.tiles[0].adj = ["10"];
    data.tiles[10].adj = ["0"];

    // 5 <-> 15
    data.tiles[5].adj = ["15"];
    data.tiles[15].adj = ["5"];

    // 7 -> 13 (单向)
    data.tiles[7].adj = ["13"];

    return createMapTemplateFromJSON(data);
}

/**
 * 寻路测试类
 */
export class PathfindingTest {
    private template: MapTemplate;
    private graph: MapGraph;
    private pathfinder: BFSPathfinder;
    private generator: PathChoiceGenerator;

    constructor() {
        this.template = createTestMapTemplate();
        this.graph = new MapGraph(this.template);
        this.pathfinder = new BFSPathfinder(this.graph);
        this.generator = new PathChoiceGenerator(this.graph);
    }

    /**
     * 运行所有测试
     */
    public runAllTests(): void {
        console.log('[PathfindingTest] Starting tests...\n');

        this.testGraphConstruction();
        this.testBasicBFS();
        this.testShortcuts();
        this.testPathGeneration();
        this.testPathValidation();
        this.testTileZeroHandling();  // 新增：测试tile 0的处理

        console.log('\n[PathfindingTest] All tests completed!');
    }

    /**
     * 测试图构建
     */
    private testGraphConstruction(): void {
        console.log('Test 1: Graph Construction');

        // 测试节点数量
        console.assert(this.graph.size === 20, 'Graph should have 20 nodes');

        // 测试环形连接
        const neighbors0 = this.graph.getNeighbors(BigInt(0));
        console.assert(neighbors0.includes(BigInt(1)), 'Node 0 should connect to node 1 (cw)');
        console.assert(neighbors0.includes(BigInt(19)), 'Node 0 should connect to node 19 (ccw)');
        console.assert(neighbors0.includes(BigInt(10)), 'Node 0 should connect to node 10 (adj)');

        console.log('  ✓ Graph construction successful');
    }

    /**
     * 测试基本BFS
     */
    private testBasicBFS(): void {
        console.log('Test 2: Basic BFS');

        // 从0出发，1步可达
        const reachable1 = this.pathfinder.getTilesAtExactDistance(BigInt(0), 1);
        console.assert(reachable1.length === 3, 'From node 0, 3 nodes reachable in 1 step');
        console.assert(reachable1.includes(BigInt(1)), 'Node 1 reachable');
        console.assert(reachable1.includes(BigInt(19)), 'Node 19 reachable');
        console.assert(reachable1.includes(BigInt(10)), 'Node 10 reachable via shortcut');

        // 从0出发，2步可达
        const reachable2 = this.pathfinder.getTilesAtExactDistance(BigInt(0), 2);
        console.assert(reachable2.includes(BigInt(2)), 'Node 2 reachable in 2 steps');
        console.assert(reachable2.includes(BigInt(18)), 'Node 18 reachable in 2 steps');
        console.assert(reachable2.includes(BigInt(11)), 'Node 11 reachable in 2 steps via shortcut');

        console.log('  ✓ Basic BFS working correctly');
    }

    /**
     * 测试捷径路径
     */
    private testShortcuts(): void {
        console.log('Test 3: Shortcut Paths');

        // 测试通过捷径的最短路径
        const path1 = this.pathfinder.findPath(BigInt(0), BigInt(11), 5);
        console.assert(path1 !== null, 'Should find path from 0 to 11');
        console.assert(path1!.distance === 2, 'Distance should be 2 via shortcut');
        console.assert(path1!.path.length === 3, 'Path should have 3 nodes');
        console.assert(path1!.path[1] === BigInt(10), 'Path should go through node 10');

        // 测试单向捷径
        const path2 = this.pathfinder.findPath(BigInt(7), BigInt(13), 3);
        console.assert(path2 !== null, 'Should find path from 7 to 13');
        console.assert(path2!.distance === 1, 'Distance should be 1 via direct connection');

        // 反向应该需要更多步数
        const path3 = this.pathfinder.findPath(BigInt(13), BigInt(7), 3);
        console.assert(path3 === null || path3.distance > 1, 'Reverse path should be longer');

        console.log('  ✓ Shortcut paths working correctly');
    }

    /**
     * 测试路径生成
     */
    private testPathGeneration(): void {
        console.log('Test 4: Path Choice Generation');

        // 测试简单环形路径（没有分叉）
        const simplePath = [BigInt(0), BigInt(1), BigInt(2), BigInt(3)];
        const simpleResult = this.generator.generateChoices(simplePath);

        // 在纯环形路径上，如果没有其他选择，不需要记录选择
        console.log(`  Simple path choices: [${simpleResult.forkChoices.join(', ')}]`);

        // 测试带分叉的路径
        const forkPath = [BigInt(0), BigInt(10), BigInt(11)]; // 通过捷径
        const forkResult = this.generator.generateChoices(forkPath);

        console.log(`  Fork path choices: [${forkResult.forkChoices.join(', ')}]`);
        console.assert(forkResult.forkChoices.includes(BigInt(10)), 'Should record choice at fork');

        console.log('  ✓ Path choice generation working');
    }

    /**
     * 测试路径验证
     */
    private testPathValidation(): void {
        console.log('Test 5: Path Validation');

        // 测试有效路径
        const validChoices = [BigInt(10), BigInt(11)]; // 从0出发，选择捷径
        const isValid1 = this.generator.validateChoices(BigInt(0), validChoices, 3);
        console.assert(isValid1, 'Valid path should pass validation');

        // 测试无效路径（不相邻的选择）
        const invalidChoices = [BigInt(5)]; // 从0不能直接到5
        const isValid2 = this.generator.validateChoices(BigInt(0), invalidChoices, 2);
        console.assert(!isValid2, 'Invalid path should fail validation');

        console.log('  ✓ Path validation working correctly');
    }

    /**
     * 测试tile 0的处理（验证bug修复）
     */
    private testTileZeroHandling(): void {
        console.log('Test 6: Tile 0 Handling (Bug Fix Verification)');

        // 测试从最后一个地块（19）获取邻居，应该包含地块0
        const neighbors19 = this.graph.getNeighbors(BigInt(19));
        console.assert(neighbors19.includes(BigInt(0)), 'Tile 19 should have tile 0 as cw neighbor');
        console.assert(neighbors19.includes(BigInt(18)), 'Tile 19 should have tile 18 as ccw neighbor');
        console.log(`  Neighbors of tile 19: [${neighbors19.join(', ')}]`);

        // 测试从地块19到地块0的路径（应该是1步）
        const path19to0 = this.pathfinder.findPath(BigInt(19), BigInt(0), 3);
        console.assert(path19to0 !== null, 'Should find path from 19 to 0');
        console.assert(path19to0!.distance === 1, 'Distance from 19 to 0 should be 1');
        console.assert(path19to0!.path.length === 2, 'Path should have 2 nodes (19 and 0)');
        console.assert(path19to0!.path[1] === BigInt(0), 'Path should end at tile 0');

        // 测试从地块18通过19到达0的路径（2步）
        const path18to0 = this.pathfinder.findPath(BigInt(18), BigInt(0), 3);
        console.assert(path18to0 !== null, 'Should find path from 18 to 0');
        console.assert(path18to0!.distance === 2, 'Distance from 18 to 0 should be 2');
        console.log(`  Path from 18 to 0: [${path18to0!.path.join(' -> ')}]`);

        // 测试hasFork不会因为tile 0而出错
        const hasFork19 = this.generator['hasFork'](BigInt(19), neighbors19);
        console.assert(hasFork19 === (neighbors19.length > 1), 'hasFork should be based on neighbor count');

        // 测试getDefaultNext正确处理tile 0
        const defaultFrom19 = this.generator['getDefaultNext'](BigInt(19), neighbors19);
        console.assert(defaultFrom19 === BigInt(0), 'Default next from tile 19 should be tile 0 (cw priority)');

        console.log('  ✓ Tile 0 handling working correctly (bug fixed!)');
    }

    /**
     * 演示完整的寻路流程
     */
    public demonstrateFullFlow(): void {
        console.log('\n[PathfindingTest] Demonstrating full pathfinding flow:');

        const start = BigInt(0);
        const target = BigInt(15);
        const maxSteps = 6;

        console.log(`\n1. Finding path from ${start} to ${target} in ${maxSteps} steps`);

        // 寻找路径
        const pathInfo = this.pathfinder.findPath(start, target, maxSteps);
        if (!pathInfo) {
            console.log('  No path found!');
            return;
        }

        console.log(`  Found path with distance ${pathInfo.distance}:`);
        console.log(`  Path: [${pathInfo.path.join(' -> ')}]`);

        // 生成选择序列
        const choiceResult = this.generator.generateChoices(pathInfo.path);
        console.log(`\n2. Generated choice sequence:`);
        console.log(`  Fork choices: [${choiceResult.forkChoices.join(', ')}]`);

        // 打印详细选择信息
        console.log(`\n3. Choice details:`);
        for (const choice of choiceResult.choiceDetails) {
            console.log(`  At tile ${choice.atTile}: choose ${choice.choice}`);
        }

        // 验证选择序列
        const isValid = this.generator.validateChoices(start, choiceResult.forkChoices, maxSteps);
        console.log(`\n4. Validation result: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
    }
}

/**
 * 运行测试
 */
export function runPathfindingTests(): void {
    const test = new PathfindingTest();
    test.runAllTests();
    test.demonstrateFullFlow();
}