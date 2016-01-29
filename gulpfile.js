/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * Represents the gulp configuration file
 * @author TCDEVELOPER
 * @version 1.0
 *
 */
var gulp = require('gulp');
var jshint = require('gulp-jshint');

gulp.task('lint', function() {
    return gulp.src(['controllers/**/*.js','services/**/*.js','helpers/**/*.js','test_files/**/*.js','*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('default', ['lint']);
