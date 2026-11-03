// LUMI storage adapter: one small interface for private files, so deliverables can move from Supabase Storage to
// Cloudflare R2 (or any S3-compatible store) later without touching scan-file / get-download logic.
// Which store a file lives in is recorded per row in product_files.store ('supabase' today, 'r2' later).
// R2 is only used when a row says store = 'r2' AND these secrets are set on the edge functions:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY   (bucket names stay the same: quarantine / deliverables)
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

export interface FileStore {
  download(bucket: string, path: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | null>
  upload(bucket: string, path: string, bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<boolean>
  remove(bucket: string, path: string): Promise<void>
  signedUrl(bucket: string, path: string, ttlSeconds: number, downloadName: string): Promise<string | null>
}

export function supabaseStore(admin: SupabaseClient): FileStore {
  return {
    async download(bucket, path) {
      const { data, error } = await admin.storage.from(bucket).download(path)
      if (error || !data) return null
      return { bytes: new Uint8Array(await data.arrayBuffer()), type: data.type || 'application/octet-stream' }
    },
    async upload(bucket, path, bytes, contentType) {
      const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType, upsert: true })
      return !error
    },
    async remove(bucket, path) { await admin.storage.from(bucket).remove([path]) },
    async signedUrl(bucket, path, ttl, name) {
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, ttl, { download: name })
      return error || !data ? null : data.signedUrl
    },
  }
}

export function r2Store(): FileStore {
  const account = Deno.env.get('R2_ACCOUNT_ID'), key = Deno.env.get('R2_ACCESS_KEY_ID'), secret = Deno.env.get('R2_SECRET_ACCESS_KEY')
  if (!account || !key || !secret) throw new Error('R2 is not configured')
  const aws = new AwsClient({ accessKeyId: key, secretAccessKey: secret, service: 's3', region: 'auto' })
  const base = `https://${account}.r2.cloudflarestorage.com`
  const u = (bucket: string, path: string) => `${base}/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
  return {
    async download(bucket, path) {
      const r = await aws.fetch(u(bucket, path))
      if (!r.ok) return null
      return { bytes: new Uint8Array(await r.arrayBuffer()), type: r.headers.get('content-type') || 'application/octet-stream' }
    },
    async upload(bucket, path, bytes, contentType) {
      const r = await aws.fetch(u(bucket, path), { method: 'PUT', body: bytes, headers: { 'content-type': contentType } })
      return r.ok
    },
    async remove(bucket, path) { await aws.fetch(u(bucket, path), { method: 'DELETE' }) },
    async signedUrl(bucket, path, ttl, name) {
      const url = new URL(u(bucket, path))
      url.searchParams.set('X-Amz-Expires', String(ttl))
      url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
      const signed = await aws.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } })
      return signed.url
    },
  }
}

export function storeFor(kind: string | null | undefined, admin: SupabaseClient): FileStore {
  return kind === 'r2' ? r2Store() : supabaseStore(admin)
}
