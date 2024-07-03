
class BitError extends Error {
    constructor(message) {
        super(message);
        this.name = "BitError";
    }
}

const bittaps = {
    2: [1], 3: [2], 4: [3], 5: [2], 6: [5], 7: [6], 8: [4, 5, 6],
    9: [5], 10: [7], 11: [9], 12: [6, 8, 11], 13: [4, 12], 14: [5, 13],
    15: [14], 16: [4, 13, 15]
};

function lfsr(taps, buf) {
    let nbits = buf.length;
    let sr = buf.slice(); // clone array
    let out = [];
    for (let i = 0; i < (1 << nbits) - 1; i++) {
        let feedback = sr[0];
        out.push(feedback ? 1 : 0);
        taps.forEach(t => {
            feedback ^= sr[t];
        });
        sr.push(feedback);
        sr.shift();
    }
    return out;
}

function mls(n, seed = null) {
    if (!(n in bittaps)) {
        throw new BitError(`taps for ${n} bits unknown`);
    }
    let taps = bittaps[n];
    if (seed === null) {
        seed = Array(n).fill(1);
    } else if (seed.length !== n) {
        throw new BitError(`length of seed must equal ${n}`);
    }
    return lfsr(taps, seed);
}

export function generateMLS(nbits) {
    nbits = parseInt(nbits);
    let m = mls(nbits);
    // nbits = 65535
    return m
}
