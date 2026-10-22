@echo off
REM Compila ExtraerVentasImprimete.exe (32 bits, el driver de A2 es de 32 bits).
REM Resultado: scripts\dist\ con el .exe, el config de ejemplo y los .bat de prueba.
REM Se corre en una PC de desarrollo con Python 32 bits; la tienda no necesita Python.
cd /d "%~dp0"
py -3-32 -m pip install --upgrade pyinstaller pyodbc || goto error
py -3-32 -m PyInstaller --onefile --console --clean --name ExtraerVentasImprimete ^
  --distpath dist --workpath build --specpath build extraer_ventas.py || goto error
copy /y config_ventas.ejemplo.ini dist\ >nul
copy /y tienda\*.bat dist\ >nul
echo.
echo Listo: copia la carpeta scripts\dist a la PC de la tienda.
pause
exit /b 0
:error
echo.
echo ERROR compilando. Revisa el mensaje de arriba.
pause
exit /b 1
