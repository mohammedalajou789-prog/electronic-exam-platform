// src/lib/r2.ts
//
// Server-only access to the Cloudflare R2 bucket that holds question images.
// Never import this file from a client component: it reads the R2 secret key.
//
// R2 speaks the S3 API. Requests are signed with AWS Signature Version 4, written here
// with node:crypto so the project needs no extra package:
// - presignPutUrl(): a short-lived URL the admin's browser uses to upload one image
//   directly to R2 (Vercel refuses request bodies above 4.5 MB, so uploads must not
//   pass through our server).
// - headObject() / deleteObject(): called by our API routes.
//
// Environment (.env.local and Vercel): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET.

import { createHash, createHmac } from 'node:crypto'

const REGION = 'auto'
const SERVICE = 's3'
const ALGORITHM = 'AWS4-HMAC-SHA256'
const EMPTY_BODY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 is not configured (R2_* environment variables are missing)')
  }
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

/** RFC 3986 encoding, as SigV4 requires (encodeURIComponent leaves !'()* alone). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function objectPath(bucket: string, key: string): string {
  return '/' + encodeRfc3986(bucket) + '/' + key.split('/').map(encodeRfc3986).join('/')
}

function timestamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

function signature(config: R2Config, dateStamp: string, stringToSign: string): string {
  const kDate = hmac('AWS4' + config.secretAccessKey, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  return createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
}

/**
 * A URL that lets the browser PUT one file at `key` for `expiresSeconds`.
 * Content-Type is part of the signature, so the browser must send the type the server
 * approved (R2 answers 403 otherwise). R2 does not document a size limit for presigned
 * URLs, so the size is checked again after the upload (headObject in the save route).
 */
export function presignPutUrl(
  key: string,
  contentType: string,
  expiresSeconds = 300,
  now: Date = new Date()
): string {
  const config = getConfig()
  const host = `${config.accountId}.r2.cloudflarestorage.com`
  const path = objectPath(config.bucket, key)
  const { amzDate, dateStamp } = timestamps(now)
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const signedHeaders = 'content-type;host'

  const query: [string, string][] = [
    ['X-Amz-Algorithm', ALGORITHM],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', `${config.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]
  const canonicalQuery = query
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const canonicalHeaders =
    `content-type:${contentType.trim()}\n` +
    `host:${host}\n`

  const canonicalRequest = [
    'PUT', path, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n')

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature(config, dateStamp, stringToSign)}`
}

/** Signs and sends one request without a body (HEAD or DELETE) to one object. */
async function sendSignedOnce(method: 'HEAD' | 'DELETE', key: string, now: Date = new Date()): Promise<Response> {
  const config = getConfig()
  const host = `${config.accountId}.r2.cloudflarestorage.com`
  const path = objectPath(config.bucket, key)
  const { amzDate, dateStamp } = timestamps(now)
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${EMPTY_BODY_SHA256}\n` +
    `x-amz-date:${amzDate}\n`
  const canonicalRequest = [
    method, path, '', canonicalHeaders, signedHeaders, EMPTY_BODY_SHA256,
  ].join('\n')
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n')

  return fetch(`https://${host}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      'x-amz-content-sha256': EMPTY_BODY_SHA256,
      'x-amz-date': amzDate,
      authorization:
        `${ALGORITHM} Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature(config, dateStamp, stringToSign)}`,
    },
  })
}

/**
 * Like sendSignedOnce, but tries up to 3 times when the connection fails or R2 answers
 * with a server error (a slow or interrupted connection should not leave an unused
 * file behind). Each try is signed again with the current time.
 */
async function sendSigned(method: 'HEAD' | 'DELETE', key: string): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, attempt * 700))
    try {
      const res = await sendSignedOnce(method, key)
      if (res.status < 500) return res
      lastError = new Error(`R2 ${method} failed with status ${res.status}`)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export interface ObjectInfo {
  exists: boolean
  size: number | null
  contentType: string | null
}

/** Checks that an uploaded object is really in the bucket (and how big it is). */
export async function headObject(key: string): Promise<ObjectInfo> {
  const res = await sendSigned('HEAD', key)
  if (res.status === 404) return { exists: false, size: null, contentType: null }
  if (!res.ok) throw new Error(`R2 HEAD failed with status ${res.status}`)
  const length = Number(res.headers.get('content-length'))
  return {
    exists: true,
    size: Number.isFinite(length) ? length : null,
    contentType: res.headers.get('content-type'),
  }
}

/** Deletes one object. Deleting an object that is already gone counts as success. */
export async function deleteObject(key: string): Promise<void> {
  const res = await sendSigned('DELETE', key)
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 DELETE failed with status ${res.status}`)
  }
}