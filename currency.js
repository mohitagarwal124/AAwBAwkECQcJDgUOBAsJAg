const bootstrap = require('./Lib/bootstrap');
const controller = require('./Controller');
const config = require('./Config');

logger = require('./Lib/winston').winstonLogger;

async function initialProcess() {
  try {
    const bootstrapData = await bootstrap.serverBootstrap();
    db = bootstrapData[0];
    client = bootstrapData[1];
  } catch (error) {
    throw error;
  }
}

async function convertCurrency() {
  try {
    await initialProcess();
    const payload = {
      fromCurrency: config.SUPPORTED_CURRENCY.USD,
      toCurrency: config.SUPPORTED_CURRENCY.EUR,
    };
    await controller.currencyController.processCurrency(payload);
  } catch (error) {
    logger.error(error);
  }
}

convertCurrency();
