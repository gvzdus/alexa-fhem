# Changelog
All notable changes to this project will be documented in this file.

## [0.5.3p2]
- Fix OpenSSH 

## [0.5.3p1]
### Added
- Experimental support for thermostat modes for HM
### Changed
- Bugfix: No crash on simple curl http://localhost:3000

## [0.5.3]
### Changed
- A ChangeLog
- Default-Configuration moved from .alexa/config.json to ~/alexa-fhem.cfg
- Process title is not changed, to see command line arguments in ps
- alexaFHEM.ProxyConnection is set to the status of the SSH connection
- some error cases handled in autoconfiguration (execution of SSH commands)
- in the response, a header X-ProcTime is set to analyse the response time 
  in the chain.
- Compression on SSH connection turned on
- winston-requirement removed from package.json

