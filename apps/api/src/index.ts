import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

const app = createApp();

app.listen(config.PORT, () => {
  logger.info(`Ghost 3.0 API listening on port ${config.PORT}`, {
    port: config.PORT,
    environment: config.NODE_ENV,
    paypalEnv: config.PAYPAL_ENV,
  });
});
