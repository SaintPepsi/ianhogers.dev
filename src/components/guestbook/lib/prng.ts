export function createPRNG(seed: number) {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(max: number): number {
      return Math.floor(this.next() * max);
    },
    nextFloat(min: number, max: number): number {
      return min + this.next() * (max - min);
    }
  };
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}
