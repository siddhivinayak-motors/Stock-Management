-- Pratik Badheka is the Personal Department Manager; remove the unintended EV assignment.
update public.profiles
set department='Personal',
    department_access=array['Personal']::text[],
    updated_at=now()
where user_id='64a4977d-32ba-444f-a36f-22bdcfd41f4c'
  and lower(email)='sales.b@siddhivinayakmotors.com'
  and designation='Manager'
  and status='active';
