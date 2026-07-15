@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title The Endless Lease - GitHub Sync

set "PROJECT_NAME=The Endless Lease"
set "REPO_URL=https://github.com/index7777/The-Endless-Lease.git"
set "NPM_CACHE=%CD%\.npm-cache"

call :find_tools || goto fatal
call :ensure_repo || goto fatal
goto menu

:find_tools
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git for Windows was not found.
  exit /b 1
)

set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if defined NODE_EXE (
  for %%D in ("!NODE_EXE!") do set "NODE_DIR=%%~dpD"
  set "PATH=!NODE_DIR!;!PATH!"
  for /f "tokens=1 delims=." %%V in ('node -p process.versions.node 2^>nul') do set "NODE_MAJOR=%%V"
)
if not defined NODE_MAJOR set "NODE_MAJOR=0"

if !NODE_MAJOR! LSS 22 (
  set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if exist "!CODEX_NODE!" (
    set "NODE_EXE=!CODEX_NODE!"
    for %%D in ("!NODE_EXE!") do set "NODE_DIR=%%~dpD"
    set "PATH=!NODE_DIR!;!PATH!"
    for /f "tokens=1 delims=." %%V in ('node -p process.versions.node 2^>nul') do set "NODE_MAJOR=%%V"
  )
)

if !NODE_MAJOR! LSS 22 (
  echo [ERROR] %PROJECT_NAME% requires Node.js 22.13 or newer.
  echo Install Node.js 22 LTS or newer and run this file again.
  exit /b 1
)

set "NPM_CLI=%ProgramFiles%\nodejs\node_modules\npm\bin\npm-cli.js"
if not exist "!NPM_CLI!" (
  for /f "delims=" %%N in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%N"
  if not defined NPM_CMD (
    echo [ERROR] npm was not found.
    exit /b 1
  )
)
exit /b 0

:ensure_repo
if exist ".git\HEAD" goto ensure_remote

if exist ".git" rmdir /s /q ".git"
echo Initializing local Git repository...
git init || exit /b 1
git branch -M main || exit /b 1

:ensure_remote
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REPO_URL%" || exit /b 1
) else (
  for /f "delims=" %%R in ('git remote get-url origin') do set "CURRENT_REMOTE=%%R"
  if /i not "!CURRENT_REMOTE!"=="%REPO_URL%" (
    echo Updating origin to %REPO_URL%
    git remote set-url origin "%REPO_URL%" || exit /b 1
  )
)
exit /b 0

:menu
cls
echo =====================================================
echo   %PROJECT_NAME% - A/B Computer Sync
echo   Folder: %CD%
echo   Remote: %REPO_URL%
echo =====================================================
echo   FIRST COMPUTER: use [2] to make the first push.
echo   OTHER COMPUTER: clone the repo once, then use [1].
echo =====================================================
echo   [1] Start work  - pull latest, then install packages
echo   [2] Finish work - commit and push changes
echo   [3] Status      - branch, changes, Node, node_modules
echo   [4] Install dependencies only
echo   [0] Exit
echo =====================================================
set /p "CHOICE=Choose: "

if "%CHOICE%"=="1" goto start_work
if "%CHOICE%"=="2" goto finish_work
if "%CHOICE%"=="3" goto status
if "%CHOICE%"=="4" goto install_deps
if "%CHOICE%"=="0" goto end
goto menu

:start_work
echo.
echo [1/3] Checking local changes...
for /f %%C in ('git status --porcelain 2^>nul ^| find /c /v ""') do set "CHANGE_COUNT=%%C"
if not "!CHANGE_COUNT!"=="0" (
  echo [STOP] This computer has local changes. Nothing was pulled.
  git status --short
  echo Use option 2 first, or resolve these files manually.
  pause
  goto menu
)

echo [2/3] Pulling latest remote main...
git fetch origin || goto git_failed
git show-ref --verify --quiet refs/remotes/origin/main
if errorlevel 1 (
  echo Remote main does not exist yet. Use option 2 on the first computer.
  pause
  goto menu
)
git pull --ff-only origin main || (
  echo [STOP] Fast-forward pull was not possible. No files were overwritten.
  echo Review the branch history manually.
  pause
  goto menu
)

echo [3/3] Checking dependencies...
call :install_packages || goto npm_failed
echo.
echo Ready. You can start work on this computer.
pause
goto menu

:finish_work
echo.
git status --short
echo.
set "MSG=Sync The Endless Lease"
echo Commit description is automatic: !MSG!

git add -A || goto git_failed
git diff --cached --quiet
if not errorlevel 1 (
  echo Nothing to commit.
) else (
  git commit -m "%MSG%" || goto git_failed
)

git fetch origin || goto git_failed
git show-ref --verify --quiet refs/remotes/origin/main
if not errorlevel 1 (
  git pull --rebase origin main || (
    echo [STOP] Rebase requires manual conflict resolution.
    pause
    goto menu
  )
)

git push -u origin main || goto git_failed
echo.
echo Finished. On the other computer, use option 1 before editing.
pause
goto menu

:status
echo.
git status --short --branch
echo.
git remote -v
echo.
"%NODE_EXE%" --version
if exist "node_modules" (echo node_modules: present) else (echo node_modules: missing)
pause
goto menu

:install_deps
call :install_packages || goto npm_failed
echo Dependencies installed successfully.
pause
goto menu

:install_packages
if not exist "package-lock.json" (
  echo [ERROR] package-lock.json is missing.
  exit /b 1
)
if exist "node_modules" (
  call :run_npm install
) else (
  call :run_npm ci
)
exit /b !ERRORLEVEL!

:run_npm
if exist "%NPM_CLI%" (
  "%NODE_EXE%" "%NPM_CLI%" %* --cache "%NPM_CACHE%"
) else (
  call "%NPM_CMD%" %* --cache "%NPM_CACHE%"
)
exit /b !ERRORLEVEL!

:git_failed
echo.
echo [ERROR] Git operation failed.
echo Sign in through Git Credential Manager if GitHub asks for access.
pause
goto menu

:npm_failed
echo.
echo [ERROR] Dependency installation failed.
echo Verify write access, Node.js 22.13+, and network access.
pause
goto menu

:fatal
echo.
echo Setup could not continue.
pause

:end
endlocal
