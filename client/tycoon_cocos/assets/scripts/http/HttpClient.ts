/**
 * HTTP客户端
 *
 * 基于XMLHttpRequest的HTTP请求封装，支持GET/POST/PUT方法
 * 用于与Cloudflare Workers API进行通信
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

export interface RequestOptions {
    headers?: Record<string, string>;
    timeout?: number;
}

export interface HttpClientOptions {
    baseUrl: string;
    timeout?: number;
}

/**
 * HTTP客户端类
 * 使用XMLHttpRequest实现，Cocos Creator原生支持
 */
export class HttpClient {
    private baseUrl: string;
    private timeout: number;

    constructor(options: HttpClientOptions) {
        this.baseUrl = options.baseUrl;
        this.timeout = options.timeout || 30000;  // 默认30秒超时
    }

    /**
     * GET请求
     */
    public async get<T>(path: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('GET', path, undefined, options);
    }

    /**
     * POST请求
     */
    public async post<T>(path: string, data: any, options?: RequestOptions): Promise<T> {
        return this.request<T>('POST', path, data, options);
    }

    /**
     * PUT请求
     */
    public async put<T>(path: string, data: any, options?: RequestOptions): Promise<T> {
        return this.request<T>('PUT', path, data, options);
    }

    /**
     * DELETE请求
     */
    public async delete<T>(path: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('DELETE', path, undefined, options);
    }

    /**
     * 通用请求方法
     */
    private request<T>(
        method: string,
        path: string,
        data?: any,
        options?: RequestOptions
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // 构建完整URL
            const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

            xhr.open(method, url, true);
            xhr.timeout = options?.timeout || this.timeout;

            // 设置Content-Type
            xhr.setRequestHeader('Content-Type', 'application/json');

            // 添加自定义headers
            if (options?.headers) {
                Object.entries(options.headers).forEach(([key, value]) => {
                    xhr.setRequestHeader(key, value);
                });
            }

            // 成功回调
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${xhr.responseText}`));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };

            // 错误回调
            xhr.onerror = () => {
                reject(new Error('Network error'));
            };

            // 超时回调
            xhr.ontimeout = () => {
                reject(new Error(`Request timeout after ${xhr.timeout}ms`));
            };

            // 发送请求
            if (data) {
                xhr.send(JSON.stringify(data));
            } else {
                xhr.send();
            }
        });
    }

    /**
     * 设置基础URL
     */
    public setBaseUrl(baseUrl: string): void {
        this.baseUrl = baseUrl;
    }

    /**
     * 设置默认超时时间
     */
    public setTimeout(timeout: number): void {
        this.timeout = timeout;
    }

    /**
     * 获取基础URL
     */
    public getBaseUrl(): string {
        return this.baseUrl;
    }
}
