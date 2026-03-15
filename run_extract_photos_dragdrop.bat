@echo off
setlocal

REM Sleep een PDF op dit .bat-bestand.
REM Vereist in dezelfde map:
REM - extract_photos.py
REM - students.csv
REM Python moet geïnstalleerd zijn.

set "APPDIR=%~dp0"
set "SCRIPT=%APPDIR%extract_photos.py"
set "CSV=%APPDIR%students.csv"
set "TARGETPDF=%APPDIR%Klaslijst.pdf"

if "%~1"=="" (
    echo.
    echo Geen PDF opgegeven.
    echo Sleep een PDF-bestand op dit .bat-bestand.
    echo.
    pause
    exit /b 1
)

if not exist "%~1" (
    echo.
    echo Bestand niet gevonden:
    echo %~1
    echo.
    pause
    exit /b 1
)

if /I not "%~x1"==".pdf" (
    echo.
    echo Dit is geen PDF-bestand:
    echo %~1
    echo.
    pause
    exit /b 1
)

if not exist "%SCRIPT%" (
    echo.
    echo extract_photos.py niet gevonden in:
    echo %APPDIR%
    echo.
    pause
    exit /b 1
)

if not exist "%CSV%" (
    echo.
    echo students.csv niet gevonden in:
    echo %APPDIR%
    echo.
    pause
    exit /b 1
)

echo.
echo Kopieer PDF naar:
echo %TARGETPDF%
copy /Y "%~1" "%TARGETPDF%" >nul
if errorlevel 1 (
    echo Kopieren van de PDF is mislukt.
    echo.
    pause
    exit /b 1
)

echo.
echo Start extractie...
echo.
python "%SCRIPT%"
if errorlevel 1 (
    echo.
    echo Het script gaf een fout.
    echo Controleer of Python en PyMuPDF correct geinstalleerd zijn.
    echo pip install pymupdf
    echo.
    pause
    exit /b 1
)

echo.
echo Klaar.
pause
