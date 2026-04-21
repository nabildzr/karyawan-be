// Regex validasi pasangan koordinat "lat, lon":
// - Latitude : -90.0000000 s/d 90.0000000 (lintang bumi, sumbu Y)
// - Longitude: -180.0000000 s/d 180.0000000 (bujur bumi, sumbu X)
// - Presisi desimal hingga 10 digit untuk akurasi ~1 mm
export const COORDINATE_REGEX =
  /^-?([0-8]?[0-9]|90)(\.[0-9]{1,10})?,\s*-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]{1,10})?$/;