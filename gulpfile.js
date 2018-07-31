// https://gulpjs.com/
// https://github.com/gulpjs/gulp
// https://stackoverflow.com/questions/24591854/using-gulp-to-concatenate-and-uglify-files
// https://stackoverflow.com/questions/22115400/why-do-we-need-to-install-gulp-globally-and-locally
// https://css-tricks.com/gulp-for-beginners/
// https://github.com/mrdoob/three.js/wiki/Build-instructions

const gulp = require('gulp'),
    gp_concat = require('gulp-concat'),
    gp_rename = require('gulp-rename'),
    gp_uglify = require('gulp-uglify');

const srcFiles = [
    'index.js',
    'node_modules/three/build/three.js',
    'node_modules/three/examples/controls/OrbitControls.js', 
    'node_modules/three/examples/loaders/FBXLoader.js',
    'node_modules/three/examples/loaders/ColladaLoader.js',
    'node_modules/three/examples/loaders/GCodeLoader.js',
    'node_modules/three/examples/loaders/GLTFLoader.js',
    'node_modules/three/examples/loaders/OBJLoader.js',
    'node_modules/three/examples/loaders/PCDLoader.js',
    'node_modules/three/examples/loaders/PDBLoader.js',
    'node_modules/three/examples/loaders/PLYLoader.js',
    'node_modules/three/examples/loaders/STLLoader.js',
    'node_modules/three/examples/loaders/TDSLoader.js',
];

gulp.task('build', function(){
    return gulp.src(srcFiles)
        .pipe(gp_concat('concat.js'))
        .pipe(gulp.dest('dist'))
        .pipe(gp_rename('ara-viewer.js'))
        .pipe(gp_uglify())
        .pipe(gulp.dest('dist'));
});

gulp.task('watch', function() {
    gulp.watch(srcFiles, ['build']);
  });

gulp.task('default', ['watch', 'build'], function(){});