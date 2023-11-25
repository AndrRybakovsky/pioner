import gulp from 'gulp';
const { src, dest, series, watch } = gulp;

import path from 'path';
import {deleteAsync} from 'del';
import fs from 'fs';
import fonter from 'gulp-fonter-fix';
import ttf2woff2 from 'gulp-ttf2woff2';
import svgSprite from 'gulp-svg-sprite';
import svgmin from 'gulp-svgmin';
import cheerio from 'gulp-cheerio';
import replace from 'gulp-replace';
import imagemin, {mozjpeg, optipng} from 'gulp-imagemin';
import webp from 'gulp-webp';
import changed from 'gulp-changed';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
const sass = gulpSass(dartSass);
import cleanCss from 'gulp-clean-css';
import autoprefixer from 'autoprefixer';
import postCss from 'gulp-postcss';
import webpack from 'webpack';
import webpackStream from 'webpack-stream';
import fileinclude from 'gulp-file-include';
import htmlmin from 'gulp-htmlmin';
import gulpif from 'gulp-if';
import zipListener from 'gulp-zip';
import { create as browserSyncCreate } from 'browser-sync';
const browserSync = browserSyncCreate();

// Variables
const srcFolder = './src';
const buildFolder = './dist';

const srcPaths = {
  srcFontsFolder: `${srcFolder}/fonts`,
  srcFontFacesFile: `${srcFolder}/scss/_fonts.scss`,
  srcResourcesFolder: `${srcFolder}/resources`,
  srcSvgSpritesFolder: `${srcFolder}/img/svg/**.svg`,
  srcImagesFolder: `${srcFolder}/img`,
  srcScssFolder: `${srcFolder}/scss/**/*.scss`,
  srcMainJsFileFolder: `${srcFolder}/js/main.js`,
  srcFullJsFolder: `${srcFolder}/js/**/*.js`,
  srcHtmlFolder: `${srcFolder}/partials`,
};

const buildPaths = {
  buildFontsFolder: `${buildFolder}/fonts`,
  buildImagesFolder: `${buildFolder}/img/`,
  buildCssFolder: `${buildFolder}/css`,
  buildJsFolder: `${buildFolder}/js`,
};

const rootFolder = path.basename(path.resolve());

let isProd = false;

// Clean build folder
const clean = () => {
  return deleteAsync([buildFolder])
}

// Fonts
const italicRegex = /italic/i;
const cleanSeparator = /(?:_|__|-|\s)?(italic)/i;

const fontWeights = {
	thin: 100,
	hairline: 100,
	extralight: 200,
	ultralight: 200,
	light: 300,
	regular: 400,
	medium: 500,
	semibold: 600,
	demibold: 600,
	bold: 700,
	extrabold: 800,
	ultrabold: 800,
	black: 900,
	heavy: 900,
	extrablack: 950,
	ultrablack: 950
};

const fontFaceTemplate = (name, file, weight, style) => `@font-face {
	font-family: ${name};
	font-display: swap;
	src: url("../fonts/${file}.woff2") format("woff2");
	font-weight: ${weight};
	font-style: ${style};
}\n`;

const otfToTtf = () => {
  return src(`${srcPaths.srcFontsFolder}/*otf`, {})
    .pipe(fonter({formats: ['ttf']}))
    .pipe(dest(srcPaths.srcFontsFolder))
}

const ttfToWoff = () => {
  return src(`${srcPaths.srcFontsFolder}/*ttf`, {})
    .pipe(ttf2woff2())
    .pipe(dest(srcPaths.srcFontsFolder))
    .pipe(src(`${srcPaths.srcFontsFolder}/*.{woff,woff2}`))
		.pipe(dest(buildPaths.buildFontsFolder));
}

const fontStyle = async () => {
    const fontFiles = await fs.promises.readdir(buildPaths.buildFontsFolder);
    await fs.promises.writeFile(srcPaths.srcFontFacesFile, '');
    let newFileOnly;
    for (const file of fontFiles) {
			const [fileName] = file.split('.');

			if (newFileOnly !== fileName) {
				const [name, weight = 'regular'] = fileName.split('-');
				const weightString = fontWeights[weight.replace(cleanSeparator, '').toLowerCase()];
				const fontStyle = italicRegex.test(fileName) ? 'italic' : 'normal';

				await fs.promises.appendFile(srcPaths.srcFontFacesFile, fontFaceTemplate(name, fileName, weightString, fontStyle));
				newFileOnly = fileName;
			}
		}
};

// Replace resources
const resources = () => {
  return src(`${srcPaths.srcResourcesFolder}/**`)
    .pipe(dest(buildFolder))
}

