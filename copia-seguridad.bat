@echo off
REM ---------------------------------------------------------------
REM  Copia de seguridad de la base de datos de Kairos.
REM  Pensado para el Programador de tareas de Windows (una vez al dia).
REM
REM  Deja el resultado en backups\ultima-copia.log, para poder mirar si
REM  alguna noche fallo en vez de enterarse el dia que hace falta la copia.
REM ---------------------------------------------------------------
cd /d "%~dp0"
echo. >> backups\ultima-copia.log
echo ===== %date% %time% ===== >> backups\ultima-copia.log
node backend\scripts\backup.js >> backups\ultima-copia.log 2>&1
