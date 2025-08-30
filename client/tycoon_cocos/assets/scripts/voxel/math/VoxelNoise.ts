export class VoxelNoise {
    private static readonly SIMPLEX_SKEW_FACTOR_2D = 0.5 * (Math.sqrt(3.0) - 1.0);
    private static readonly SIMPLEX_UNSKEW_FACTOR_2D = (3.0 - Math.sqrt(3.0)) / 6.0;
    private static readonly SIMPLEX_SKEW_FACTOR_3D = 1.0 / 3.0;
    private static readonly SIMPLEX_UNSKEW_FACTOR_3D = 1.0 / 6.0;

    private static readonly GRAD3 = [
        [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
        [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
        [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    private static readonly P = [
        151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
        140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
        247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
        57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
        74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
        60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
        65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
        200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
        52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
        207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
        119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
        129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
        218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
        81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
        184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
        222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
    ];

    private static perm: number[] = new Array(512);
    private static permMod12: number[] = new Array(512);

    static {
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.P[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    private static fastFloor(x: number): number {
        const xi = Math.floor(x);
        return x < xi ? xi - 1 : xi;
    }

    private static dot2(g: number[], x: number, y: number): number {
        return g[0] * x + g[1] * y;
    }

    private static dot3(g: number[], x: number, y: number, z: number): number {
        return g[0] * x + g[1] * y + g[2] * z;
    }

    static simplex2(x: number, y: number, octaves: number, persistence: number, lacunarity: number): number {
        let amplitude = 1.0;
        let frequency = 1.0;
        let maxValue = 0.0;
        let sum = 0.0;

        for (let i = 0; i < octaves; i++) {
            sum += this.rawSimplex2(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return sum / maxValue;
    }

    private static rawSimplex2(xin: number, yin: number): number {
        let n0: number, n1: number, n2: number;

        const s = (xin + yin) * this.SIMPLEX_SKEW_FACTOR_2D;
        const i = this.fastFloor(xin + s);
        const j = this.fastFloor(yin + s);
        const t = (i + j) * this.SIMPLEX_UNSKEW_FACTOR_2D;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        let i1: number, j1: number;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }

        const x1 = x0 - i1 + this.SIMPLEX_UNSKEW_FACTOR_2D;
        const y1 = y0 - j1 + this.SIMPLEX_UNSKEW_FACTOR_2D;
        const x2 = x0 - 1.0 + 2.0 * this.SIMPLEX_UNSKEW_FACTOR_2D;
        const y2 = y0 - 1.0 + 2.0 * this.SIMPLEX_UNSKEW_FACTOR_2D;

        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.permMod12[ii + this.perm[jj]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot2(this.GRAD3[gi0], x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot2(this.GRAD3[gi1], x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot2(this.GRAD3[gi2], x2, y2);
        }

        return 70.0 * (n0 + n1 + n2);
    }

    static simplex3(x: number, y: number, z: number, octaves: number, persistence: number, lacunarity: number): number {
        let amplitude = 1.0;
        let frequency = 1.0;
        let maxValue = 0.0;
        let sum = 0.0;

        for (let i = 0; i < octaves; i++) {
            sum += this.rawSimplex3(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return sum / maxValue;
    }

    private static rawSimplex3(xin: number, yin: number, zin: number): number {
        let n0: number, n1: number, n2: number, n3: number;

        const s = (xin + yin + zin) * this.SIMPLEX_SKEW_FACTOR_3D;
        const i = this.fastFloor(xin + s);
        const j = this.fastFloor(yin + s);
        const k = this.fastFloor(zin + s);
        const t = (i + j + k) * this.SIMPLEX_UNSKEW_FACTOR_3D;
        const X0 = i - t;
        const Y0 = j - t;
        const Z0 = k - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        const z0 = zin - Z0;

        let i1: number, j1: number, k1: number;
        let i2: number, j2: number, k2: number;

        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
            } else {
                i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
            }
        } else {
            if (y0 < z0) {
                i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
            } else if (x0 < z0) {
                i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
            } else {
                i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            }
        }

        const x1 = x0 - i1 + this.SIMPLEX_UNSKEW_FACTOR_3D;
        const y1 = y0 - j1 + this.SIMPLEX_UNSKEW_FACTOR_3D;
        const z1 = z0 - k1 + this.SIMPLEX_UNSKEW_FACTOR_3D;
        const x2 = x0 - i2 + 2.0 * this.SIMPLEX_UNSKEW_FACTOR_3D;
        const y2 = y0 - j2 + 2.0 * this.SIMPLEX_UNSKEW_FACTOR_3D;
        const z2 = z0 - k2 + 2.0 * this.SIMPLEX_UNSKEW_FACTOR_3D;
        const x3 = x0 - 1.0 + 3.0 * this.SIMPLEX_UNSKEW_FACTOR_3D;
        const y3 = y0 - 1.0 + 3.0 * this.SIMPLEX_UNSKEW_FACTOR_3D;
        const z3 = z0 - 1.0 + 3.0 * this.SIMPLEX_UNSKEW_FACTOR_3D;

        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
        const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
        const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot3(this.GRAD3[gi0], x0, y0, z0);
        }

        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot3(this.GRAD3[gi1], x1, y1, z1);
        }

        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot3(this.GRAD3[gi2], x2, y2, z2);
        }

        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) {
            n3 = 0.0;
        } else {
            t3 *= t3;
            n3 = t3 * t3 * this.dot3(this.GRAD3[gi3], x3, y3, z3);
        }

        return 32.0 * (n0 + n1 + n2 + n3);
    }

    static noise2(x: number, y: number): number {
        return this.rawSimplex2(x, y);
    }

    static noise3(x: number, y: number, z: number): number {
        return this.rawSimplex3(x, y, z);
    }
}