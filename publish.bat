REM Copy build content
robocopy "./dist" %1/vim-webgl-viewer *.* /MIR

REM Push to github pages
cd %1
git add -A
git commit -m "publish"
git push