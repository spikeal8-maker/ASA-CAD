@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Exploratory browser CLI; repository Playwright remains the regression harness.
set "ASA_NODE_DIR=%LOCALAPPDATA%\ASA-CAD\toolchains\node-v22.23.5-win-x64"
set "ASA_BROWSER_CLI=%LOCALAPPDATA%\ASA-CAD\playwright-cli\0.1.25\node_modules\@playwright\cli\playwright-cli.js"
if not exist "%ASA_NODE_DIR%\node.exe" (
  >&2 echo ASA-CAD portable Node 22.23.5 is missing.
  exit /b 127
)
if not exist "%ASA_BROWSER_CLI%" (
  >&2 echo ASA-CAD Playwright CLI 0.1.25 is missing. Ask the controller to prepare the scoped toolchain.
  exit /b 127
)
set "PATH=%ASA_NODE_DIR%;%PATH%"
"%ASA_NODE_DIR%\node.exe" "%ASA_BROWSER_CLI%" %*
exit /b %ERRORLEVEL%
