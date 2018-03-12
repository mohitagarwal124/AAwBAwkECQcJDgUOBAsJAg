const config = require('../Config');
const dao = require('./dao');
const exchange = require('./exchange');

const bluebird = require('bluebird');
const fivebeans = require('fivebeans');

const exchangeWorker = fivebeans.worker;
const client = bluebird.promisifyAll(new fivebeans.client(config.BEANSTALKD.HOST, config.BEANSTALKD.PORT));

async function insertJobs(jobArray) {
  const model = db.collection(config.MONGO.COLLECTION.CURRENCY_RATES);
  await dao.insertData(model, jobArray);
  return true;
}

function exchangeHandler() {
  this.type = config.BEANSTALKD.HANDLER;
}

async function workerErrorHandler(payload, cb) {
  if (config.JOB.TRY_COUNT <= config.JOB.TRIES) {
    config.JOB.TRY_COUNT++;
    cb('release', config.JOB.ERROR_DELAY);
    console.log('released with 3');
  } else if (config.JOB.TRY_COUNT > config.JOB.TRIES) {
    if (config.JOB.CURRENCY_ARRAY.length) {
      await insertJobs(config.JOB.CURRENCY_ARRAY);
      console.log('data inserted');
    }
    cb('bury');
  } else {
    cb('bury');
  }
}

async function workerHandler(payload, cb) {
  try {
    const arrayLength = config.JOB.CURRENCY_ARRAY.length;
    console.log(arrayLength, config.JOB.SUCCESS_LENGTH, arrayLength < config.JOB.SUCCESS_LENGTH);
    if (arrayLength < config.JOB.SUCCESS_LENGTH) {
      const rate = await exchange.getRate(payload.fromCurrency, payload.toCurrency);
      const currencyData = await exchange.formatData(payload, rate);
      config.JOB.CURRENCY_ARRAY.push(currencyData);
      cb('release', config.JOB.SUCCESS_DELAY);
      console.log('released with 60');
    } else {
      console.log('data to inseret');
      await insertJobs(config.JOB.CURRENCY_ARRAY);
      cb('success');
      console.log('job success');
    }
  } catch (error) {
    console.log('error handler ', error);
    await workerErrorHandler(payload, cb);
  }
}

async function initializeWorker() {
  exchangeHandler.prototype.work = workerHandler;
  const handler = new exchangeHandler();
  const options = {
    id: config.BEANSTALKD.WORKER, // The ID of the worker for debugging and tacking
    host: config.BEANSTALKD.HOST, // The host to listen on
    port: config.BEANSTALKD.PORT, // the port to listen on
    handlers: {
      [config.BEANSTALKD.HANDLER]: handler, // setting handlers for types
    },
    ignoreDefault: true,
  };
  const worker = new exchangeWorker(options); // return the worker object
  worker.start([config.BEANSTALKD.TUBE]); // Connect the exchangeWorker to the beanstalkd server & make it watch the specified tube mohitagarwal124
  return true;
}

async function tubeConnect() {
  try {
    return new bluebird((resolve, reject) => {
      client.on('connect', async () => {
        await initializeWorker();
        console.log('connected');
        resolve(client);
      }).on('error', (err) => {
        reject(err);
      }).on('close', () => {
        console.log('client closed');
      }).connectAsync();
    });
  } catch (error) {
    throw error;
  }
}

async function initializeJob(payload) {
  console.log('initializeJob');
  return {
    type: config.BEANSTALKD.HANDLER,
    payload: {
      fromCurrency: payload.fromCurrency,
      toCurrency: payload.toCurrency,
    },
  };
}

async function useTube() {
  try {
    let tubeName = config.BEANSTALKD.TUBE;
    tubeName = client.useAsync(tubeName);
    return tubeName;
  } catch (error) {
    throw error;
  }
}

async function dataInTube(tubeName, data) {
  const tubeData = JSON.stringify([tubeName, data]);
  const jobID = await client.putAsync(config.BEANSTALKD.PRIORITY, config.BEANSTALKD.DELAY, config.BEANSTALKD.TTR, tubeData);
  return jobID;
}

async function reserveData() {
  console.log('reserveAsync called');
  const data = await client.reserveAsync();
  return data;
}

module.exports = {
  tubeConnect,
  initializeJob,
  useTube,
  dataInTube,
  reserveData,
};
