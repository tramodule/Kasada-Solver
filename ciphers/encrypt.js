function encrypt(key, iv, payload) {
    function e(i, m) {
        var p = m * 8;
        return [o(i, p), o(i, p + 4)];
    }
    function t(i, m, _ref) {
        var p = _ref[0]
            , l = _ref[1];
        var a = m * 8;
        i[a] = p >> 24 & 255,
            i[a + 1] = p >> 16 & 255,
            i[a + 2] = p >> 8 & 255,
            i[a + 3] = p & 255,
            i[a + 4] = l >> 24 & 255,
            i[a + 5] = l >> 16 & 255,
            i[a + 6] = l >> 8 & 255,
            i[a + 7] = l & 255;
    }
    function r(i, m) {
        var p = m[0]
            , l = m[1]
            , a = 0
            , g = 2654435769;
        for (var f = 0; f < 32; f += 1)
            p = p + ((l << 4 ^ l >> 5) + l ^ a + i[a & 3]) | 0,
                a = a + g | 0,
                l = l + ((p << 4 ^ p >> 5) + p ^ a + i[a >> 11 & 3]) | 0;
        return [p, l];
    }
    function n(i, _ref2, _ref3, g, f) {
        var m = _ref2[0]
            , p = _ref2[1];
        var l = _ref3[0]
            , a = _ref3[1];
        var h = r(i, [l ^ m, a ^ p]);
        return t(g, f, h),
            h;
    }
    function o(i, m) {
        return i[m] << 24 | i[m + 1] << 16 | i[m + 2] << 8 | i[m + 3] << 0;
    }
    function s(i) {
        if (i.length !== 8)
            throw new Error("iv must be 64-bit");
        return [o(i, 0), o(i, 4)];
    }
    function c(i) {
        if (i.length !== 16)
            throw new Error("key must be 128-bit");
        return [o(i, 0), o(i, 4), o(i, 8), o(i, 12)];
    }
    function u(i, m, p) {
        var l = c(i)
            , a = s(m)
            , g = 5
            , f = []
            , h = Math.ceil(p.length / 8)
            , _ = 0
            , b = 0
            , C = []
            , d = n(l, [0, 0], a, C, b++);
        for (f.push([0, p.length]); f.length < g && _ < h; )
            f.push(e(p, _++));
        var R = 0;
        for (; f.length > 0; ) {
            R = (R + d[0]) % f.length,
            R < 0 && (R += f.length);
            var M = f[R];
            d = n(l, d, M, C, b++),
                _ < h ? f[R] = e(p, _++) : f.splice(R, 1);
        }
        return C;
    }
    return u(key, iv, payload);
}


export default encrypt;