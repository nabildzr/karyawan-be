// * File ini menangani validasi bisnis untuk module auth.

import { AuthRepository } from "../repository";

// & Placeholder validation to mark repository abstraction usage.
// % Placeholder validasi untuk menandai penggunaan abstraction repository.
export function validateAuthRequest() {
  return Boolean(AuthRepository.getClient());
}
