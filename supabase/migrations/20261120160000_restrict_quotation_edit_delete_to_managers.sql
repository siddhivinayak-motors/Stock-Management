-- Restrict quotation edit/delete to Manager, General Manager, Admin and Super Admin.
-- Permission grants remain required for the corresponding action.
DROP POLICY IF EXISTS quotations_manager_edit_only ON public.quotations;
CREATE POLICY quotations_manager_edit_only ON public.quotations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.is_super_admin OR p.designation IN ('Manager','General Manager','Admin'))
    )
    AND private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.is_super_admin OR p.designation IN ('Manager','General Manager','Admin'))
    )
    AND private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  );

DROP POLICY IF EXISTS quotations_manager_delete_only ON public.quotations;
CREATE POLICY quotations_manager_delete_only ON public.quotations
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.is_super_admin OR p.designation IN ('Manager','General Manager','Admin'))
    )
    AND private.has_permission('quotation_management'::app_module, 'delete'::app_action)
  );

DROP POLICY IF EXISTS quotation_items_manager_edit_only ON public.quotation_items;
CREATE POLICY quotation_items_manager_edit_only ON public.quotation_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND private.can_access_department(q.department)
        AND (p.is_super_admin OR p.designation IN ('Manager','General Manager','Admin'))
    )
    AND private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND private.can_access_department(q.department)
        AND (p.is_super_admin OR p.designation IN ('Manager','General Manager','Admin'))
    )
    AND private.has_permission('quotation_management'::app_module, 'edit'::app_action)
  );

DROP POLICY IF EXISTS quotation_items_manager_delete_only ON public.quotation_items;
CREATE POLICY quotation_items_manager_delete_only ON public.quotation_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND private.can_access_department(q.department)
        AND (p.is_super_admin OR p.designation IN ('Manager','General Manager','Admin'))
    )
    AND private.has_permission('quotation_management'::app_module, 'delete'::app_action)
  );
