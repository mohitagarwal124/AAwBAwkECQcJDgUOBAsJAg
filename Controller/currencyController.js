const response = require('../Lib/response');
const services = require('../Services');

/**
* @function <b>processFile</b><br> Method to read and process file
* @param  req  request object
* @param  res object
*/
async function processCurrencyForServer(req, res) {
  try {
    console.log('===req.body===', req.body);
    const currencyData = await services.currencyService.currencyConverter(req.body);
    if (currencyData.isError) {
      throw currencyData;
    }
    response.sendSuccess(currencyData, res);
  } catch (error) {
    response.sendError(error, res);
  }
}

/**
* @function <b>processFile</b><br> Method to read and process file
* @param  req  request object
* @param  res object
*/
async function processCurrency(payload) {
  try {
    const currencyData = await services.currencyService.currencyConverter(payload);
    if (currencyData.isError) {
      throw currencyData;
    }
    return currencyData;
  } catch (error) {
    throw error;
  }
}


module.exports = {
  processCurrency,
  processCurrencyForServer,
};
