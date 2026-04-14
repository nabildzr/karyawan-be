// * File ini menangani validasi bisnis untuk module rbac.

import { RbacRepository } from "../repository";

// & Placeholder validation to mark repository abstraction usage.
// % Placeholder validasi untuk menandai penggunaan abstraction repository.
export function validateRbacRequest() {
  return Boolean(RbacRepository.getClient());
}
