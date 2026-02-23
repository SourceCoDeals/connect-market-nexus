
-- OAuth token storage for PhoneBurner (per-user tokens)
CREATE TABLE public.phoneburner_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.phoneburner_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only the token owner can read their own tokens
CREATE POLICY "Users can read own OAuth tokens"
ON public.phoneburner_oauth_tokens FOR SELECT
USING (auth.uid() = user_id);

-- Only admins can insert/update tokens (via edge functions with service role)
CREATE POLICY "Service role manages OAuth tokens"
ON public.phoneburner_oauth_tokens FOR ALL
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_phoneburner_oauth_tokens_updated_at
BEFORE UPDATE ON public.phoneburner_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
