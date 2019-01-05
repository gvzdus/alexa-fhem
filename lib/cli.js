const program = require('commander');
const version = require('./version');
const Server = require('./server').Server;
const User = require('./user').User;
const logging = require("./logger");
const path = require('path');
const fs = require('fs');


'use strict';

const log = logging.Logger.withPrefix('cli');

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
    .option('-l, --logtofile',
      'interims option for fhemlazy to force logging to file instead of stdout',
      function () { setFileLogging();},undefined)
    .option('-c, --config [path]',
      'where to find the configuration',
      function (p) { User.setConfigurationPath(p);},undefined)
    .parse(process.argv);

  startupPromise.then(()=>{

    const server = new Server();
    const shutdown = function (signal) {
      log.info("Got %s, shutting down alexa-fhem...", signal);

      server.shutdown();

      process.exit(130);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', ()=> shutdown('SIGTERM'));

    server.run();

    process.on('exit', () => { addOrRemoveProcessPid(false) });
    addOrRemoveProcessPid(true);

  }).catch((reason)=> {
    log.error("Server failed with " + reason);
    process.exit(1);
  });
};

function killProcess() {
  return new Promise ((resolve, reject)=> {
    try {
      const pidPath = getPidPath();
      const oldpids = fs.readFileSync(pidPath);
      if (oldpids) {
        const pids = JSON.parse(oldpids.toString());
        for (const pid of pids) {
          try {
            process.kill(pid);
          } catch (e) {
            log.error("Trying to kill " + pid + " failed with " + e);
          }
        }
        fs.unlinkSync(pidPath);
        reject("Process(es) " + oldpids + " killed");
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

function addOrRemoveProcessPid(add) {
  const pidPath = getPidPath();
  let pids = [];
  try {
    const oldpids = fs.readFileSync(pidPath);
    if (oldpids) {
      pids = [].concat(JSON.parse(oldpids.toString()));
    }
  } catch (e) {
  }
  if (add)
    pids.push(process.pid);
  else {
    const i = pids.indexOf(process.pid);
    if (i>=0)
      pids.splice(i, 1);
  }
  fs.writeFileSync(pidPath, JSON.stringify(pids));
}

function setFileLogging() {
  const path = require ('path');

  const paths = [ '/opt/fhem/log',
    path.join (path.dirname(process.argv[1]), '..', '..', 'log'),
    path.join (path.dirname(process.argv[1]), '..', '..', 'logs'),
    path.join (path.dirname(process.argv[1]), '..', 'log'),
    path.join (path.dirname(process.argv[1]), '..', 'logs'),
    '/tmp'
  ];

  for (const p of paths ) {
    try {
      var s = fs.statSync(p);
      if (s.isDirectory()) {
        logging.setFileLogging(path.join(p, 'alexafhem.log'));
        break;
      }
    } catch (e) {
        // try next...
    }
  }
  path.dirname(process.argv[1]);
}