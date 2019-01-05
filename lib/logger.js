// const chalk = require('chalk');
const chalk = undefined;
const util = require('util');
const fs = require('fs');

'use strict';

module.exports = {
  Logger: Logger,
  setDebugEnabled: setDebugEnabled,
  setFileLogging: setFileLogging
};

let DEBUG_ENABLED = false;
let TIME_ENABLED = false;

// Turns on debug level logging
function setDebugEnabled(enabled) {
  DEBUG_ENABLED = enabled;
}

let logfile = undefined;

//setFileLogging = function (path) {
function setFileLogging  (path) {
  if (path) {
    logfile = fs.openSync(path, 'a');
    TIME_ENABLED = true;
  } else {
    logfile = undefined;
    TIME_ENABLED = false;
  }
}


// global cache of logger instances by plugin name
let loggerCache = {};

/**
 * Logger class
 */

function Logger(prefix) {
  this.prefix = prefix;
}

Logger.prototype.debug = function(msg) {
  if (DEBUG_ENABLED)
    this.log.apply(this, ['debug'].concat(Array.prototype.slice.call(arguments)));
};
  
Logger.prototype.info = function(msg) {
  this.log.apply(this, ['info'].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.warn = function(msg) {
  this.log.apply(this, ['warn'].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.error = function(msg) {
  this.log.apply(this, ['error'].concat(Array.prototype.slice.call(arguments)));
};
  
Logger.prototype.log = function(level, msg) {
  
  msg = util.format.apply(util, Array.prototype.slice.call(arguments, 1));
  let func = console.log;

  if (chalk) {
    if (level === 'debug') {
      msg = chalk.gray(msg);
    } else if (level === 'warn') {
      msg = chalk.yellow(msg);
      func = console.error;
    } else if (level === 'error') {
      msg = chalk.bold.red(msg);
      func = console.error;
    }
  }
  
  // prepend prefix if applicable
  if (this.prefix)
    msg = "[" + (chalk ? chalk.cyan(this.prefix) : this.prefix) + "] " + msg;
  
  // prepend timestamp
  if (TIME_ENABLED) {
    const date = new Date();
    msg = "[" + date.toLocaleString() + "]" + " " + msg;
  }

  if (logfile)
    fs.appendFile(logfile, msg + '\n', (err) => { if (err) console.log(err) });
  else
    func(msg);
};
  
Logger.withPrefix = function(prefix) {

  if (!loggerCache[prefix]) {
    // create a class-like logger thing that acts as a function as well
    // as an instance of Logger.
    const logger = new Logger(prefix);
    const log = logger.info.bind(logger);
    log.debug = logger.debug;
    log.info = logger.info;
    log.warn = logger.warn;
    log.error = logger.error;
    log.log = logger.log;
    log.prefix = logger.prefix;
    loggerCache[prefix] = log;
  }
  
  return loggerCache[prefix];
};