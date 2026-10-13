-- Mutant m03-admin-signout-ends-nothing: an admin's sign-out of a person ends no device
CREATE OR REPLACE FUNCTION core.person_sign_out(p_person uuid, p_device uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require_capability('org.sign_out');
begin
  return 1;
end
$function$
;
