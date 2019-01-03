const program = require('commander');
const version = require('./version');
const Server = require('./server').Server;
const User = require('./user').User;
const log = require("./logger").Logger;
const path = require('path');
const fs = require('fs');


'use strict';

module.exports = function() {

  let startupPromise = new Promise(function (resolve) {
      resolve();
  });
  program
    .version(version, undefined)
    .option('-U, --user-storage-path [path]',
      'look for alexa user files at [path] instead of the default location (~/.alexa)',
      function(p) { User.setStoragePath(p); }, undefined)
    .option('-D, --debug',
      'turn on debug level logging',
      function() { require('./logger').setDebugEnabled(true) }, undefined)
    .option('-A, --autoconfig',
      'automatically try to create config, find FHEM and prepare for public skill',
      function() { startupPromise = User.autoConfig(); }, undefined)
    .option('-k, --kill',
      'kill a running version based on created pid file',
      function() { startupPromise = killProcess(); }, undefined)
    .parse(process.argv);

  startupPromise.then(()=>{

    const server = new Server();
    const shutdown = function (signal) {
      log.info("Got %s, shutting down alexa-fhem...", signal);

      server.shutdown();
      fs.unlinkSync(getPidPath());

      process.exit(130);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', ()=> shutdown('SIGTERM'));

    server.run();

    fs.writeFileSync( getPidPath(), process.pid );

  }).catch((reason)=> {
    log.error("Server failed with " + reason);
    process.exit(1);
  });
};

function killProcess() {
  return new Promise ((resolve, reject)=> {
    try {
      const pidPath = getPidPath();
      const oldpid = fs.readFileSync(pidPath);
      if (oldpid) {
        process.kill(parseInt(oldpid.toString()));
        fs.unlinkSync(pidPath)
        reject("Process " + oldpid + " killed");
      } else {
        reject("No pid found");
      }
    } catch (e) {
      reject("Error " + e + " on trying to read pid");
    }
  })
}

function getPidPath() {
  return path.join(User.storagePath(), "alexa.pid");
}