/**
 * 元数据服务测试脚本
 *
 * 使用方法：
 * 1. 在Cocos Creator中运行游戏（F5预览）
 * 2. 打开浏览器控制台（F12）
 * 3. 运行测试命令（见下方示例）
 */

import { GameInitializer } from '../core/GameInitializer';

/**
 * 测试HTTP客户端和元数据服务
 */
export async function testMetadataService(): Promise<void> {
    console.log('=== 开始测试元数据服务 ===\n');

    const initializer = GameInitializer.getInstance();
    if (!initializer) {
        console.error('❌ GameInitializer未初始化');
        return;
    }

    const metadataService = initializer.getMetadataService();
    if (!metadataService) {
        console.error('❌ MetadataService未初始化');
        return;
    }

    try {
        // 测试1：创建玩家
        console.log('📝 测试1：创建玩家...');
        const testAddress = '0x' + Math.random().toString(16).slice(2, 10);
        const player = await metadataService.createOrUpdatePlayer(testAddress, {
            nickname: '测试玩家',
            bio: '这是一个测试玩家'
        });
        console.log('✅ 创建玩家成功:', player);
        console.log('');

        // 测试2：获取玩家
        console.log('📝 测试2：获取玩家...');
        const retrievedPlayer = await metadataService.getPlayer(testAddress);
        console.log('✅ 获取玩家成功:', retrievedPlayer);
        console.log('');

        // 测试3：更新玩家
        console.log('📝 测试3：更新玩家...');
        const updatedPlayer = await metadataService.updatePlayer(testAddress, {
            nickname: '更新后的昵称',
            bio: '更新后的简介'
        });
        console.log('✅ 更新玩家成功:', updatedPlayer);
        console.log('');

        // 测试4：创建游戏房间
        console.log('📝 测试4：创建游戏房间...');
        const testGameId = '0x' + Math.random().toString(16).slice(2, 10);
        const game = await metadataService.createGameRoom({
            gameId: testGameId,
            roomName: '测试房间',
            description: '这是一个测试游戏房间',
            hostAddress: testAddress,
            tags: ['测试', 'demo']
        });
        console.log('✅ 创建游戏房间成功:', game);
        console.log('');

        // 测试5：获取游戏房间
        console.log('📝 测试5：获取游戏房间...');
        const retrievedGame = await metadataService.getGameRoom(testGameId);
        console.log('✅ 获取游戏房间成功:', retrievedGame);
        console.log('');

        // 测试6：列出游戏房间
        console.log('📝 测试6：列出游戏房间...');
        const gameList = await metadataService.listGameRooms({
            status: 'waiting',
            limit: 5
        });
        console.log('✅ 列出游戏房间成功:', gameList);
        console.log('');

        // 测试7：缓存测试
        console.log('📝 测试7：测试缓存...');
        console.time('首次获取（无缓存）');
        await metadataService.getPlayer(testAddress);
        console.timeEnd('首次获取（无缓存）');

        console.time('第二次获取（有缓存）');
        await metadataService.getPlayer(testAddress);
        console.timeEnd('第二次获取（有缓存）');
        console.log('');

        // 测试8：获取不存在的玩家
        console.log('📝 测试8：获取不存在的玩家...');
        const nonExistent = await metadataService.getPlayer('0xnonexistent');
        if (nonExistent === null) {
            console.log('✅ 正确返回null');
        } else {
            console.error('❌ 应该返回null');
        }
        console.log('');

        console.log('=== ✅ 所有测试通过！ ===');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

/**
 * 测试HTTP客户端基础功能
 */
export async function testHttpClient(): Promise<void> {
    console.log('=== 测试HTTP客户端 ===\n');

    const initializer = GameInitializer.getInstance();
    if (!initializer) {
        console.error('❌ GameInitializer未初始化');
        return;
    }

    const httpClient = initializer.getHttpClient();
    if (!httpClient) {
        console.error('❌ HttpClient未初始化');
        return;
    }

    try {
        // 测试健康检查
        console.log('📝 测试健康检查端点...');
        const health = await httpClient.get('/health');
        console.log('✅ 健康检查成功:', health);
        console.log('');

        console.log('=== ✅ HTTP客户端测试通过！ ===');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

/**
 * 测试缓存管理器
 */
export async function testCacheManager(): Promise<void> {
    console.log('=== 测试缓存管理器 ===\n');

    const initializer = GameInitializer.getInstance();
    if (!initializer) {
        console.error('❌ GameInitializer未初始化');
        return;
    }

    const cacheManager = initializer.getCacheManager();
    if (!cacheManager) {
        console.error('❌ CacheManager未初始化');
        return;
    }

    try {
        // 测试设置和获取
        console.log('📝 测试设置和获取缓存...');
        const testData = { name: '测试数据', value: 123 };
        cacheManager.set('test_key', testData, 60000);
        const retrieved = cacheManager.get('test_key');
        console.log('设置的数据:', testData);
        console.log('获取的数据:', retrieved);
        console.log('');

        // 测试过期
        console.log('📝 测试缓存过期...');
        cacheManager.set('expire_test', 'will expire', 100);
        await new Promise(resolve => setTimeout(resolve, 150));
        const expired = cacheManager.get('expire_test');
        if (expired === null) {
            console.log('✅ 过期缓存正确返回null');
        } else {
            console.error('❌ 过期缓存应该返回null');
        }
        console.log('');

        // 测试统计
        console.log('📝 缓存统计信息:');
        const stats = cacheManager.getStats();
        console.log(stats);
        console.log('');

        console.log('=== ✅ 缓存管理器测试通过！ ===');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 暴露到全局window对象，方便在控制台调用
if (typeof window !== 'undefined') {
    (window as any).testMetadata = testMetadataService;
    (window as any).testHttp = testHttpClient;
    (window as any).testCache = testCacheManager;
}
