import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // Copy AI API key from signup metadata to user_ai_settings table
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.ai_api_key) {
        await supabase.from("user_ai_settings").upsert(
          {
            user_id: user.id,
            ai_api_key: user.user_metadata.ai_api_key,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        await supabase.auth.updateUser({
          data: { ai_api_key: null },
        });
      }
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
