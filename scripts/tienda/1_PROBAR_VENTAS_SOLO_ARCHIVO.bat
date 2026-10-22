@echo off
REM Prueba: lee las ventas de A2 y guarda el JSON en exportaciones\, SIN enviar nada.
REM Para uso manual. El Programador de tareas llama al .exe directo, sin este .bat.
cd /d "%~dp0"
ExtraerVentasImprimete.exe --solo-archivo
echo.
echo Codigo de salida: %ERRORLEVEL%  (0 = bien, 1 = error, 2 = sin ventas)
echo El detalle queda en la carpeta logs\
pause
