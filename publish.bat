REM set "origin=%cd%"
REM cd %1
REM del /F /Q *.*
robocopy "./dist" %1 *.* /MIR
git add -A
git commit -m "publish"
git push