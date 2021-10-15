set "origin=%cd%"
cd %1
del /F /Q *.*
robocopy "%origin%/dist" %1 *.*
git add -A
git commit -m "publish"
git push