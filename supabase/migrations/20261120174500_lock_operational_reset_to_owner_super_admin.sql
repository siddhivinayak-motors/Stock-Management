CREATE OR REPLACE FUNCTION public.svm_operational_reset(p_selection jsonb, p_execute boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_uid uuid:=auth.uid(); v_owner uuid:='236565a9-1892-41ee-b54a-c81bde3b9b01';
 v_key text; v_allowed text[]:=ARRAY['personal.stock','personal.holds','personal.quotations','personal.price_list','personal.excel_upload','ev.stock','ev.holds','ev.quotations','ev.price_list','ev.excel_upload','commercial.stock','commercial.holds','commercial.quotations','commercial.price_list','commercial.excel_upload','llm.stock','llm.holds','llm.quotations','llm.price_list','llm.excel_upload','workspace.price_list_imports','workspace.common_excel_upload','workspace.audit_history','workspace.retail_reports'];
 v_dept text; v_counts jsonb:='{}'::jsonb; v_total bigint:=0; v_n bigint; v_email text; v_designation text;
BEGIN
 IF v_uid IS NULL OR v_uid<>v_owner OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=v_owner AND p.is_super_admin IS TRUE AND lower(coalesce(p.status,''))='active') THEN
  RAISE EXCEPTION 'Operational reset is restricted to the designated active Super Admin account.';
 END IF;
 IF jsonb_typeof(p_selection)<>'array' OR jsonb_array_length(p_selection)=0 THEN RAISE EXCEPTION 'Select at least one reset option.'; END IF;
 FOR v_key IN SELECT DISTINCT jsonb_array_elements_text(p_selection) LOOP IF NOT(v_key=ANY(v_allowed)) THEN RAISE EXCEPTION 'Invalid reset option: %',v_key; END IF; END LOOP;
 SELECT email,designation INTO v_email,v_designation FROM public.profiles WHERE user_id=v_owner;
 FOR v_key IN SELECT DISTINCT jsonb_array_elements_text(p_selection) LOOP
  v_dept:=CASE split_part(v_key,'.',1) WHEN 'personal' THEN 'Personal' WHEN 'ev' THEN 'EV' WHEN 'commercial' THEN 'Commercial' WHEN 'llm' THEN 'LLM' ELSE NULL END; v_n:=0;
  CASE
   WHEN split_part(v_key,'.',2)='stock' AND v_dept IS NOT NULL THEN SELECT count(*) INTO v_n FROM public.vehicles WHERE department=v_dept; IF p_execute THEN DELETE FROM public.vehicles WHERE department=v_dept; END IF;
   WHEN split_part(v_key,'.',2)='holds' AND v_dept IS NOT NULL THEN SELECT count(*) INTO v_n FROM public.stock_holds WHERE department=v_dept; IF p_execute THEN DELETE FROM public.stock_holds WHERE department=v_dept; END IF;
   WHEN split_part(v_key,'.',2)='quotations' AND v_dept IS NOT NULL THEN SELECT count(*) INTO v_n FROM public.quotations WHERE department=v_dept; IF p_execute THEN DELETE FROM public.quotations WHERE department=v_dept; END IF;
   WHEN split_part(v_key,'.',2)='price_list' AND v_dept IS NOT NULL THEN SELECT count(*) INTO v_n FROM public.price_list_versions WHERE department=v_dept; IF p_execute THEN DELETE FROM public.price_list_import_batches WHERE department=v_dept; DELETE FROM public.price_list_versions WHERE department=v_dept; END IF;
   WHEN split_part(v_key,'.',2)='excel_upload' AND v_dept IS NOT NULL THEN SELECT (SELECT count(*) FROM public.stock_import_batches WHERE department=v_dept)+(SELECT count(*) FROM public.vehicles WHERE department=v_dept AND source='standard_stock_report') INTO v_n; IF p_execute THEN DELETE FROM public.vehicles WHERE department=v_dept AND source='standard_stock_report'; DELETE FROM public.stock_import_batches WHERE department=v_dept; END IF;
   WHEN v_key='workspace.price_list_imports' THEN SELECT count(*) INTO v_n FROM public.price_list_import_batches; IF p_execute THEN DELETE FROM public.price_list_import_batches; END IF;
   WHEN v_key='workspace.common_excel_upload' THEN SELECT (SELECT count(*) FROM public.stock_import_batches)+(SELECT count(*) FROM public.vehicles WHERE source='standard_stock_report') INTO v_n; IF p_execute THEN DELETE FROM public.vehicles WHERE source='standard_stock_report'; DELETE FROM public.stock_import_batches; END IF;
   WHEN v_key='workspace.audit_history' THEN SELECT count(*) INTO v_n FROM public.audit_logs; IF p_execute THEN DELETE FROM public.audit_logs; END IF;
   WHEN v_key='workspace.retail_reports' THEN v_n:=0;
   ELSE RAISE EXCEPTION 'Unsupported reset option: %',v_key;
  END CASE;
  v_counts:=v_counts||jsonb_build_object(v_key,v_n); v_total:=v_total+v_n;
 END LOOP;
 IF p_execute THEN INSERT INTO public.audit_logs(actor_id,actor_email,actor_designation,module,action,action_label,record_type,details) VALUES(v_uid,v_email,v_designation,'backup_restore'::app_module,'delete'::app_action,'Operational reset executed','operational_reset',jsonb_build_object('selection',p_selection,'deleted_record_count',v_total,'employee_management_excluded',true,'restricted_owner_uid',v_owner)); END IF;
 RETURN jsonb_build_object('executed',p_execute,'counts',v_counts,'total_rows',v_total,'employee_management_excluded',true,'authorized_owner_uid',v_owner);
END; $$;
REVOKE ALL ON FUNCTION public.svm_operational_reset(jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.svm_operational_reset(jsonb,boolean) TO authenticated;