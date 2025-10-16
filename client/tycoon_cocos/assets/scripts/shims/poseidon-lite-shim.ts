/**
 * Poseidon-lite Shim
 * 
 * 用于屏蔽 poseidon-lite 依赖，避免 Rollup 构建错误
 * 注意：这是占位实现，仅用于构建通过。运行期如果被调用会返回固定的 BigInt 值。
 */

// 创建占位函数，返回固定的 BigInt 值
function makeHashFn(n: number) {
  return (..._args: any[]): bigint => {
    // 占位实现：返回固定 BigInt，避免运行时报错
    // 如需真实计算，请接入真正的 Poseidon 实现
    return BigInt(n);
  };
}

// 导出 Sui 期望的 poseidon 函数
export const poseidon1 = makeHashFn(1);
export const poseidon2 = makeHashFn(2);
export const poseidon3 = makeHashFn(3);
export const poseidon4 = makeHashFn(4);
export const poseidon5 = makeHashFn(5);
export const poseidon6 = makeHashFn(6);
export const poseidon7 = makeHashFn(7);
export const poseidon8 = makeHashFn(8);
export const poseidon9 = makeHashFn(9);
export const poseidon10 = makeHashFn(10);
export const poseidon11 = makeHashFn(11);
export const poseidon12 = makeHashFn(12);
export const poseidon13 = makeHashFn(13);
export const poseidon14 = makeHashFn(14);
export const poseidon15 = makeHashFn(15);
export const poseidon16 = makeHashFn(16);

// 导出其他可能的 poseidon 相关函数
export const poseidon = {
  poseidon1,
  poseidon2,
  poseidon3,
  poseidon4,
  poseidon5,
  poseidon6,
  poseidon7,
  poseidon8,
  poseidon9,
  poseidon10,
  poseidon11,
  poseidon12,
  poseidon13,
  poseidon14,
  poseidon15,
  poseidon16
};

// 默认导出
export default poseidon;
