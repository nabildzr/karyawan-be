import * as argon2 from "argon2";

// & ============ Password Hashing dengan Argon2 ============

/**
 * Hash password menggunakan Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB // jumlah memori yang digunakan untuk hashing, semakin besar semakin aman tapi juga lebih lambat
    timeCost: 3, // jumlah iterasi hashing, semakin banyak semakin aman tapi juga lebih lambat
    parallelism: 4, // jumlah thread paralel yang digunakan untuk hashing, semakin banyak semakin cepat tapi juga lebih berat untuk server
  });
}

/**
 * Verifikasi password dengan hash yang tersimpan
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
