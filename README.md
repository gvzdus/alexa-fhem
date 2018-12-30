
Voraussetzungen:
 - Posix/Linux-System (getestet auf jessie-Raspbian)
 - nodejs, getestet auf 8.15.0
 - FHEM-Config bitte sichern, wird bei der Installation veraendert
 - Alexa-FHEM muss unter dem gleichen Nutzer wie FHEM laufen

1. alexa-fhem installieren, vorzugsweise unterhalb des Homedir von
  FHEM (/opt/fhem ?), z.B. durch "git clone https://github.com/gvzdus/alexa-fhem"

2. ALS FHEM-User bin/alexa -A aufrufen, also z.B.:
  sudo -u fhem /opt/fhem/bin/alexa -A

3. Durch die Fragen mit Return durchklackern, aber bitte lesen

4. Ein paar Devices, die gesteuert werden sollen, ein Attribut
  "alexaName" zuweisen, das ist der Name, auf den der Echo
   reagiert.

5. In FHEM im Web das ggf. neu angelegte Device MyAlexa oeffnen
   und auf "Start" klicken

6. Waehrend der beta-Testphase: Bei gvz-fhem@garnix.de nach einer
  Einladung zum Testen fragen, hierbei bitte pruefen, ob die bei
  Amazon verwendete Email-Adresse mit der eigenen Absenderadresse
  identisch ist, sonst wird das nichts.

7. Am besten im Web unter "alexa.amazon.com" anmelden und den
   Skill "FHEMlazy" hinzufuegen. 

8. Jetzt das Secret angeben, dass unter Attribute als "skillSecret"
   beim Alexa-Device zu finden ist

9. Im Gutfall ist auf der folgenden Pruefseite alles gruen, und
   es wurden sogar schon die Geraete mit alexaName gefunden.

10. Weiter klicken, und fertig.
