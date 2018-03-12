const path = require('path');
const winston = require('winston');
const winstonRotateFile = require('winston-daily-rotate-file');

const logPath = path.resolve('./Log');

// converts the date object to local time string
const tsFormat = () => (new Date()).toUTCString();

const transports = [];
  transports.push(
    new (winstonRotateFile)({
      name: 'Info File',
      filename: `${logPath}/info.log`, // filename to be created
      timestamp: tsFormat,
      datePattern: 'yyyy-MM-dd',
      prepend: true, // prepends date to name of file
      level: 'info', // level of log
    }),
    new (winstonRotateFile)({
      name: 'Error File',
      filename: `${logPath}/error.log`, // filename to be created
      timestamp: tsFormat,
      datePattern: 'yyyy-MM-dd',
      prepend: true, // prepends date to name of file
      level: 'error', // level of log
    }),
  );

exports.winstonLogger = new (winston.Logger)({
  transports,
});

