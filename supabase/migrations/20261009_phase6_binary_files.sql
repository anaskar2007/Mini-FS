-- MiniFS Phase 6: Binary file support (Supabase Storage integration).
-- Adds two nullable columns to fs_files — existing rows receive NULL (correct for text files).
-- Does NOT drop or alter any existing column, table, index, or policy.

ALTER TABLE public.fs_files
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- ─── Storage RLS ──────────────────────────────────────────────────────────────
-- Object path format: {user_uuid}/{file_uuid}/{original_filename}
-- (storage.foldername(name))[1] is the first path segment = the user UUID.
-- This guarantees ownership without trusting any client-provided ID.

-- INSERT: users may only upload under their own UUID prefix.
CREATE POLICY IF NOT EXISTS "Users upload own files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: users may only read objects under their own UUID prefix.
CREATE POLICY IF NOT EXISTS "Users read own files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: users may update objects under their own UUID prefix.
CREATE POLICY IF NOT EXISTS "Users update own files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: users may delete objects under their own UUID prefix.
CREATE POLICY IF NOT EXISTS "Users delete own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── save_filesystem_snapshot update ──────────────────────────────────────────
-- Replace the stored function to pass through the two new optional columns.
-- The snapshot JSON may contain "mimeType" and "storagePath"; if absent, NULL is used.

CREATE OR REPLACE FUNCTION public.save_filesystem_snapshot(p_snapshot jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  root_id uuid := (p_snapshot->>'rootDirectoryId')::uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF jsonb_typeof(p_snapshot->'directories') <> 'array'
     OR jsonb_typeof(p_snapshot->'files') <> 'array'
     OR jsonb_typeof(p_snapshot->'disk'->'blocks') <> 'array' THEN
    RAISE EXCEPTION 'Invalid MiniFS snapshot';
  END IF;

  DELETE FROM public.fs_files WHERE owner_id = current_user_id;
  DELETE FROM public.fs_virtual_disks WHERE owner_id = current_user_id;
  DELETE FROM public.fs_directories WHERE owner_id = current_user_id;

  INSERT INTO public.fs_directories (id, owner_id, name, parent_id, created_at)
  SELECT (entry->>'id')::uuid, current_user_id, entry->>'name',
    nullif(entry->>'parentId', '')::uuid, (entry->>'createdAt')::timestamptz
  FROM jsonb_array_elements(p_snapshot->'directories') entry;

  IF NOT EXISTS (
    SELECT 1 FROM public.fs_directories
    WHERE id = root_id AND owner_id = current_user_id AND parent_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Snapshot root directory is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fs_directories directory
    LEFT JOIN public.fs_directories parent ON parent.id = directory.parent_id
    WHERE directory.owner_id = current_user_id
      AND directory.parent_id IS NOT NULL
      AND (parent.id IS NULL OR parent.owner_id <> current_user_id)
  ) THEN
    RAISE EXCEPTION 'Snapshot contains an invalid directory parent';
  END IF;

  INSERT INTO public.fs_files (
    id, owner_id, parent_id, name, content, size_bytes, allocation_method,
    data_block_ids, index_block_id, created_at, modified_at,
    mime_type, storage_path
  )
  SELECT
    (entry->>'id')::uuid, current_user_id, (entry->>'parentId')::uuid,
    entry->>'name', coalesce(entry->>'content', ''),
    octet_length(coalesce(entry->>'content', '')),
    entry->>'allocationMethod',
    coalesce(array(SELECT jsonb_array_elements_text(entry->'dataBlockIds')::integer), '{}'),
    nullif(entry->>'indexBlockId', '')::integer,
    (entry->>'createdAt')::timestamptz, (entry->>'modifiedAt')::timestamptz,
    nullif(entry->>'mimeType', ''),
    nullif(entry->>'storagePath', '')
  FROM jsonb_array_elements(p_snapshot->'files') entry;

  IF EXISTS (
    SELECT 1
    FROM public.fs_files file
    JOIN public.fs_directories parent ON parent.id = file.parent_id
    WHERE file.owner_id = current_user_id
      AND parent.owner_id <> current_user_id
  ) THEN
    RAISE EXCEPTION 'Snapshot contains an invalid file parent';
  END IF;

  INSERT INTO public.fs_virtual_disks (
    owner_id, root_directory_id, default_allocation_method, total_blocks,
    block_size_bytes, blocks, updated_at
  ) VALUES (
    current_user_id, root_id, p_snapshot->>'defaultAllocationMethod',
    (p_snapshot->'disk'->>'totalBlocks')::integer,
    (p_snapshot->'disk'->>'blockSizeBytes')::integer,
    p_snapshot->'disk'->'blocks', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_filesystem_snapshot(jsonb) TO authenticated;
