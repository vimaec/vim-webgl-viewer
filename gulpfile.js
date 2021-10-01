// https://gulpjs.com/
// https://github.com/gulpjs/gulp
// https://stackoverflow.com/questions/24591854/using-gulp-to-concatenate-and-uglify-files
// https://stackoverflow.com/questions/22115400/why-do-we-need-to-install-gulp-globally-and-locally
// https://css-tricks.com/gulp-for-beginners/
// https://github.com/mrdoob/three.js/wiki/Build-instructions

const gulp = require('gulp'),
    gp_concat = require('gulp-concat'),
    gp_rename = require('gulp-rename'),
    gp_uglify = require('gulp-uglify-es').default;

const srcFiles = [
    // dependenciees
    'node_modules/dat.gui/build/dat.gui.js',
    'node_modules/three/build/three.js',
    'node_modules/three/examples/js/libs/stats.min.js',
    'node_modules/three/examples/js/utils/BufferGeometryUtils.js',
    
    //vim code
    'deep_merge.js',
    'viewer.js',
    'viewer_camera.js',
    'viewer_gui.js',
    'viewer_input.js',
    'viewer_settings.js',
    'VIMLoader.js',
];

gulp.task('build', function(){
    return gulp.src(srcFiles)
        .pipe(gp_concat('vim-webgl-viewer.js', {
            newLine:'\n;' // the newline is needed in case the file ends with a line comment, the semi-colon is needed if the last statement wasn't terminated
        }))       
        .pipe(gulp.dest('public'));
});

gulp.task('dist', function(){
    return gulp.src(srcFiles)
        .pipe(gp_concat('vim-webgl-viewer.js', {
            newLine:'\n;' // the newline is needed in case the file ends with a line comment, the semi-colon is needed if the last statement wasn't terminated
        }))
        .pipe(gulp.dest('public'))
        .pipe(gp_rename('vim-webgl-viewer.min.js'))
        .pipe(gp_uglify())
        .pipe(gulp.dest('public'));
});

gulp.task('watch', function() {
    gulp.watch(srcFiles, gulp.series('build'));
});

