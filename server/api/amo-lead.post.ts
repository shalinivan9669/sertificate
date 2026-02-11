type AmoLeadPayload = {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  company?: string;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map<string, RateLimitState>();

const trimValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const amoSubdomain = trimValue(config.amoSubdomain);
  const amoLongToken = trimValue(config.amoLongToken);

  if (!amoSubdomain || !amoLongToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'amoCRM is not configured',
    });
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  const now = Date.now();
  const currentLimit = rateLimitStore.get(ip);

  if (!currentLimit || currentLimit.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (currentLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
    });
  } else {
    currentLimit.count += 1;
    rateLimitStore.set(ip, currentLimit);
  }

  const body = (await readBody(event)) as AmoLeadPayload;
  const name = trimValue(body?.name);
  const phone = trimValue(body?.phone);
  const email = trimValue(body?.email);
  const message = trimValue(body?.message);
  const company = trimValue(body?.company);

  if (company) {
    return { ok: true };
  }

  if (!phone && !email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Phone or email is required',
    });
  }

  const leadIdentity = name || phone || email;
  const contactFields = [];

  if (phone) {
    contactFields.push({
      field_code: 'PHONE',
      values: [{ value: phone }],
    });
  }

  if (email) {
    contactFields.push({
      field_code: 'EMAIL',
      values: [{ value: email }],
    });
  }

  const requestBody: Record<string, unknown>[] = [
    {
      name: `\u0417\u0430\u044f\u0432\u043a\u0430 \u0441 \u0441\u0430\u0439\u0442\u0430: ${leadIdentity}`,
      _embedded: {
        contacts: [
          {
            name: name || leadIdentity,
            custom_fields_values: contactFields,
          },
        ],
        ...(message
          ? {
              notes: [
                {
                  note_type: 'common',
                  params: { text: message },
                },
              ],
            }
          : {}),
      },
    },
  ];

  try {
    await $fetch(`https://${amoSubdomain}.amocrm.ru/api/v4/leads/complex`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${amoLongToken}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      statusMessage: error?.data?.title || error?.data?.detail || 'Failed to create amoCRM lead',
    });
  }

  return { ok: true };
});
