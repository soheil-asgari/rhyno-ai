export const config = {
  runtime: 'edge', // استفاده از محیط Edge برای پنهان ماندن بیشتر
};

const TARGET_DOMAIN = process.env.TARGET_DOMAIN?.replace(/\/$/, "");

export default async function handler(req) {
  // اگر دامین هدف تنظیم نشده باشد، چیزی نشان نمی‌دهیم
  if (!TARGET_DOMAIN) return new Response(null, { status: 404 });

  try {
    const url = new URL(req.url);
    const finalUrl = `${TARGET_DOMAIN}${url.pathname}${url.search}`;

    const newHeaders = new Headers();
    const forbidden = [
      "x-", "cf-", "forwarded", "via", "host", "connection"
    ];

    // پاکسازی هدرهای مشکوک
    req.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (!forbidden.some(prefix => k.startsWith(prefix))) {
        newHeaders.set(k, value);
      }
    });

    // جعل هویت مرورگر
    newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    newHeaders.set("Accept-Language", "en-US,en;q=0.9");

    const response = await fetch(finalUrl, {
      method: req.method,
      headers: newHeaders,
      body: req.body,
      redirect: "manual",
      duplex: "half"
    });

    // تمیزکاری هدرهای برگشتی از مقصد
    const cleanResponseHeaders = new Headers(response.headers);
    ["server", "x-powered-by", "set-cookie"].forEach(h => cleanResponseHeaders.delete(h));
    
    cleanResponseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      headers: cleanResponseHeaders,
    });

  } catch (e) {
    return new Response(null, { status: 500 });
  }
}
