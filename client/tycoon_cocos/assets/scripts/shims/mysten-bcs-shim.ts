// Shim for @mysten/bcs to avoid BigInt exponent being transpiled to Math.pow
// We override only the bigint integer helpers (u64/u128/u256) with precomputed constants.

import { bcs as baseBcs } from '@mysten/bcs/dist/esm/bcs.js';
import { bigUIntBcsType } from '@mysten/bcs/dist/esm/bcs-type.js';

// Re-export everything else from the official ESM entry so consumers like
// @mysten/sui/bcs can import from '@mysten/bcs' normally.
export {
  BcsEnum,
  BcsReader,
  BcsStruct,
  BcsTuple,
  BcsType,
  BcsWriter,
  SerializedBcs,
  decodeStr,
  encodeStr,
  splitGenericParameters,
  toB58,
  fromB58,
  toB64,
  fromB64,
  toBase58,
  fromBase58,
  toBase64,
  fromBase64,
  toHEX,
  fromHEX,
  toHex,
  fromHex,
  isSerializedBcs,
} from '@mysten/bcs/dist/esm/index.js';

// Precomputed BigInt maxima to avoid using the ** operator at runtime
// 2^64 - 1
const U64_MAX = 18446744073709551615n;
// 2^128 - 1
const U128_MAX = 340282366920938463463374607431768211455n;
// 2^256 - 1
const U256_MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

export const bcs = {
  ...baseBcs,
  u64(options?: { name?: string; validate?: (v: unknown) => void }) {
    return bigUIntBcsType({
      readMethod: 'read64',
      writeMethod: 'write64',
      size: 8,
      maxValue: U64_MAX,
      ...(options || {}),
      name: options?.name ?? 'u64',
    });
  },
  u128(options?: { name?: string; validate?: (v: unknown) => void }) {
    return bigUIntBcsType({
      readMethod: 'read128',
      writeMethod: 'write128',
      size: 16,
      maxValue: U128_MAX,
      ...(options || {}),
      name: options?.name ?? 'u128',
    });
  },
  u256(options?: { name?: string; validate?: (v: unknown) => void }) {
    return bigUIntBcsType({
      readMethod: 'read256',
      writeMethod: 'write256',
      size: 32,
      maxValue: U256_MAX,
      ...(options || {}),
      name: options?.name ?? 'u256',
    });
  },
};

