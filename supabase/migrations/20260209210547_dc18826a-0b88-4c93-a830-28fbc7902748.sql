ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'buyer';

UPDATE public.profiles SET role = 'buyer' WHERE role IS NULL;