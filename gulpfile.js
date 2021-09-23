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
    'index.js',
    'node_modules/dat.gui/build/dat.gui.js',
    'node_modules/three/build/three.js',
    'node_modules/three/examples/js/libs/stats.min.js',
    'node_modules/three/examples/js/utils/BufferGeometryUtils.js',
    'node_modules/three/examples/js/loaders/FBXLoader.js',
    'node_modules/three/examples/js/loaders/ColladaLoader.js',
    'node_modules/three/examples/js/loaders/GCodeLoader.js',
    'node_modules/three/examples/js/loaders/GLTFLoader.js',
    'node_modules/three/examples/js/loaders/OBJLoader.js',
    'node_modules/three/examples/js/loaders/PCDLoader.js',
    'node_modules/three/examples/js/loaders/PDBLoader.js',
    'node_modules/three/examples/js/loaders/PLYLoader.js',
    'node_modules/three/examples/js/loaders/STLLoader.js',
    'node_modules/three/examples/js/loaders/TDSLoader.js',
    'node_modules/three/examples/js/loaders/MTLLoader.js',
    //'node_modules/three/examples/js/controls/FirstPersonControls.js',
    //'node_modules/three/examples/js/controls/PointerLockControls.js',
    //'CustomOrbitControls.js', 
    //'CameraControls.js',
    'VimLoader.js',
	'DeepMerge.js'
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

