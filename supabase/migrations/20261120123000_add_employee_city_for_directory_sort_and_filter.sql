ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_city_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_city_check
  CHECK (city IS NULL OR city IN ('Bhavnagar','Amreli','Botad','Rajula'));

CREATE INDEX IF NOT EXISTS profiles_city_designation_active_idx
  ON public.profiles (city, designation)
  WHERE deleted_at IS NULL;