// Replace svg
const replaceSvg = () => {
  return src(`${srcPaths.srcImagesFolder}/**.svg`)
    .pipe(dest(buildPaths.buildImagesFolder))
}

// Svg Sprites
const svgSprites = () => {
  return src(srcPaths.srcSvgSpritesFolder)
    .pipe(
      svgmin({
        js2svg: {
          pretty: true,
        },
      })
    )
    .pipe(
      cheerio({
        run: function ($) {
          $('[fill]').removeAttr('fill');
          $('[stroke]').removeAttr('stroke');
          $('[style]').removeAttr('style');
        },
        parserOptions: {
          xmlMode: true
        },
      })
    )
    .pipe(replace('&gt;', '>'))
    .pipe(svgSprite({
      mode: {
        stack: {
          sprite: "../sprite.svg"
        }
      },
    }))
    .pipe(dest(buildPaths.buildImagesFolder));
}

// Images
const images = () => {
  return src([`${srcPaths.srcImagesFolder}/**/**.{jpg,jpeg,png}`])
    .pipe(changed(buildPaths.buildImagesFolder))
    .pipe(imagemin([
      mozjpeg({ quality: 80, progressive: true }),
      optipng({ optimizationLevel: 2 }),
    ]))
    .pipe(dest(buildPaths.buildImagesFolder))
};

// WebP
const webpImages = () => {
  return src([`${srcPaths.srcImagesFolder}/**/**.{jpg,jpeg,png}`])
    .pipe(changed(buildPaths.buildImagesFolder, { extension: '.webp' }))
    .pipe(webp())
    .pipe(dest(buildPaths.buildImagesFolder))
};

// Styles
const styles = () => {
  return src(srcPaths.srcScssFolder, { sourcemaps: !isProd })
    .pipe(sass())
    .pipe(postCss([
      autoprefixer({
        cascade: false,
        grid: true,
      })
    ]))
    .pipe(gulpif(isProd, cleanCss({
      level: 2
    })))
    .pipe(dest(buildPaths.buildCssFolder, { sourcemaps: '.' }))
    .pipe(browserSync.stream());
}

// Js
const scripts = () => {
  return src(srcPaths.srcMainJsFileFolder)
    .pipe(webpackStream({
      mode: isProd ? 'production' : 'development',
      output: {
        filename: 'main.js',
      },
      module: {
        rules: [{
          test: /\.m?js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: "defaults"
                }]
              ]
            }
          }
        }]
      },
      devtool: !isProd ? 'source-map' : false
    }))
    .on('error', function (err) {
      console.error('WEBPACK ERROR', err);
      this.emit('end');
    })
    .pipe(dest(buildPaths.buildJsFolder))
    .pipe(browserSync.stream());
}

// Html
const htmlInclude = () => {
  return src([`${srcFolder}/*.html`])
  .pipe(fileinclude({
    prefix: '@',
    basepath: '@file'
  }))
  .pipe(dest(buildFolder))
  .pipe(browserSync.stream());
}

const htmlMinify = () => {
  return src(`${buildFolder}/**/*.html`)
    .pipe(htmlmin({
      collapseWhitespace: true
    }))
    .pipe(dest(buildFolder));
}

// Watch files
const watchFiles = () => {
  browserSync.init({
    server: {
      baseDir: `${buildFolder}`
    },
  });

  watch(`${srcPaths.srcResourcesFolder}/**`, resources);
  watch(`${srcPaths.srcImagesFolder}/**/**.svg`, replaceSvg);
  watch(srcPaths.srcSvgSpritesFolder, svgSprites);
  watch(`${srcPaths.srcImagesFolder}/**/**.{jpg,jpeg,png}`, images);
  watch(`${srcPaths.srcImagesFolder}/**/**.{jpg,jpeg,png}`, webpImages);
  watch(srcPaths.srcScssFolder, styles);
  watch(srcPaths.srcFullJsFolder, scripts);
  watch(`${srcPaths.srcHtmlFolder}/*.html`, htmlInclude);
  watch(`${srcFolder}/*.html`, htmlInclude);
}

// Zip
const zipFiles = async (done) => {
  await deleteAsync([`${buildFolder}/*.zip`]);
  return src(`${buildFolder}/**/*.*`, {})
    .pipe(zipListener(`${rootFolder}.zip`))
    .pipe(dest(buildFolder))
};

const toProd = (done) => {
  isProd = true;
  done();
};

export default series(clean, otfToTtf, ttfToWoff, fontStyle, resources, replaceSvg, svgSprites, images, webpImages, styles, scripts, htmlInclude, watchFiles);
export const build = series(toProd, clean, otfToTtf, ttfToWoff, fontStyle, resources, replaceSvg, svgSprites, images, webpImages, styles, scripts, htmlInclude, htmlMinify);
export const zip = zipFiles;
