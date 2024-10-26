import { Hono } from 'hono';

import uploadHandler from '../utils/upload.util';

const routes = (app: Hono) => {
    app.post('/upload', uploadHandler);
};

export default routes;