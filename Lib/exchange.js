const exchange = require('open-exchange-rates');
const fx = require('money');
const bluebird = require('bluebird');
const config = require('../Config');

//  it sets the appid for open exchange rate
async function rateConnect() {
  try {
    exchange.set({
      app_id: config.OPEN_EXCHANGE.APP_KEY,
    });
  } catch (error) {
    throw error;
  }
}

async function convertMoney(fromCurrency, toCurrency) {
  try {
    fx.rates = exchange.rates;
    fx.base = exchange.base;
    let rate = parseFloat(fx(1).from(fromCurrency).to(toCurrency));
    rate = Math.round(rate * 100 + Number.EPSILON) / 100; // rounding off rate to two decimal places
    return rate;
  } catch (error) {
    throw error;
  }
}

async function getRate(fromCurrency, toCurrency) {
  try {
    return new bluebird((resolve, reject) => {
      exchange.latest(async () => {
        const rate = await convertMoney(fromCurrency, toCurrency);
        resolve(rate);
      });
    });
  } catch (error) {
    throw error;
  }
}

async function formatData(payload, rate) {
  return {
    from: payload.fromCurrency,
    to: payload.toCurrency,
    rate,
    created_at: new Date(),
  };
}

module.exports = {
  rateConnect,
  getRate,
  formatData,
};
