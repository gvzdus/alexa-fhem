const winston = require('winston');
const { combine, timestamp, label, printf } = winston.format;

'use strict';

const myFormat = printf(info => {
  return `${info.timestamp} ${info.level} ${info.label}: ${info.message}`;
});

const Logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    myFormat
  ),
  defaultMeta: {service: 'user-service'},
}).add(new winston.transports.File({ filename: 'alexa-fhem.log' }))
  .add(new winston.transports.Console());

function getLogger(prefix) {
  return winston.createLogger({
    level: 'info',
    format: combine(
      label({ label: prefix }),
      timestamp(),
      myFormat
    ),
    defaultMeta: {service: 'user-service'},
  }).add(new winston.transports.File({ filename: 'alexa-fhem2.log' }))
    .add(new winston.transports.Console());
}

module.exports = {
  Logger: Logger,
  getLogger: getLogger,
  setDebugEnabled: setDebugEnabled,
};

let DEBUG_ENABLED = false;

// Turns on debug level logging
function setDebugEnabled(enabled) {
  Logger.transports.file.level = enabled ? 'debug' : 'info';
  DEBUG_ENABLED = enabled;
}