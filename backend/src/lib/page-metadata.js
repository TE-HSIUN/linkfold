import { lookup } from 'node:dns/promises';
import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';

import * as cheerio from 'cheerio';
import ipaddr from 'ipaddr.js';

const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_MEDIA_TYPES = new Set([
  'application/xhtml+xml',
  'text/html',
]);

function createHttpError(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    code,
  });
}

function invalidUrlError() {
  return createHttpError(
    400,
    'INVALID_URL',
    'originalUrl 必須是安全的公開 http 或 https 網址',
  );
}

function metadataUnavailableError() {
  return createHttpError(
    422,
    'METADATA_UNAVAILABLE',
    '無法取得頁面資訊',
  );
}

function normalizeText(value, maxLength) {
  return value.replace(/\s+/gu, ' ').trim().slice(0, maxLength);
}

function parseMetadataUrl(value) {
  if (typeof value !== 'string') {
    throw invalidUrlError();
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw invalidUrlError();
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== ''
  ) {
    throw invalidUrlError();
  }

  return url;
}

async function defaultResolver(hostname) {
  return lookup(hostname, { all: true, verbatim: true });
}

async function resolvePublicTarget(url, resolver) {
  let addresses;

  try {
    addresses = await resolver(url.hostname);
  } catch {
    throw metadataUnavailableError();
  }

  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.some(
      (entry) =>
        typeof entry?.address !== 'string' ||
        !isPublicAddress(entry.address),
    )
  ) {
    if (Array.isArray(addresses) && addresses.length > 0) {
      throw invalidUrlError();
    }

    throw metadataUnavailableError();
  }

  return addresses[0];
}

export function isPublicAddress(address) {
  if (typeof address !== 'string' || !ipaddr.isValid(address)) {
    return false;
  }

  const parsed = ipaddr.parse(address);

  if (
    parsed.kind() === 'ipv6' &&
    parsed.range() === 'ipv4Mapped'
  ) {
    return isPublicAddress(parsed.toIPv4Address().toString());
  }

  return parsed.range() === 'unicast';
}

export function extractPageMetadata(html) {
  const $ = cheerio.load(String(html));
  const descriptionElement = $('meta[name]')
    .toArray()
    .find(
      (element) =>
        ($(element).attr('name') ?? '').toLowerCase() ===
        'description',
    );

  return {
    title: normalizeText($('title').first().text(), 300),
    description: normalizeText(
      descriptionElement
        ? ($(descriptionElement).attr('content') ?? '')
        : '',
      500,
    ),
  };
}

export function createHttpFetcher({
  httpRequest = requestHttp,
  httpsRequest = requestHttps,
} = {}) {
  return function fetchOnce({
    url,
    address,
    family,
    signal,
    maxBytes,
  }) {
    return new Promise((resolve, reject) => {
      const requester =
        url.protocol === 'https:' ? httpsRequest : httpRequest;
      let settled = false;
      let totalBytes = 0;
      const chunks = [];
      let req;

      const rejectOnce = (error) => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      };

      req = requester(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.protocol === 'https:' ? 443 : 80,
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers: {
            accept: 'text/html, application/xhtml+xml',
            'accept-encoding': 'identity',
            'user-agent': 'LinkfoldMetadataBot/1.0',
          },
          signal,
          servername:
            url.protocol === 'https:' ? url.hostname : undefined,
          lookup(hostname, options, callback) {
            if (options?.all) {
              callback(null, [{ address, family }]);
              return;
            }

            callback(null, address, family);
          },
        },
        (response) => {
          const contentLength = Number(
            response.headers['content-length'],
          );

          if (
            Number.isFinite(contentLength) &&
            contentLength > maxBytes
          ) {
            rejectOnce(metadataUnavailableError());
            response.destroy();
            req.destroy();
            return;
          }

          response.on('data', (value) => {
            const chunk = Buffer.isBuffer(value)
              ? value
              : Buffer.from(value);
            totalBytes += chunk.byteLength;

            if (totalBytes > maxBytes) {
              rejectOnce(metadataUnavailableError());
              response.destroy();
              req.destroy();
              return;
            }

            chunks.push(chunk);
          });
          response.once('end', () => {
            if (settled) {
              return;
            }

            settled = true;
            resolve({
              statusCode: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks),
            });
          });
          response.once('error', rejectOnce);
        },
      );

      req.once('error', rejectOnce);
      req.end();
    });
  };
}

export function createPageMetadataService({
  resolver = defaultResolver,
  fetchOnce = createHttpFetcher(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
} = {}) {
  return async function getPageMetadata(originalUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let currentUrl;
    let redirectCount = 0;

    try {
      currentUrl = parseMetadataUrl(originalUrl);

      while (true) {
        const target = await resolvePublicTarget(
          currentUrl,
          resolver,
        );
        const response = await fetchOnce({
          url: currentUrl,
          address: target.address,
          family: target.family,
          signal: controller.signal,
          maxBytes,
        });

        if (REDIRECT_STATUSES.has(response?.statusCode)) {
          const location = response.headers?.location;

          if (
            typeof location !== 'string' ||
            redirectCount >= maxRedirects
          ) {
            throw metadataUnavailableError();
          }

          currentUrl = parseMetadataUrl(
            new URL(location, currentUrl).toString(),
          );
          redirectCount += 1;
          continue;
        }

        if (
          typeof response?.statusCode !== 'number' ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          throw metadataUnavailableError();
        }

        const mediaType = String(
          response.headers?.['content-type'] ?? '',
        )
          .split(';', 1)[0]
          .trim()
          .toLowerCase();
        const body = Buffer.isBuffer(response.body)
          ? response.body
          : Buffer.from(response.body ?? '');

        if (
          !HTML_MEDIA_TYPES.has(mediaType) ||
          body.byteLength > maxBytes
        ) {
          throw metadataUnavailableError();
        }

        return extractPageMetadata(body.toString('utf8'));
      }
    } catch (error) {
      if (error?.status) {
        throw error;
      }

      throw metadataUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  };
}
