#!/usr/bin/env node
/**
 * 地图坐标迁移工具
 * 将地图中的负数坐标平移到 0-255 的 u8 范围内
 *
 * 使用方式：
 *   node migrate-coords.js [map-file-path]
 *
 * 示例：
 *   node migrate-coords.js ../../client/tycoon_cocos/assets/resources/data/maps/map.json
 */

const fs = require('fs');
const path = require('path');

// 默认地图文件路径
const DEFAULT_MAP_FILE = '../../client/tycoon_cocos/assets/resources/data/maps/map.json';

// 从命令行参数获取文件路径
const mapFilePath = process.argv[2] || DEFAULT_MAP_FILE;
const absolutePath = path.resolve(__dirname, mapFilePath);

console.log('='.repeat(60));
console.log('地图坐标迁移工具');
console.log('='.repeat(60));
console.log(`目标文件: ${absolutePath}`);
console.log('');

// 检查文件是否存在
if (!fs.existsSync(absolutePath)) {
    console.error(`✗ 文件不存在: ${absolutePath}`);
    process.exit(1);
}

// 1. 读取地图数据
console.log('[1/7] 读取地图数据...');
const mapData = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
console.log(`✓ 地图ID: ${mapData.mapId}`);
console.log(`✓ Tiles: ${mapData.tiles?.length || 0}`);
console.log(`✓ Buildings: ${mapData.buildings?.length || 0}`);
console.log('');

// 2. 计算当前坐标范围
console.log('[2/7] 分析坐标范围...');
let minX = Infinity, maxX = -Infinity;
let minZ = Infinity, maxZ = -Infinity;

(mapData.tiles || []).forEach(tile => {
    const x = tile.position.x;
    const z = tile.position.z;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
});

(mapData.buildings || []).forEach(building => {
    const x = building.position.x;
    const z = building.position.z;

    // 2x2 建筑占用 2x2 的格子
    const size = building.size || 1;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + size - 1);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z + size - 1);
});

console.log(`当前范围:`);
console.log(`  X: [${minX}, ${maxX}] (跨度 ${maxX - minX + 1})`);
console.log(`  Z: [${minZ}, ${maxZ}] (跨度 ${maxZ - minZ + 1})`);
console.log('');

// 3. 计算平移偏移量
console.log('[3/7] 计算平移偏移量...');
const offsetX = minX < 0 ? -minX : 0;
const offsetZ = minZ < 0 ? -minZ : 0;

console.log(`平移偏移量:`);
console.log(`  X: +${offsetX}`);
console.log(`  Z: +${offsetZ}`);

if (offsetX === 0 && offsetZ === 0) {
    console.log('');
    console.log('✓ 地图坐标已在有效范围内，无需平移');
    process.exit(0);
}
console.log('');

// 4. 平移所有坐标
console.log('[4/7] 平移坐标...');
let tilesMigrated = 0;
let buildingsMigrated = 0;

(mapData.tiles || []).forEach(tile => {
    tile.position.x += offsetX;
    tile.position.z += offsetZ;
    tilesMigrated++;
});

(mapData.buildings || []).forEach(building => {
    building.position.x += offsetX;
    building.position.z += offsetZ;
    buildingsMigrated++;
});

console.log(`✓ 已平移 ${tilesMigrated} 个 tiles`);
console.log(`✓ 已平移 ${buildingsMigrated} 个 buildings`);
console.log('');

// 5. 验证平移后的范围
console.log('[5/7] 验证平移结果...');
let newMinX = Infinity, newMaxX = -Infinity;
let newMinZ = Infinity, newMaxZ = -Infinity;

(mapData.tiles || []).forEach(tile => {
    const x = tile.position.x;
    const z = tile.position.z;
    newMinX = Math.min(newMinX, x);
    newMaxX = Math.max(newMaxX, x);
    newMinZ = Math.min(newMinZ, z);
    newMaxZ = Math.max(newMaxZ, z);
});

(mapData.buildings || []).forEach(building => {
    const x = building.position.x;
    const z = building.position.z;
    const size = building.size || 1;
    newMinX = Math.min(newMinX, x);
    newMaxX = Math.max(newMaxX, x + size - 1);
    newMinZ = Math.min(newMinZ, z);
    newMaxZ = Math.max(newMaxZ, z + size - 1);
});

console.log(`平移后范围:`);
console.log(`  X: [${newMinX}, ${newMaxX}] (跨度 ${newMaxX - newMinX + 1})`);
console.log(`  Z: [${newMinZ}, ${newMaxZ}] (跨度 ${newMaxZ - newMinZ + 1})`);
console.log('');

// 6. 检查是否在 u8 范围内 (0-255)
console.log('[6/7] 检查 u8 范围...');
const inRange = newMinX >= 0 && newMaxX <= 255 && newMinZ >= 0 && newMaxZ <= 255;

if (inRange) {
    console.log('✓ 所有坐标都在有效范围内 (0-255)');
} else {
    console.error('✗ 坐标超出 u8 范围 (0-255)!');
    console.error(`  X 超出: ${newMinX < 0 || newMaxX > 255}`);
    console.error(`  Z 超出: ${newMinZ < 0 || newMaxZ > 255}`);
    process.exit(1);
}
console.log('');

// 7. 保存结果
console.log('[7/7] 保存结果...');

// 备份原文件
const backupPath = absolutePath + '.backup';
fs.copyFileSync(absolutePath, backupPath);
console.log(`✓ 备份已保存: ${backupPath}`);

// 保存迁移后的数据
fs.writeFileSync(absolutePath, JSON.stringify(mapData, null, 2), 'utf-8');
console.log(`✓ 迁移后的地图已保存: ${absolutePath}`);
console.log('');

// 8. 总结
console.log('='.repeat(60));
console.log('迁移完成！');
console.log('='.repeat(60));
console.log(`平移: X+${offsetX}, Z+${offsetZ}`);
console.log(`新范围: X[${newMinX}, ${newMaxX}], Z[${newMinZ}, ${newMaxZ}]`);
console.log(`Tiles: ${tilesMigrated} 个`);
console.log(`Buildings: ${buildingsMigrated} 个`);
console.log('');
console.log('⚠️ 注意：在 Cocos Creator 中重新加载地图以查看效果');
console.log('');
