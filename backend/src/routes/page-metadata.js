import { Router } from 'express';

import { createPageMetadataService } from '../lib/page-metadata.js';

export function createPageMetadataRouter({
  metadataService = createPageMetadataService(),
} = {}) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const body =
        req.body !== null && typeof req.body === 'object'
          ? req.body
          : {};
      const metadata = await metadataService(body.originalUrl);

      res.json({
        title: metadata.title,
        description: metadata.description,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

const router = createPageMetadataRouter();

export default router;
