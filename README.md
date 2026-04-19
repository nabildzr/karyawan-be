# Attendance App with Elysia.js Backend

by @nabildzr

## SMTP Config for Forgot Password Email

Flow `POST /v1/auth/send-code` dan `POST /v1/auth/forgot-password` akan mengirim:
- Kode verifikasi reset password
- Link reset password

Set environment variable berikut di file `.env` backend:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM_EMAIL=no-reply@example.com
SMTP_FROM_NAME=Portal Karyawan

# Optional, untuk menyusun link reset absolut
WEB_BASE_URL=http://localhost:5173
```

Catatan:
- Jika `SMTP_HOST` tidak terisi, sistem akan skip pengiriman email.
- Pada mode non-production, response forgot password tetap menyertakan `verificationCode` dan `resetToken` untuk membantu testing.
