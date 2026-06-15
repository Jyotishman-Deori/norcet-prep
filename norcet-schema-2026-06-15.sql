


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_profile_ids" (
    "profile_id" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text"
);


ALTER TABLE "public"."admin_profile_ids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kv_shared" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."kv_shared" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_profile_ids"
    ADD CONSTRAINT "admin_profile_ids_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."kv_shared"
    ADD CONSTRAINT "kv_shared_pkey" PRIMARY KEY ("key");



ALTER TABLE "public"."admin_profile_ids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_select" ON "public"."admin_profile_ids" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_delete" ON "public"."kv_shared" FOR DELETE TO "anon" USING (true);



CREATE POLICY "anon_insert" ON "public"."kv_shared" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_select" ON "public"."kv_shared" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_update" ON "public"."kv_shared" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."kv_shared" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_profile_ids" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_profile_ids" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_profile_ids" TO "service_role";



GRANT ALL ON TABLE "public"."kv_shared" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."kv_shared" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."kv_shared" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































