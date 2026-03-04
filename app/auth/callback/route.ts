import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Ensure https://on-site-d.vercel.app/auth/callback is in Supabase
// → Authentication → URL Configuration → Redirect URLs

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/admin";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  if (token_hash && type === "recovery") {
    // Handle recovery token (Supabase recovery emails send token_hash + type, not code)
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "recovery",
    });
    if (!error) {
      return NextResponse.redirect(
        new URL("/auth/reset-password", requestUrl.origin)
      );
    }
  }

  if (code) {
    // Handle OAuth / PKCE code exchange
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safeNext = next.startsWith("/") ? next : "/admin";
      return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/admin", requestUrl.origin));
}
