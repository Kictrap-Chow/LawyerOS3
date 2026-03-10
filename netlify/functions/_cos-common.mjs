import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export const normalizePrefix = (prefix = '') => String(prefix || '').replace(/^\/+|\/+$/g, '');

export const makeCosClient = (config = {}) => {
  const region = String(config.region || '').trim();
  const secretId = String(config.secretId || '').trim();
  const secretKey = String(config.secretKey || '').trim();
  if (!region || !secretId || !secretKey) throw new Error('COS config incomplete');
  return new S3Client({
    region,
    endpoint: `https://cos.${region}.myqcloud.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: secretId,
      secretAccessKey: secretKey,
    },
  });
};

export const streamToString = async (stream) =>
  await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

export const readJsonObject = async (client, bucket, key) => {
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await streamToString(obj.Body);
    return JSON.parse(text || '{}');
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const code = error?.Code || error?.name;
    if (status === 404 || code === 'NoSuchKey' || code === 'NotFound') return null;
    throw error;
  }
};

export const putJsonObject = async (client, bucket, key, value) => {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: 'application/json',
    })
  );
};

export const clearPrefix = async (client, bucket, prefix) => {
  let continuationToken;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const keys = (listed.Contents || []).map((item) => ({ Key: item.Key })).filter((item) => item.Key);
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys },
        })
      );
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
};

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

