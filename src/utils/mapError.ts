// * File utility: mapError.ts
// & This utility maps service error prefixes into HTTP status and API payload.
// % Utilitas ini memetakan prefix error service ke status HTTP dan payload API.
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { errorResponse } from "./response_helper";

// & Map normalized error messages to HTTP status code and response body.
// % Petakan pesan error ternormalisasi ke kode status HTTP dan body response.
export const mapError = (error: any, set: any) => {
  // & Use message prefix convention from service layer exceptions.
  // % Gunakan konvensi prefix pesan dari exception di layer service.
  const msg: string = error.message ?? "";
  if (msg.startsWith("Bad Request"))
    set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
  else if (msg.startsWith("Not Found"))
    set.status = HttpStatusEnum.HTTP_404_NOT_FOUND;
  else if (msg.startsWith("Conflict"))
    set.status = HttpStatusEnum.HTTP_409_CONFLICT;
  else if (msg.startsWith("Forbidden"))
    set.status = HttpStatusEnum.HTTP_403_FORBIDDEN;
  else set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;

  console.error("Error :", error);

  // & Return right-side message fragment if available, else fallback text.
  // % Kembalikan fragmen pesan sisi kanan jika ada, jika tidak pakai fallback.
  return errorResponse(
    msg.split(": ")[1] || "Terjadi kesalahan internal server.",
  );
};
