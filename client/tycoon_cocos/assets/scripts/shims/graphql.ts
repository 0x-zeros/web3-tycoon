/**
 * GraphQL Shim
 *
 * 这是一个空壳模块，用于替换 graphql 依赖，避免 Cocos Creator 构建时的 ES 模块兼容性问题。
 *
 * 本项目只使用 @mysten/sui 的 JSON-RPC 功能（client/transactions/keypairs 等），
 * 不需要 GraphQL 功能，因此使用此 shim 来完全绕过 graphql 依赖。
 *
 * 如果有代码意外调用了 GraphQL 函数，会抛出明确的错误信息，便于调试。
 */

// ============ 类型定义 ============

export type DocumentNode = unknown;
export type GraphQLSchema = unknown;
export type GraphQLType = unknown;
// 注意：避免与下方类同名的类型别名，防止重复声明错误
export type GraphQLFieldConfig<TSource, TContext, TArgs = any> = unknown;
export type GraphQLResolveInfo = unknown;
// 注意：避免与下方类同名的类型别名，防止重复声明错误

// ============ 常用函数（抛出错误） ============

export const parse = (..._args: any[]): never => {
  throw new Error('[shim/graphql] parse() was called but GraphQL is disabled in this build.');
};

export const print = (..._args: any[]): never => {
  throw new Error('[shim/graphql] print() was called but GraphQL is disabled in this build.');
};

export const execute = (..._args: any[]): never => {
  throw new Error('[shim/graphql] execute() was called but GraphQL is disabled in this build.');
};

export const validate = (..._args: any[]): never => {
  throw new Error('[shim/graphql] validate() was called but GraphQL is disabled in this build.');
};

export const buildSchema = (..._args: any[]): never => {
  throw new Error('[shim/graphql] buildSchema() was called but GraphQL is disabled in this build.');
};

export const graphql = (..._args: any[]): never => {
  throw new Error('[shim/graphql] graphql() was called but GraphQL is disabled in this build.');
};

// ============ 常用常量 ============

export const Kind: any = {};

export const visit = (..._args: any[]): never => {
  throw new Error('[shim/graphql] visit() was called but GraphQL is disabled in this build.');
};

// ============ 类构造器（抛出错误） ============

export class GraphQLError extends Error {
  constructor(..._args: any[]) {
    super('[shim/graphql] GraphQLError is disabled in this build.');
  }
}

export class GraphQLScalarType {
  constructor(..._args: any[]) {
    throw new Error('[shim/graphql] GraphQLScalarType is disabled in this build.');
  }
}

export class GraphQLObjectType {
  constructor(..._args: any[]) {
    throw new Error('[shim/graphql] GraphQLObjectType is disabled in this build.');
  }
}

// ============ 默认导出 ============

const defaultExport = {
  parse,
  print,
  execute,
  validate,
  buildSchema,
  graphql,
  Kind,
  visit,
  GraphQLError,
  GraphQLScalarType,
  GraphQLObjectType
};

export default defaultExport;
