-- Foto dei progressi su Supabase Storage.
--
-- Bucket privato: le immagini non sono pubbliche, il client le mostra con
-- URL firmati (scadenza oraria, rigenerati a ogni caricamento della
-- schermata). `progress_photos.photo_url` conserva il **percorso** dentro il
-- bucket (es. "<user-id>/2026-09-30-…​.jpg"): il backend non ha bisogno di
-- credenziali storage e le righe restano valide anche quando un URL firmato
-- scade.
--
-- Il blocco è difensivo: lo schema `storage` esiste nei database Supabase,
-- ma non nel database shadow che Prisma crea per `migrate dev`, dove senza
-- questo controllo la migrazione fallirebbe.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage.buckets assente: bucket "progress-photos" non creato';
    RETURN;
  END IF;

  EXECUTE $sql$
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'progress-photos',
      'progress-photos',
      FALSE,
      10485760, -- 10 MB
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO NOTHING
  $sql$;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'progress_photos_insert'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "progress_photos_insert" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'progress-photos' AND owner = auth.uid())
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'progress_photos_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "progress_photos_select" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'progress-photos' AND owner = auth.uid())
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'progress_photos_delete'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "progress_photos_delete" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'progress-photos' AND owner = auth.uid())
    $sql$;
  END IF;
END $$;
