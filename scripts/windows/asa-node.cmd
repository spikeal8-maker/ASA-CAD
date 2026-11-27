@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Project-selected runtime only. This does not alter the machine or user PATH.
set "ASA_NODE_DIR=%LOCALAPPDATA%\ASA-CAD\toolchains\node-v22.23.5-win-x64"
if not exist "%ASA_NODE_DIR%\node.exe" (
  >&2 echo ASA-CAD portable Node 22.23.5 is missing. Ask the controller to prepare the scoped toolchain.
  exit /b 127
)
set "PATH=%ASA_NODE_DIR%;%PATH%"
"%ASA_NODE_DIR%\node.exe" %*
exit /b %ERRORLEVEL%
