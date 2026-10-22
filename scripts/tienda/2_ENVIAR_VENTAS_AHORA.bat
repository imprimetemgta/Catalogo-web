@echo off
REM Envia las ventas al catalogo ahora mismo (lo mismo que hace la tarea programada).
cd /d "%~dp0"
ExtraerVentasImprimete.exe
echo.
echo Codigo de salida: %ERRORLEVEL%  (0 = bien, 1 = error, 2 = sin ventas)
echo El detalle queda en la carpeta logs\
pause
