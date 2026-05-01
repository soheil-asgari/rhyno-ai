export const config = {
  runtime: 'edge', // سبک‌ترین و نامرئی‌ترین حالت ورسل
};

// ۱. آدرس مقصد را اینجا ننویس؛ در پنل ورسل به صورت Environment Variable ست کن.
const TARGET_DOMAIN = process.env.TARGET_DOMAIN?.replace(/\/$/, "");
const AUTH_KEY = process.env.PROXY_AUTH_KEY;

export default async function handler(req) {
  if (!TARGET_DOMAIN) return new Response(null, { status: 404 });

  // ۲. سد امنیتی: اگر کسی آدرس شما را پیدا کند، بدون کلید نمی‌تواند از آن استفاده کند.
  // این کار باعث می‌شود ترافیک "غریبه" و ربات‌های اسکنر باعث لو رفتن شما نشوند.
  const url = new URL(req.url);
  if (AUTH_KEY && url.searchParams.get("key") !== AUTH_KEY) {
    return new Response(null, { status: 404 }); // نمایش خطای ۴۰۴ برای گمراهی
  }

  try {
    // ۳. پاکسازی کامل ردپای ورسل (Deep Scrubbing)
    const newHeaders = new Headers();
    const forbidden = [
      "x-", "cf-", "forwarded", "via", "host", "connection", "referer"
    ];

    req.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      // حذف هر چیزی که با x- یا cf- شروع شود یا در لیست سیاه باشد
      if (!forbidden.some(prefix => k.startsWith(prefix))) {
        newHeaders.set(k, value);
      }
    });

    // ۴. هویت جعلی (Identity Spoofing)
    newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    newHeaders.set("Accept-Language", "en-US,en;q=0.9");
    newHeaders.set("Cache-Control", "no-cache");

    const finalUrl = `${TARGET_DOMAIN}${url.pathname}${url.search}`;

    // ۵. ارسال درخواست با استفاده از Fetch استاندارد Edge
    const response = await fetch(finalUrl, {
      method: req.method,
      headers: newHeaders,
      body: req.body,
      redirect: "manual", // جلوگیری از دنبال کردن خودکار ریدایرکت‌ها برای پنهان ماندن
      duplex: "half"
    });

    // ۶. شستشوی هدرهای بازگشتی
    const cleanResponseHeaders = new Headers(response.headers);
    const hideFromClient = ["server", "x-powered-by", "set-cookie", "access-control-allow-origin"];
    hideFromClient.forEach(h => cleanResponseHeaders.delete(h));

    // اضافه کردن هدرهای امنیتی برای مرورگر خودتان
    cleanResponseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      headers: cleanResponseHeaders,
    });

  } catch (e) {
    // حتی در خطا هم اطلاعاتی لو نمی‌دهیم
    return new Response(null, { status: 500 });
  }
}