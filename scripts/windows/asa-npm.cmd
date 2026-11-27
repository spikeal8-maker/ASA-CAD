@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Use npm.cmd on Windows without changing PowerShell execution policy.
set "ASA_NODE_DIR=%LOCALAPPDATA%\ASA-CAD\toolchains\node-v22.23.5-win-x64"
if not exist "%ASA_NODE_DIR%\node.exe" (
  >&2 echo ASA-CAD portable Node 22.23.5 is missing. Global Node fallback is not allowed.
  exit /b 127
)
if not exist "%ASA_NODE_DIR%\npm.cmd" (
  >&2 echo ASA-CAD portable Node 22.23.5 is missing. Ask the controller to prepare the scoped toolchain.
  exit /b 127
)
set "PATH=%ASA_NODE_DIR%;%PATH%"
call "%ASA_NODE_DIR%\npm.cmd" %*
exit /b %ERRORLEVEL%
