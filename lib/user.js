const path = require('path');
const fs = require('fs');

'use strict';

module.exports = {
  User: User
};

/**
 * Manages user settings and storage locations.
 */

// global cached config
var config;

// optional custom storage path
var customStoragePath;

function User() {
}
  
User.config = function() {
  return config || (config = Config.load(User.configPath()));
};
  
User.storagePath = function() {
  if (customStoragePath) return customStoragePath;
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.env.PWD;
  return path.join(home, ".alexa");
};

User.sshKeyPath = function() {
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || process.env.PWD;
  return path.join(home, ".ssh");
};

User.configPath = function() {
  return path.join(User.storagePath(), "config.json");
};

User.persistPath = function() {
  return path.join(User.storagePath(), "persist");
};

User.setStoragePath = function(path) {
  customStoragePath = path;
};

var log = require("./logger").Logger;

var resolveFunc;
var rejectFunc;

User.autoConfig = function () {
  return new Promise(function (resolve, reject) {
    resolveFunc = resolve;
    rejectFunc = reject;

    (async () => {
        await runAutoconfig()
    })();
})
};

const readline = require('readline-sync');
const crypto = require('crypto');

var csrfToken;
var alexaDeviceName;

async function runAutoconfig() {
  const spath = User.storagePath();

  // FIRST STEP: Check for config.json and build up one, if missing
  let dirty = false; // Did we modify an existing config.json ?
  if (!fs.existsSync(spath)) {
    console.log("Creating directory " + spath);
    fs.mkdirSync(spath, 0o700);
  }
  const configPath = User.configPath();
  let config = {};
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync("./config-sample.json")) {
      console.log("config.json not existing, creating from ../config-sample.json");
      try {
        config = JSON.parse(fs.readFileSync("./config-sample.json"));
      } catch (e) {
        console.log("... which is broken JSON, so from the scratch anyways...");
      }
    } else {
      console.log("config.json not existing, creating from the scratch");
    }
    dirty = true;
  } else {
    try {
      config = JSON.parse(fs.readFileSync(configPath));
      dirty = false;
    } catch (e) {
      console.log("... which is broken JSON, so from the scratch anyways...");
    }
  }
  if (!config.hasOwnProperty('alexa')) {
    config.alexa = {}
  }
  if (!config.hasOwnProperty('connections')) {
    config.connections = []
  }

  // Default settings for alexa-fhem
  if (!config.alexa.hasOwnProperty('port')) {
    config.alexa.port = 3000; dirty=true
  }
  if (!config.alexa.hasOwnProperty('name')) {
    config.alexa.name = 'Alexa'; dirty=true
  }
  if (!config.alexa.hasOwnProperty('bind-ip')) {
    config.alexa['bind-ip'] = '127.0.0.1'; dirty=true
  }
  if (!config.alexa.hasOwnProperty('ssl')) {
    config.alexa.ssl = false;
  }
  if (!config.alexa.hasOwnProperty('publicSkill')) {
    config.alexa.publicSkill = true; dirty=true
  }
  if (!config.alexa.hasOwnProperty('ssh')) {
    ['/bin', '/usr/bin', '/usr/local/bin'].forEach(d => { if (fs.existsSync(d+'/ssh')) {
      config.alexa.ssh = d+'/ssh'; dirty=true;
    }});
  }

  // Search for FHEM, if no connections..
  if (config.connections.length === 0) {
    dirty=true;
    const conn = {
      server: '127.0.0.1',
      port: 8083,
      name: 'FHEM',
      filter: 'alexaName=...*',
      ssl: false
    };
    config.connections.push(conn);
  }
  let conn = config.connections[0];

  let test1 = await buildRequest(conn);
  // Typical HTTPS listener error?
  log.debug (JSON.stringify(test1));
  if (!test1.success && !conn.ssl && test1.message.hasOwnProperty("errno") && test1.message.errno==='ECONNRESET') {
    conn.ssl = true;
    let test2 = await buildRequest(conn);
    if (test2.hasOwnProperty('httpcode')) {
      // Obviously, SSL is doing better...
      config.connections[0].ssl = true;
      test1 = test2;
    } else {
      conn.ssl = false;
    }
  }
  let failmsg = undefined;
  if (!test1.success) {
    let url = (conn.ssl ? "https" : "http") + "://" + conn.server + ":" + conn.port + "/" + (conn.webname ? conn.webname : "fhem/");
    if (test1.hasOwnProperty("httpcode")) {
      switch (test1.httpcode) {
        case 401:
          failmsg = "FHEM seems to be username/password protected. Please provide the authentication settings.";
          conn.auth = {user: "FIXME", password: "FIXME"};
          break;
        case 404:
          failmsg = url + " returned a 404 Not found. Probably you have to fix webname?";
          conn.webname = "FIXME";
          break;
        default:
          failmsg = "Strange HTTP code " + test1.httpcode + " when accessing " + url + ". Please verify manually.";
          break;
      }
    } else {
      conn.server = "FIXME";
      conn.port = "FIXME";
      if (test1.message.hasOwnProperty('errno')) {
        if (test1.message.errno === 'ECONNREFUSED') {
          failmsg = "FHEM not found at " + url +
            " (no listener). It seems to be running on a different IP / port.";
        } else if (test1.message.errno === 'ECONNRESET') {
          failmsg = "FHEM not found at " + conn.server + ":" + conn.port +
            ". It seems to be running on a different IP / port.";
        } else {
          failmsg = "Unknown error code " + test1.message.errno + " on connecting to " + url;
        }
      } else {
        failmsg = "Unknown error " + test1.message;
      }
    }
    config.connections[0] = conn;
    log.warn("Problem message " + failmsg);
  } else {
    // Connectivity to FHEM given...
    csrfToken = test1.message;
    console.log ("FHEM-Connectivity fine, CSRF-Token: " + csrfToken);
  }

  if (dirty) {
    console.log("config.json to write:\n" + JSON.stringify(config, null, 2))
    let goon = readline.question("Okay to write about file to " + configPath + "? [Hit Enter for okay, 'n' else] ");
    if (goon !== 'n') {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  }

  // NEXT STEP: Generate SSH key if not yet done
  let pubkey_path = path.join(User.sshKeyPath(), 'id_rsa');
  if (! fs.existsSync(pubkey_path)) {
    if (fs.existsSync(config.alexa.ssh + '-keygen')) {
      console.log ('No SSH public key found, we have to generate one.');
      let goon = readline.question("Okay to generate SSH-Key in " + User.sshKeyPath() + "? [Hit Enter for okay, 'n' else] ");
      if (goon !== 'n') {
        const execSync = require('child_process').spawnSync;
        const prc = execSync(config.alexa.ssh + '-keygen',  ['-t', 'rsa', '-N', '', '-f', pubkey_path], { stdio: 'pipe'});
        console.log (prc.output[1].toString());
      } else {
        failmsg = 'Without a private SSH key, connection setup will not work. Please create an SSH key manually.';
      }
    } else {
      failmsg = 'ssh-keygen command not found, please check if your installation of SSH is complete.';
    }
  }

  // NEXT STEP: Register SSH key at server
  var registrationKey = undefined;
  const hash = crypto.createHash('sha256');
  // This is only for our side:
  const registrationRandomBytes = crypto.randomBytes(8);
  let bearerTokenRandomBytes = crypto.randomBytes(8);
  // This is to publish to the server:
  const registrationRandomHash = hash.update(registrationRandomBytes).digest('hex');
  console.log ("Random hash: " + registrationRandomHash);
  if (fs.existsSync(pubkey_path)) {
    const execSync = require('child_process').spawnSync;

    console.log("Your SSH key needs to get registered. Please read the privacy instructions here:");
    console.log("  https://va.fhem.de/privacy/");
    console.log("... and the press Enter to register your key.");
    let goon = readline.question("Okay to register your public SSH-Key at fhem-va.fhem.de? [Hit Enter for okay, 'n' else] ");
    if (goon !== 'n') {
      // Most likely initial SSH call: Avoid prompt for adding HostKey
      const prc = execSync(config.alexa.ssh, [
        '-o', 'StrictHostKeyChecking=no',
        '-p', 58824, 'fhem-va.fhem.de', 'register',
        'keyhash=' + registrationRandomHash], {stdio: 'pipe'});
      let registrationStatus = prc.output[1].toString();
      //console.log(registrationStatus);
      const regexp = /\s+([0-9A-F]+)-\.\./m;
      let match = regexp.exec(registrationStatus);
      const userIdProxy = match[1];
      // Search for Device MyAlexa (TYPE=alexa) and create if not existing
      const searchAlexaString = await FHEM_execute(log, conn, "jsonlist2 TYPE=alexa").catch(
        a => console.log("ERROR" + a));
      const searchAlexa = JSON.parse(searchAlexaString);
      if (searchAlexa.totalResultsReturned < 1) {
        await FHEM_execute(log, conn, "define MyAlexa alexa");
        alexaDeviceName = "MyAlexa";
      } else {
        const attrs = searchAlexa.Results[0].Attributes;
        alexaDeviceName = searchAlexa.Results[0].Name;
      }

      // Search for Device FHEM.Alexa (TYPE=dummy) and create if not existing, otherwise modify
      const FHEMAlexa = "FHEM.Alexa";
      let searchFHEMAlexaString = await FHEM_execute(log, conn, "jsonlist2 FHEM.Alexa").catch(
        a => console.log("ERROR" + a));
      let searchFHEMAlexa = JSON.parse(searchFHEMAlexaString);
      if (searchFHEMAlexa.totalResultsReturned < 1) {
        await FHEM_execute(log, conn, "define " + FHEMAlexa + " dummy");
        searchFHEMAlexaString = await FHEM_execute(log, conn, "jsonlist2 FHEM.Alexa").catch(
          a => console.log("ERROR" + a));
        searchFHEMAlexa = JSON.parse(searchFHEMAlexaString);
      }
      const readings = searchFHEMAlexa.Results[0].Readings;
        await FHEM_execute(log, conn, "attr " + FHEMAlexa + " event-on-change-reading state");
      await FHEM_execute(log, conn, "attr " + FHEMAlexa + " webCmd Start:Stop:Reload");
      await FHEM_execute(log, conn, "attr " + FHEMAlexa + " readingList skillRegistrationKey bearerToken autoStart");
      await FHEM_execute(log, conn, "delete " + FHEMAlexa + ".DOIF");
      await FHEM_execute(log, conn, "define " + FHEMAlexa + ".DOIF DOIF ([" + FHEMAlexa + "] eq \"Start\") " +
          "(set " + FHEMAlexa + " on, {system (\"" + process.argv[1] + " > /tmp/alexa.stdout.log 2>&1 &\")}) " +
          "DOELSEIF ([" + FHEMAlexa + "] eq \"Stop\") " +
          "(set " + FHEMAlexa + " off, {system (\"" + process.argv[1] + " -k > /dev/null 2>&1 &\")}) " +
          "DOELSEIF ([" + FHEMAlexa + "] eq \"Reload\") " +
          "(set " + alexaDeviceName + " reload)"
          );
      await FHEM_execute(log, conn, "define " + FHEMAlexa + ".autostart notify global:INITIALIZED.* set " + FHEMAlexa + " Start");

      // Build new registration key, if a bearer token is existing, use this one (otherwise the
      // skill has to be reregistered at Amazon).
      if (readings.hasOwnProperty('bearerToken')) {
        bearerTokenRandomBytes = Buffer.from(readings.bearerToken.Value, "hex")
      }
      registrationKey = match[1] + '-' +
        registrationRandomBytes.toString('hex').toUpperCase() + '-' +
        bearerTokenRandomBytes.toString('hex').toUpperCase();

      console.log("\r\nThis is your registration key:\r\n\r\n");
      console.log(">>>>>>>>>        " + registrationKey + "        <<<<<<<<\r\n\r\n");
      console.log("You will need it when activating the skill in the Alexa-App.\r\n" +
        "Please copy & paste it NOW to a safe place, then press Enter continue!\r\n");
      let goon = readline.question("Copied? [Hit Enter for okay, 'n' else] ");

      await FHEM_execute(log, conn, "set " + FHEMAlexa + " skillRegistrationKey " + registrationKey);
      await FHEM_execute(log, conn, "set " + FHEMAlexa + " bearerToken " +
        bearerTokenRandomBytes.toString('hex').toUpperCase());
      await FHEM_execute(log, conn, "set " + FHEMAlexa + " autoStart " + true);
      //}

      // create Alexa start/stop stuff if not yet existing
    } else {
      failmsg = "Unable to continue without a registered SSH key.\r\n";
    }

  }
//  log.info (JSON.stringify(config, null,2 ));
//  process.exit(1);
}


