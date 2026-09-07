import { createError, readRawBody, setHeader, type H3Event } from 'h3';

/** Bound streamed requests before JSON parsing, including requests without Content-Length. */
export async function enforceBodyLimit(event: H3Event, maximum: number) {
  const request = event.node.req;
  const tooLarge = () => createError({ statusCode: 413, statusMessage: 'BODY_TOO_LARGE', data: { code: 'BODY_TOO_LARGE', requestId: event.context.requestId } });
  // Serverless adapters can supply an already bounded platform body rather than a Node stream.
  if (event.web?.request?.body || event._requestBody || 'rawBody' in request || 'body' in request || '__unenv__' in request) {
    const body = await readRawBody(event, false);
    if (body && body.length > maximum) throw tooLarge();
    (request as typeof request & { rawBody?: Buffer }).rawBody = body || Buffer.alloc(0);
    return;
  }
  if (request.readableEnded) return;
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []; let length = 0;
    const cleanup = () => { request.off('data', onData); request.off('end', onEnd); request.off('error', onError); request.off('aborted', onAborted); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onAborted = () => onError(createError({ statusCode: 400, statusMessage: 'REQUEST_ABORTED' }));
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks, length)); };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); length += bytes.length;
      if (length > maximum) {
        cleanup(); request.pause(); setHeader(event, 'Connection', 'close');
        event.node.res.once('finish', () => request.destroy());
        reject(tooLarge()); return;
      }
      chunks.push(bytes);
    };
    request.on('data', onData); request.once('end', onEnd); request.once('error', onError); request.once('aborted', onAborted);
  });
  (request as typeof request & { rawBody?: Buffer }).rawBody = body;
}
