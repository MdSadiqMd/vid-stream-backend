import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/serve-static';

import cors from './middleware/middleware';
import routes from './routes/upload.routes';

const app = new Hono();

app.use(cors);
app.use('/uploads', serveStatic({
    path: './uploads',
    getContent: async (path, c) => {
        const filePath = path;
        const content = await fetch(filePath);
        return content;
    },
}));
app.use(logger());
routes(app);

app.get('/', (c) => {
    return c.text('Hello Hono!');
});

export default app;