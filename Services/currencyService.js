const config = require('../Config');
const bluebird = require('bluebird');
const tube = require('../Lib/tube');

async function currencyConverter(payload) {
  try {
    config.JOB.CURRENCY_ARRAY = [];
    config.JOB.TRY_COUNT = 1;
    console.log('currencyConverter');
    const data = await bluebird.all([tube.useTube(), tube.initializeJob(payload)]);
    console.log(data);
    const jobID = await tube.dataInTube(data[0], data[1]);
    return jobID;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  currencyConverter,
};
