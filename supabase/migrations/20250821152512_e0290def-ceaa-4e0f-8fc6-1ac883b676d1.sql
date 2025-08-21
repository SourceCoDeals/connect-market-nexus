-- Add foreign key constraint for admin_id in user_notes table
ALTER TABLE public.user_notes 
ADD CONSTRAINT user_notes_admin_id_fkey 
FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Also add foreign key constraint for user_id in user_notes table  
ALTER TABLE public.user_notes 
ADD CONSTRAINT user_notes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;