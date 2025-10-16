/**
 * ZkLogin Shim
 * 
 * 用于屏蔽 @mysten/sui/zklogin 相关功能，避免 poseidon-lite 依赖问题
 * 注意：这是占位实现，仅用于构建通过。运行期如果被调用会抛出错误。
 */

// 导出空的 zkLogin 相关接口，避免构建错误
export const zkLogin = {
  // 占位实现
};

// 导出空的 poseidon 相关函数
export const poseidon = {
  // 占位实现
};

// 如果运行时被调用，抛出错误提示
const throwNotImplemented = (feature: string) => {
  throw new Error(`ZkLogin feature '${feature}' is not implemented in this build. ZkLogin has been disabled to avoid dependency issues.`);
};

// 导出所有可能的 zkLogin 相关函数，都返回错误
export const getZkLoginSignature = () => throwNotImplemented('getZkLoginSignature');
export const getZkLoginUserSignature = () => throwNotImplemented('getZkLoginUserSignature');
export const getZkLoginUserAddress = () => throwNotImplemented('getZkLoginUserAddress');
export const getZkLoginUserSalt = () => throwNotImplemented('getZkLoginUserSalt');
export const getZkLoginUserKeyClaim = () => throwNotImplemented('getZkLoginUserKeyClaim');
export const getZkLoginUserKeyClaimName = () => throwNotImplemented('getZkLoginUserKeyClaimName');
export const getZkLoginUserKeyClaimValue = () => throwNotImplemented('getZkLoginUserKeyClaimValue');
export const getZkLoginUserKeyClaimNameHash = () => throwNotImplemented('getZkLoginUserKeyClaimNameHash');
export const getZkLoginUserKeyClaimValueHash = () => throwNotImplemented('getZkLoginUserKeyClaimValueHash');
export const getZkLoginUserKeyClaimNameHashPrefix = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashPrefix');
export const getZkLoginUserKeyClaimValueHashPrefix = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashPrefix');
export const getZkLoginUserKeyClaimNameHashSuffix = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashSuffix');
export const getZkLoginUserKeyClaimValueHashSuffix = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashSuffix');
export const getZkLoginUserKeyClaimNameHashPrefixLength = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashPrefixLength');
export const getZkLoginUserKeyClaimValueHashPrefixLength = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashPrefixLength');
export const getZkLoginUserKeyClaimNameHashSuffixLength = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashSuffixLength');
export const getZkLoginUserKeyClaimValueHashSuffixLength = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashSuffixLength');
export const getZkLoginUserKeyClaimNameHashPrefixBytes = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashPrefixBytes');
export const getZkLoginUserKeyClaimValueHashPrefixBytes = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashPrefixBytes');
export const getZkLoginUserKeyClaimNameHashSuffixBytes = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashSuffixBytes');
export const getZkLoginUserKeyClaimValueHashSuffixBytes = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashSuffixBytes');
export const getZkLoginUserKeyClaimNameHashPrefixLengthBytes = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashPrefixLengthBytes');
export const getZkLoginUserKeyClaimValueHashPrefixLengthBytes = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashPrefixLengthBytes');
export const getZkLoginUserKeyClaimNameHashSuffixLengthBytes = () => throwNotImplemented('getZkLoginUserKeyClaimNameHashSuffixLengthBytes');
export const getZkLoginUserKeyClaimValueHashSuffixLengthBytes = () => throwNotImplemented('getZkLoginUserKeyClaimValueHashSuffixLengthBytes');

// 默认导出
export default {
  zkLogin,
  poseidon,
  getZkLoginSignature,
  getZkLoginUserSignature,
  getZkLoginUserAddress,
  getZkLoginUserSalt,
  getZkLoginUserKeyClaim,
  getZkLoginUserKeyClaimName,
  getZkLoginUserKeyClaimValue,
  getZkLoginUserKeyClaimNameHash,
  getZkLoginUserKeyClaimValueHash,
  getZkLoginUserKeyClaimNameHashPrefix,
  getZkLoginUserKeyClaimValueHashPrefix,
  getZkLoginUserKeyClaimNameHashSuffix,
  getZkLoginUserKeyClaimValueHashSuffix,
  getZkLoginUserKeyClaimNameHashPrefixLength,
  getZkLoginUserKeyClaimValueHashPrefixLength,
  getZkLoginUserKeyClaimNameHashSuffixLength,
  getZkLoginUserKeyClaimValueHashSuffixLength,
  getZkLoginUserKeyClaimNameHashPrefixLengthBytes,
  getZkLoginUserKeyClaimValueHashPrefixLengthBytes,
  getZkLoginUserKeyClaimNameHashSuffixLengthBytes,
  getZkLoginUserKeyClaimValueHashSuffixLengthBytes
};
