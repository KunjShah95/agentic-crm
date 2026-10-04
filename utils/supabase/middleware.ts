import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  /* Constructed for its effect, not for its return value.
     `createServerClient` installs the cookie adapter below, and the auth session
     is refreshed as a side effect of that construction when a token is near
     expiry. Nothing here calls a method on the client — this file exists to
     propagate refreshed cookies onto both the outgoing request and the response,
     which is why it returns `supabaseResponse` rather than the client.

     The previous `const supabase = ...` binding was never read, which is correct
     but reads like a mistake and is flagged as one. */
  createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        /* Mirror onto the *request* so handlers further down this same request
           see the refreshed token, not the stale one. `options` is deliberately
           dropped here: these options carry `path`, `domain` and `sameSite`,
           which describe where the cookie should be written, and
           `request.cookies.set` takes only name and value. Applying them here is
           not possible and passing them through would be wrong. They are applied
           on the response below, which is the write that actually reaches the
           browser. */
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  return supabaseResponse
};
