// * File shared attendances: timezone.ts
// & This utility formats clock values according to target timezone.
// % Utilitas ini memformat nilai jam sesuai timezone tujuan.
// & Format Date value to HH:mm in Indonesian locale using provided timezone.
// % Format nilai Date ke HH:mm dalam locale Indonesia dengan timezone yang diberikan.
export const formatClockByTimezone = (value: Date, timezone: string) => {
  return value.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
};