function buildRequest (config ) {
  return new Promise((resolve, reject) => {
      var base_url = 'http://';
      if (config.ssl) {
          if (typeof config.ssl !== 'boolean') {
              this.log.error('config: value for ssl has to be boolean.');
              process.exit(0);
          }
          base_url = 'https://';
      }
      base_url += config.server + ':' + config.port;

      if (config.webname) {
          base_url += '/' + config.webname;
      } else {
          base_url += '/fhem';
      }
      config.base_url = base_url;
      base_url += "?XHR=1";

      let request = require('request');
      const auth = config['auth'];
      let options = {};
      if (auth) {
          if (auth.sendImmediately === undefined)
              auth.sendImmediately = false;
          options = {auth: auth, rejectUnauthorized: false};
      }
      request(base_url, options, (error, response, body) => {
          if (error)
            resolve( { success: false, message: error } );
          else if (response.statusCode !== 200) {
            resolve( { success: false, httpcode: response.statusCode, message: "Invalid status code" } );
          }
          let csrftoken = undefined;
          Object.keys(response.headers).forEach((key) => {
            if (key.toLocaleLowerCase()==='x-fhem-csrftoken') {
              csrftoken = response.headers[key];
            }});
          resolve( { success: true, httpcode: 200, message: csrftoken } );
      });
  });
}

function
FHEM_execute(log,connection,cmd,callback) {
  return new Promise((resolve, reject) => {
    cmd = encodeURIComponent(cmd);
    if (csrfToken)
      cmd += '&fwcsrf=' + csrfToken;
    cmd += '&XHR=1';
    var url = connection.base_url + '?cmd=' + cmd;
    log.info('  executing: ' + url);

    let request = require('request');
    request
      .get({url: url, gzip: true},
        function (err, response, result) {
          if (!err && response.statusCode === 200) {
            result = result.replace(/[\r\n]/g, '');
            resolve(result);
          } else {
            log('There was a problem connecting to FHEM (' + url + ').');
            if (response)
              reject('  ' + response.statusCode + ': ' + response.statusMessage);
            else
              reject('Unknown problem');
          }

        })
      .on('error', function (err) {
        reject('There was a problem connecting to FHEM (' + url + '):' + err);
      });
  });
}
