import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

const app = new Hono();
app.use(logger());

app.get('/', (c) => {
    return c.text('Hello Hono!');
});

app.get('/ping', (c) => {
    return c.text('pong');
});

serve({
    fetch: app.fetch,
    port: 3000,
});

export default app;