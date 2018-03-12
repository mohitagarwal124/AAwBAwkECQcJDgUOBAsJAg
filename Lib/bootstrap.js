const blueBird = require('bluebird');
const config = require('../Config');
const dao = require('./dao');
const tube = require('./tube');
const exchange = require('./exchange');

async function stopServer() {
  setTimeout(() => {
    process.exit(1);
  }, 15000);
}

async function serverBootstrap() {
  try {
    const data = await blueBird.all([dao.dbConnect(), tube.tubeConnect(), exchange.rateConnect()]);
    console.log('bootstraping done');
    return data;
  } catch (error) {
    console.log('gdhghg', error);
    stopServer();
  }
}

module.exports = {
  serverBootstrap,
};
