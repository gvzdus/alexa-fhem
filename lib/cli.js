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

    fs.writeFileSync( path.join (User.storagePath(), "alexa.pid"), process.pid );
    const server = new Server();
    const shutdown = function (signal) {
      log.info("Got %s, shutting down alexa-fhem...", signal);

      server.shutdown();

      process.exit(130);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    server.run();

  }).catch((reason)=> {
    log.error(reason);
    process.exit(1);
  });
};

function killProcess() {
  return new Promise ((resolve, reject)=> {
    try {
      const oldpid = fs.readFileSync(path.join(User.storagePath(), "alexa.pid"));
      if (oldpid) {
        process.kill(parseInt(oldpid.toString()));
        reject("Process " + oldpid + " killed");
      } else {
        reject("No pid found");
      }
    } catch (e) {
      reject("Error " + e + " on trying to read pid");
    }
  })
}

