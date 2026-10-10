-- Phase 7: Account Deletion Function
-- Allows an authenticated user to securely delete their own account.

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void AS $$
BEGIN
  -- Delete the user's filesystem state (cascades or cleans up tables).
  DELETE FROM public.fs_state WHERE user_id = auth.uid();
  
  -- Note: Supabase Storage objects cannot be easily deleted from plpgsql without pg_net.
  -- We rely on the Next.js Server Action to clean up Storage files before calling this.

  -- Delete the user from auth.users (this requires postgres role which owns the function)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
