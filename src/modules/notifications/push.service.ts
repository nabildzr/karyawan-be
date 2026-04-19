import webpush from "web-push";

// Konfigurasi Web Push menggunakan VAPID keys dari environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:nabildzikrika@gmail.com",
    vapidPublicKey,
    vapidPrivateKey,
  );
} else {
  console.warn("⚠️  VAPID keys not set in .env. Web Push notifications will not work.");
}

export class PushService {
  static async sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: {
      title: string;
      body: string;
      icon?: string;
      url?: string;
      tag?: string;
    },
  ) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("VAPID keys not configured, skipping push notification.");
      return false;
    }

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/favicon.png",
          url: payload.url || "/karyawan/notifikasi",
          tag: payload.tag,
        }),
        {
          // TTL 24 jam — jika device offline, server push akan retry selama ini
          TTL: 86400,
        }
      );
      return true;
    } catch (error: any) {
      // 410 Gone = subscription sudah tidak valid (user uninstalled app / revoked)
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.warn("Push subscription expired/gone:", subscription.endpoint);
        return "expired";
      }
      console.error("Error sending push notification:", error.message);
      return false;
    }
  }
}
